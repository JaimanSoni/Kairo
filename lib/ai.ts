import type { List } from "./types";

export type AiParsed = {
  title: string;
  plannedFor: string | null;
  plannedTime: string | null;
  dueDate: string | null;
  estimateMin: number | null;
  listId: string | null;
  listName: string | null;
  spotlight: boolean;
  subtasks: string[];
};

const GEMINI_URL = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
// Longer than the capture reveal's own 9s budget on purpose: a slow answer
// stops narrating but still files the tasks when it lands. Only a dead
// answer helps nobody.
const TIMEOUT_MS = 15000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_TASKS = 5;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * The capture prompt. Three principles carry all of its accuracy:
 *
 * 1. The model never does date arithmetic. Language models are bad at
 *    calendars, so every date word it could meet — the next fourteen days,
 *    this weekend, next weekend, next week, next month — is precomputed here
 *    and the model only looks the answer up.
 * 2. Rules come with worked examples, because "next weekend" resolved wrong
 *    once in production and an example is the cheapest way to never argue
 *    about it again.
 * 3. One capture can carry several tasks. "Call the bank and hit the gym" is
 *    two things; "go shopping and buy fruits" is one errand. The split-versus-
 *    subtask judgment gets its own rules and a contrasting example pair.
 */
function systemPrompt(today: string, time: string, lists: List[]): string {
  const [y, m, d] = today.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const plus = (days: number) => {
    const dt = new Date(base);
    dt.setDate(dt.getDate() + days);
    return dt;
  };

  const calendar = Array.from({ length: 14 }, (_, i) => {
    const dt = plus(i);
    const label = i === 0 ? "today" : i === 1 ? "tomorrow" : "";
    return `  ${WEEKDAYS[dt.getDay()].slice(0, 3)} ${fmt(dt)}${label ? `  (${label})` : ""}`;
  }).join("\n");

  // Saturday of the current week block; "next weekend" is the one after it.
  // From a Saturday or Sunday, "this weekend" means the weekend you are in.
  const dow = base.getDay(); // 0 Sun .. 6 Sat
  const daysToSat = dow === 0 ? -1 : 6 - dow;
  const thisWeekendSat = plus(daysToSat);
  const nextWeekendSat = plus(daysToSat + 7);
  const nextMonday = plus(dow === 0 ? 1 : 8 - dow);
  const nextMonth = new Date(y, m, 1);

  const listNames = lists.length ? lists.map((l) => JSON.stringify(l.name)).join(", ") : "(none)";

  return `You extract structured tasks from messy natural language, often a voice transcript in Indian English.
Reply with ONLY a raw JSON object, no markdown fences, no commentary, of EXACTLY this shape:
{"tasks": [{"title": string, "plannedFor": "YYYY-MM-DD" or null, "plannedTime": "HH:MM" or null, "dueDate": "YYYY-MM-DD" or null, "estimateMin": integer or null, "listName": string or null, "spotlight": boolean, "subtasks": [strings]}]}

HOW MANY TASKS
One capture often contains SEVERAL distinct tasks joined by "and", "also", "then", "after that", or just run together. Output one task object per distinct action, in the order spoken, at most ${MAX_TASKS}.
Split when the actions are independent things someone would tick off separately (different places, people, topics or times).
Do NOT split when the extra words are part of the same errand or steps of one job — those stay ONE task, with the steps in "subtasks" only when they are concrete.
Shared context distributes: a date, time or place said once applies to every task it plainly covers ("tomorrow call mom and pay rent" = both tomorrow).

CURRENT MOMENT
Right now it is ${WEEKDAYS[dow]} ${today} at ${time} (the user's local time).
Calendar — ALWAYS look dates up here, NEVER calculate them yourself:
${calendar}
Anchors:
  "this weekend" = Sat ${fmt(thisWeekendSat)}
  "next weekend" = Sat ${fmt(nextWeekendSat)}
  "next week" = Mon ${fmt(nextMonday)} (unless a specific day is named, then that day NEXT week)
  "next month" = ${fmt(nextMonth)}
  "tonight" / "this evening" = today

FIELD RULES (each task)
title: clean sentence-case imperative. Strip filler ("umm", "I have to", "remind me to", "I want to") but keep every meaningful detail.
plannedFor: the day the user intends to DO the task.
plannedTime: 24h clock, only when the user says a time ("at 6", "6 pm", "in the evening"). Word times: morning=09:00, noon=12:00, afternoon=15:00, evening=19:00, night=21:00. "at 6" with no am/pm: pick the next sensible occurrence given the current time.
dueDate: ONLY a hard deadline ("by", "before", "due", "deadline"). A deadline alone does not set plannedFor.
estimateMin: any stated or implied duration: "within 30 mins"=30, "half an hour"=30, "couple of hours"=120, "quick call"=10. Otherwise null.
listName: pick the ONE list whose MEANING fits (fruits or supermarket goes to a groceries-style list, gym or run to a fitness-style list, office work to a work-style list). Copy the name EXACTLY from: [${listNames}]. If none fits, null. NEVER invent a list.
spotlight: true only for explicit priority language (most important, top priority, must do today, critical).
subtasks: only when the user lists multiple concrete steps of THIS task; each short and imperative. Usually [].
Never invent dates, times, durations or steps. When unsure, use null.

EXAMPLES (dates resolved with the calendar above; lists here are illustrative, always use the user's actual list names)
"go for shopping next weekend and buy some fruits"
-> {"tasks":[{"title":"Go shopping and buy fruits","plannedFor":"${fmt(nextWeekendSat)}","plannedTime":null,"dueDate":null,"estimateMin":null,"listName":"Groceries","spotlight":false,"subtasks":[]}]}
(one errand, not two tasks: the fruits are part of the shopping)
"call the bank tomorrow at 11 and gym today at 7"
-> {"tasks":[{"title":"Call the bank","plannedFor":"${fmt(plus(1))}","plannedTime":"11:00","dueDate":null,"estimateMin":null,"listName":null,"spotlight":false,"subtasks":[]},{"title":"Gym session","plannedFor":"${today}","plannedTime":"19:00","dueDate":null,"estimateMin":null,"listName":"Fitness","spotlight":false,"subtasks":[]}]}
(two independent actions with their own times)
"umm I have to finish the client report we have to complete it within 30 mins also book flights for goa"
-> {"tasks":[{"title":"Finish the client report","plannedFor":null,"plannedTime":null,"dueDate":null,"estimateMin":30,"listName":"Work","spotlight":false,"subtasks":[]},{"title":"Book flights for Goa","plannedFor":null,"plannedTime":null,"dueDate":null,"estimateMin":null,"listName":null,"spotlight":false,"subtasks":[]}]}
"submit the tax file by friday"
-> {"tasks":[{"title":"Submit the tax file","plannedFor":null,"plannedTime":null,"dueDate":"${fmt(plus(((5 - dow + 7) % 7) || 7))}","estimateMin":null,"listName":null,"spotlight":false,"subtasks":[]}]}`;
}

