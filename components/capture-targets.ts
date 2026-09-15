"use client";

import { docToText, previewOf, type JNode } from "@/lib/doc-model";
import { journalApi, journalCache, pendingDraftDates } from "@/lib/journal-client";
import { notesApi, notesStore } from "@/lib/notes-client";
import { metaOf } from "./notes/actions";

/**
 * Where Capture can put a thought besides a task: a new page in Notes, or a
 * line on today's journal page. Each answers with what happened, in a word,
 * so the capture box can say it in a sentence.
 */

export type CaptureResult =
  | { ok: true; href: string }
  | { ok: false; kind: "offline" | "locked" | "draft" | "error" };

const paragraph = (text: string): JNode => ({ type: "paragraph", content: [{ type: "text", text }] });

/** A title from what was said: the first sentence, or its first words when that runs long. */
export function titleFrom(text: string): { title: string; rest: string } {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentence = /^(.{1,90}?[.!?])(\s|$)/.exec(clean);
  if (clean.length <= 80) return { title: clean.replace(/[.!?]+$/, ""), rest: "" };
  if (sentence) return { title: sentence[1].replace(/[.!?]+$/, ""), rest: clean.slice(sentence[1].length).trim() };
  const cut = clean.slice(0, 80).replace(/\s+\S*$/, "");
  return { title: `${cut}…`, rest: clean };
}

/** A new page in Notes. A short thought is the page's title; a longer one also becomes its first paragraph. */
export async function captureNote(text: string): Promise<CaptureResult> {
  const { title, rest } = titleFrom(text);
  const r = await notesApi.create({ title, doc: { type: "doc", content: [rest ? paragraph(rest) : { type: "paragraph" }] } });
  if (!r.ok) return { ok: false, kind: r.kind === "offline" ? "offline" : "error" };
  notesStore.upsert(metaOf(r.data.page));
  return { ok: true, href: `/notes/${r.data.page.id}` };
}

const hhmm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/**
 * A line on today's journal page, under the time it was written, the way
 * coming back to the page later in the day marks it. Writing still unsaved on
 * this device is never raced: the page is opened instead.
 */
export async function captureJournalLine(text: string, today: string, userId: string): Promise<CaptureResult> {
  if (pendingDraftDates(userId).includes(today)) return { ok: false, kind: "draft" };
  const got = await journalApi.get(today);
  if (!got.ok) return { ok: false, kind: got.kind === "locked" ? "locked" : got.kind === "offline" ? "offline" : "error" };
  let current = got.data.entry;
  for (let attempt = 0; attempt < 2; attempt++) {
    const existing = (current?.doc.content ?? []).filter((n) => !(n.type === "paragraph" && !n.content?.length));
    const doc: JNode = {
      type: "doc",
      content: [...existing, ...(existing.length ? [{ type: "entryTime", attrs: { time: hhmm() } }] : []), paragraph(text.trim())],
    };
    const r = await journalApi.save(today, { title: current?.title ?? "", doc, mood: current?.mood ?? null, baseVersion: current?.version ?? 0 });
    if (r.ok) {
      if (r.data.entry) journalCache.put(today, r.data.entry, previewOf(docToText(r.data.entry.doc)));
      return { ok: true, href: `/journal/${today}` };
    }
    if (r.kind === "conflict" && attempt === 0) {
      current = r.current;
      continue;
    }
    return { ok: false, kind: r.kind === "locked" ? "locked" : r.kind === "offline" ? "offline" : "error" };
  }
  return { ok: false, kind: "error" };
}
