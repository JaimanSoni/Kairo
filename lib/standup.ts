/**
 * The morning standup, for people who have to post one.
 *
 * At AllEvents everyone writes the same message into the same Slack channel
 * every morning: what they did yesterday, what they are doing today. Kairo
 * already knows both -- it is the thing they ticked off and the thing they
 * planned -- so writing it out again by hand is the app failing to be useful
 * with what it has.
 *
 * Nothing here talks to a model or a database. It decides who this is for,
 * what shape the message takes, and what a line is allowed to say, so all of
 * that can be tested without either.
 */

/** Where this is the daily ritual. */
const TEAM_DOMAIN = "allevents.in";

/** Kairo's own author, who gets to say so at the bottom. */
const AUTHOR = "jaimansoni@gmail.com";

export const KAIRO_URL = "https://kairo.jaimansoni.com";

export function standupEmail(email: string | null | undefined): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

/** Whether to offer it at all. */
export function wantsStandup(email: string | null | undefined): boolean {
  const at = standupEmail(email);
  return at.endsWith(`@${TEAM_DOMAIN}`) || at === AUTHOR;
}

/** Whether the message ends with where it came from. */
export function signsOff(email: string | null | undefined): boolean {
  return standupEmail(email) === AUTHOR;
}

export type StandupLines = { yesterday: string[]; today: string[] };

/**
 * What a task looks like to the writer: its title, and the list it lives in
 * when that list adds something a colleague would need ("Design", "Ops").
 */
export type StandupTask = { title: string; list: string | null };

/* --------------------------------------------------------------- the text */

const BULLET = "• ";

/**
 * The message itself. The model writes the lines; the shape is ours, because
 * the shape is the part the channel expects to be the same every day.
 */
export function standupText(lines: StandupLines, opts: { signed?: boolean } = {}): string {
  const block = (heading: string, items: string[]) =>
    `${heading}\n${items.length ? items.map((l) => BULLET + l).join("\n") : `${BULLET}Nothing to report`}`;

  const body = [block("Yesterday's Update:", lines.yesterday), block("Today's Plan:", lines.today)].join("\n\n");
  return opts.signed ? `${body}\n\nsent using Kairo, try here: kairo` : body;
}

/**
 * The same message as HTML, so that pasting it into Slack carries a real
 * link rather than the word "kairo" with an address next to it.
 *
 * Slack's composer takes rich text off the clipboard, so the copy button
 * puts both flavours on it and lets Slack choose. Everywhere else gets the
 * plain one, which is why the plain one has to read properly on its own.
 */
export function standupHtml(lines: StandupLines, opts: { signed?: boolean } = {}): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const block = (heading: string, items: string[]) =>
    `<div>${esc(heading)}</div>` +
    (items.length
      ? `<ul>${items.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`
      : `<ul><li>Nothing to report</li></ul>`);

  const body = block("Yesterday's Update:", lines.yesterday) + "<br>" + block("Today's Plan:", lines.today);
  return opts.signed ? `${body}<br><div>sent using Kairo, try here: <a href="${KAIRO_URL}">kairo</a></div>` : body;
}

/* ------------------------------------------------------- keeping it honest */

/**
 * A line the model wrote, cleaned up.
 *
 * It arrives with a bullet on it about a third of the time however plainly
 * the prompt says not to, and occasionally with a heading it was told not to
 * write. Rather than reject the whole answer for a stray dash, the line is
 * tidied and kept.
 */
export function tidyLine(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let line = raw
    .replace(/^\s*(?:[-*•–]|\d+[.)])\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!line) return null;
  // a heading it was asked not to write
  if (/^(yesterday|today)(['’]s)?\s*(update|plan)?\s*:?$/i.test(line)) return null;
  // a greeting or a sign-off
  if (/^(hi|hey|hello|good morning|thanks|thank you)\b/i.test(line) && line.length < 40) return null;
  if (line.length > 240) line = line.slice(0, 237).trimEnd() + "…";
  return line;
}

export function tidyLines(raw: unknown, limit = 8): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const line = tidyLine(item);
    if (!line) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= limit) break;
  }
  return out;
}
