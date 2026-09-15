"use client";

import { useEffect, useState } from "react";
import { gardenApi } from "@/lib/habits-client";
import { track } from "@/lib/analytics-client";
import { useApp } from "../../store";
import { Modal } from "../../ui";
import { PersonAvatar } from "../../person-avatar";
import { Burst, Moment, plink } from "../fx";
import { IconTick } from "../icons";
import { Plant } from "../plants";

const MESSAGE = "I saved you a plot next to my garden in Kairo City. Claim it, and let's grow better habits side by side.";
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

type Suggestion = { email: string; name: string; picture?: string; note: string };

/**
 * A plot saved for a friend, and the two ways to hand it over: copy the link
 * to send however you like, or find them by email and send it in one tap,
 * as a letter with a picture of your garden and the plot beside it.
 */
export function InviteSheet({ code: first, onClose, onCancelled, onNewCode }: { code: string; onClose: () => void; onCancelled: () => void; onNewCode: () => void }) {
  const { state, showToast } = useApp();
  const [code, setCode] = useState(first);
  const [mode, setMode] = useState<"link" | "email">("link");
  const [copied, setCopied] = useState(false);
  const [letting, setLetting] = useState(false);
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<{ email: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invited, setInvited] = useState<{ email: string; claimed: boolean }[]>([]);
  const [burst, setBurst] = useState(0);
  const url = `${window.location.origin}/i/${code}`;

  // the people invited before are suggestions too, fetched once the email side opens
  useEffect(() => {
    if (mode !== "email") return;
    let alive = true;
    void gardenApi.sentInvites().then((r) => {
      if (alive && r.ok) setInvited(r.data.sent);
    });
    return () => {
      alive = false;
    };
  }, [mode]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${MESSAGE} ${url}`);
      setCopied(true);
      track("city-invite-copy");
      showToast({ message: "Invite link copied. Paste it to your friend." });
    } catch {
      showToast({ message: url });
    }
  };

  const shareNative = async () => {
    try {
      await navigator.share({ title: "A plot for you in Kairo City", text: MESSAGE, url });
      track("city-invite-share");
    } catch {
      /* closed the share sheet */
    }
  };

  const letGo = async () => {
    setLetting(true);
    const r = await gardenApi.cancelInvite(code);
    setLetting(false);
    if (!r.ok) {
      showToast({ message: "That plot couldn't be let go just now." });
      return;
    }
    showToast({ message: "The plot is free again." });
    onCancelled();
  };

  const send = async (email: string, name: string) => {
    if (sending) return;
    setSending(email);
    setError(null);
    const r = await gardenApi.emailInvite(code, email);
    setSending(null);
    if (!r.ok) {
      setError(r.kind === "offline" ? "You're offline. Copy the link instead." : r.kind === "missing" ? "That plot isn't saved any more." : r.message);
      return;
    }
    track("city-invite-email");
    plink(true);
    setBurst((n) => n + 1);
    setSentTo({ email, name });
  };

  const saveAnother = async () => {
    const r = await gardenApi.invite();
    if (!r.ok) {
      showToast({ message: r.kind === "invalid" ? r.message : "Another plot couldn't be saved just now." });
      return;
    }
    setCode(r.data.code);
    setSentTo(null);
    setQuery("");
    setCopied(false);
    onNewCode();
  };

  // people you already share lists with, then people you've invited before
  const pool: Suggestion[] = [];
  const seen = new Set<string>();
  for (const p of state.people) {
    const email = p.email.toLowerCase();
    if (p.id === state.user.id || !email || seen.has(email)) continue;
    seen.add(email);
    pool.push({ email, name: p.name, picture: p.picture, note: "Shares a list with you" });
  }
  for (const i of invited) {
    if (seen.has(i.email)) continue;
    seen.add(i.email);
    pool.push({ email: i.email, name: "", note: i.claimed ? "Already your neighbour" : "Invited before" });
  }
  const q = query.trim().toLowerCase();
  const matches = (q ? pool.filter((p) => p.email.includes(q) || p.name.toLowerCase().includes(q)) : pool).slice(0, 5);
  const typed = EMAIL_RE.test(q) && !matches.some((m) => m.email === q) ? q : null;

  return (
    <Modal onClose={onClose} anchor="top" above>
      <div className="relative p-5" data-invite-sheet={code}>
        {/* your garden, and the plot beside it waiting */}
        <div className="relative flex h-28 items-end justify-center gap-3 overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#8ad0f6_0%,#d8f2fb_55%,#7cc46c_55%,#5aa651_100%)]" aria-hidden>
          <div className="flex w-[42%] flex-col items-center pb-2">
            <span className="mb-1 rounded-md bg-[#e9c89a] px-2 py-0.5 text-[10px] font-bold text-[#3b2716] shadow">You</span>
            <div className="flex items-end gap-1">
              <Plant species="apple" stage={5} size={42} fit="snug" />
              <Plant species="sunflower" stage={4} size={34} fit="snug" />
            </div>
          </div>
          <div className="city-invite mb-3 flex w-[42%] flex-col items-center rounded-xl border-2 border-dashed border-[#f4c95d] bg-white/40 px-2 py-2.5">
            <span className="rounded-md bg-[#ffe9a3] px-2 py-0.5 text-[10px] font-bold text-[#5c4300] shadow">{sentTo ? (sentTo.name || sentTo.email.split("@")[0]) : "Your friend"}</span>
            <span className="mt-1 text-[11px] font-semibold text-[#1c2624]">{sentTo ? "Invite on its way" : "Saved for them"}</span>
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-1/2">
            <Moment id={burst} ms={1600}>
              <Burst golden count={36} />
            </Moment>
          </div>
        </div>

        {sentTo ? (
          <div className="mt-4 text-center" data-invite-sent>
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-moss text-white shadow-lg">
              <IconTick size={20} />
            </span>
            <h2 className="font-display mt-3 text-2xl leading-tight">Invite sent to {sentTo.name || sentTo.email}</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-soft">
              They&apos;ll get a picture of your garden and the plot beside it, with one button to claim it. You&apos;ll hear the moment they move in.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button type="button" onClick={() => void saveAnother()} className="h-11 rounded-full bg-sun px-5 text-sm font-bold text-on-accent hover:bg-sun-deep" data-save-another>
                Save a plot for someone else
              </button>
              <button type="button" onClick={onClose} className="h-11 rounded-full px-5 text-sm font-semibold text-ink-soft hover:bg-paper-deep">
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="font-display mt-4 text-2xl leading-tight">Save this plot for a friend</h2>
            <p className="mt-1 text-sm text-ink-soft">When they claim it, they move in right next to you, and you both get a bench for two.</p>

            {/* the two ways to hand it over */}
            <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="How to invite">
              {(
                [
                  { id: "link", title: "Copy link", body: "Send it anywhere", icon: <path d="M7 9.5a3 3 0 0 0 4.2.3l2-2a3 3 0 0 0-4.2-4.3l-1 1M9 6.5a3 3 0 0 0-4.2-.3l-2 2a3 3 0 0 0 4.2 4.3l1-1" /> },
                  { id: "email", title: "Invite by email", body: "Find them, send in a tap", icon: <path d="M2 4h12v8H2zM2 4l6 5 6-5" /> },
                ] as const
              ).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={mode === o.id}
                  onClick={() => {
                    setMode(o.id);
                    setError(null);
                  }}
                  className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-all ${mode === o.id ? "border-sun bg-sun-soft/60 shadow-sm" : "border-line bg-card hover:border-sun/50"}`}
                  data-invite-mode={o.id}
                >
                  <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${mode === o.id ? "bg-sun text-on-accent" : "bg-paper-deep text-ink-soft"}`}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      {o.icon}
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{o.title}</span>
                    <span className="block truncate text-xs text-ink-faint">{o.body}</span>
                  </span>
                </button>
              ))}
            </div>

            {mode === "link" ? (
              <div className="mt-4">
                <div className="flex items-center gap-2 rounded-xl border border-line bg-paper py-1.5 pl-3 pr-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-soft" data-invite-url>
                    {url}
                  </span>
                </div>
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void copy()}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-sun text-sm font-bold text-on-accent shadow-sm transition-colors hover:bg-sun-deep"
                    data-copy-invite
                  >
                    {copied ? <IconTick size={14} /> : null}
                    {copied ? "Copied" : "Copy invite link"}
                  </button>
                  {typeof navigator !== "undefined" && "share" in navigator && (
                    <button type="button" onClick={() => void shareNative()} className="h-11 rounded-full border border-line px-4 text-sm font-semibold text-ink-soft hover:border-ink-faint hover:text-ink">
                      Share…
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <label className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 focus-within:border-sun">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-ink-faint" aria-hidden>
                    <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  <input
                    value={query}
                    autoFocus
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      if (typed) void send(typed, "");
                      else if (matches[0]) void send(matches[0].email, matches[0].name);
                    }}
                    type="email"
                    inputMode="email"
                    placeholder="Search a name, or type their email"
                    aria-label="Search a name, or type their email"
                    className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-faint"
                  />
                </label>

                <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto" aria-label="Suggestions">
                  {typed && (
                    <li>
                      <SendRow email={typed} name="" note="Send the invite to this address" sending={sending === typed} onSend={() => void send(typed, "")} />
                    </li>
                  )}
                  {matches.map((m) => (
                    <li key={m.email}>
                      <SendRow email={m.email} name={m.name} picture={m.picture} note={m.note} sending={sending === m.email} onSend={() => void send(m.email, m.name)} />
                    </li>
                  ))}
                  {!typed && matches.length === 0 && (
                    <li className="rounded-xl bg-paper-deep/60 px-3 py-3 text-center text-xs text-ink-faint">
                      {q ? "Keep typing their email address" : "Type a friend's email. People you share lists with show up here."}
                    </li>
                  )}
                </ul>
              </div>
            )}

            {error && (
              <p role="alert" className="mt-2 text-sm text-clay">
                {error}
              </p>
            )}

            <div className="mt-4 flex items-center justify-between gap-3">
              <button type="button" onClick={() => void letGo()} disabled={letting} className="text-xs font-medium text-ink-faint hover:text-clay disabled:opacity-60" data-let-go>
                {letting ? "Letting go…" : "Let this plot go"}
              </button>
              <button type="button" onClick={onClose} className="h-9 rounded-full px-4 text-sm font-semibold text-ink-soft hover:bg-paper-deep">
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function SendRow({ email, name, picture, note, sending, onSend }: { email: string; name: string; picture?: string; note: string; sending: boolean; onSend: () => void }) {
  return (
    <button
      type="button"
      onClick={onSend}
      disabled={sending}
      className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-sun-soft/50 disabled:opacity-70"
      data-send-to={email}
    >
      <PersonAvatar name={name || email} picture={picture} size={34} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{name || email}</span>
        <span className="block truncate text-xs text-ink-faint">{name ? email : note}</span>
      </span>
      <span className="shrink-0 rounded-full bg-sun px-3 py-1.5 text-xs font-bold text-on-accent transition-transform group-hover:scale-105">{sending ? "Sending…" : "Send"}</span>
    </button>
  );
}
