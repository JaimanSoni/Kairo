import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { getDb } from "./db";

/**
 * What a link looks like, for the card a page shows instead of a bare URL.
 *
 * Kairo fetches the page itself, so two rules matter more than the parsing:
 *
 *   - It only ever fetches somewhere a browser could go. Every hop is checked
 *     before the request: http and https only, no credentials in the URL, and
 *     the address it resolves to must be a public one. Without that, a pasted
 *     link is a way to ask our server to read a private address for you.
 *   - It reads a little and stops. A few seconds, a few hundred kilobytes,
 *     three redirects. A slow or enormous page costs a card, not a request.
 *
 * What comes back is whatever the page says about itself (OpenGraph, then
 * Twitter's tags, then the plain title), kept for a week so the same link
 * pasted twice is fetched once.
 */

export type LinkPreview = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site: string | null;
  favicon: string | null;
};

const TIMEOUT_MS = 6_000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
/** A week: long enough to be worth keeping, short enough that a renamed page catches up. */
const CACHE_DAYS = 7;

type CacheRow = { _id: string; data: LinkPreview; at: Date; expiresAt: Date };

let indexReady: Promise<unknown> | null = null;
async function cache() {
  const col = (await getDb()).collection<CacheRow>("link_previews");
  indexReady ??= col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "link_preview_ttl" }).catch((err: unknown) => {
    indexReady = null;
    throw err;
  });
  await indexReady;
  return col;
}

/** Addresses no page of ours should ever be asked to read: ourselves, the network we sit on, the metadata service. */
function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v6 = ip.toLowerCase();
    if (v6 === "::1" || v6 === "::" || v6.startsWith("fe80") || v6.startsWith("fc") || v6.startsWith("fd")) return true;
    // an IPv4 address wearing an IPv6 coat
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // link-local, and the cloud metadata service
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  return false;
}

/** The URL as a browser would treat it, or null when it is not somewhere we may go. */
export function publicUrl(raw: unknown): URL | null {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname || url.hostname.endsWith(".local")) return null;
  if (url.hostname === "localhost" && process.env.LINK_PREVIEW_LOCAL !== "1") return null;
  return url;
}

const isLoopback = (ip: string) => ip === "::1" || ip.startsWith("127.");

/** Only while developing, and only when asked: a page served on this machine. Never in production. */
const loopbackAllowed = () => process.env.NODE_ENV !== "production" && process.env.LINK_PREVIEW_LOCAL === "1";

const allowed = (ip: string) => !isPrivateAddress(ip) || (isLoopback(ip) && loopbackAllowed());

async function resolvesPublicly(hostname: string): Promise<boolean> {
  if (isIP(hostname)) return allowed(hostname);
  try {
    const addresses = await lookup(hostname, { all: true });
    return addresses.length > 0 && addresses.every((a) => allowed(a.address));
  } catch {
    return false;
  }
}

const decode = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d{1,6});/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .trim();

const clip = (s: string | null, max: number) => {
  if (!s) return null;
  const text = decode(s).replace(/\s+/g, " ");
  return text ? text.slice(0, max) : null;
};

/** The content of the first meta tag whose property or name matches, however the attributes are ordered. */
function meta(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const pattern = new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`, "i");
    const tag = pattern.exec(html)?.[0];
    const content = tag ? /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] : null;
    if (content && content.trim()) return content;
  }
  return null;
}

function iconHref(html: string): string | null {
  const tags = html.match(/<link[^>]+>/gi) ?? [];
  for (const tag of tags) {
    const rel = /rel\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]?.toLowerCase() ?? "";
    if (!/\bicon\b/.test(rel)) continue;
    const href = /href\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (href) return href;
  }
  return null;
}

const absolute = (href: string | null, base: URL): string | null => {
  if (!href) return null;
  try {
    const url = new URL(href, base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString().slice(0, 2048) : null;
  } catch {
    return null;
  }
};

/** Follows up to three redirects by hand, checking each hop before going there. */
async function fetchHtml(start: URL, signal: AbortSignal): Promise<{ html: string; url: URL } | null> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await resolvesPublicly(url.hostname))) return null;
    const res = await fetch(url, {
      signal,
      redirect: "manual",
      headers: {
        // some sites serve a different (or no) card to something that hides what it is
        "User-Agent": "Mozilla/5.0 (compatible; KairoBot/1.0; +https://kairo.jaimansoni.com)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en",
      },
    });
    if (res.status >= 300 && res.status < 400) {
      const next = publicUrl(absolute(res.headers.get("location"), url));
      if (!next) return null;
      url = next;
      continue;
    }
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(type)) return { html: "", url };

    // read only the head-ish beginning: everything a card needs is up there
    const reader = res.body?.getReader();
    if (!reader) return { html: "", url };
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
      if (size >= MAX_BYTES) {
        await reader.cancel();
        break;
      }
    }
    const buffer = new Uint8Array(size);
    let at = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, at);
      at += chunk.byteLength;
    }
    return { html: new TextDecoder("utf-8").decode(buffer), url };
  }
  return null;
}

function read(html: string, url: URL): LinkPreview {
  const title = clip(meta(html, ["og:title", "twitter:title"]) ?? /<title[^>]*>([\s\S]{0,300})<\/title>/i.exec(html)?.[1] ?? null, 200);
  return {
    url: url.toString(),
    title,
    description: clip(meta(html, ["og:description", "twitter:description", "description"]), 300),
    image: absolute(meta(html, ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]), url),
    site: clip(meta(html, ["og:site_name", "application-name"]), 60) ?? url.hostname.replace(/^www\./, ""),
    favicon: absolute(iconHref(html) ?? "/favicon.ico", url),
  };
}

/**
 * What to show for a link. Cached for a week; a page that says nothing about
 * itself still gets a card with its address on it, which beats a spinner that
 * never ends.
 */
export async function linkPreview(raw: unknown): Promise<LinkPreview | null> {
  const url = publicUrl(raw);
  if (!url) return null;
  const key = url.toString();

  const col = await cache();
  const hit = await col.findOne({ _id: key });
  if (hit) return hit.data;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let data: LinkPreview;
  try {
    const page = await fetchHtml(url, controller.signal);
    data = page ? read(page.html, page.url) : { url: key, title: null, description: null, image: null, site: url.hostname.replace(/^www\./, ""), favicon: null };
  } catch {
    // unreachable, too slow, or refused: the card still names the site
    data = { url: key, title: null, description: null, image: null, site: url.hostname.replace(/^www\./, ""), favicon: null };
  } finally {
    clearTimeout(timer);
  }

  const now = new Date();
  await col
    .updateOne({ _id: key }, { $set: { data, at: now, expiresAt: new Date(now.getTime() + CACHE_DAYS * 24 * 60 * 60 * 1000) } }, { upsert: true })
    .catch(() => undefined);
  return data;
}
