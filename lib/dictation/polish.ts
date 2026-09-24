/**
 * What a speech model says, turned into what this app understands.
 *
 * A transcript is not a task. Whisper writes "Move the quotation to Monday."
 * with a full stop, and the command parser then looks for a day called
 * "monday." and finds nothing. It writes "five p.m." where the parser reads
 * "5pm". It writes "Grocery's" for a list called "Groceries". And on silence
 * it writes "Thank you." or "[BLANK_AUDIO]", because that is what the end of a
 * YouTube video sounds like.
 *
 * So this is the layer where accuracy is actually won. A bigger model fixes
 * some of it; none of them fix the last one, because only this app knows what
 * the person's lists are called. Every rule here is deliberate, every rule is
 * reversible (the caller is told what changed), and the whole file is pure --
 * no DOM, no model, no clock -- so it can be tested properly.
 *
 * The order matters: noise out, then repeats, then numbers, then the person's
 * own words, then punctuation. Snapping to a list name before collapsing a
 * repeat would snap the repeat.
 */

export type FixKind = "noise" | "repeat" | "time" | "estimate" | "vocab" | "stop";

export type Fix = { from: string; to: string; kind: FixKind };

/** The words this person actually uses, which no model has ever seen. */
export type Vocab = {
  /** List names, exactly as they are spelled. */
  lists: string[];
  /** Names and other words out of their own tasks and habits. */
  names: string[];
};

export type Polished = { text: string; fixes: Fix[] };

export const EMPTY_VOCAB: Vocab = { lists: [], names: [] };

/* ------------------------------------------------------------------ noise */

/**
 * What Whisper writes when there was nothing to hear.
 *
 * These are real outputs on silence or room tone, learned from captioned
 * video: the model has seen thousands of hours ending in a sign-off over a
 * music sting, so quiet sounds like the end of a video to it. A person
 * dictating a task never means any of them.
 */
const NOISE_ONLY = [
  "thank you",
  "thanks for watching",
  "thank you for watching",
  "you",
  "bye",
  "bye bye",
  "okay",
  "mm",
  "hmm",
  "uh",
  "um",
  "so",
  "the",
  ".",
  "...",
];

/** Bracketed and musical stage directions: [BLANK_AUDIO], (upbeat music), music notes. */
const NOISE_MARKS = /\s*(?:\[[^\]]*\]|\([^)]*(?:music|audio|silence|laughter|applause|inaudible)[^)]*\)|[♪♫♩♬]+)\s*/gi;

/* ----------------------------------------------------------------- numbers */

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60 };

/** "twenty five" -> 25, "seven" -> 7, and nothing else. */
function wordNumber(phrase: string): number | null {
  const words = phrase.toLowerCase().trim().split(/[\s-]+/);
  if (words.length === 1) {
    const w = words[0];
    if (w in ONES) return ONES[w];
    if (w in TENS) return TENS[w];
    return null;
  }
  if (words.length === 2 && words[0] in TENS && words[1] in ONES && ONES[words[1]] < 10) {
    return TENS[words[0]] + ONES[words[1]];
  }
  return null;
}

const NUM = "(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fourty|fifty|sixty)(?:[\\s-](?:one|two|three|four|five|six|seven|eight|nine))?";

/* ------------------------------------------------------------ the edit ops */

type Step = (text: string, add: (from: string, to: string, kind: FixKind) => void, vocab: Vocab) => string;

/** Stage directions and music, which are never part of a task. */
const stripMarks: Step = (text, add) => {
  const out = text.replace(NOISE_MARKS, " ");
  if (out !== text) add(text.trim(), out.trim(), "noise");
  return out;
};

/**
 * A model looping on the same word. Whisper does this on clips shorter than
 * about a second, and on room tone: "call call call call". Three of anything
 * in a row was not said three times.
 */
