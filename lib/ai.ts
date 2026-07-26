import type { List } from "./types";

export type AiParsed = {
  title: string;
  plannedFor: string | null;
  dueDate: string | null;
  estimateMin: number | null;
  listId: string | null;
  listName: string | null;
  spotlight: boolean;
  subtasks: string[];
};

const OLLAMA_URL = "https://ollama.com/api/chat";
const TIMEOUT_MS = 9000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function systemPrompt(today: string, lists: List[]): string {
  const [y, m, d] = today.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  const listNames = lists.length ? lists.map((l) => l.name).join(", ") : "(none)";
  return (
    "You extract ONE structured task from messy natural language (often a voice transcript). " +
    "Reply with ONLY a raw JSON object, no markdown fences, using EXACTLY these keys: " +
    "title (string — short, imperative, filler words stripped, keep essential context), " +
    "plannedFor (YYYY-MM-DD or null — the day the user intends to DO it; resolve relative words like tomorrow/friday/next week), " +
    "dueDate (YYYY-MM-DD or null — ONLY a genuine hard deadline like 'before friday', 'due', 'by the 30th'), " +
    "estimateMin (integer minutes or null — only if a duration is stated or strongly implied), " +
    `listName (one of: ${listNames} — or null if none clearly fits), ` +
    "spotlight (boolean — true ONLY if the user signals it is critical/most-important/must-do), " +
    "subtasks (array of short strings — usually empty; fill ONLY when the user explicitly lists steps). " +
    `Today is ${weekday} ${today}. Never invent dates, durations, or steps the user did not imply.`
  );
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

/**
 * Asks Ollama cloud to parse capture text into a task.
 * Returns null on ANY failure (no key, timeout, bad response) — callers must
 * fall back to the local token parser.
 */
export async function aiParseTask(
  text: string,
  today: string,
  lists: List[]
): Promise<AiParsed | null> {
  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey || !text.trim()) return null;
  const model = process.env.OLLAMA_MODEL || "gemma4:31b";

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: "system", content: systemPrompt(today, lists) },
          { role: "user", content: text.slice(0, 2000) },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;

    const data: { message?: { content?: string } } = await res.json();
    const raw = extractJson(data.message?.content ?? "");
    if (!raw) return null;

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
      dueDate: asDate(raw.dueDate),
      estimateMin: estimate,
      listId: list?.id ?? null,
      listName: list?.name ?? null,
      spotlight: raw.spotlight === true,
      subtasks,
    };
  } catch {
    return null;
  }
}
