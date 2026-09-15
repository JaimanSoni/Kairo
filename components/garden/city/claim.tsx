"use client";

import { useEffect, useState } from "react";
import { gardenApi, gardenStore } from "@/lib/habits-client";
import { ANIMALS, cleanGardenerName, type CityGarden, type Gardener } from "@/lib/habits-shared";
import { track } from "@/lib/analytics-client";
import { useApp } from "../../store";
import { Modal } from "../../ui";
import { Avatar } from "../bits";
import { GoogleBadge } from "../../guest-mode";

type Info = { status: "open" | "claimed" | "mine"; inviter: CityGarden | null; inviterName: string | null };

const withParams = (set: Record<string, string | null>) => {
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(set)) {
    if (v === null) url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  }
  return `${url.pathname}${url.search}${url.hash}`;
};

/**
 * Claiming a plot a friend saved, from their link (?claim=<code>). Signed out,
 * it asks to sign in and comes straight back here. Signed in, it's a name and
 * an animal, or just a tap for someone already in the city, and then the city
 * opens on the Friends street, beside the one who saved it.
 */
export function ClaimSheet({ code, onClose }: { code: string; onClose: () => void }) {
  const { state, showToast } = useApp();
  const guest = Boolean(state.user.guest);
  const [info, setInfo] = useState<Info | "missing" | null>(null);
  const [known, setKnown] = useState<Gardener | null | undefined>(guest ? null : undefined);
  const [name, setName] = useState("");
  const [animal, setAnimal] = useState<Gardener["animal"]>("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void gardenApi.inviteInfo(code).then((r) => {
      if (alive) setInfo(r.ok ? r.data : "missing");
    });
    if (!guest) {
      void gardenApi.profile().then((r) => {
        if (alive) setKnown(r.ok ? r.data.gardener : null);
      });
    }
    return () => {
      alive = false;
    };
  }, [code, guest]);

  const who = info && info !== "missing" ? (info.inviterName ?? "A friend") : "A friend";

  const claim = async () => {
    if (!known?.name && !cleanGardenerName(name)) {
      setError("A name is 2 to 24 letters, numbers or spaces.");
      return;
    }
    setBusy(true);
    setError(null);
    const r = await gardenApi.claim(code, known?.name ? {} : { name, animal });
    setBusy(false);
    if (!r.ok) {
      setError(r.kind === "invalid" ? r.message : "That plot couldn't be claimed just now. Try again.");
      return;
    }
    const profile = await gardenApi.profile();
    if (profile.ok) gardenStore.setGardener(profile.data.gardener);
    track("city-claim");
    // into the city, on the street you now share
    window.history.replaceState(null, "", withParams({ claim: null, city: "open", street: "friends", visit: null }));
    showToast({
      message: r.data.inviter ? `You and ${r.data.inviter.name} are neighbours now. Plant a habit to start your garden growing.` : "Your plot is claimed. Plant a habit to start your garden growing.",
      action: {
        label: "Plant a habit",
        run: () => {
          window.history.replaceState(null, "", "/habits?new=1");
          window.scrollTo(0, 0);
        },
      },
    });
  };

  return (
    <Modal onClose={onClose} anchor="top" above>
      <div className="p-5" data-claim-sheet={code}>
        {info === null || known === undefined ? (
          <div className="space-y-3" role="status">
            <div className="h-7 w-2/3 animate-pulse rounded-lg bg-paper-deep" />
            <div className="h-16 animate-pulse rounded-xl bg-paper-deep" />
          </div>
        ) : info === "missing" ? (
          <>
            <h2 className="font-display text-2xl leading-tight">This invite isn&apos;t right</h2>
            <p className="mt-1.5 text-sm text-ink-soft">The link may have been mistyped, or the plot was let go. There are free plots all over the city.</p>
            <CityButton label="Walk into Kairo City" onClose={onClose} />
          </>
        ) : info.status === "claimed" ? (
          <>
            <h2 className="font-display text-2xl leading-tight">This plot is taken</h2>
            <p className="mt-1.5 text-sm text-ink-soft">Someone has already moved in. Ask {who} to save you another, or find a free plot in the city.</p>
            <CityButton label="Walk into Kairo City" onClose={onClose} />
          </>
        ) : info.status === "mine" ? (
          <>
            <h2 className="font-display text-2xl leading-tight">This is the plot you saved</h2>
            <p className="mt-1.5 text-sm text-ink-soft">Send this link to the friend you saved it for. It&apos;s theirs to claim.</p>
            <CityButton label="Back to the city" onClose={onClose} />
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              {info.inviter ? <Avatar animal={info.inviter.animal} size={48} className="ring-2 ring-sun/40" /> : null}
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sun-deep">Kairo City</p>
                <h2 className="font-display text-2xl leading-tight">{who} saved you a plot</h2>
              </div>
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              It&apos;s right next to {info.inviter ? `their ${info.inviter.level > 1 ? `Level ${info.inviter.level} ` : ""}garden` : "their garden"}. Build habits, and your garden grows beside
              theirs. You&apos;ll both get a bench for two.
            </p>

            {guest ? (
              <a
                href={`/api/auth/google?next=${encodeURIComponent(`/today?claim=${code}`)}`}
                data-track="claim-signin"
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-bold text-paper transition-colors hover:bg-ink/90"
                data-claim-signin
              >
                <GoogleBadge size={24} /> Sign in to claim your plot
              </a>
            ) : known?.name ? (
              <p className="mt-4 flex items-center gap-2 rounded-xl bg-paper-deep px-3 py-2 text-sm text-ink-soft">
                <Avatar animal={known.animal} size={28} /> You&apos;ll move in as <b className="font-semibold text-ink">{known.name}</b>.
              </p>
            ) : (
              <>
                <label className="mt-4 block">
                  <span className="text-xs font-semibold text-ink-soft">Name on your gate</span>
                  <input
                    value={name}
                    maxLength={24}
                    autoFocus
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Sunny Fern"
                    aria-label="Name on your gate"
                    className="mt-1 h-11 w-full rounded-xl border border-line bg-paper px-3 text-[15px] outline-none focus:border-sun"
                  />
                </label>
                <fieldset className="mt-3">
                  <legend className="text-xs font-semibold text-ink-soft">Your animal</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
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
                <p className="mt-3 text-xs text-ink-faint">Visitors see your plants, level and the names of habits started from Ideas. Never your email, your photo, or habits you wrote yourself.</p>
              </>
            )}

            {error && (
              <p role="alert" className="mt-3 text-sm text-clay">
                {error}
              </p>
            )}
            {!guest && (
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={onClose} className="h-10 rounded-full px-4 text-sm font-semibold text-ink-soft hover:bg-paper-deep">
                  Not now
                </button>
                <button type="button" onClick={() => void claim()} disabled={busy} className="h-10 rounded-full bg-sun px-5 text-sm font-bold text-on-accent hover:bg-sun-deep disabled:opacity-60" data-claim-plot>
                  {busy ? "Moving in…" : "Claim my plot"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function CityButton({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        onClose();
        window.history.replaceState(null, "", withParams({ claim: null, city: "open" }));
      }}
      className="mt-5 h-11 w-full rounded-full bg-ink text-sm font-bold text-paper hover:bg-ink/90"
    >
      {label}
    </button>
  );
}