const collapseRepeats: Step = (text, add) => {
  const out = text.replace(/\b(\w+)(\s+\1\b){2,}/gi, "$1");
  if (out !== text) add(text.trim(), out.trim(), "repeat");
  return out;
};

/**
 * Spoken clock times, written the way the parser reads them.
 *
 * `extractTime` in lib/nlp.ts understands 6pm, 6:30pm, 6 pm and 18:00, and
 * nothing else. Speech arrives as "five p.m.", "half past four", "quarter to
 * six". Each of these is a straight translation with no guessing: anything
 * ambiguous, like a bare "five o'clock", is left exactly as it was said.
 */
const spokenTime: Step = (text, add) => {
  let out = text;
  const note = (before: string) => {
    if (out !== before) add(before.trim(), out.trim(), "time");
  };

  // "p.m." -> "pm", first and on its own. Whisper writes the dots, and they
  // stop every rule below from matching -- including, for "five p.m.", the
  // one that takes the full stop off the end of a command.
  let before = out;
  out = out.replace(/\b([ap])\.\s*m\.(?=\s|$|[,;!?])/gi, "$1m").replace(/\b([ap])\.\s*m\b/gi, "$1m");
  note(before);

  // "5 pm" / "5:30 pm" -> "5pm" / "5:30pm"
  before = out;
  out = out.replace(/\b(\d{1,2})(?::([0-5]\d))?\s+([ap]m)\b/gi, (_m, h, mm, ap) => `${h}${mm ? `:${mm}` : ""}${ap.toLowerCase()}`);
  note(before);

  // "five pm" / "five thirty pm" -> "5pm" / "5:30pm"
  before = out;
  out = out.replace(new RegExp(`\\b(${NUM})(?:[\\s-](${NUM}))?\\s*(am|pm)\\b`, "gi"), (m, h, mm, ap) => {
    const hour = wordNumber(h);
    if (hour === null || hour < 1 || hour > 12) return m;
    const mins = mm ? wordNumber(mm) : null;
    if (mm && (mins === null || mins > 59)) return m;
    return `${hour}${mins ? `:${String(mins).padStart(2, "0")}` : ""}${ap.toLowerCase()}`;
  });
  note(before);

  // "half past four" -> "4:30", "quarter past four" -> "4:15"
  before = out;
  out = out.replace(new RegExp(`\\b(half|quarter)\\s+past\\s+(${NUM}|\\d{1,2})\\b`, "gi"), (m, part, h) => {
    const hour = /^\d+$/.test(h) ? parseInt(h, 10) : wordNumber(h);
    if (hour === null || hour < 1 || hour > 12) return m;
    return `${hour}:${part.toLowerCase() === "half" ? "30" : "15"}`;
  });
  note(before);

  // "quarter to six" -> "5:45"
  before = out;
  out = out.replace(new RegExp(`\\bquarter\\s+to\\s+(${NUM}|\\d{1,2})\\b`, "gi"), (m, h) => {
    const hour = /^\d+$/.test(h) ? parseInt(h, 10) : wordNumber(h);
    if (hour === null || hour < 1 || hour > 12) return m;
    return `${hour === 1 ? 12 : hour - 1}:45`;
  });
  note(before);

  return out;
};

/**
 * "for twenty minutes" -> "~20m", which is how an estimate is written here.
 *
 * Only after a word that means a duration is coming. "call her in twenty
 * minutes" is a time, not an estimate, and turning it into one would file the
 * task with the wrong meaning -- so "in" is deliberately not in this list.
 */
const spokenEstimate: Step = (text, add) => {
  const re = new RegExp(`\\b(for|takes?|about|roughly|around)\\s+(${NUM}|\\d{1,3})\\s*(minutes?|mins?|hours?|hrs?)\\b`, "gi");
  const out = text.replace(re, (m, _lead, n, unit) => {
    const value = /^\d+$/.test(n) ? parseInt(n, 10) : wordNumber(n);
    if (value === null || value <= 0) return m;
    return /^h/i.test(unit) ? `~${value}h` : `~${value}m`;
  });
  if (out !== text) add(text.trim(), out.trim(), "estimate");
  return out;
};

