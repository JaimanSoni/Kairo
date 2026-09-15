"use client";

import { useEffect, useRef, useState } from "react";
import { gardenApi, gardenStore } from "@/lib/habits-client";
import type { FriendCard, FriendsOverview, Friendship } from "@/lib/habits-shared";
import { track } from "@/lib/analytics-client";
import { useApp } from "../../store";
import { Modal } from "../../ui";
import { Avatar } from "../bits";
import { Burst, Moment, plink } from "../fx";
import { IconTick, IconUsers } from "../icons";
import { Plant } from "../plants";

/**
 * Friends in Kairo City, in one sheet: find a gardener by the name on their
 * gate, answer the requests waiting for you, see your friends and the ones
 * you've asked, and a few people you might know. Someone who isn't in the
 * city yet gets a plot saved beside yours instead.
 */
export function FriendsSheet({
  onClose,
  onVisit,
  onJoin,
  onInvite,
  onChanged,
}: {
  onClose: () => void;
  onVisit: (id: string) => void;
  onJoin: () => void;
  onInvite: () => void;
  /** A friendship changed here: the street and the badge follow. */
  onChanged: (id: string, friendship: Friendship, incoming: number) => void;
}) {
  const { showToast } = useApp();
  const [overview, setOverview] = useState<FriendsOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ q: string; results: FriendCard[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    void gardenApi.friends().then((r) => {
      if (!alive) return;
      if (r.ok) {
        setOverview(r.data);
        setFailed(false);
      } else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [reload]);

  // search as they type, a moment after they stop
  const q = query.trim();
  useEffect(() => {
    if (q.length < 2) return;
    let alive = true;
    const t = setTimeout(() => {
      void gardenApi.searchGardeners(q).then((r) => {
        if (alive && r.ok) setFound({ q, results: r.data.results });
      });
    }, 220);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const joined = overview?.joined ?? true;
  const results = found && found.q === q ? found.results : null;

  /** One gardener's new standing, everywhere this sheet shows them. */
  const settle = (card: FriendCard, friendship: Friendship) => {
    const moved = { ...card, friendship, note: undefined };
    const without = (list: FriendCard[]) => list.filter((c) => c.id !== card.id);
    const next = overview
      ? {
          ...overview,
          incoming: without(overview.incoming),
          outgoing: friendship === "requested" ? [moved, ...without(overview.outgoing)] : without(overview.outgoing),
          friends: friendship === "friends" ? [moved, ...without(overview.friends)].sort((a, b) => b.score - a.score) : without(overview.friends),
          suggestions: overview.suggestions.map((c) => (c.id === card.id ? { ...c, friendship } : c)),
        }
      : null;
    if (next) setOverview(next);
    setFound((f) => (f ? { ...f, results: f.results.map((c) => (c.id === card.id ? { ...c, friendship } : c)) } : f));
    const incoming = next?.incoming.length ?? 0;
    gardenStore.setFriendRequests(incoming);
    onChanged(card.id, friendship, incoming);
  };

  const act = async (card: FriendCard, action: "ask" | "accept" | "decline" | "drop") => {
    if (busy) return;
    if (!joined && (action === "ask" || action === "accept")) {
      onJoin();
      return;
    }
    setBusy(card.id);
    const r =
      action === "ask" ? await gardenApi.askFriend(card.id) : action === "drop" ? await gardenApi.dropFriend(card.id) : await gardenApi.answerFriend(card.id, action);
    setBusy(null);
    if (!r.ok) {
      showToast({ message: r.kind === "invalid" ? r.message : r.kind === "offline" ? "You're offline. Try again in a moment." : "That didn't go through. Try again." });
      if (r.kind === "missing") setReload((n) => n + 1);
      return;
    }
    const friendship = r.data.friendship;
    settle(card, friendship);
    track(`city-friend-${action}`);
    if (friendship === "friends" && card.friendship !== "friends") {
      plink(true);
      setBurst((n) => n + 1);
      showToast({ message: `You and ${card.name} are friends now.` });
    } else if (friendship === "requested" && action === "ask") {
      plink(false);
      showToast({ message: `Friend request sent to ${card.name}.` });
    } else if (action === "drop") {
      showToast({ message: card.friendship === "friends" ? `${card.name} is off your Friends street.` : `Request to ${card.name} taken back.` });
    }
  };

  const row = (card: FriendCard, where: "incoming" | "friends" | "outgoing" | "suggestion" | "result") => (
    <FriendRow key={`${where}-${card.id}`} card={card} where={where} busy={busy === card.id} onVisit={() => onVisit(card.id)} onAct={(a) => void act(card, a)} />
  );

  return (
    <Modal onClose={onClose} anchor="top" above>
      <div className="relative p-5" data-friends-sheet>
        <div className="pointer-events-none absolute inset-x-0 top-10 z-10">
          <Moment id={burst} ms={1600}>
            <Burst golden count={36} />
          </Moment>
        </div>
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sun-soft text-sun-deep">
            <IconUsers size={22} />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-2xl leading-tight">Friends</h2>
            <p className="mt-0.5 text-sm text-ink-soft">Friends share a street in Kairo City, and see each other&apos;s gardens grow.</p>
          </div>
        </div>

        {!joined && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-sun/40 bg-sun-soft/50 p-3" data-friends-join>
            <p className="min-w-0 flex-1 text-sm text-ink-soft">Claim your plot in the city to add friends and answer requests.</p>
            <button type="button" onClick={onJoin} className="h-9 rounded-full bg-sun px-4 text-xs font-bold text-on-accent hover:bg-sun-deep">
              Claim your plot
            </button>
          </div>
        )}

        <label className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-paper px-3 focus-within:border-sun">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-ink-faint" aria-hidden>
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={40}
            placeholder="Find a gardener by name"
            aria-label="Find a gardener by name"
            className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-faint"
            data-friend-search
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear the search" className="grid size-7 place-items-center rounded-full text-ink-faint hover:bg-paper-deep">
              ×
            </button>
          )}
        </label>

        <div className="mt-3 max-h-[min(52vh,32rem)] overflow-y-auto pr-0.5">
          {q.length >= 2 ? (
            <section aria-label="Gardeners found" data-friend-results>
              {results === null ? (
                <p className="px-2 py-4 text-center text-sm text-ink-faint" role="status">
                  Looking along the street…
                </p>
              ) : results.length ? (
                <ul className="space-y-1">{results.map((c) => row(c, "result"))}</ul>
              ) : (
                <div className="rounded-2xl bg-paper-deep/60 px-4 py-5 text-center" data-friend-none>
                  <p className="text-sm font-medium text-ink">No gardener on the street is called &ldquo;{q}&rdquo;</p>
                  <p className="mt-1 text-xs text-ink-faint">They might use another name on their gate, or not be in the city yet.</p>
                  <button type="button" onClick={onInvite} className="mt-3 h-9 rounded-full bg-sun px-4 text-xs font-bold text-on-accent hover:bg-sun-deep">
                    Invite them to the plot next door
                  </button>
                </div>
              )}
            </section>
          ) : q.length === 1 ? (
            <p className="px-2 py-4 text-center text-sm text-ink-faint">Keep typing a name</p>
          ) : !overview ? (
            failed ? (
              <button type="button" onClick={() => setReload((n) => n + 1)} className="w-full rounded-2xl bg-paper-deep/60 px-4 py-5 text-sm font-semibold text-ink-soft">
                Friends didn&apos;t load. Try again
              </button>
            ) : (
              <p className="px-2 py-6 text-center text-sm text-ink-faint" role="status">
                Gathering your friends…
              </p>
            )
          ) : (
            <div className="space-y-4">
              {overview.incoming.length > 0 && (
                <Section title={`Friend requests · ${overview.incoming.length}`} tone="sun" data="incoming">
                  {overview.incoming.map((c) => row(c, "incoming"))}
                </Section>
              )}

              <Section title={overview.friends.length ? `Your friends · ${overview.friends.length}` : "Your friends"} data="friends">
                {overview.friends.length ? (
                  overview.friends.map((c) => row(c, "friends"))
                ) : (
                  <li className="rounded-2xl bg-paper-deep/60 px-4 py-4 text-center text-sm text-ink-soft" data-friends-empty>
                    No friends on your street yet. Find someone by name above, or invite a friend who isn&apos;t here yet.
                  </li>
                )}
              </Section>

              {overview.outgoing.length > 0 && (
                <Section title="Waiting for an answer" data="outgoing">
                  {overview.outgoing.map((c) => row(c, "outgoing"))}
                </Section>
              )}

              {overview.suggestions.length > 0 && (
                <Section title="People you might know" data="suggestions">
                  {overview.suggestions.map((c) => row(c, "suggestion"))}
                </Section>
              )}

              <button
                type="button"
                onClick={onInvite}
                className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-sun/50 bg-sun-soft/30 p-3 text-left transition-colors hover:bg-sun-soft/60"
                data-friends-invite
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sun text-lg font-bold text-on-accent">+</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">Friend not in the city yet?</span>
                  <span className="block text-xs text-ink-soft">Save them the plot next to yours, and send the invite by link or email.</span>
                </span>
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="h-9 rounded-full px-4 text-sm font-semibold text-ink-soft hover:bg-paper-deep">
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Section({ title, tone, data, children }: { title: string; tone?: "sun"; data: string; children: React.ReactNode }) {
  return (
    <section data-friends-section={data}>
      <h3 className={`px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${tone === "sun" ? "text-sun-deep" : "text-ink-faint"}`}>{title}</h3>
      <ul className="space-y-1">{children}</ul>
    </section>
  );
}

function FriendRow({
  card,
  where,
  busy,
  onVisit,
  onAct,
}: {
  card: FriendCard;
  where: "incoming" | "friends" | "outgoing" | "suggestion" | "result";
  busy: boolean;
  onVisit: () => void;
  onAct: (action: "ask" | "accept" | "decline" | "drop") => void;
}) {
  // ending a friendship takes a second tap, for a few seconds
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  const line = card.note ?? (card.dueToday > 0 ? `Level ${card.level} · ${card.doneToday} of ${card.dueToday} done today` : `Level ${card.level} · ${card.score} pts`);
  const f = card.friendship;

  return (
    <li className={`flex items-center gap-2.5 rounded-2xl px-2 py-2 transition-colors ${where === "incoming" ? "bg-sun-soft/40" : "hover:bg-paper-deep/60"}`} data-friend={card.id} data-friendship={f ?? "none"}>
      <button type="button" onClick={onVisit} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Visit ${card.name}'s garden`}>
        <Avatar animal={card.animal} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{card.name}</span>
          <span className="block truncate text-xs text-ink-faint">{line}</span>
        </span>
        <span className="hidden shrink-0 items-end gap-0.5 sm:flex" aria-hidden>
          {card.plants.map((p, i) => (
            <Plant key={i} species={p.species} stage={p.stage} size={i === 0 ? 26 : 20} sway={false} ground="none" fit="tight" />
          ))}
        </span>
      </button>

      <span className="flex shrink-0 items-center gap-1">
        {f === "incoming" ? (
          <>
            <button type="button" disabled={busy} onClick={() => onAct("accept")} className="h-8 rounded-full bg-sun px-3.5 text-xs font-bold text-on-accent hover:bg-sun-deep disabled:opacity-60" data-friend-accept>
              {busy ? "…" : "Accept"}
            </button>
            <button type="button" disabled={busy} onClick={() => onAct("decline")} aria-label={`Decline ${card.name}`} className="grid size-8 place-items-center rounded-full text-ink-faint hover:bg-paper-deep hover:text-ink" data-friend-decline>
              ×
            </button>
          </>
        ) : f === "friends" ? (
          where === "friends" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => (confirming ? onAct("drop") : setConfirming(true))}
              className={`h-8 rounded-full px-3 text-xs font-semibold transition-colors ${confirming ? "bg-clay text-white" : "text-ink-faint hover:bg-paper-deep hover:text-ink-soft"}`}
              data-friend-remove
            >
              {busy ? "…" : confirming ? "Remove?" : "Remove"}
            </button>
          ) : (
            <span className="flex h-8 items-center gap-1 rounded-full bg-moss-soft px-3 text-xs font-semibold text-moss">
              <IconTick size={11} /> Friends
            </span>
          )
        ) : f === "requested" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => (confirming ? onAct("drop") : setConfirming(true))}
            className={`h-8 rounded-full border px-3 text-xs font-semibold transition-colors ${confirming ? "border-clay bg-clay text-white" : "border-line text-ink-soft hover:border-ink-faint"}`}
            data-friend-cancel
          >
            {busy ? "…" : confirming ? "Take back?" : "Requested"}
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => onAct("ask")} className="h-8 rounded-full bg-ink px-3.5 text-xs font-bold text-paper transition-transform hover:-translate-y-0.5 disabled:opacity-60" data-friend-add>
            {busy ? "…" : "Add friend"}
          </button>
        )}
      </span>
    </li>
  );
}

