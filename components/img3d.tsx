import Image from "next/image";

/**
 * The 3D icon set living in /public/img. See IMAGE-PROMPTS.md for the
 * generation spec. Every key here must have a matching 256px PNG.
 */
export const LIST_ICONS = [
  "list-folder",
  "list-work",
  "list-home",
  "list-heart",
  "list-errands",
  "list-books",
  "list-fitness",
  "list-art",
  "list-travel",
  "list-growth",
  "list-mind",
  "list-goals",
] as const;

/** Tier 2 — key moments and empty states. */
export const SYSTEM_ICONS = ["sunrise", "moon", "inbox", "party", "bird", "book", "lock"] as const;

/** Tier 3 — small property icons for the task editor and menus. */
export const PROPERTY_ICONS = [
  "sun",
  "sun-cloud",
  "timer",
  "flag",
  "pencil",
  "leaf",
  "feather",
] as const;

const ALL_ICONS = new Set<string>([...LIST_ICONS, ...SYSTEM_ICONS, ...PROPERTY_ICONS]);

/** Legacy lists stored emoji — map them onto the icon set so old data upgrades itself. */
const EMOJI_TO_ICON: Record<string, string> = {
  "📁": "list-folder",
  "💼": "list-work",
  "🏡": "list-home",
  "❤️": "list-heart",
  "🛒": "list-errands",
  "📚": "list-books",
  "💪": "list-fitness",
  "🎨": "list-art",
  "✈️": "list-travel",
  "🌱": "list-growth",
  "🧠": "list-mind",
  "🎯": "list-goals",
};

export function iconKeyFor(value: string): string | null {
  if (ALL_ICONS.has(value)) return value;
  return EMOJI_TO_ICON[value] ?? null;
}

/** Renders a known 3D icon by key. */
export function Icon3d({
  name,
  size = 20,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={`/img/${name}.png`}
      alt=""
      width={size}
      height={size}
      className={`inline-block select-none object-contain ${className ?? ""}`}
      draggable={false}
    />
  );
}

/**
 * A list's visual mark: 3D icon when the stored value is (or maps to) one,
 * otherwise the raw emoji as text — old custom emojis keep working.
 */
export function ListMark({ value, size = 20 }: { value: string; size?: number }) {
  const key = iconKeyFor(value);
  if (key) return <Icon3d name={key} size={size} />;
  return (
    <span className="inline-block leading-none" style={{ fontSize: Math.round(size * 0.85) }}>
      {value}
    </span>
  );
}