/* ------------------------------------------------------- the person's words */

/**
 * Words too ordinary to ever be a mishearing of a list name.
 *
 * Without this, a list called "Word" swallows every "work", and a habit
 * called "Rest" swallows every "best". A name only wins against a word the
 * person is unlikely to have meant literally.
 */
const COMMON = new Set(
  ("the a an and or but if then than that this these those i me my we our you your he she it they them his her its their\n" +
    "is am are was were be been being do does did done doing have has had having will would can could shall should may\n" +
    "might must need to of in on at by for with from into over under about after before again more most some any all\n" +
    "not no yes now today tomorrow yesterday morning afternoon evening night week month year day days time times\n" +
    "add new make call send get go come take put move set buy pay book read write plan check mail email text\n" +
    "task tasks list lists note notes thing things stuff work home back down up out off just also very really please")
    .split(/\s+/)
    .filter(Boolean),
);

/** Distance as far as it matters: anything past the cap is simply "too far". */
function editDistance(a: string, b: string, cap: number): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      row.push(v);
      if (v < best) best = v;
    }
    if (best > cap) return cap + 1;
    prev = row;
  }
  return prev[b.length];
}

/**
 * A rough sound of a word, so "Ravi" and "Robby", or "Kairo" and "Cairo",
 * come out the same. Not a real phonetic algorithm -- it only has to be
 * wrong in the same way for two spellings of one sound.
 */
function soundOf(word: string): string {
  const s = word
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/^(kn|gn|pn|wr|ps)/, (m) => m[1])
    .replace(/ph/g, "f")
    .replace(/(?:ck|kh|q)/g, "k")
    .replace(/(?:sh|ch|sch)/g, "x")
    .replace(/(?:th|dh)/g, "t")
    .replace(/(?:z|s)/g, "s")
    .replace(/(?:v|w)/g, "v")
    .replace(/(?:c|g)(?=[eiy])/g, "j");
  if (!s) return "";
  const head = s[0];
  const tail = s
    .slice(1)
    .replace(/[aeiouhy]/g, "")
    .replace(/(.)\1+/g, "$1");
  return head + tail;
}

/** How far wrong a heard word may be and still be that word. */
function allowance(len: number): number {
  if (len <= 4) return 1;
  if (len <= 8) return 2;
  return 3;
}

/**
 * The best of the person's own words for something that was heard, or null
 * when nothing is close enough to be worth the risk of changing it.
 */
function nearest(heard: string, candidates: string[]): string | null {
  const key = heard.toLowerCase();
  if (key.length < 3) return null;
  let best: { word: string; score: number } | null = null;
  for (const word of candidates) {
    const target = word.toLowerCase();
    if (target === key) return null; // already right
    const cap = allowance(Math.max(key.length, target.length));
    const d = editDistance(key, target, cap);
    const sounds = d > cap && soundOf(key) !== "" && soundOf(key) === soundOf(target);
    if (d > cap && !sounds) continue;
    const score = sounds ? cap : d;
    if (!best || score < best.score) best = { word, score };
  }
  return best ? best.word : null;
}

/**
 * The person's own nouns, put back.
 *
 * Runs over the longest phrases first, so a two-word list name is matched as
 * a phrase before either of its words is considered on its own. A word the
 * whole language uses is left alone: the gain from catching one list name is
 * not worth turning somebody's "work" into their "Word" list.
 */
