import type { List } from "./types";
import { sanitizeRepeat, type Repeat } from "./repeat";
import { tidyLines, type StandupLines, type StandupTask } from "./standup";

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
  /**
   * A recurrence rule, when the user said one.
   *
   * This used to be the one thing the local parser did that the model could
   * not, so a capture's rule was lifted off a second, local parse and pasted
   * onto the model's first task. With nothing parsing captures but the model,
   * "gym every monday" has to survive here or it does not survive at all.
   */
  repeat: Repeat | null;
};

const OLLAMA_URL = "https://ollama.com/api/chat";
// Vercel-to-Ollama round trips measure 2-4x slower than a home connection's,
// so the leash is set for the datacenter path; the omnibar's reveal budget
// (20s) must stay above this plus the fast-failure retry.
const OLLAMA_TIMEOUT_MS = 15000;
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
{"tasks": [{"title": string, "plannedFor": "YYYY-MM-DD" or null, "plannedTime": "HH:MM" or null, "dueDate": "YYYY-MM-DD" or null, "estimateMin": integer or null, "listName": string or null, "spotlight": boolean, "subtasks": [strings], "repeat": null or {"type":"daily","interval":N} or {"type":"weekly","weekdays":[0-6]} or {"type":"monthly","dayOfMonth":N}}]}

WHAT YOU ARE READING
Usually someone talking, out loud, unrehearsed — not a typed list. They think mid-sentence, repeat themselves, change their minds, say things that are not tasks at all, and mix Hindi and English in one breath. Your job is to hear the commitments inside that and leave the rest of it alone.

A task is something the person intends to DO. These are NOT tasks, and must never appear in the output:
  - how they feel or what they notice: "I'm so tired today", "traffic was mad"
  - things already finished: "I already called mom", "sent the invoice this morning"
  - wishes and idle thoughts with no intent: "I wish I could go to Goa sometime"
  - talking to the app: "okay so", "let me think", "add this to my list", "note this down"
  - questions they are asking themselves out loud, unless they resolve into a decision to do something
If NOTHING in the input is a task, return exactly {"tasks": []}. That is a correct and useful answer. Never pad the output with the raw text as a task to have something to say.

CHANGING THEIR MIND
People correct themselves out loud: "call Ravi on Monday — no wait, Tuesday", "move it to 6, actually 7". The LAST thing they say about a task wins, and the correction never becomes a second task. Words like "no", "wait", "actually", "sorry", "I mean", "scratch that" mark a correction.

SAID TWICE IS ONCE
The same commitment mentioned more than once in one capture is ONE task, with every detail they gave it across all the mentions.

CRITICAL — ANTI-HALLUCINATION
Use ONLY words, dates, and actions the user actually said. NEVER invent a task that isn't mentioned in the input. When something IS clearly a commitment but you cannot make out its details, keep the person's own words as the title and leave every other field null. Guessing a date is worse than leaving it empty.

HINDI AND HINGLISH
Write the title in English, but keep names, places and specifics exactly as said. "kal Ravi ko call karna hai" is "Call Ravi" planned for tomorrow. "paneer lena hai" is "Buy paneer". Never translate a person's name or a brand.

HOW MANY TASKS
One capture often contains SEVERAL distinct tasks joined by "and", "also", "then", "after that", or just run together. Output one task object per distinct action, in the order spoken, at most ${MAX_TASKS}.
Split when the actions are independent things someone would tick off separately — DIFFERENT action verbs, different times, different days, different people, different places.
Semicolons, commas between clauses, and line breaks are STRONG separators: each segment is its own task unless it is plainly a step of the segment before it.
Two work items are still two tasks when they are different pieces of work ("fix the login bug; refactor the parser" is TWO) — sharing a project or a list never merges them.
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
repeat: ONLY when the user says it happens again and again — "every monday", "daily", "every two days", "every month on the 5th", "every weekday". weekdays are 0=Sun..6=Sat, so "every monday" is {"type":"weekly","weekdays":[1]} and "every weekday" is {"type":"weekly","weekdays":[1,2,3,4,5]}. "daily" is {"type":"daily","interval":1}, "every other day" is {"type":"daily","interval":2}. A single future date is NOT a repeat. Otherwise null.
Never invent dates, times, durations or steps. When unsure, use null.

