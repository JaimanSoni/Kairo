/**
 * Links that are better watched than read.
 *
 * A handful of places give a page of their own to drop into a frame: a
 * video, a track, a post. Everything else gets a card instead, which is the
 * honest answer for a link nobody can embed.
 *
 * Shapes rather than pixels: a video keeps 16:9, a track is a fixed strip, a
 * post is tall and scrolls inside itself.
 */

export type EmbedShape = "video" | "audio" | "portrait" | "post";

export type Embed = {
  provider: "YouTube" | "Vimeo" | "Loom" | "Spotify" | "Instagram" | "TikTok";
  /** The address that goes in the frame. */
  src: string;
  shape: EmbedShape;
};

const id = (value: string | undefined | null, pattern = /^[a-zA-Z0-9_-]{2,64}$/) => (value && pattern.test(value) ? value : null);

/** The frame for a link, when the place it points at offers one. */
export function embedFor(raw: string): Embed | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const video = id(url.searchParams.get("v")) ?? (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live" ? id(parts[1]) : null);
    if (video) return { provider: "YouTube", src: `https://www.youtube-nocookie.com/embed/${video}?rel=0`, shape: "video" };
  }
  if (host === "youtu.be") {
    const video = id(parts[0]);
    if (video) return { provider: "YouTube", src: `https://www.youtube-nocookie.com/embed/${video}?rel=0`, shape: "video" };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const video = id(parts.find((p) => /^\d{6,12}$/.test(p)), /^\d{6,12}$/);
    if (video) return { provider: "Vimeo", src: `https://player.vimeo.com/video/${video}`, shape: "video" };
  }
  if (host === "loom.com") {
    const video = id(parts[1] ?? null, /^[a-f0-9]{16,40}$/i);
    if ((parts[0] === "share" || parts[0] === "embed") && video) return { provider: "Loom", src: `https://www.loom.com/embed/${video}`, shape: "video" };
  }
  if (host === "open.spotify.com") {
    const kind = parts[0] === "embed" ? parts[1] : parts[0];
    const thing = id(parts[0] === "embed" ? parts[2] : parts[1]);
    if (thing && ["track", "album", "playlist", "episode", "show", "artist"].includes(kind ?? "")) {
      return { provider: "Spotify", src: `https://open.spotify.com/embed/${kind}/${thing}`, shape: kind === "track" || kind === "episode" ? "audio" : "post" };
    }
  }
  if (host === "instagram.com") {
    const kind = parts[0];
    const code = id(parts[1]);
    if (code && (kind === "p" || kind === "reel" || kind === "tv")) {
      return { provider: "Instagram", src: `https://www.instagram.com/${kind}/${code}/embed`, shape: "post" };
    }
  }
  if (host === "tiktok.com" || host === "vm.tiktok.com") {
    const video = id(parts[2] ?? null, /^\d{6,25}$/);
    if (parts[1] === "video" && video) return { provider: "TikTok", src: `https://www.tiktok.com/embed/v2/${video}`, shape: "portrait" };
  }
  return null;
}

/** What the card says it is, when the page itself says nothing. */
export function siteOf(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return raw.slice(0, 60);
  }
}
