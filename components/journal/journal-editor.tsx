"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import { Focus, Placeholder } from "@tiptap/extensions";
import type { Task } from "@/lib/types";
import { addDays, localDayOf } from "@/lib/dates";
import { track } from "@/lib/analytics-client";
import { getSpeechRecognition, type SpeechRec } from "@/lib/speech";
import {
  countWords,
  docToText,
  EMPTY_DOC,
  entryToMarkdown,
  isEmptyPage,
  longDate,
  MOODS,
  previewOf,
  type JNode,
  type JournalEntry,
  type Mood,
} from "@/lib/journal-shared";
import {
  clearDraft,
  journalApi,
  journalCache,
  readDraft,
  writeDraft,
  type Draft,
  type Result,
} from "@/lib/journal-client";
import { hiddenListIds, useApp } from "../store";
import { navigateApp } from "../app-views";
import { Modal } from "../ui";
import { AutoStamp, Callout, createSlashStore, EntryTime, SlashCommand, type SlashItem } from "./extensions";
import { buildSlashItems, filterSlash, nowHHMM, SelectionBubble, SlashMenu, WritingDock } from "./menus";
import { JournalLockGate } from "./lock-gate";
import { promptFor } from "./prompts";

/* ------------------------------------------------------------------ types */

type Page = { title: string; doc: JNode; mood: Mood | null };

type Loaded = {
  /** What the server holds, or null for an unwritten day. */
  server: JournalEntry | null;
  /** What the editor opens with — the server page, or unsynced local work. */
  page: Page;
  baseVersion: number;
  /** True when the page opened with local work that still needs saving. */
  unsynced: boolean;
};

type Conflict = { theirs: JournalEntry | null; mine: Page };

type SaveState = "saved" | "dirty" | "saving" | "offline" | "error" | "conflict";

type Font = "sans" | "serif" | "mono";
const FONT_KEY = "kairo-journal-font";

/* ---------------------------------------------------------------- helpers */

function samePage(a: Page, b: Page): boolean {
  return a.title === b.title && a.mood === b.mood && JSON.stringify(a.doc) === JSON.stringify(b.doc);
}

function pageOf(entry: JournalEntry | null): Page {
  return entry ? { title: entry.title, doc: entry.doc, mood: entry.mood } : { title: "", doc: EMPTY_DOC, mood: null };
}

/**
 * What was finished in Kairo on a given day, as lines for the page. Recent
 * days are already in the store; older ones come from the Log. Anything in a
 * locked list stays out — a PIN on a list must not be undone by a journal.
 */
async function winsFor(date: string, tasks: Record<string, Task>, hidden: Set<string>, today: string): Promise<string[]> {
  const found = new Map<string, string>();
  const take = (t: Task) => {
    if (t.listId && hidden.has(t.listId)) return;
    if (t.status === "done" && t.completedAt && localDayOf(t.completedAt) === date) found.set(t.id, t.title);
    for (const st of t.subtasks) {
      if (st.done && st.doneAt && localDayOf(st.doneAt) === date) found.set(`${t.id}:${st.id}`, `${st.title} (${t.title})`);
    }
  };
  for (const t of Object.values(tasks)) take(t);

  // the store holds three days of finished work; past that, ask the Log
  if (date < addDays(today, -2)) {
    const [y, m, d] = date.split("-").map(Number);
    const before = new Date(y, m - 1, d + 1).toISOString();
    try {
      const res = await fetch(`/api/log?limit=200&before=${encodeURIComponent(before)}`);
      if (res.ok) {
        const { tasks: older } = (await res.json()) as { tasks: Task[] };
        for (const t of older) take(t);
      }
    } catch {
      /* offline: the page just doesn't get them */
    }
  }
  return [...found.values()];
}

/* ---------------------------------------------------------- orchestrator */

/**
 * One day's page: loading it, reconciling it with anything left on this
 * device, and resolving the rare case where two devices wrote at once.
 *
 * The writing surface itself lives in PageSurface, keyed by day and by
 * "generation" — resolving a conflict remounts it with the chosen text rather
 * than trying to patch a live editor from outside, which is where editors lose
 * the undo history, the caret, and occasionally the words.
 */
