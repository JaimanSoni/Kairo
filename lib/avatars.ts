/**
 * The house animals: six 3D characters that stand in when an account has no
 * Google photo. The pick hashes the person's name, so the same person shows
 * the same animal everywhere, every time, with nothing stored.
 */
export function animalAvatar(seed: string): string {
  let n = 0;
  for (const ch of seed || "kairo") n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return `/avatars/avatar-${(n % 6) + 1}.png`;
}

/** What an account may choose to wear: the Google photo, or an animal. */
export const AVATAR_CHOICES = [
  "google",
  "animal-1",
  "animal-2",
  "animal-3",
  "animal-4",
  "animal-5",
  "animal-6",
] as const;
export type AvatarChoice = (typeof AVATAR_CHOICES)[number];

export function isAvatarChoice(x: unknown): x is AvatarChoice {
  return typeof x === "string" && (AVATAR_CHOICES as readonly string[]).includes(x);
}

/** The picture an explicit choice resolves to. */
export function avatarChoiceUrl(choice: string): string | undefined {
  const m = /^animal-([1-6])$/.exec(choice);
  return m ? `/avatars/avatar-${m[1]}.png` : undefined;
}

/**
 * The picture everyone should see for an account: their chosen animal if they
 * picked one, else the Google photo. Runs wherever a user is serialized, so a
 * choice made once holds everywhere, including in other people's views.
 */
export function resolveAvatar(
  choice: string | undefined | null,
  googlePicture: string | undefined
): string | undefined {
  return (choice && avatarChoiceUrl(choice)) || googlePicture;
}
