"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ANIMALS, cleanGardenerName, seedOf, SEEDS, type Board, type Gardener, type SeedStat } from "@/lib/habits-shared";
import { gardenApi, gardenStore } from "@/lib/habits-client";
import { useApp } from "../store";
import { CITY_SHOWN } from "@/lib/types";
import { navigateApp } from "../app-views";
import { Plant } from "./plants";
import { Avatar, BackLink, HABIT_TINT, RankBadge, SectionTitle } from "./bits";
import { IconFlame, IconTrophy, IconUsers } from "./icons";
import { useGarden } from "./use-garden";

/**
 * Leaderboards: other people keeping the same habits. Nobody appears here
 * until they choose a name and an animal and say yes; nothing else about them
 * is shown.
 */
export function CommunityPage() {
  const { habits, gardener } = useGarden();
  const params = useSearchParams();
  const seeded = habits.filter((h) => h.seedId && seedOf(h.seedId));
  const asked = params.get("seed");
  const initial = asked && seedOf(asked) ? asked : seeded[0]?.seedId ?? "water";
  const [seed, setSeed] = useState(initial);
  const [scope, setScope] = useState<"global" | "friends">("global");
  const [stats, setStats] = useState<SeedStat[]>([]);

  useEffect(() => {
    let alive = true;
    void gardenApi.seeds().then((r) => {
      if (alive && r.ok) setStats(r.data.stats);
    });
    return () => {
      alive = false;
    };
  }, []);

  const mine = new Set(seeded.map((h) => h.seedId as string));
  const order = [...SEEDS].sort(
    (a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)) || (stats.find((s) => s.seedId === b.id)?.gardeners ?? 0) - (stats.find((s) => s.seedId === a.id)?.gardeners ?? 0)
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6 sm:px-6">
      <BackLink href="/habits" label="Habits" />
      <header className="anim-rise mb-6 mt-3">
        <h1 className="font-display text-4xl">Leaderboards</h1>
        <p className="mt-1 text-sm text-ink-soft">A streak leaderboard for every habit idea. Only habits started from Ideas take part.</p>
      </header>

      <GardenerCard key={gardener ? `${gardener.name}:${gardener.animal}:${gardener.public}` : "none"} gardener={gardener} />

      <section className="mt-8">
        <SectionTitle>Habits</SectionTitle>
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
          {order.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={seed === s.id}
              onClick={() => {
                setSeed(s.id);
                window.history.replaceState(null, "", `/habits/community?seed=${s.id}`);
              }}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors ${
                seed === s.id ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-soft hover:border-ink-faint hover:text-ink"
              }`}
            >
              {mine.has(s.id) && <span className="size-1.5 rounded-full" style={{ background: HABIT_TINT[s.color] }} aria-label="(on your list)" />}
              {s.name}
            </button>
          ))}
        </div>

        <BoardList key={`${seed}:${scope}`} seedId={seed} scope={scope} setScope={setScope} growing={mine.has(seed)} gardener={gardener} />
      </section>
    </div>
  );
}

function BoardList({
  seedId,
  scope,
  setScope,
  growing,
  gardener,
}: {
  seedId: string;
  scope: "global" | "friends";
  setScope: (s: "global" | "friends") => void;
  growing: boolean;
  gardener: Gardener | null;
}) {
  const [board, setBoard] = useState<Board | null>(null);
  const [failed, setFailed] = useState(false);
  const seed = seedOf(seedId)!;
  const unit = (n: number) => (seed.schedule.kind === "weekly" ? (n === 1 ? "week" : "weeks") : n === 1 ? "day" : "days");

  useEffect(() => {
    let alive = true;
    void gardenApi.board(seedId, scope).then((r) => {
      if (!alive) return;
      if (r.ok) setBoard(r.data);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [seedId, scope, gardener?.public, gardener?.name, gardener?.animal]);

  const me = board?.me ?? null;
  const above = board && me ? [...board.rows].reverse().find((r) => r.streak > me.streak) : null;
  const showMeBelow = Boolean(board && me && !board.rows.some((r) => r.me));

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <span
          className="grid size-11 shrink-0 place-items-end justify-center overflow-hidden rounded-xl"
          style={{ background: `color-mix(in srgb, ${HABIT_TINT[seed.color]} 14%, transparent)` }}
        >
          <Plant species={seed.species} stage={5} size={36} sway={false} ground="none" fit="snug" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{seed.name}</div>
          <div className="flex items-center gap-1 text-xs text-ink-faint">
            <IconUsers size={12} />
            {board ? `${board.gardeners} ${board.gardeners === 1 ? "person" : "people"} on this leaderboard` : "…"}
          </div>
        </div>
        <div className="inline-flex rounded-full border border-line bg-paper p-0.5">
          {(["global", "friends"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={scope === s}
              onClick={() => setScope(s)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${scope === s ? "bg-card text-ink shadow-sm" : "text-ink-faint hover:text-ink-soft"}`}
            >
              {s === "global" ? "Everyone" : "Friends"}
            </button>
          ))}
        </div>
        {!growing && (
          <button type="button" onClick={() => navigateApp(`/habits/ideas?start=${seedId}`)} className="h-8 shrink-0 rounded-full bg-ink px-3.5 text-xs font-semibold text-paper">
            Start it
          </button>
        )}
      </div>

      {failed ? (
        <p className="px-4 py-6 text-sm text-ink-soft">The leaderboard didn&apos;t load. Try again in a moment.</p>
      ) : !board ? (
        <div className="space-y-2 p-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-paper-deep" />
          ))}
        </div>
      ) : (
        <>
          {me && (
            <div className="flex items-start gap-3 border-b border-line bg-sun-soft/40 px-4 py-3">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-card text-sun-deep shadow-sm">
                <IconTrophy size={15} />
              </span>
              <p className="text-sm text-ink">
                <b className="font-semibold">{gardener?.public ? `You're #${me.rank}` : `You'd be #${me.rank}`}</b> with a {me.streak}-{unit(1)} streak.{" "}
                <span className="text-ink-soft">
                  {above ? (
                    <>
                      {above.streak - me.streak + 1} more {unit(above.streak - me.streak + 1)} to pass {above.name}.
                    </>
                  ) : me.streak > 0 ? (
                    "Nobody's ahead of you."
                  ) : (
                    "Mark it done today to get on the leaderboard."
                  )}
                </span>
                {!gardener?.public && <span className="mt-0.5 block text-xs text-ink-faint">Only you can see this until you join the leaderboards.</span>}
              </p>
            </div>
          )}

          {board.rows.length === 0 && !showMeBelow ? (
            <p className="px-4 py-8 text-center text-sm text-ink-soft">
              {scope === "friends" ? "None of the people you share lists with are on this leaderboard yet." : "Nobody public here yet. The top spot is open."}
            </p>
          ) : (
            <ol className="divide-y divide-line">
              {board.rows.map((r, i) => (
                <li key={`${i}-${r.name}`} className={`flex items-center gap-3 px-4 py-2.5 ${r.me ? "bg-sun-soft/40" : ""}`}>
                  <RankBadge rank={r.rank} />
                  <Avatar animal={r.animal} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {r.name}
                      {r.me && <span className="ml-1.5 text-xs font-normal text-ink-faint">(you)</span>}
                    </span>
                    <span className="block text-[11px] text-ink-faint">best {r.best}</span>
                  </span>
                  <span className="flex items-center gap-1 text-sm font-semibold tabular-nums">
                    <IconFlame size={14} className="text-clay" />
                    {r.streak}
                  </span>
                </li>
              ))}
              {showMeBelow && me && (
                <li className="flex items-center gap-3 px-4 py-2.5">
                  <RankBadge rank={me.rank} />
                  <Avatar animal={me.animal} size={32} className="opacity-60" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-soft">{me.name} (you, hidden)</span>
                  <span className="flex items-center gap-1 text-sm font-semibold tabular-nums text-ink-soft">
                    <IconFlame size={14} />
                    {me.streak}
                  </span>
                </li>
              )}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

function GardenerCard({ gardener }: { gardener: Gardener | null }) {
  const { showToast } = useApp();
  const [editing, setEditing] = useState(!gardener);
  const [name, setName] = useState(gardener?.name ?? "");
  const [animal, setAnimal] = useState<Gardener["animal"]>(gardener?.animal ?? "1");
  const [open, setOpen] = useState(gardener?.public ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (patch?: Partial<Gardener>) => {
    const next = { name, animal, public: open, ...patch };
    if (!cleanGardenerName(next.name)) {
      setError("A name is 2 to 24 letters, numbers or spaces.");
      return;
    }
    setBusy(true);
    setError(null);
    const r = await gardenApi.setProfile(next);
    setBusy(false);
    if (!r.ok) {
      setError(r.kind === "invalid" ? r.message : "That didn't save. Try again.");
      return;
    }
    gardenStore.setGardener(r.data.gardener);
    setEditing(false);
    showToast({ message: r.data.gardener.public ? `You're ${CITY_SHOWN ? "in Kairo City and " : ""}on the leaderboards as ${r.data.gardener.name}.` : `You're hidden from ${CITY_SHOWN ? "Kairo City and " : ""}the leaderboards.` });
  };

  if (gardener && !editing) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
        <Avatar animal={gardener.animal} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{gardener.name}</div>
          <div className="text-xs text-ink-faint">{gardener.public ? (CITY_SHOWN ? "In Kairo City and on leaderboards" : "On the leaderboards") : CITY_SHOWN ? "Hidden from Kairo City and leaderboards" : "Hidden from the leaderboards"}</div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setOpen(!gardener.public);
            void save({ name: gardener.name, animal: gardener.animal, public: !gardener.public });
          }}
          className="h-8 rounded-full border border-line bg-card px-3.5 text-xs font-semibold text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
        >
          {gardener.public ? "Hide me" : "Show me"}
        </button>
        <button type="button" onClick={() => setEditing(true)} className="h-8 rounded-full px-3 text-xs font-semibold text-sun-deep hover:bg-sun-soft">
          Edit
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="rounded-2xl border border-line bg-card p-5"
    >
      <h2 className="font-display text-2xl">{gardener ? "Your leaderboard name" : "Join the leaderboards"}</h2>
      <p className="mt-1 text-sm text-ink-soft">Pick a name and an animal. That&apos;s all anyone sees: never your email or your photo.</p>
      <label className="mt-4 block">
        <span className="text-xs font-semibold text-ink-soft">Name</span>
        <input
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sunny Fern"
          className="mt-1 h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-sun"
        />
      </label>
      <fieldset className="mt-4">
        <legend className="text-xs font-semibold text-ink-soft">Animal</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {ANIMALS.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={animal === a}
              aria-label={`Animal ${a}`}
              onClick={() => setAnimal(a)}
              className={`rounded-full p-0.5 transition-all ${animal === a ? "ring-2 ring-sun ring-offset-2 ring-offset-card" : "opacity-60 hover:opacity-100"}`}
            >
              <Avatar animal={a} size={40} />
            </button>
          ))}
        </div>
      </fieldset>
      <label className="mt-4 flex items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} className="size-4 accent-[var(--color-sun)]" />
        Show me on leaderboards
      </label>
      {error && (
        <p role="alert" className="mt-2 text-sm text-clay">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={busy} className="h-9 rounded-full bg-ink px-5 text-sm font-semibold text-paper disabled:opacity-60">
          {busy ? "Saving…" : gardener ? "Save" : "Join"}
        </button>
        {gardener && (
          <button type="button" onClick={() => setEditing(false)} className="h-9 rounded-full px-4 text-sm font-semibold text-ink-soft hover:bg-paper-deep">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
