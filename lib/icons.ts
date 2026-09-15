/**
 * Kairo's 3D icon set, by key. Every key has a 256px PNG in /public/img (see
 * IMAGE-PROMPTS.md for how they're made). Nothing here touches React, so the
 * server can check a key as easily as a component can draw one.
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

/** Tier 2: key moments and empty states. */
export const SYSTEM_ICONS = ["sunrise", "moon", "inbox", "party", "bird", "book", "lock", "sparkle"] as const;

/** Tier 3: small property icons for the task editor and menus. */
export const PROPERTY_ICONS = ["sun", "repeat", "bell", "coffee", "sun-cloud", "timer", "flag", "pencil", "leaf", "feather"] as const;

const ALL_ICONS = new Set<string>([...LIST_ICONS, ...SYSTEM_ICONS, ...PROPERTY_ICONS]);

export const isIconKey = (v: unknown): v is string => typeof v === "string" && ALL_ICONS.has(v);

/** What each icon shows, in words: its label, and what an assistant can ask for. */
export const ICON_NAMES: Record<string, string> = {
  "list-folder": "Folder",
  "list-work": "Briefcase",
  "list-home": "Home",
  "list-heart": "Heart",
  "list-errands": "Shopping cart",
  "list-books": "Books",
  "list-fitness": "Dumbbells",
  "list-art": "Palette",
  "list-travel": "Plane",
  "list-growth": "Sprout",
  "list-mind": "Brain",
  "list-goals": "Target",
  sunrise: "Sunrise",
  moon: "Moon",
  inbox: "Inbox",
  party: "Party popper",
  bird: "Paper plane",
  book: "Open book",
  lock: "Lock",
  sparkle: "Sparkles",
  sun: "Sun",
  repeat: "Repeat",
  bell: "Bell",
  coffee: "Coffee",
  "sun-cloud": "Sun and cloud",
  timer: "Stopwatch",
  flag: "Flag",
  pencil: "Pencil",
  leaf: "Leaf",
  feather: "Feather",
};

/** Legacy lists stored emoji. These map onto the icon set so old data upgrades itself. */
export const EMOJI_TO_ICON: Record<string, string> = {
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

/**
 * Pages and callouts in notes began with emoji. Each one that has a close
 * match in the icon set gets it; the rest show the plain page mark.
 */
const PAGE_EMOJI: [icon: string, emoji: string][] = [
  ["list-folder", "📁 📂 🗂 🗃 📋 🗄"],
  ["list-work", "💼 🏢 💻 🖥 ⌨ 📊 🧾 🧮 🖱 📠"],
  ["list-home", "🏠 🏡 🛏 🧹 🛋 🏘"],
  ["list-heart", "❤ 🧡 💛 💚 💙 💜 🖤 🤍 😍 🥰 💖 💕 💗 😘 🤗"],
  ["list-errands", "🛒 📦 🛍 💳 💰 💵 🪙 🧺"],
  ["list-books", "📚 🎓 🏫 🧑‍🏫"],
  ["list-fitness", "💪 🏃 🚴 🏋 ⚽ 🏀 🎾 🏏 🏈 ⛳ 🏓 🥇 🩺 💊"],
  ["list-art", "🎨 🎭 🎬 📷 🎸 🎹 🎧 🎤 🥁 🧶 🧑‍🎨 🎮 🧩 ♟"],
  ["list-travel", "✈ 🛫 🗺 🧭 🧳 🏖 🏝 🌍 🚗 🚆 🚌 🚲 ⛵ 🚢 🏕 🏙 🗼 🏰"],
  ["list-growth", "🌱 🪴 🌿 📈 🌳 🌲 🌵"],
  ["list-mind", "🧠 🤔 🧘 🧐 🤯"],
  ["list-goals", "🎯 🏆 💯 🚀"],
  ["sunrise", "🌅 🌄"],
  ["moon", "🌙 🌛 🌜 😴 💤"],
  ["inbox", "📥 📬 ✉ 📨 📩 📮 ✅ ☑ ✔"],
  ["party", "🎉 🥳 🎁 🎂 🎊 🎈 🍰 🧁"],
  ["bird", "🕊 🐦 📤"],
  ["book", "📖 📓 📔 📒 📕 📗 📘 📙"],
  ["lock", "🔒 🔑 🔐 🗝"],
  ["sparkle", "💡 ✨ ⭐ 🌟 💫 🪄 🔥 ⚡"],
  ["sun", "☀ 🔆 🌞 😎"],
  ["repeat", "🔁 🔄 ♻ 🗓 📅 📆 ♾"],
  ["bell", "🔔 📣 📢 ❗ ⚠"],
  ["coffee", "☕ 🍵 🧋"],
  ["sun-cloud", "🌤 ⛅ 🌥 🌦 🌈"],
  ["timer", "⏰ ⌛ ⏳ ⏱ 🕐"],
  ["flag", "🚩 🏁 📌 📍 🔖 🏷"],
  ["pencil", "📝 ✏ 🖊 🖋 ✍ 🗒"],
  ["leaf", "🍀 🍁 🍂 🌸 🌻 🌷 🌹"],
  ["feather", "🪶 💭 💬 🗣"],
];

/** Emoji compared without their presentation selector, so "✏️" and "✏" are one. */
const bare = (s: string) => s.replace(/️/g, "");

const PAGE_EMOJI_TO_ICON = new Map<string, string>();
for (const [icon, list] of PAGE_EMOJI) {
  for (const emoji of list.split(" ")) PAGE_EMOJI_TO_ICON.set(bare(emoji), icon);
}

/** The icon a page (or callout) shows: its key, a legacy emoji's match, or nothing. */
export function pageIconKey(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  if (ALL_ICONS.has(value)) return value;
  return PAGE_EMOJI_TO_ICON.get(bare(value.trim())) ?? null;
}

/** Every key, in the order a picker shows them. */
export const PAGE_ICONS: readonly string[] = [...LIST_ICONS, ...SYSTEM_ICONS, ...PROPERTY_ICONS];
