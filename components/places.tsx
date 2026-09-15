import type { SpacePrefs } from "@/lib/types";
import { IconBook, IconCalendar, IconInbox, IconJournal, IconNotes, IconSprout, IconSun } from "./ui";

/**
 * Kairo's places, the same on every screen: Today, the day you're in; Plan,
 * where tasks wait for their day; Notes; and the garden. A desktop lists every
 * page under its place; a phone has one tab per place, and a switch at the top
 * of a place with more than one page moves between them.
 */

export type NavItem = { href: string; label: string; icon: (p: { size?: number; className?: string }) => React.ReactNode };
export type Space = { id: string; label: string; icon: NavItem["icon"]; items: NavItem[] };

export const TODAY: NavItem = { href: "/today", label: "Today", icon: IconSun };

export const SPACES: Space[] = [
  {
    id: "plan",
    label: "Plan",
    icon: IconCalendar,
    items: [
      { href: "/calendar", label: "Calendar", icon: IconCalendar },
      { href: "/lists", label: "Lists", icon: IconInbox },
      { href: "/log", label: "Log", icon: IconBook },
    ],
  },
  {
    id: "write",
    label: "Write",
    icon: IconNotes,
    // Notes first: it's where Write opens. The journal is hidden for now (see JOURNAL_SHOWN).
    items: [
      { href: "/notes", label: "Notes", icon: IconNotes },
      { href: "/journal", label: "Journal", icon: IconJournal },
    ],
  },
  {
    id: "grow",
    label: "Grow",
    icon: IconSprout,
    items: [{ href: "/habits", label: "Habits", icon: IconSprout }],
  },
];

/** The pages each optional place owns. */
const OPTIONAL: Record<string, keyof SpacePrefs> = { "/journal": "journal", "/notes": "notes", "/habits": "garden" };

/** The places this account keeps: hidden pages leave their place, and an empty place leaves altogether. */
export function visibleSpaces(prefs: SpacePrefs): Space[] {
  return SPACES.map((s) => ({ ...s, items: s.items.filter((i) => !OPTIONAL[i.href] || prefs[OPTIONAL[i.href]]) })).filter((s) => s.items.length > 0);
}

/** Every page shown, in sidebar order, with the number key that opens it: numbers never skip a hidden page. */
export function numberedPages(prefs: SpacePrefs): (NavItem & { key: string })[] {
  return [TODAY, ...visibleSpaces(prefs).flatMap((s) => s.items)].map((item, i) => ({ ...item, key: String(i + 1) }));
}
