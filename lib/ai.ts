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

const OLLAMA_URL = "https://ollama.com/api/chat";
const GEMINI_URL = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
// Gemma answers first on a short leash; Gemini only runs if Gemma failed, so
// the combined worst case still lands near the reveal's 12 second budget,
// and a slow answer that misses it still files its tasks late.
const OLLAMA_TIMEOUT_MS = 8000;
const GEMINI_TIMEOUT_MS = 10000;
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

CRITICAL — ANTI-HALLUCINATION
Use ONLY words, dates, and actions the user actually said. NEVER invent a task that isn't mentioned in the input. If the input is unclear or you can't parse it, return a single task with the raw text as title and null for everything else. It is ALWAYS better to return one safe task than to guess.

HOW MANY TASKS
One capture often contains SEVERAL distinct tasks joined by "and", "also", "then", "after that", or just run together. Output one task object per distinct action, in the order spoken, at most ${MAX_TASKS}.
Split when the actions are independent things someone would tick off separately — DIFFERENT action verbs, different times, different days, different people, different places.
Examples of 2-task splits: "call mom and go to gym", "pay rent tomorrow and buy groceries", "call the bank today at 11 and gym at 7"
Do NOT split when the extra words are part of the same errand or steps of one job — those stay ONE task, with the steps in "subtasks" only when they are concrete.
Examples that stay ONE: "go shopping and buy fruits", "write report and email it", "clean the kitchen and mop the floor"
Shared context distributes: a date, time or place said once applies to EVERY task it plainly covers. "tomorrow call mom and pay rent" → both tasks get tomorrow. But when each action has its OWN time or day, that overrides the shared one.

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
title: clean sentence-case imperative. Strip filler ("umm", "I have to", "remind me to", "I want to") but keep every meaningful detail from the user's words.
plannedFor: the day the user intends to DO the task.
plannedTime: 24h clock, only when the user says a time ("at 6", "6 pm", "in the evening"). Word times: morning=09:00, noon=12:00, afternoon=15:00, evening=19:00, night=21:00. "at 6" with no am/pm: pick the next sensible occurrence given the current time.
A day-part word WITHOUT a day ("in the morning", "in the evening") also sets plannedFor: today if that part of the day is still ahead of the current time, otherwise tomorrow. Each task gets its OWN day-part resolution — if task A says "today evening" set both plannedFor=today and plannedTime=19:00, and if task B says "tomorrow morning" set plannedFor=tomorrow and plannedTime=09:00.
dueDate: ONLY a hard deadline ("by", "before", "due", "deadline"). A deadline alone does not set plannedFor.
estimateMin: any stated or implied duration: "within 30 mins"=30, "half an hour"=30, "couple of hours"=120, "quick call"=10. Otherwise null.
listName: pick the ONE list whose MEANING fits (fruits or supermarket goes to a groceries-style list, gym or run to a fitness-style list, office work to a work-style list). Copy the name EXACTLY from: [${listNames}]. If none fits, null. NEVER invent a list.
spotlight: true only for explicit priority language (most important, top priority, must do today, critical).
subtasks: only when the user lists multiple concrete steps of THIS task; each short and imperative. Usually [].
Never invent dates, times, durations or steps. When unsure, use null.