/**
 * Inside someone's garden: where you stand with them, as one button. Add,
 * take back a request, accept theirs, or see that you're friends.
 */
export function FriendAction({
  id,
  name,
  friendship,
  canAsk,
  onJoin,
  onChanged,
}: {
  id: string;
  name: string;
  friendship: Friendship;
  canAsk: boolean;
  onJoin: () => void;
  onChanged: (friendship: Friendship) => void;
}) {
  const { showToast } = useApp();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  const run = async (action: "ask" | "accept" | "drop") => {
    if (busy) return;
    if (!canAsk && action !== "drop") {
      onJoin();
      return;
    }
    setBusy(true);
    const r = action === "ask" ? await gardenApi.askFriend(id) : action === "accept" ? await gardenApi.answerFriend(id, "accept") : await gardenApi.dropFriend(id);
    setBusy(false);
    setConfirming(false);
    if (!r.ok) {
      showToast({ message: r.kind === "invalid" ? r.message : "That didn't go through. Try again." });
      return;
    }
    track(`city-friend-${action}`);
    // the button itself says what happened: a toast here would sit over the buttons, in the way of the next tap
    if (r.data.friendship === "friends" && friendship !== "friends") {
      plink(true);
      setBurst((n) => n + 1);
    } else if (r.data.friendship === "requested" && action === "ask") {
      plink(false);
      setBurst((n) => n + 1);
    }
    onChanged(r.data.friendship);
  };

  const base = "relative flex h-12 items-center gap-2 rounded-full px-5 text-sm font-bold shadow-xl transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0";
  return (
    <span className="relative" data-friend-action={friendship ?? "none"}>
      <span className="pointer-events-none absolute inset-x-0 top-0">
        <Moment id={burst} ms={1400}>
          <Burst count={20} />
        </Moment>
      </span>
      {friendship === "friends" ? (
        <span className="gd-hud flex h-12 items-center gap-2 rounded-full px-5 text-sm font-bold text-white">
          <IconTick size={13} /> Friends
        </span>
      ) : friendship === "incoming" ? (
        <button type="button" disabled={busy} onClick={() => void run("accept")} className={`${base} bg-white text-[#1c2624]`} data-friend-accept>
          <IconUsers size={16} /> {busy ? "Accepting…" : `Accept ${name}'s request`}
        </button>
      ) : friendship === "requested" ? (
        <button type="button" disabled={busy} onClick={() => (confirming ? void run("drop") : setConfirming(true))} className={`${base} ${confirming ? "bg-clay text-white" : "gd-hud text-white"}`} data-friend-cancel>
          <IconUsers size={16} /> {busy ? "…" : confirming ? "Take back the request?" : "Requested"}
        </button>
      ) : (
        <button type="button" disabled={busy} onClick={() => void run("ask")} className={`${base} bg-white text-[#1c2624]`} data-friend-add>
          <IconUsers size={16} /> {busy ? "Sending…" : "Add friend"}
        </button>
      )}
    </span>
  );
}
