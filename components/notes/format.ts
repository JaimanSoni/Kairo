import { notesStore } from "@/lib/notes-client";

/** "just now", "12m ago", "3h ago", "yesterday", "4 Sep". */
export function ago(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  const date = new Date(then);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

/** "Projects / Kairo / Launch" — where a page lives, its own title left off. */
export function pathOf(id: string): string {
  return notesStore
    .ancestors(id)
    .map((a) => a.title || "Untitled")
    .join(" / ");
}