EXAMPLES (dates resolved with the calendar above; lists here are illustrative, always use the user's actual list names)
"go for shopping next weekend and buy some fruits"
-> {"tasks":[{"title":"Go shopping and buy fruits","plannedFor":"${fmt(nextWeekendSat)}","plannedTime":null,"dueDate":null,"estimateMin":null,"listName":"Groceries","spotlight":false,"subtasks":[]}]}
(one errand, not two tasks: the fruits are part of the shopping trip)
"call the bank tomorrow at 11 and gym today at 7"
-> {"tasks":[{"title":"Call the bank","plannedFor":"${fmt(plus(1))}","plannedTime":"11:00","dueDate":null,"estimateMin":null,"listName":null,"spotlight":false,"subtasks":[]},{"title":"Gym session","plannedFor":"${today}","plannedTime":"19:00","dueDate":null,"estimateMin":null,"listName":"Fitness","spotlight":false,"subtasks":[]}]}
(two independent actions, each with its own day and time)
"call mom today evening 6pm and go to gym tomorrow morning"
-> {"tasks":[{"title":"Call mom","plannedFor":"${today}","plannedTime":"18:00","dueDate":null,"estimateMin":null,"listName":null,"spotlight":false,"subtasks":[]},{"title":"Go to gym","plannedFor":"${fmt(plus(1))}","plannedTime":"09:00","dueDate":null,"estimateMin":null,"listName":"Fitness","spotlight":false,"subtasks":[]}]}
(two tasks, different days, each with its own day-part time)
"call mom in the morning and go to college tomorrow"
-> {"tasks":[{"title":"Call mom","plannedFor":"${time < "09:00" ? today : fmt(plus(1))}","plannedTime":"09:00","dueDate":null,"estimateMin":null,"listName":null,"spotlight":false,"subtasks":[]},{"title":"Go to college","plannedFor":"${fmt(plus(1))}","plannedTime":null,"dueDate":null,"estimateMin":null,"listName":null,"spotlight":false,"subtasks":[]}]}
(two tasks; "in the morning" with no day means the next morning from right now)
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

/** Gemma over Ollama cloud: the workhorse, no meaningful rate limits. */
async function callOllama(system: string, user: string): Promise<string | null> {
  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OLLAMA_MODEL || "gemma4:31b";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  try {
    const res = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("[ai] ollama answered", res.status);
      return null;
    }
    const data: { message?: { content?: string } } = await res.json();
    return data.message?.content ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Gemini, as the understudy when Gemma is down. No retries on 429 or 503:
 * on a 10-requests-per-minute free tier, retrying a rate limit only spends
 * the next caller's request making this caller's problem worse.
 */
async function callGemini(system: string, user: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

  const attempt = async (withThinkingOff: boolean) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    try {
      return await fetch(GEMINI_URL(model), {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
            // thinking is wasted latency here; some variants reject the
            // knob, hence the schema-retry below
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
    let res = await attempt(true);
    if (res.status === 400) res = await attempt(false);
    if (!res.ok) {
      console.error("[ai] gemini answered", res.status);
      return null;
    }
    const data: { candidates?: { content?: { parts?: { text?: string }[] } }[] } =
      await res.json();
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? null;
  } catch {
    return null;
  }
}

/**
 * Parses capture text into one or more tasks: Gemma first, Gemini as the
 * fallback. Returns null on ANY failure — callers must fall back to the
 * local token parser.
 */
export async function aiParseTasks(
  text: string,
  today: string,
  time: string,
  lists: List[]
): Promise<AiParsed[] | null> {
  if (!text.trim()) return null;
  const system = systemPrompt(today, time, lists);
  const user = text.slice(0, 2000);

  const content = (await callOllama(system, user)) ?? (await callGemini(system, user));
  if (!content) return null;

  const raw = extractJson(content);
  if (!raw) return null;

  // accept both the asked-for {tasks:[...]} and a bare single object
  const items = Array.isArray(raw.tasks) ? raw.tasks : [raw];
  const tasks = items
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .slice(0, MAX_TASKS)
    .map((x) => sanitizeOne(x, lists))
    .filter((x): x is AiParsed => x !== null);

  if (tasks.length === 0) return null;

  // reject responses where every task title looks unrelated to the input
  const validated = validateAgainstInput(text, tasks);
  return validated.length > 0 ? validated : null;
}

/**
 * Rejects AI tasks whose titles have zero word overlap with the original
 * input. Also drops any task with a future date more than 90 days out (unless
 * the input explicitly mentions that timeframe).
 */
function validateAgainstInput(input: string, tasks: AiParsed[]): AiParsed[] {
  const inputWords = new Set(
    input.toLowerCase().split(/\s+/).filter((w) => w.length >= 3)
  );
  const hasFarDate = /\b\d{1,2}\s*(?:months?|years?)\b/i.test(input);

  return tasks.filter((t) => {
    const titleWords = t.title.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
    const overlap = titleWords.filter((w) => inputWords.has(w));
    // at least one meaningful word must overlap, unless the input is very short
    if (inputWords.size >= 3 && overlap.length === 0) {
      console.warn("[ai] rejected hallucinated task:", t.title);
      return false;
    }
    // reject dates far in the future that weren't mentioned in input
    if (t.plannedFor && !hasFarDate) {
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 90);
      const taskDate = new Date(t.plannedFor);
      if (taskDate > maxDate) {
        console.warn("[ai] rejected far-future date:", t.plannedFor, "for:", t.title);
        return false;
      }
    }
    return true;
  });
}