EXAMPLES (dates resolved with the calendar above; lists here are illustrative, always use the user's actual list names)
"go for shopping next weekend and buy some fruits"
-> {"tasks":[{"title":"Go shopping and buy fruits","plannedFor":"${fmt(nextWeekendSat)}","plannedTime":null,"dueDate":null,"estimateMin":null,"listName":"Groceries","spotlight":false,"subtasks":[],"repeat":null}]}
(one errand, not two tasks: the fruits are part of the shopping trip)
"call the bank tomorrow at 11 and gym today at 7"
-> {"tasks":[{"title":"Call the bank","plannedFor":"${fmt(plus(1))}","plannedTime":"11:00","dueDate":null,"estimateMin":null,"listName":null,"spotlight":false,"subtasks":[],"repeat":null},{"title":"Gym session","plannedFor":"${today}","plannedTime":"19:00","dueDate":null,"estimateMin":null,"listName":"Fitness","spotlight":false,"subtasks":[],"repeat":null}]}
(two independent actions, each with its own day and time)
"call mom today evening 6pm and go to gym tomorrow morning"
-> {"tasks":[{"title":"Call mom","plannedFor":"${today}","plannedTime":"18:00","dueDate":null,"estimateMin":null,"listName":null,"spotlight":false,"subtasks":[],"repeat":null},{"title":"Go to gym","plannedFor":"${fmt(plus(1))}","plannedTime":"09:00","dueDate":null,"estimateMin":null,"listName":"Fitness","spotlight":false,"subtasks":[],"repeat":null}]}
(two tasks, different days, each with its own day-part time)
"call mom in the morning and go to college tomorrow"
-> {"tasks":[{"title":"Call mom","plannedFor":"${time < "09:00" ? today : fmt(plus(1))}","plannedTime":"09:00","dueDate":null,"estimateMin":null,"listName":null,"spotlight":false,"subtasks":[],"repeat":null},{"title":"Go to college","plannedFor":"${fmt(plus(1))}","plannedTime":null,"dueDate":null,"estimateMin":null,"listName":null,"spotlight":false,"subtasks":[],"repeat":null}]}
(two tasks; "in the morning" with no day means the next morning from right now)
"i want to add a new feature in the linkedin agent; call mom at 7 pm to remind her for dinner; build a new agent"
-> {"tasks":[{"title":"Add a new feature in the LinkedIn agent","plannedFor":null,"plannedTime":null,"dueDate":null,"estimateMin":null,"listName":"Work","spotlight":false,"subtasks":[],"repeat":null},{"title":"Call mom to remind her for dinner","plannedFor":"${today}","plannedTime":"19:00","dueDate":null,"estimateMin":null,"listName":null,"spotlight":false,"subtasks":[],"repeat":null},{"title":"Build a new agent","plannedFor":null,"plannedTime":null,"dueDate":null,"estimateMin":null,"listName":"Work","spotlight":false,"subtasks":[],"repeat":null}]}
(three tasks: semicolons separate them, and the two work items are different pieces of work, so they never merge)
"umm I have to finish the client report we have to complete it within 30 mins also book flights for goa"
-> {"tasks":[{"title":"Finish the client report","plannedFor":null,"plannedTime":null,"dueDate":null,"estimateMin":30,"listName":"Work","spotlight":false,"subtasks":[],"repeat":null},{"title":"Book flights for Goa","plannedFor":null,"plannedTime":null,"dueDate":null,"estimateMin":null,"listName":null,"spotlight":false,"subtasks":[],"repeat":null}]}
"okay so umm today was pretty rough, anyway I need to call Ravi about the quotation, uh tomorrow I think, and I really should hit the gym, I keep saying that"
-> {"tasks":[{"title":"Call Ravi about the quotation","plannedFor":"${fmt(plus(1))}","plannedTime":null,"dueDate":null,"estimateMin":null,"listName":null,"spotlight":false,"subtasks":[],"repeat":null},{"title":"Hit the gym","plannedFor":null,"plannedTime":null,"dueDate":null,"estimateMin":null,"listName":"Fitness","spotlight":false,"subtasks":[],"repeat":null}]}
(the tiredness and "I keep saying that" are not tasks; "I really should" is still an intent)

"call Ravi on monday, no wait, tuesday is better"
-> {"tasks":[{"title":"Call Ravi","plannedFor":"${fmt(plus(((2 - dow + 7) % 7) || 7))}","plannedTime":null,"dueDate":null,"estimateMin":null,"listName":null,"spotlight":false,"subtasks":[],"repeat":null}]}
(one task, corrected — never two)

"I already paid the rent, and I'm so done with this week"
-> {"tasks":[]}
(finished, and a feeling — nothing to do)

"gym every monday and wednesday at 7 am"
-> {"tasks":[{"title":"Gym","plannedFor":null,"plannedTime":"07:00","dueDate":null,"estimateMin":null,"listName":"Fitness","spotlight":false,"subtasks":[],"repeat":{"type":"weekly","weekdays":[1,3]}}]}

"kal shaam ko Shreya ko call karna hai aur paneer bhi lena hai"
-> {"tasks":[{"title":"Call Shreya","plannedFor":"${fmt(plus(1))}","plannedTime":"19:00","dueDate":null,"estimateMin":null,"listName":null,"spotlight":false,"subtasks":[],"repeat":null},{"title":"Buy paneer","plannedFor":"${fmt(plus(1))}","plannedTime":null,"dueDate":null,"estimateMin":null,"listName":"Groceries","spotlight":false,"subtasks":[],"repeat":null}]}
(two tasks; the evening belongs to the call, tomorrow covers both)

"submit the tax file by friday"
-> {"tasks":[{"title":"Submit the tax file","plannedFor":null,"plannedTime":null,"dueDate":"${fmt(plus(((5 - dow + 7) % 7) || 7))}","estimateMin":null,"listName":null,"spotlight":false,"subtasks":[],"repeat":null}]}`;
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
    // the same check the API uses on a rule typed by hand
    repeat: sanitizeRepeat(raw.repeat) ?? null,
  };
}

/** Gemma over Ollama cloud: the workhorse, no meaningful rate limits. */
async function callOllama(system: string, user: string): Promise<string | null> {
  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OLLAMA_MODEL || "gemma4:31b";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        // near-greedy: parsing is extraction, and the default temperature
        // made the split-vs-merge judgment wobble between identical runs
        options: { temperature: 0.1 },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("[ai] ollama answered", res.status, "in", Date.now() - t0, "ms");
      return null;
    }
    const data: { message?: { content?: string } } = await res.json();
    console.log("[ai] ollama ok in", Date.now() - t0, "ms");
    return data.message?.content ?? null;
  } catch {
    console.error("[ai] ollama timed out or failed after", Date.now() - t0, "ms");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parses capture text into one or more tasks, via Gemma only. Returns null
 * on ANY failure — callers must fall back to the local token parser.
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

  // a fast Ollama failure (429, 5xx, network blip) deserves one more try —
  // but a timeout does not, because 8s + 8s would blow the reveal's budget
  const t0 = Date.now();
  let content = await callOllama(system, user);
  if (!content && Date.now() - t0 < 2500) content = await callOllama(system, user);
  if (!content) return null;

  const raw = extractJson(content);
  if (!raw) return null;

  /**
    * An empty list is an answer, not a failure.
    *
    * People think out loud, and most of what they say is not a task: "I'm so
    * tired, the traffic was insane" contains nothing to do, and the model
    * saying so is it working. Returning null here instead made the capture
    * report that the AI could not be reached, which is a lie about the one
    * case the prompt is proudest of.
    */
  if (Array.isArray(raw.tasks) && raw.tasks.length === 0) return [];

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

/* ---------------------------------------------------------------- standup */

/**
 * The daily standup, written out of what was actually ticked off.
 *
 * The hard part is not the facts, it is the register. Ask a model for a
 * "status update" and it writes like a press release: leveraged, aligned,
 * spearheaded, end-to-end. Nobody talks like that to their own team, and a
 * channel full of it is a channel nobody reads. So the prompt spends most of
 * its length on how to sound, and almost none on what to include -- because
 * what to include is already decided by what the person ticked off.
 *
 * It returns the lines, not the message: the headings and the bullets are
 * ours to put on, so the shape is identical every morning whatever the model
 * does.
 */
export async function aiStandup(
  yesterday: StandupTask[],
  today: StandupTask[]
): Promise<StandupLines | null> {
  if (yesterday.length === 0 && today.length === 0) return null;

  const show = (tasks: StandupTask[]) =>
    tasks.length === 0 ? "  (nothing)" : tasks.map((t) => `  - ${t.title}${t.list ? `  [${t.list}]` : ""}`).join("\n");

  const system = `You write one person's morning standup for their team's chat channel.

Reply with ONLY a raw JSON object, no markdown fences, no commentary, of EXACTLY this shape:
{"yesterday": [string, ...], "today": [string, ...]}

HOW A LINE HAS TO SOUND
Like telling a colleague at the next desk what you are up to. Short, plain, specific, a little bit dull. Somebody reading it should know what you are working on, and that is the whole job.
Yesterday's lines are finished work, in the past: "Fixed the login redirect", "Sent the Q3 numbers to Priya".
Today's lines are what you are getting on with: "Finishing the payment retries", "Starting on the venue import".
Keep the real nouns out of the task -- the feature, the client, the file, the person. That is the only part anyone else needs.

NEVER use these words, or anything that sounds like them:
leverage, align, alignment, synergy, deep dive, circle back, bandwidth, streamline, spearhead, drive, driving, robust, seamless, utilise, facilitate, ideate, roadmap, stakeholder, deliverable, action item, end-to-end, holistic, optimise, enable, unlock, impactful, key, various, multiple, several, successfully, efficiently, as per, kindly, EOD, ASAP, KPI, ETA.
No greeting, no "Hi team", no sign-off, no emoji, no headings, no numbering, no bullet characters. Only the lines.
Do not write "Worked on" more than once; say what was actually done instead.

WHAT GOES IN
One line per thing. Tasks that are plainly the same piece of work become one line; unrelated ones stay apart.
A title that says little on its own ("deck", "ravi", "follow up") gets a line as plain as it stands -- "Worked on the deck" -- and never gets detail it does not have. A thin line is fine. An invented one is not.
Leave out anything that is not work: shopping, gym, family, doctors, bills, anything personal. This goes in a work channel.
At most 8 lines in each list. If a list has nothing in it, return [] for that one.
Use only what you are given. Never invent a task, a name, a number or a date.

EXAMPLES
Given yesterday: "fix login bug", "reply to ravi about the quotation", "buy paneer"
-> {"yesterday":["Fixed the login bug","Replied to Ravi about the quotation"],"today":[]}
(the groceries are not the team's business)

Given yesterday: "deck", "deck feedback from ops"
-> {"yesterday":["Worked on the deck and went through the feedback from ops"],"today":[]}
(one piece of work, one line, and no detail invented for "deck")

Given today: "finish payment retries", "standup notes", "venue import script"
-> {"yesterday":[],"today":["Finishing the payment retries","Writing up the standup notes","Starting on the venue import script"]}`;

  const user = `Finished yesterday:\n${show(yesterday)}\n\nPlanned for today:\n${show(today)}`;

  const t0 = Date.now();
  let content = await callOllama(system, user);
  if (!content && Date.now() - t0 < 2500) content = await callOllama(system, user);
  if (!content) return null;

  const raw = extractJson(content);
  if (!raw) return null;

  const lines: StandupLines = {
    yesterday: tidyLines(raw.yesterday),
    today: tidyLines(raw.today),
  };
  // an answer with nothing in either list is not an answer
  if (lines.yesterday.length === 0 && lines.today.length === 0) return null;
  return lines;
}
