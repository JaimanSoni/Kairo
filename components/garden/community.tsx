"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ANIMALS, cleanGardenerName, seedOf, SEEDS, type Board, type Gardener, type SeedStat } from "@/lib/habits-shared";
import { gardenApi, gardenStore } from "@/lib/habits-client";
import { useApp } from "../store";
import { navigateApp } from "../app-views";
import { Plant } from "./plants";
import { Avatar, BackLink, SectionTitle } from "./bits";
import { useGarden } from "./use-garden";

/**
 * Other gardeners growing the same seeds. Nobody appears here until they
 * choose a name and an animal and say yes; nothing else about them is shown.
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
  const order = [...SEEDS].sort((a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)) || (stats.find((s) => s.seedId === b.id)?.gardeners ?? 0) - (stats.find((s) => s.seedId === a.id)?.gardeners ?? 0));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6 sm:px-6">
      <BackLink href="/garden" label="Garden" />
      <header className="anim-rise mb-5 mt-2">
        <h1 className="font-display text-4xl">Community</h1>
        <p className="mt-1 text-sm text-ink-soft">Streak leaderboards for every seed. Grow alongside people keeping the same habit.</p>
      </header>

      <GardenerCard key={gardener ? `${gardener.name}:${gardener.animal}:${gardener.public}` : "none"} gardener={gardener} />

      <section className="mt-6">
        <SectionTitle>Boards</SectionTitle>
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2">
          {order.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={seed === s.id}
              onClick={() => {
                setSeed(s.id);
                window.history.replaceState(null, "", `/garden/community?seed=${s.id}`);
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                seed === s.id ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-soft hover:border-sun"
              }`}
            >
              <span aria-hidden>{s.emoji}</span> {s.name}
              {mine.has(s.id) && <span className="size-1.5 rounded-full bg-moss" aria-label="(growing)" />}
            </button>
          ))}
        </div>

        <div className="mt-2 inline-flex rounded-full border border-line bg-card p-0.5">
          {(["global", "friends"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={scope === s}
              onClick={() => setScope(s)}
              className={`rounded-full px-4 py-1 text-sm font-semibold ${scope === s ? "bg-sun text-on-accent" : "text-ink-soft"}`}
            >
              {s === "global" ? "Everyone" : "Friends"}
            </button>
          ))}
        </div>

        <BoardList key={`${seed}:${scope}`} seedId={seed} scope={scope} growing={mine.has(seed)} gardener={gardener} />
      </section>
    </div>
  );
}

function BoardList({ seedId, scope, growing, gardener }: { seedId: string; scope: "global" | "friends"; growing: boolean; gardener: Gardener | null }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [failed, setFailed] = useState(false);
  const seed = seedOf(seedId)!;

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

  if (failed) return <p className="mt-4 text-sm text-ink-soft">The board didn&apos;t load. Try again in a moment.</p>;
  if (!board) {
    return (
      <div className="mt-4 space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-2xl bg-paper-deep" />
        ))}
      </div>
    );
  }

  const me = board.me;
  const above = me ? [...board.rows].reverse().find((r) => r.streak > me.streak) : null;
  const showMeBelow = me && !board.rows.some((r) => r.me);

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center gap-3 rounded-2xl border border-line bg-card p-3">
        <Plant species={seed.species} stage={5} size={52} sway={false} ground="none" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">
            {seed.emoji} {seed.name}
          </div>
          <div className="text-xs text-ink-faint">
            {board.gardeners} public {board.gardeners === 1 ? "gardener" : "gardeners"}
            {scope === "friends" ? " among people you share lists with" : ""}
          </div>
        </div>
        {!growing && (
          <button type="button" onClick={() => navigateApp(`/garden/seeds?plant=${seedId}`)} className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-paper">
            Plant it
          </button>
        )}
      </div>

      {me && (
        <div className="anim-pop mb-3 rounded-2xl border border-sun/40 bg-sun-soft/60 px-4 py-3 text-sm">
          <b>{gardener?.public ? `You're #${me.rank}` : `You'd be #${me.rank}`}</b> with a {me.streak}-day streak.{" "}
          {above ? (
            <>
              {above.streak - me.streak + 1} more {above.streak - me.streak + 1 === 1 ? "day" : "days"} to pass <b>{above.name}</b>.
            </>
          ) : me.streak > 0 ? (
            "Nobody's ahead of you. 👑"
          ) : (
            "Water today to get on the board."
          )}
          {!gardener?.public && <span className="block text-xs text-ink-soft">Only you can see this until you join the board above.</span>}
        </div>
      )}

      {board.rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
          <div className="text-3xl">🌱</div>
          <p className="mt-2 text-sm text-ink-soft">
            {scope === "friends" ? "None of the people you share with grow this publicly yet." : "No public gardeners here yet. The top spot is open."}
          </p>
        </div>
      ) : (
        <ol className="space-y-1.5">
          {board.rows.map((r, i) => (
            <li
              key={`${i}-${r.name}`}
              className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${r.me ? "border-sun bg-sun-soft" : "border-line bg-card"} ${r.rank <= 3 ? "shadow-sm" : ""}`}
            >
              <span className={`w-7 text-center font-display ${r.rank <= 3 ? "text-xl" : "text-sm text-ink-faint"}`}>{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}</span>
              <Avatar animal={r.animal} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {r.name}
                  {r.me && <span className="ml-1 text-xs font-normal text-sun-deep">(you)</span>}
                </span>
                <span className="block text-[11px] text-ink-faint">best {r.best}</span>
              </span>
              <span className="text-base font-bold">🔥 {r.streak}</span>
            </li>
          ))}
          {showMeBelow && (
            <li className="flex items-center gap-3 rounded-2xl border border-dashed border-sun/60 px-3 py-2">
              <span className="w-7 text-center text-sm text-ink-faint">{me!.rank}</span>
              <Avatar animal={me!.animal} size={34} className="opacity-70" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-soft">{me!.name} (you, hidden)</span>
              <span className="text-base font-bold text-ink-soft">🔥 {me!.streak}</span>
            </li>
          )}
        </ol>
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
    showToast({ message: r.data.gardener.public ? `🏆 You're on the boards as ${r.data.gardener.name}.` : "You're hidden from the boards." });
  };

  if (gardener && !editing) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3">
        <Avatar animal={gardener.animal} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{gardener.name}</div>
          <div className="text-xs text-ink-faint">{gardener.public ? "Shown on leaderboards" : "Hidden from leaderboards"}</div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setOpen(!gardener.public);
            void save({ name: gardener.name, animal: gardener.animal, public: !gardener.public });
          }}
          className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-sun"
        >
          {gardener.public ? "Hide me" : "Show me"}
        </button>
        <button type="button" onClick={() => setEditing(true)} className="rounded-full px-2 py-1.5 text-xs font-semibold text-sun-deep">
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
      className="rounded-2xl border border-sun/40 bg-gradient-to-br from-sun-soft/70 to-card p-4"
    >
      <h2 className="font-display text-xl">{gardener ? "Your gardener" : "Join the leaderboards"}</h2>
      <p className="mt-0.5 text-xs text-ink-soft">Pick a name and an animal. That&apos;s all anyone sees — never your email or photo.</p>
      <label className="mt-3 block">
        <span className="text-xs font-semibold text-ink-soft">Gardener name</span>
        <input
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sunny Fern"
          className="mt-1 h-10 w-full rounded-xl border border-line bg-card px-3 text-sm outline-none focus:border-sun"
        />
      </label>
      <fieldset className="mt-3">
        <legend className="text-xs font-semibold text-ink-soft">Animal</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {ANIMALS.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={animal === a}
              aria-label={`Animal ${a}`}
              onClick={() => setAnimal(a)}
              className={`rounded-full p-0.5 transition-transform ${animal === a ? "scale-110 ring-2 ring-sun" : "opacity-70 hover:opacity-100"}`}
            >
              <Avatar animal={a} size={42} />
            </button>
          ))}
        </div>
      </fieldset>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} className="size-4 accent-[var(--color-sun)]" />
        Show me on leaderboards
      </label>
      {error && (
        <p role="alert" className="mt-2 text-sm text-clay">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={busy} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60">
          {busy ? "Saving…" : gardener ? "Save" : "Join"}
        </button>
        {gardener && (
          <button type="button" onClick={() => setEditing(false)} className="rounded-full px-3 py-2 text-sm font-semibold text-ink-soft">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