export function JournalEditor({ date }: { date: string }) {
  const { state } = useApp();
  const userId = state.user.id;
  const today = state.today;

  const [status, setStatus] = useState<"loading" | "ready" | "locked" | "offline-empty">("loading");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [generation, setGeneration] = useState(0);
  const [reload, setReload] = useState(0);

  // tomorrow's page can't be written yet — the address bar is not a time machine
  const future = date > today;
  useEffect(() => {
    if (future) navigateApp(`/journal/${today}`);
  }, [future, today]);

  useEffect(() => {
    if (future) return;
    let cancelled = false;
    journalApi.get(date).then((r) => {
      if (cancelled) return;
      const draft = readDraft(userId, date);

      if (!r.ok) {
        if (r.kind === "locked") {
          setStatus("locked");
          return;
        }
        // offline or failing: local work on this device is still the page
        if (draft) {
          setLoaded({ server: null, page: draft, baseVersion: draft.baseVersion, unsynced: true });
          setStatus("ready");
        } else {
          setStatus("offline-empty");
        }
        return;
      }

      const server = r.data.entry;
      const serverVersion = server?.version ?? 0;
      const serverPage = pageOf(server);

      if (draft && !samePage(draft, serverPage)) {
        if (draft.baseVersion === serverVersion) {
          // edits that never reached the server, on top of exactly this version
          setLoaded({ server, page: draft, baseVersion: serverVersion, unsynced: true });
        } else {
          // the page moved on elsewhere after this device's edits began
          setLoaded({ server, page: serverPage, baseVersion: serverVersion, unsynced: false });
          setConflict({ theirs: server, mine: draft });
        }
      } else {
        if (draft) clearDraft(userId, date);
        setLoaded({ server, page: serverPage, baseVersion: serverVersion, unsynced: false });
      }
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [date, userId, future, reload]);

  const resolve = (choice: "both" | "mine" | "theirs") => {
    if (!conflict) return;
    const { theirs, mine } = conflict;
    const theirPage = pageOf(theirs);
    const base = theirs?.version ?? 0;
    let page: Page;
    if (choice === "theirs") {
      page = theirPage;
      clearDraft(userId, date);
    } else if (choice === "mine") {
      page = mine;
    } else {
      // nothing is lost: their page, a divider, then what this device wrote
      page = {
        title: mine.title || theirPage.title,
        mood: mine.mood ?? theirPage.mood,
        doc: {
          type: "doc",
          content: [
            ...(theirPage.doc.content ?? []),
            { type: "horizontalRule" },
            { type: "callout", attrs: { emoji: "📱" }, content: [{ type: "paragraph", content: [{ type: "text", text: "Also written on another device" }] }] },
            ...(mine.doc.content ?? []),
          ],
        },
      };
    }
    // the choice is kept on this device first, so a reload or a dropped connection can't undo it
    if (choice !== "theirs") writeDraft(userId, date, { ...page, baseVersion: base, savedAt: Date.now() });
    setLoaded({ server: theirs, page, baseVersion: base, unsynced: choice !== "theirs" });
    setConflict(null);
    setGeneration((g) => g + 1);
  };

  if (future) return null;

  if (status === "locked") {
    return (
      <JournalLockGate
        onUnlocked={() => {
          setStatus("loading");
          setReload((n) => n + 1);
        }}
      />
    );
  }

  if (status === "offline-empty") {
    return (
      <div className="mx-auto max-w-md px-6 pb-32 pt-24 text-center">
        <div className="text-4xl">📡</div>
        <h1 className="font-display mt-3 text-2xl">This page isn&apos;t on this device yet</h1>
        <p className="mt-2 text-sm text-ink-soft">You look offline. Pages you&apos;ve opened here before still work; this one opens once you&apos;re back.</p>
        <button
          onClick={() => {
            setStatus("loading");
            setReload((n) => n + 1);
          }}
          className="mt-5 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper"
        >
          Try again
        </button>
      </div>
    );
  }

  if (status === "loading" || !loaded) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 pb-32 pt-10 sm:px-8">
        <div className="h-3 w-24 animate-pulse rounded-full bg-paper-deep" />
        <div className="mt-3 h-10 w-72 animate-pulse rounded-xl bg-paper-deep" />
        <div className="mt-8 space-y-3">
          {[92, 78, 85, 60].map((w) => (
            <div key={w} className="h-4 animate-pulse rounded-full bg-paper-deep" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {conflict && <ConflictBanner onResolve={resolve} theirsDeleted={!conflict.theirs} />}
      <PageSurface
        key={`${date}:${generation}`}
        date={date}
        today={today}
        userId={userId}
        loaded={loaded}
        frozen={conflict !== null}
        onConflict={(theirs, mine) => setConflict({ theirs, mine })}
        onLocked={() => setStatus("locked")}
      />
    </>
  );
}

function ConflictBanner({ onResolve, theirsDeleted }: { onResolve: (c: "both" | "mine" | "theirs") => void; theirsDeleted: boolean }) {
  return (
    <div className="sticky top-14 z-40 mx-auto mt-3 w-[min(42rem,calc(100%-2rem))] md:top-3">
      <div className="anim-pop rounded-2xl border border-sun/40 bg-card p-4 shadow-xl shadow-ink/10">
        <p className="text-sm font-semibold">
          {theirsDeleted ? "This page was deleted on another device while you wrote." : "This page changed on another device while you wrote."}
        </p>
        <p className="mt-0.5 text-xs text-ink-soft">
          {theirsDeleted ? "Your words are still here. Keep them, or let the page go." : "Nothing has been lost yet. Pick what to keep."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {!theirsDeleted && (
            <button onClick={() => onResolve("both")} className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-paper">
              Keep both
            </button>
          )}
          <button onClick={() => onResolve("mine")} className="rounded-full border border-line bg-card px-4 py-1.5 text-xs font-semibold text-ink-soft hover:border-ink-faint">
            Keep mine
          </button>
          <button onClick={() => onResolve("theirs")} className="rounded-full border border-line bg-card px-4 py-1.5 text-xs font-semibold text-ink-soft hover:border-ink-faint">
            {theirsDeleted ? "Let it go" : "Use the other"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Each "/ prompt" asks something new — a counter rather than randomness, so renders stay pure. */
let promptTurns = 0;
const nextPromptTurn = () => ++promptTurns;

type EditorStorage = { slashCommand: { items: SlashItem[] }; journalAutoStamp: { armed: boolean } };
const storageOf = (e: Editor) => e.storage as unknown as EditorStorage;

/* -------------------------------------------------------------- the page */

const SAVE_DEBOUNCE_MS = 900;
const DRAFT_THROTTLE_MS = 250;
const RETRY_MS = 6000;
/** Come back after this long and your next words get a timestamp. */
const STAMP_AFTER_MS = 45 * 60_000;

function PageSurface({
  date,
  today,
  userId,
  loaded,
  frozen,
  onConflict,
  onLocked,
}: {
  date: string;
  today: string;
  userId: string;
  loaded: Loaded;
  /** A choice about this page is pending: nothing on it can change or save until it's made. */
  frozen: boolean;
  onConflict: (theirs: JournalEntry | null, mine: Page) => void;
  onLocked: () => void;
}) {
  const { state, showToast } = useApp();
  const [title, setTitle] = useState(loaded.page.title);
  const [mood, setMood] = useState<Mood | null>(loaded.page.mood);
  const [save, setSave] = useState<SaveState>(loaded.unsynced ? "dirty" : "saved");
  const [words, setWords] = useState(() => countWords(docToText(loaded.page.doc)));
  const [font, setFont] = useState<Font>(() => {
    try {
      const f = localStorage.getItem(FONT_KEY);
      return f === "serif" || f === "mono" ? f : "sans";
    } catch {
      return "sans";
    }
  });
  const [focusMode, setFocusMode] = useState(false);
  const [typing, setTyping] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [wins, setWins] = useState<string[] | null>(null);

  // the latest of everything, for saves that fire after a render has passed
  const versionRef = useRef(loaded.baseVersion);
  const titleRef = useRef(title);
  const moodRef = useRef(mood);
  const editorRef = useRef<Editor | null>(null);
  const dirtyRef = useRef(loaded.unsynced);
  const changeRef = useRef(0);
  const savingRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const flushRef = useRef<() => void>(() => {});
  /** Set by a conflict: this page stops saving until a person chooses what to keep. */
  const conflictedRef = useRef(false);
  const frozenRef = useRef(frozen);
  /** The last document the editor produced — what's left to save once it's torn down. */
  const lastDocRef = useRef<JNode | null>(null);

  const hidden = useMemo(() => hiddenListIds(state), [state]);

  /**
   * The page as it stands, or null when nothing trustworthy can say. An editor
   * that hasn't been created yet has no idea what the page holds, and sending
   * its blank state is how a page gets erased by accident. Once one has
   * existed, its last document stands in for it after it's torn down, so
   * leaving the page still saves the final words.
   */
  const snapshot = useCallback((): Page | null => {
    const ed = editorRef.current;
    const doc = ed && !ed.isDestroyed ? (ed.getJSON() as JNode) : lastDocRef.current;
    if (!doc) return null;
    return { title: titleRef.current, mood: moodRef.current, doc };
  }, []);

  const persistDraft = useCallback(() => {
    if (draftTimer.current) return;
    draftTimer.current = setTimeout(() => {
      draftTimer.current = null;
      const page = snapshot();
      if (!page) return;
      const draft: Draft = { ...page, baseVersion: versionRef.current, savedAt: Date.now() };
      writeDraft(userId, date, draft);
    }, DRAFT_THROTTLE_MS);
  }, [date, snapshot, userId]);

  /**
   * The save loop. At most one request in flight; changes made while it runs
   * are picked up by a follow-up save the moment it returns. A save only
   * clears the device draft when nothing has changed since it was sent — a
   * sentence typed during the round trip must survive the response.
   */
  const flush = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (!dirtyRef.current || savingRef.current || conflictedRef.current || frozenRef.current) return;
    const page = snapshot();
    // no live editor and nothing captured from one: the draft on this device stands
    if (!page) return;
    savingRef.current = true;
    setSave("saving");

    const sentChange = changeRef.current;
    // Emptying a page erases it, and erasing is always an explicit DELETE. A
    // save is never allowed to do it, so a blank snapshot can't wipe a day.
    let r: Result<{ entry: JournalEntry | null }>;
    if (!isEmptyPage(docToText(page.doc), page.title, page.mood)) {
      r = await journalApi.save(date, { ...page, baseVersion: versionRef.current });
    } else if (versionRef.current === 0) {
      r = { ok: true, data: { entry: null } };
    } else {
      const removed = await journalApi.remove(date, versionRef.current);
      r = removed.ok ? { ok: true, data: { entry: null } } : removed;
    }
    savingRef.current = false;

    if (r.ok) {
      const entry = r.data.entry;
      versionRef.current = entry?.version ?? 0;
      journalCache.put(date, entry, previewOf(docToText(page.doc)));
      if (changeRef.current === sentChange) {
        dirtyRef.current = false;
        clearDraft(userId, date);
        setSave("saved");
      } else {
        // more was written while this one travelled; the draft already holds it
        const latest = snapshot();
        if (latest) writeDraft(userId, date, { ...latest, baseVersion: versionRef.current, savedAt: Date.now() });
        saveTimer.current = setTimeout(() => flushRef.current(), 200);
      }
      return;
    }

    if (r.kind === "conflict") {
      // Stop until a person chooses. Freezing the page means the choice is
      // about exactly these words, and nothing typed while deciding goes missing.
      conflictedRef.current = true;
      // false: freezing isn't an edit, and must not reach the save loop as one
      editorRef.current?.setEditable(false, false);
      setSave("conflict");
      onConflict(r.current, snapshot() ?? page);
      return;
    }
    if (r.kind === "locked") {
      onLocked();
      return;
    }
    setSave(r.kind === "offline" ? "offline" : "error");
    saveTimer.current = setTimeout(() => flushRef.current(), RETRY_MS);
  }, [date, onConflict, onLocked, snapshot, userId]);

  useEffect(() => {
    flushRef.current = () => void flush();
  }, [flush]);

  const changed = useCallback((doc?: JNode) => {
    if (doc) lastDocRef.current = doc;
    dirtyRef.current = true;
    changeRef.current++;
    setSave((s) => (s === "saving" ? s : "dirty"));
    persistDraft();
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flushRef.current(), SAVE_DEBOUNCE_MS);

    setTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 1400);
  }, [persistDraft]);

  const slashStore = useMemo(() => createSlashStore(), []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        dropcursor: { color: "#0c9384", width: 2 },
        link: {
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          defaultProtocol: "https",
          protocols: ["http", "https", "mailto"],
          isAllowedUri: (url, ctx) => ctx.defaultValidate(url) && !/^\s*(javascript|data|vbscript):/i.test(url),
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Typography,
      Placeholder.configure({
        showOnlyCurrent: true,
        placeholder: ({ node, editor: ed }) => {
          if (node.type.name === "heading") return "Heading";
          if (ed.isEmpty) return promptFor(date);
          return "Keep going, or type / for more";
        },
      }),
      Focus.configure({ className: "has-focus", mode: "shallowest" }),
      EntryTime,
      Callout,
      SlashCommand.configure({ store: slashStore, filter: filterSlash }),
      AutoStamp.configure({ now: nowHHMM }),
    ],
    content: loaded.page.doc,
    editorProps: {
      attributes: {
        class: "jr-prose",
        spellcheck: "true",
        dir: "auto",
        "aria-label": `Journal page for ${longDate(date)}`,
      },
    },
    onUpdate: ({ editor: ed }) => {
      const doc = ed.getJSON() as JNode;
      setWords(countWords(docToText(doc)));
      changed(doc);
    },
  });

  // The editor exists only after its first client render. Everything the page
  // tells TipTap — its instance, whether the next words get a timestamp — is
  // written here, after that, and never during render.
  useEffect(() => {
    editorRef.current = editor;
    if (!editor) return;
    lastDocRef.current = editor.getJSON() as JNode;
    // an existing page for today, last touched a while ago: the next words get a time
    storageOf(editor).journalAutoStamp.armed =
      date === today &&
      Boolean(loaded.server) &&
      Date.now() - new Date(loaded.server?.updatedAt ?? 0).getTime() > STAMP_AFTER_MS;
    // work left on this device by an earlier visit saves as soon as it can
    if (dirtyRef.current) saveTimer.current = setTimeout(() => flushRef.current(), 400);
  }, [editor, date, today, loaded.server]);

  // while a conflict waits on a choice, the page holds still
  useEffect(() => {
    frozenRef.current = frozen;
    if (editor && !editor.isDestroyed) editor.setEditable(!frozen, false);
  }, [editor, frozen]);

  useEffect(() => {
    if (!editor) return;
    storageOf(editor).slashCommand.items = buildSlashItems({
      prompt: () => promptFor(date, nextPromptTurn()),
      wins: () => winsFor(date, state.tasks, hidden, today),
      notify: (message) => showToast({ message }),
    });
  }, [editor, date, state.tasks, hidden, today, showToast]);

  // typewriter scrolling in focus mode: the line being written stays near eye level
  useEffect(() => {
    if (!editor || !focusMode) return;
    const onSelection = () => {
      const coords = editor.view.coordsAtPos(editor.state.selection.head);
      const delta = coords.top - window.innerHeight * 0.42;
      if (Math.abs(delta) > 48) window.scrollBy({ top: delta, behavior: "smooth" });
    };
    editor.on("selectionUpdate", onSelection);
    return () => {
      editor.off("selectionUpdate", onSelection);
    };
  }, [editor, focusMode]);

  const editorFocused = useEditorState({ editor, selector: ({ editor: e }) => e?.isFocused ?? false });

  // leaving the page — by navigation, tab switch or closing — saves first
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushRef.current();
    };
    const onPageHide = () => flushRef.current();
    const onOnline = () => flushRef.current();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("online", onOnline);
      if (draftTimer.current) {
        clearTimeout(draftTimer.current);
        draftTimer.current = null;
        const last = snapshot();
        // a page waiting on a conflict leaves the draft to whatever gets chosen
        const settled = !conflictedRef.current && !frozenRef.current;
        if (dirtyRef.current && last && settled) writeDraft(userId, date, { ...last, baseVersion: versionRef.current, savedAt: Date.now() });
      }
      if (typingTimer.current) clearTimeout(typingTimer.current);
      recRef.current?.abort();
      flushRef.current();
    };
  }, [date, snapshot, userId]);

  // ⌘S saves now; ⌘⇧F toggles focus; Escape leaves focus mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        flushRef.current();
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFocusMode((f) => !f);
      } else if (e.key === "Escape" && focusMode && !document.querySelector('[role="listbox"]')) {
        setFocusMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode]);

  // "This day in Kairo" — loaded once, shown under the page
  useEffect(() => {
    let cancelled = false;
    winsFor(date, state.tasks, hidden, today).then((w) => {
      if (!cancelled) setWins(w);
    });
    return () => {
      cancelled = true;
    };
  }, [date, state.tasks, hidden, today]);

  const pickFont = (f: Font) => {
    setFont(f);
    try {
      localStorage.setItem(FONT_KEY, f);
    } catch {}
  };

  const pickMood = (m: Mood) => {
    const next = mood === m ? null : m;
    setMood(next);
    moodRef.current = next;
    changed();
  };

  const voiceSupported = useMemo(() => getSpeechRecognition() !== null, []);
  const toggleVoice = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const SR = getSpeechRecognition();
    const ed = editorRef.current;
    if (!SR || !ed) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (e) => {
      let finalText = "";
      let pending = "";
      for (let i = e.resultIndex ?? 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else pending += res[0].transcript;
      }
      if (finalText.trim()) ed.chain().focus().insertContent(`${finalText.trim()} `).run();
      setInterim(pending);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    rec.onerror = () => {
      setListening(false);
      setInterim("");
      showToast({ message: "Couldn't hear that. The microphone may be blocked." });
    };
    recRef.current = rec;
    setListening(true);
    track("journal-dictate");
    ed.commands.focus("end");
    rec.start();
  };

  const addWins = () => {
    const ed = editorRef.current;
    if (!ed || !wins?.length) return;
    ed.chain()
      .focus("end")
      .insertContent([
        {
          type: "callout",
          attrs: { emoji: "✅" },
          content: [
            { type: "paragraph", content: [{ type: "text", text: "What I finished", marks: [{ type: "bold" }] }] },
            {
              type: "taskList",
              content: wins.map((text) => ({
                type: "taskItem",
                attrs: { checked: true },
                content: [{ type: "paragraph", content: [{ type: "text", text }] }],
              })),
            },
          ],
        },
        { type: "paragraph" },
      ])
      .run();
  };

  const downloadPage = () => {
    setMenuOpen(false);
    const page = snapshot();
    if (!page) return;
    const md = entryToMarkdown({ date, title: page.title, mood: page.mood, doc: page.doc, words });
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `kairo-journal-${date}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const deletePage = async () => {
    setConfirmDelete(false);
    const page = snapshot();
    if (!page) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    dirtyRef.current = false;
    clearDraft(userId, date);

    if (versionRef.current > 0) {
      const r = await journalApi.remove(date, versionRef.current);
      if (!r.ok) {
        showToast({ message: r.kind === "offline" ? "You're offline, so the page stays for now." : "Couldn't delete that page." });
        dirtyRef.current = true;
        return;
      }
    }
    journalCache.put(date, null, "");
    track("journal-delete");
    navigateApp("/journal");
    showToast({
      message: "Page deleted.",
      action: {
        label: "Undo",
        run: () => {
          journalApi.save(date, { ...page, baseVersion: 0 }).then((r) => {
            if (r.ok) {
              journalCache.put(date, r.data.entry, previewOf(docToText(page.doc)));
              navigateApp(`/journal/${date}`);
            }
          });
        },
      },
    });
  };

  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const isToday = date === today;
  const weekday = longDate(date).split(",")[0];
  const [, dayMonthYear] = longDate(date).split(", ");
  const moodInfo = mood ? MOODS[mood - 1] : null;

  return (
    <div className={`jr-font-${font} ${focusMode ? "jr-focus" : ""} min-h-dvh`}>
      {/* header — steps back entirely in focus mode. Pinned only on wider
          screens: on a phone the app bar already holds the top edge. */}
      <header
        className={`relative z-30 border-b border-line/60 bg-paper/85 backdrop-blur transition-opacity duration-500 md:sticky md:top-0 ${
          focusMode ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-3 py-2 sm:px-5">
          <button
            onClick={() => navigateApp("/journal")}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-card hover:text-ink"
          >
            <span aria-hidden>←</span>
            <span className="hidden sm:inline">Journal</span>
          </button>

          <div className="flex items-center">
            <button
              onClick={() => navigateApp(`/journal/${prev}`)}
              aria-label="Previous day"
              className="grid size-8 place-items-center rounded-full text-ink-faint hover:bg-card hover:text-ink"
            >
              ‹
            </button>
            <button
              onClick={() => navigateApp(`/journal/${next}`)}
              disabled={isToday}
              aria-label="Next day"
              className="grid size-8 place-items-center rounded-full text-ink-faint hover:bg-card hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
            >
              ›
            </button>
          </div>

          <SaveBadge state={frozen ? "conflict" : save} onRetry={() => flushRef.current()} />

          <div className="relative ml-auto">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Page options"
              aria-expanded={menuOpen}
              className="grid size-9 place-items-center rounded-full text-ink-soft hover:bg-card hover:text-ink"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <circle cx="3" cy="8" r="1.5" />
                <circle cx="8" cy="8" r="1.5" />
                <circle cx="13" cy="8" r="1.5" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <button className="fixed inset-0 z-40 cursor-default" aria-hidden tabIndex={-1} onClick={() => setMenuOpen(false)} />
                <div className="anim-pop absolute right-0 top-11 z-50 w-60 rounded-2xl border border-line bg-card p-1.5 shadow-2xl shadow-ink/10">
                  <div className="px-2.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">Writing font</div>
                  <div className="grid grid-cols-3 gap-1 px-1 pb-1.5">
                    {(
                      [
                        ["sans", "Sans", ""],
                        ["serif", "Serif", "font-display"],
                        ["mono", "Mono", "font-mono"],
                      ] as const
                    ).map(([f, label, cls]) => (
                      <button
                        key={f}
                        onClick={() => pickFont(f)}
                        className={`rounded-lg py-2 text-sm ${cls} ${font === f ? "bg-sun-soft text-sun-deep" : "text-ink-soft hover:bg-paper-deep"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="my-1 h-px bg-line" />
                  <MenuItem
                    onClick={() => {
                      setMenuOpen(false);
                      setFocusMode(true);
                    }}
                    hint="⌘⇧F"
                  >
                    Focus mode
                  </MenuItem>
                  <MenuItem onClick={downloadPage}>Download this page</MenuItem>
                  <div className="my-1 h-px bg-line" />
                  <MenuItem
                    danger
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmDelete(true);
                    }}
                  >
                    Delete this page
                  </MenuItem>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-5 pb-40 pt-8 sm:px-8 sm:pt-12">
        {/* the date is the page's heading — a diary is addressed by day */}
        <div className={`transition-opacity duration-500 ${focusMode ? "opacity-25" : ""}`}>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-sun-deep">
            {weekday}
            {isToday && <span className="rounded-full bg-sun-soft px-2 py-0.5 text-[10px] tracking-[0.1em]">Today</span>}
          </div>
          <h1 className="font-display mt-1.5 text-4xl leading-tight tracking-tight sm:text-5xl">{dayMonthYear}</h1>
        </div>

        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            titleRef.current = e.target.value;
            changed();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || (e.key === "ArrowDown" && !e.shiftKey)) {
              e.preventDefault();
              const ed = editorRef.current;
              if (!ed) return;
              // Focus now, not on the next frame. TipTap's focus command defers,
              // and a fast typist's first letters would land in the title.
              ed.view.focus();
              ed.commands.setTextSelection(0);
            }
          }}
          readOnly={frozen}
          maxLength={140}
          placeholder="Give today a title"
          aria-label="Page title"
          className="font-display mt-6 w-full bg-transparent text-2xl text-ink outline-none placeholder:text-ink-faint/70 sm:text-[1.7rem]"
        />

        <MoodRow mood={mood} onPick={pickMood} dim={focusMode} disabled={frozen} />

        <div className="mt-7">
          <EditorContent editor={editor} />
        </div>

        {/* This day in Kairo: the part of a diary no other journal can write for you */}
        {wins && wins.length > 0 && !focusMode && (
          <section className="anim-rise mt-2 rounded-2xl border border-line bg-card/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">This day in Kairo</div>
                <div className="mt-0.5 text-sm text-ink-soft">
                  You finished {wins.length} {wins.length === 1 ? "thing" : "things"}.
                </div>
              </div>
              <button onClick={addWins} className="shrink-0 rounded-full border border-line bg-card px-3.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:border-sun hover:text-sun-deep">
                Add to page
              </button>
            </div>
            <ul className="mt-3 space-y-1.5">
              {wins.slice(0, 6).map((w) => (
                <li key={w} className="flex items-center gap-2 text-sm text-ink-soft">
                  <span className="grid size-4 shrink-0 place-items-center rounded-full bg-moss text-[9px] text-white">✓</span>
                  <span className="truncate">{w}</span>
                </li>
              ))}
              {wins.length > 6 && <li className="pl-6 text-xs text-ink-faint">and {wins.length - 6} more</li>}
            </ul>
          </section>
        )}

        <footer className={`mt-6 flex items-center justify-between text-xs text-ink-faint transition-opacity ${focusMode ? "opacity-0" : ""}`}>
          <span>
            {words.toLocaleString()} {words === 1 ? "word" : "words"}
            {words >= 200 && ` · ${Math.max(1, Math.round(words / 230))} min read`}
          </span>
          {moodInfo && (
            <span>
              {moodInfo.emoji} {moodInfo.label}
            </span>
          )}
        </footer>
      </main>

      {listening && (
        <div className="fixed inset-x-0 top-4 z-[70] flex justify-center px-4">
          <div className="anim-pop flex max-w-lg items-center gap-3 rounded-full border border-line bg-card/95 py-2 pl-3 pr-2 shadow-xl backdrop-blur">
            <span className="flex h-4 items-end gap-0.5" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="anim-bar w-0.5 rounded-full bg-sun" style={{ animationDelay: `${i * 0.12}s` }} />
              ))}
            </span>
            <span className="min-w-0 truncate text-sm text-ink-soft">{interim || "Listening…"}</span>
            <button onClick={toggleVoice} className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-paper">
              Stop
            </button>
          </div>
        </div>
      )}

      {focusMode && (
        <button
          onClick={() => setFocusMode(false)}
          className="fixed right-4 top-4 z-[65] rounded-full border border-line bg-card/80 px-3 py-1.5 text-xs font-medium text-ink-faint backdrop-blur transition-colors hover:text-ink"
        >
          Leave focus <span className="ml-1 opacity-60">Esc</span>
        </button>
      )}

      {editor && <SelectionBubble editor={editor} />}
      <SlashMenu store={slashStore} />
      {editor && (editorFocused || listening) && (
        <WritingDock
          editor={editor}
          listening={listening}
          onVoice={toggleVoice}
          voiceSupported={voiceSupported}
          typing={typing}
          focusMode={focusMode}
          onFocusMode={() => setFocusMode((f) => !f)}
        />
      )}

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(false)}>
          <div className="p-6">
            <h2 className="font-display text-2xl">Delete this page?</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Everything written on {longDate(date)} goes. You&apos;ll have a few seconds to undo it.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)} className="rounded-full border border-line bg-card px-4 py-2 text-sm font-medium text-ink-soft">
                Keep it
              </button>
              <button onClick={deletePage} className="rounded-full bg-clay px-4 py-2 text-sm font-semibold text-white">
                Delete page
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  hint,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
        danger ? "text-clay hover:bg-clay-soft" : "text-ink-soft hover:bg-paper-deep hover:text-ink"
      }`}
    >
      {children}
      {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
    </button>
  );
}

function SaveBadge({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  const view: Record<SaveState, { dot: string; label: string }> = {
    saved: { dot: "bg-moss", label: "Saved" },
    dirty: { dot: "bg-ink-faint", label: "Edited" },
    saving: { dot: "bg-sun jr-breathe", label: "Saving" },
    offline: { dot: "bg-[#d8a03e]", label: "Offline · kept on this device" },
    error: { dot: "bg-clay", label: "Couldn't save · retrying" },
    conflict: { dot: "bg-sun", label: "Paused · pick what to keep" },
  };
  const v = view[state];
  const retryable = state === "offline" || state === "error";
  return (
    <button
      type="button"
      onClick={retryable ? onRetry : undefined}
      aria-live="polite"
      className={`flex min-w-0 items-center gap-1.5 rounded-full px-2 py-1 text-xs text-ink-faint ${retryable ? "hover:bg-card" : "cursor-default"}`}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${v.dot}`} />
      <span className="truncate">{v.label}</span>
    </button>
  );
}

/**
 * Mood as a row of weather. It asks once, quietly, and folds away to a single
 * chip once answered — a page that keeps asking how you feel stops being a
 * place to write and becomes a survey.
 */
function MoodRow({ mood, onPick, dim, disabled }: { mood: Mood | null; onPick: (m: Mood) => void; dim: boolean; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const chosen = mood ? MOODS[mood - 1] : null;
  const expanded = !chosen || open;

  return (
    <div className={`mt-3 flex flex-wrap items-center gap-2 transition-opacity duration-500 ${dim ? "opacity-20" : disabled ? "opacity-50" : ""}`}>
      {expanded ? (
        <>
          <span className="text-sm text-ink-faint">{chosen ? "Change the weather:" : "Weather inside today?"}</span>
          <div className="flex items-center gap-1">
            {MOODS.map((m) => {
              const active = mood === m.value;
              return (
                <button
                  key={m.value}
                  onClick={() => {
                    onPick(m.value);
                    setOpen(false);
                  }}
                  disabled={disabled}
                  aria-label={m.label}
                  aria-pressed={active}
                  title={m.label}
                  className={`group relative grid size-10 place-items-center rounded-full text-xl transition-all duration-200 hover:-translate-y-0.5 hover:scale-110 ${
                    active ? "scale-110 bg-card shadow-md" : "hover:bg-card"
                  }`}
                  style={active ? { boxShadow: `0 0 0 2px ${m.color}` } : undefined}
                >
                  {m.emoji}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        chosen && (
          <button
            onClick={() => setOpen(true)}
            disabled={disabled}
            className="flex items-center gap-1.5 rounded-full border border-line bg-card/70 py-1 pl-2 pr-3 text-sm text-ink-soft transition-colors hover:border-ink-faint"
            style={{ boxShadow: `inset 3px 0 0 ${chosen.color}` }}
          >
            <span className="text-base">{chosen.emoji}</span>
            {chosen.label}
          </button>
        )
      )}
    </div>
  );
}