const snapVocab: Step = (text, add, vocab) => {
  const all = [...vocab.lists, ...vocab.names].filter((v) => v.trim().length >= 3);
  if (all.length === 0) return text;
  const longest = Math.min(4, Math.max(...all.map((v) => v.trim().split(/\s+/).length)));

  const parts = text.split(/(\s+)/); // words and the spaces between them, kept
  for (let n = longest; n >= 1; n--) {
    const candidates = all.filter((v) => v.trim().split(/\s+/).length === n);
    if (candidates.length === 0) continue;
    for (let i = 0; i < parts.length; i += 2) {
      const span = i + (n - 1) * 2;
      if (span >= parts.length) break;
      const slice = parts.slice(i, span + 1).join("");
      const bare = slice.replace(/^[^\w]+|[^\w']+$/g, "");
      if (!bare) continue;
      if (n === 1 && COMMON.has(bare.toLowerCase())) continue;
      const hit = nearest(bare, candidates);
      if (!hit) continue;
      const replaced = slice.replace(bare, hit);
      add(bare, hit, "vocab");
      parts[i] = replaced;
      for (let k = i + 1; k <= span; k++) parts[k] = "";
      i = span;
    }
  }
  return parts.join("");
};

/**
 * The full stop at the end, which is the single most expensive character a
 * speech model produces here: "move the invoice to Monday." leaves the
 * command parser looking for a day called "monday." Anything with real
 * sentence punctuation inside it is left alone -- that is a note, not a task.
 */
const trailingStop: Step = (text, add) => {
  const trimmed = text.trim();
  if (!/[.]$/.test(trimmed)) return text;
  const body = trimmed.slice(0, -1);
  if (/[.!?]/.test(body)) return text; // more than one sentence: leave it as written
  add(trimmed, body, "stop");
  return body;
};

const STEPS: Step[] = [stripMarks, collapseRepeats, spokenTime, spokenEstimate, snapVocab, trailingStop];

/**
 * Turn one transcript into something this app can file.
 *
 * Returns the text and every change made to it, so a caller can show the
 * person what was corrected, and so a test can assert on the reason rather
 * than only the result.
 */
export function polish(raw: string, vocab: Vocab = EMPTY_VOCAB): Polished {
  const fixes: Fix[] = [];
  const add = (from: string, to: string, kind: FixKind) => {
    if (from !== to) fixes.push({ from, to, kind });
  };

  let text = raw.replace(/\s+/g, " ").trim();
  if (!text) return { text: "", fixes };

  // nothing but a sign-off: the microphone heard a room, not a person
  const bare = text.toLowerCase().replace(/[.!?,]/g, "").trim();
  if (NOISE_ONLY.includes(bare)) {
    return { text: "", fixes: [{ from: text, to: "", kind: "noise" }] };
  }

  for (const step of STEPS) text = step(text, add, vocab).replace(/\s+/g, " ").trim();

  // and again, in case taking the noise out left only a sign-off behind
  const after = text.toLowerCase().replace(/[.!?,]/g, "").trim();
  if (NOISE_ONLY.includes(after)) return { text: "", fixes: [...fixes, { from: text, to: "", kind: "noise" }] };

  return { text, fixes };
}

/**
 * The vocabulary, out of what the person already has.
 *
 * List and habit names matter most -- they are the words a general model has
 * never been given a reason to prefer. Out of task titles we take only what
 * looks like a name: a capitalised word that is not merely the first word of
 * the title, which is how "Ravi" survives and "Buy" does not.
 */
export function buildVocab(lists: string[], habits: string[], titles: string[]): Vocab {
  const names = new Set<string>();
  for (const h of habits) if (h.trim()) names.add(h.trim());
  for (const title of titles) {
    const words = title.split(/\s+/);
    for (let i = 1; i < words.length; i++) {
      const w = words[i].replace(/^[^\w]+|[^\w']+$/g, "");
      if (w.length >= 3 && /^[A-Z][a-z'-]+$/.test(w) && !COMMON.has(w.toLowerCase())) names.add(w);
    }
  }
  return {
    lists: lists.filter((l) => l.trim().length >= 3),
    names: [...names].slice(0, 400),
  };
}
