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