/** Pulls the first JSON object out of a possibly fenced / chatty response. */
function extractJson(content: string): Record<string, unknown> | null {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(content.slice(start, end + 1));
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function asDate(v: unknown): string | null {
  return typeof v === "string" && DATE_RE.test(v) ? v : null;
}

/** Validates one raw task object from the model into an AiParsed, or null. */
function sanitizeOne(raw: Record<string, unknown>, lists: List[]): AiParsed | null {
  const title = typeof raw.title === "string" ? raw.title.trim().slice(0, 500) : "";
  if (!title) return null;

  // tolerate models that answer "list" instead of "listName"
  const listNameRaw = raw.listName ?? raw.list;
  const listName = typeof listNameRaw === "string" ? listNameRaw : null;
  const list = listName
    ? lists.find((l) => l.name.toLowerCase() === listName.toLowerCase()) ?? null
    : null;

  const estimate =
    typeof raw.estimateMin === "number" && raw.estimateMin > 0 && raw.estimateMin <= 24 * 60
      ? Math.round(raw.estimateMin)
      : null;

  const subtasks = Array.isArray(raw.subtasks)
    ? raw.subtasks
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .slice(0, 20)
        .map((s) => s.trim().slice(0, 500))
    : [];

  return {
    title,
    plannedFor: asDate(raw.plannedFor),
    plannedTime:
      typeof raw.plannedTime === "string" && TIME_RE.test(raw.plannedTime) ? raw.plannedTime : null,
    dueDate: asDate(raw.dueDate),
    estimateMin: estimate,
    listId: list?.id ?? null,
    listName: list?.name ?? null,
    spotlight: raw.spotlight === true,
    subtasks,
  };
}

/**
 * Asks Gemini to parse capture text into one or more tasks.
 * Returns null on ANY failure (no key, timeout, bad response) — callers must
 * fall back to the local token parser.
 */
export async function aiParseTasks(
  text: string,
  today: string,
  time: string,
  lists: List[]
): Promise<AiParsed[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !text.trim()) return null;
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

  const call = async (withThinkingOff: boolean) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await fetch(GEMINI_URL(model), {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt(today, time, lists) }] },
          contents: [{ role: "user", parts: [{ text: text.slice(0, 2000) }] }],
          generationConfig: {
            // JSON out, and no creative temperature: parsing is transcription
            responseMimeType: "application/json",
            temperature: 0.1,
            // thinking would be wasted here and costs seconds of latency;
            // capture races a 9 second budget before the client falls back.
            // Some variants (flash-lite) reject the field, hence the retry.
            ...(withThinkingOff ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    let res = await call(true);
    if (res.status === 400) res = await call(false);
    // free-tier congestion answers 503, and bursts answer 429; both are
    // usually gone a moment later, so one short-fused retry is worth it
    if (res.status === 503 || res.status === 429) {
      await new Promise((r) => setTimeout(r, 700));
      res = await call(true);
      if (res.status === 400) res = await call(false);
    }
    if (!res.ok) {
      console.error("[ai] gemini answered", res.status, (await res.text()).slice(0, 200));
      return null;
    }

    const data: {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    } = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const raw = extractJson(content);
    if (!raw) return null;

    // accept both the asked-for {tasks:[...]} and a bare single object
    const items = Array.isArray(raw.tasks) ? raw.tasks : [raw];
    const tasks = items
      .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
      .slice(0, MAX_TASKS)
      .map((x) => sanitizeOne(x, lists))
      .filter((x): x is AiParsed => x !== null);

    return tasks.length > 0 ? tasks : null;
  } catch {
    return null;
  }
}
