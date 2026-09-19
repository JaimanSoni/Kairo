"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "../store";
import { navigateApp } from "../app-views";
import { upgradeHref, useCan } from "../entitlements";
import { AppLockModal, type AppLockMode } from "../app-lock";
import { useTheme, type ThemePref } from "../theme";
import { CoffeeModal } from "../coffee";
import { ConnectionsModal, useConnectionCount } from "../mcp-settings";
import { ShareKairoSheet } from "../share-kairo";
import { useSubscriptionSummary } from "../subscription-settings";
import { JournalDownload } from "../paywall";
import { Icon3d } from "../img3d";
import { PersonAvatar } from "../person-avatar";
import { SPACE_CHOICES } from "../welcome";
import { gardenApi, gardenStore } from "@/lib/habits-client";
import { coffeeEnabled } from "@/lib/coffee";
import { CITY_SHOWN, JOURNAL_SHOWN } from "@/lib/types";
import { useGarden } from "../garden/use-garden";
import { LeaveCity } from "../garden/city/leave";
import { SkyOptions } from "../garden/sky";

/**
 * Settings, as a page of its own.
 *
 * It grew one control at a time inside the profile sheet until the sheet was
 * a long scroll of unrelated switches. Here every setting belongs to a
 * section with a name, the sections are in the order people look for them
 * (who you are, how it looks, what it holds, what it tells you, who can get
 * in), and a list down the side, or across the top on a phone, jumps to any
 * of them. Each section has an address: /settings#notifications.
 */

type SectionId = "profile" | "appearance" | "features" | "notifications" | "privacy" | "connections" | "billing" | "accounts" | "data" | "help";

const SECTIONS: { id: SectionId; label: string; icon: React.ReactNode }[] = [
  { id: "profile", label: "Profile", icon: <path d="M8 7.5a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5zM2.75 14c.4-2.7 2.5-4.25 5.25-4.25S12.85 11.3 13.25 14" /> },
  { id: "appearance", label: "Appearance", icon: <path d="M8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /> },
  { id: "features", label: "Your Kairo", icon: <path d="M2.5 2.5h4.25v4.25H2.5zM9.25 2.5h4.25v4.25H9.25zM2.5 9.25h4.25v4.25H2.5zM9.25 9.25h4.25v4.25H9.25z" /> },
  { id: "notifications", label: "Notifications", icon: <path d="M4 11.25V7.5a4 4 0 1 1 8 0v3.75l1 1.25H3l1-1.25zM6.5 14h3" /> },
  { id: "privacy", label: "Privacy & security", icon: <path d="M8 1.75l5 2v4c0 3.1-2.1 5.4-5 6.5-2.9-1.1-5-3.4-5-6.5v-4l5-2zM6 8l1.5 1.5L10.25 6.5" /> },
  { id: "connections", label: "Connections", icon: <path d="M6.5 9.5l3-3M5 7.5l-1.25 1.25a2.5 2.5 0 0 0 3.5 3.5L8.5 11M11 8.5l1.25-1.25a2.5 2.5 0 0 0-3.5-3.5L7.5 5" /> },
  { id: "billing", label: "Plan & billing", icon: <path d="M1.75 4.25h12.5v7.5H1.75zM1.75 6.75h12.5M4.25 9.5h2.5" /> },
  { id: "accounts", label: "Accounts", icon: <path d="M6 7.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5zM1.75 13.5c.3-2.3 2-3.75 4.25-3.75s3.95 1.45 4.25 3.75M10.75 3a2.25 2.25 0 0 1 0 4.25M12 9.9c1.3.45 2.1 1.6 2.25 3.6" /> },
  { id: "data", label: "Your data", icon: <path d="M8 2v8M4.75 7l3.25 3.25L11.25 7M2.5 13.5h11" /> },
  { id: "help", label: "Help & more", icon: <path d="M8 14.25a6.25 6.25 0 1 0 0-12.5 6.25 6.25 0 0 0 0 12.5zM6.25 6.25a1.8 1.8 0 0 1 3.5.55c0 1.2-1.75 1.5-1.75 2.6M8 11.5h.01" /> },
];

function Glyph({ children, size = 16 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

const chevron = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 text-ink-faint" aria-hidden>
    <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BTN = "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-line bg-card px-4 text-xs font-semibold text-ink-soft transition-colors hover:border-ink-faint hover:text-ink disabled:opacity-50";
const BTN_PRIMARY = "inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-xs font-semibold text-paper transition-colors hover:bg-ink/90 disabled:opacity-50";
const BTN_DANGER = "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-line bg-card px-4 text-xs font-semibold text-ink-soft transition-colors hover:border-clay hover:text-clay disabled:opacity-50";

export default function SettingsView() {
  const [active, setActive] = useState<SectionId>("profile");

  // arriving at /settings#section lands on that section, and stays on it while
  // the rows above finish loading (billing, connections, the garden) and grow;
  // the moment you scroll yourself, it lets go
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id || !SECTIONS.some((s) => s.id === id)) return;
    const land = () => document.getElementById(id)?.scrollIntoView();
    land();
    let yours = false;
    const letGo = () => (yours = true);
    const events = ["wheel", "touchstart", "keydown"] as const;
    for (const e of events) window.addEventListener(e, letGo, { passive: true, once: true });
    const timers = [250, 800, 1600].map((ms) => setTimeout(() => !yours && land(), ms));
    return () => {
      timers.forEach(clearTimeout);
      for (const e of events) window.removeEventListener(e, letGo);
    };
  }, []);

  // the list down the side follows the scroll
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => Boolean(el));
    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (seen[0]) setActive(seen[0].target.id as SectionId);
      },
      { rootMargin: "-15% 0px -70% 0px" }
    );
    for (const el of els) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // the chip for the section in view stays in sight on a phone
  // (sideways only, inside the strip: a scrollIntoView here could tug the page mid-scroll)
  useEffect(() => {
    const chip = document.querySelector<HTMLElement>(`[data-settings-chip="${active}"]`);
    const strip = chip?.parentElement;
    if (!chip || !strip || strip.scrollWidth <= strip.clientWidth) return;
    const left = chip.offsetLeft - strip.offsetLeft;
    if (left < strip.scrollLeft || left + chip.offsetWidth > strip.scrollLeft + strip.clientWidth) strip.scrollTo({ left: Math.max(0, left - 16), behavior: "smooth" });
  }, [active]);

  const jump = (id: SectionId) => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    window.history.replaceState(window.history.state, "", `#${id}`);
    setActive(id);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-32 pt-6 sm:px-6 md:pt-10" data-settings>
      <header className="anim-rise">
        <h1 className="font-display text-4xl">Settings</h1>
        <p className="mt-1 text-sm text-ink-soft">How Kairo looks, what it holds, what it tells you, and who can get in.</p>
      </header>

      {/* on a phone: the sections, across the top */}
      <nav
        aria-label="Settings sections"
        className="no-scrollbar sticky top-[calc(max(0.6rem,env(safe-area-inset-top))+2.6rem)] z-20 -mx-4 mt-4 flex gap-1.5 overflow-x-auto border-b border-line/70 bg-paper/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 md:top-0 lg:hidden"
      >
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => jump(s.id)}
            aria-current={active === s.id ? "true" : undefined}
            data-settings-chip={s.id}
            className={`h-8 shrink-0 rounded-full px-3 text-xs font-semibold transition-colors ${active === s.id ? "bg-ink text-paper" : "bg-card text-ink-soft ring-1 ring-line hover:text-ink"}`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="mt-6 lg:mt-8 lg:grid lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:gap-10">
        {/* on a computer: the sections, down the side */}
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-8 space-y-0.5">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    jump(s.id);
                  }}
                  aria-current={active === s.id ? "true" : undefined}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${active === s.id ? "bg-card text-ink shadow-sm" : "text-ink-soft hover:bg-card/60 hover:text-ink"}`}
                >
                  <span className={active === s.id ? "text-sun-deep" : "text-ink-faint"}>
                    <Glyph>{s.icon}</Glyph>
                  </span>
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-10">
          <ProfileSection />
          <AppearanceSection />
          <FeaturesSection />
          <NotificationsSection />
          <PrivacySection />
          <ConnectionsSection />
          <BillingSection />
          <AccountsSection />
          <DataSection />
          <HelpSection />
          <p className="px-1 text-center text-xs text-ink-faint">kairo, where good days grow</p>
          {/* room under the last section, so every section can reach the top when it is chosen */}
          <div aria-hidden className="h-[45vh]" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ building blocks */

function Section({ id, title, description, children, data }: { id: SectionId; title: string; description?: string; children: React.ReactNode; data?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-32 md:scroll-mt-16 lg:scroll-mt-8" {...(data ? { [data]: "" } : {})}>
      <div className="mb-3 px-1">
        <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-ink-soft">{description}</p>}
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-card">{children}</div>
    </section>
  );
}

/**
 * One setting: what it is, a sentence about it, and its control on the right.
 * A row with several buttons (`wrap`) puts them under the words on a phone,
 * lined up with the text rather than squeezing it.
 */
function Row({ title, description, control, children, lead, wrap }: { title: React.ReactNode; description?: React.ReactNode; control?: React.ReactNode; children?: React.ReactNode; lead?: React.ReactNode; wrap?: boolean }) {
  const indent = lead ? "pl-12 sm:pl-[3.25rem]" : "";
  return (
    <div className="border-t border-line px-4 py-4 first:border-t-0 sm:px-5">
      <div className={`flex items-center gap-3 sm:gap-4 ${wrap ? "flex-wrap sm:flex-nowrap" : ""}`}>
        {lead && <span className="shrink-0">{lead}</span>}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ink">{title}</div>
          {description && <div className="mt-0.5 text-[13px] leading-5 text-ink-soft">{description}</div>}
        </div>
        {control && <div className={`flex shrink-0 items-center gap-2 ${wrap ? `w-full flex-wrap sm:w-auto ${lead ? "pl-12 sm:pl-0" : ""}` : ""}`}>{control}</div>}
      </div>
      {children && <div className={`mt-3 ${indent}`}>{children}</div>}
    </div>
  );
}

/** A row that goes somewhere, or opens something: the whole row is the button. */
function LinkRow({ title, description, href, onClick, lead, data }: { title: string; description?: string; href?: string; onClick?: () => void; lead?: React.ReactNode; data?: string }) {
  const inner = (
    <>
      {lead && <span className="shrink-0">{lead}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink">{title}</span>
        {description && <span className="mt-0.5 block text-[13px] leading-5 text-ink-soft">{description}</span>}
      </span>
      {chevron}
    </>
  );
  const cls = "flex w-full items-center gap-3 border-t border-line px-4 py-3.5 text-left transition-colors first:border-t-0 hover:bg-paper-deep/50 sm:px-5";
  const attrs = data ? { [data]: "" } : {};
  return href ? (
    <Link href={href} className={cls} {...attrs}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls} {...attrs}>
      {inner}
    </button>
  );
}

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? "bg-sun" : "bg-line"}`}
    >
      <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
    </button>
  );
}

function Tile({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "sun" | "moss" | "sky" | "clay" | "lilac" }) {
  const tones = { neutral: "bg-paper-deep text-ink-soft", sun: "bg-sun-soft text-sun-deep", moss: "bg-moss-soft text-moss", sky: "bg-sky-soft text-sky", clay: "bg-clay-soft text-clay", lilac: "bg-lilac/15 text-lilac" };
  return <span className={`grid size-9 place-items-center rounded-xl ${tones[tone]}`}>{children}</span>;
}

function Status({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${on ? "bg-moss-soft text-moss" : "bg-paper-deep text-ink-faint"}`}>
      <span className={`size-1.5 rounded-full ${on ? "bg-moss" : "bg-ink-faint/60"}`} aria-hidden />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ profile */

function ProfileSection() {
  const { state, setAvatarChoice } = useApp();
  const { user } = state;
  // which picture is worn, read off the picture itself: an account with neither a photo nor a choice wears a hash-picked animal, and ringing "Google photo" there would be a lie
  const current = /\/avatars\/avatar-([1-6])\.png$/.exec(user.picture ?? "")?.[1];
  const wearingGoogle = Boolean(user.googlePicture) && user.picture === user.googlePicture;
  const ring = "ring-2 ring-sun ring-offset-2 ring-offset-card";

  return (
    <Section id="profile" title="Profile" description="How you appear on shared lists and to people you assign tasks to.">
      <div className="flex items-center gap-4 px-4 py-5 sm:px-5">
        <PersonAvatar name={user.name} picture={user.picture} size={64} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-semibold">{user.name}</div>
          <div className="truncate text-sm text-ink-soft">{user.email}</div>
          <div className="mt-1 text-xs text-ink-faint">Signed in with Google</div>
        </div>
      </div>
      <Row title="Picture" description="Your Google photo, or one of the animals.">
        <div className="flex flex-wrap items-center gap-2.5" role="radiogroup" aria-label="Picture">
          <button
            type="button"
            role="radio"
            aria-checked={wearingGoogle}
            onClick={() => setAvatarChoice("google")}
            aria-label="Use your Google photo"
            className={`grid size-11 place-items-center overflow-hidden rounded-full transition-transform hover:scale-105 ${wearingGoogle ? ring : ""}`}
          >
            {user.googlePicture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.googlePicture} alt="" className="size-full rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="grid size-full place-items-center rounded-full bg-sun-soft font-bold text-sun-deep">{user.name.charAt(0).toUpperCase()}</span>
            )}
          </button>
          <span className="mx-0.5 h-6 w-px bg-line" aria-hidden />
          {["1", "2", "3", "4", "5", "6"].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={current === n}
              onClick={() => setAvatarChoice(`animal-${n}`)}
              aria-label={`Use animal avatar ${n}`}
              className={`grid size-11 place-items-center overflow-hidden rounded-full bg-sun-soft transition-transform hover:scale-105 ${current === n ? ring : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/avatars/avatar-${n}.png`} alt="" className="size-full object-contain p-[6%]" />
            </button>
          ))}
        </div>
      </Row>
    </Section>
  );
}

/* --------------------------------------------------------------- appearance */

const THEMES: { value: ThemePref; label: string; note: string }[] = [
  { value: "light", label: "Light", note: "Always light" },
  { value: "dark", label: "Dark", note: "Always dark" },
  { value: "system", label: "Auto", note: "Follows your device" },
];

function ThemePreview({ kind }: { kind: ThemePref }) {
  const pane = (bg: string, card: string, line: string, accent: string) => (
    <span className="flex h-full flex-1 flex-col gap-1.5 p-2" style={{ background: bg }}>
      <span className="h-1.5 w-8 rounded-full" style={{ background: accent }} />
      <span className="flex flex-1 flex-col gap-1 rounded-md p-1.5" style={{ background: card }}>
        <span className="h-1 w-3/4 rounded-full" style={{ background: line }} />
        <span className="h-1 w-1/2 rounded-full" style={{ background: line }} />
        <span className="h-1 w-2/3 rounded-full" style={{ background: line }} />
      </span>
    </span>
  );
  const light = pane("#eef2f0", "#ffffff", "#d3dcd8", "#0c9384");
  const dark = pane("#121817", "#1b2321", "#34403c", "#2fb5a4");
  return (
    <span className="flex h-20 w-full overflow-hidden rounded-xl ring-1 ring-line" aria-hidden>
      {kind === "light" ? light : kind === "dark" ? dark : (
        <>
          {light}
          {dark}
        </>
      )}
    </span>
  );
}

function AppearanceSection() {
  const { pref, setTheme, mounted } = useTheme();
  return (
    <Section id="appearance" title="Appearance" description="Kept on this device.">
      <Row title="Theme">
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => {
            const on = mounted && pref === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={`${t.label} theme`}
                onClick={() => setTheme(t.value)}
                className={`rounded-2xl border p-2 text-left transition-all ${on ? "border-sun bg-sun-soft/40 shadow-sm" : "border-line hover:border-ink-faint"}`}
                data-theme-option={t.value}
              >
                <ThemePreview kind={t.value} />
                <span className="mt-2 flex items-center gap-1.5 px-0.5">
                  <span className={`grid size-4 shrink-0 place-items-center rounded-full border-2 ${on ? "border-sun" : "border-line"}`} aria-hidden>
                    {on && <span className="size-1.5 rounded-full bg-sun" />}
                  </span>
                  <span className="text-sm font-medium">{t.label}</span>
                </span>
                <span className="mt-0.5 hidden px-0.5 text-xs text-ink-faint sm:block">{t.note}</span>
              </button>
            );
          })}
        </div>
      </Row>
      <Row
        title="Garden weather"
        description="Your garden has the sky you have: rain when it rains, and the sun setting when yours does. Weather from MET Norway; where you are is rounded to about 10 km and not kept."
      >
        <div data-settings-sky>
          <SkyOptions />
        </div>
      </Row>
    </Section>
  );
}

/* ----------------------------------------------------------------- features */

function FeaturesSection() {
  const { state, setSpaces } = useApp();
  const prefs = state.user.spaces;
  return (
    <Section id="features" title="Your Kairo" description="Keep only the parts you use. Hiding one keeps everything in it, and turning it back on brings it back as it was." data="data-spaces-settings">
      <Row lead={<Icon3d name="sun" size={34} />} title="Plan my days" description="Today, Calendar, Lists and the Log." control={<span className="rounded-full bg-sun-soft px-2.5 py-1 text-[11px] font-semibold text-sun-deep">Always on</span>} />
      {SPACE_CHOICES.map((c) => (
        <Row
          key={c.key}
          lead={<Icon3d name={c.icon} size={34} className={`transition-opacity ${prefs[c.key] ? "" : "opacity-45"}`} />}
          title={c.title}
          description={prefs[c.key] ? c.body : "Hidden. Everything in it is kept."}
          control={<Toggle checked={prefs[c.key]} onChange={(v) => void setSpaces({ ...prefs, [c.key]: v })} label={c.title} />}
        />
      ))}
    </Section>
  );
}

/* ------------------------------------------------------------ notifications */

type PushState = "loading" | "enabled" | "disabled" | "denied" | "unsupported" | "insecure";

function NotificationsSection() {
  const { state } = useApp();
  const [status, setStatus] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("@/lib/push-client").then(async ({ pushPermission, pushEnabled }) => {
      const insecure = window.isSecureContext === false;
      const perm = pushPermission();
      const next: PushState = insecure ? "insecure" : perm === "unsupported" ? "unsupported" : perm === "denied" ? "denied" : (await pushEnabled()) ? "enabled" : "disabled";
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const { enablePush, disablePush } = await import("@/lib/push-client");
    if (status === "enabled") {
      await disablePush();
      setStatus("disabled");
    } else {
      const result = await enablePush();
      if (result.status === "enabled" || result.status === "denied" || result.status === "insecure" || result.status === "unsupported") setStatus(result.status);
      else {
        setStatus("disabled");
        setNote({ ok: false, text: `Couldn't turn them on: ${result.detail}` });
      }
    }
    setBusy(false);
  };

  const test = async () => {
    const res = await fetch("/api/push/test", { method: "POST" }).catch(() => null);
    setNote(res?.ok ? { ok: true, text: "Sent. It should arrive in a moment." } : { ok: false, text: "The test didn't send. Try again in a moment." });
  };

  const blocked =
    status === "insecure"
      ? "Notifications need a secure connection (HTTPS or localhost). Opened from a network address like 192.168.x.x, they can't arrive."
      : status === "unsupported"
        ? "This browser can't show notifications. On an iPhone, add Kairo to your home screen first (Share, then Add to Home Screen), and turn them on from there."
        : status === "denied"
          ? "Blocked for this site. Allow notifications in your browser's site settings (the lock icon by the address), then come back."
          : null;

  return (
    <Section id="notifications" title="Notifications" description="What Kairo can tell you when the app is closed.">
      <Row
        lead={<Tile tone={status === "enabled" ? "sun" : "neutral"}><Glyph>{SECTIONS[3].icon}</Glyph></Tile>}
        title={
          <span className="flex flex-wrap items-center gap-2">
            On this device {status !== "loading" && !blocked && <Status on={status === "enabled"}>{status === "enabled" ? "On" : "Off"}</Status>}
          </span>
        }
        description={blocked ?? "Reminders for tasks and habits, focus timers ending, and friend requests."}
        control={!blocked ? <Toggle checked={status === "enabled"} disabled={status === "loading" || busy} onChange={() => void toggle()} label="Notifications on this device" /> : undefined}
      >
        {(status === "enabled" || note) && (
          <div className="flex flex-wrap items-center gap-3">
            {status === "enabled" && (
              <button type="button" onClick={() => void test()} className={BTN}>
                Send a test notification
              </button>
            )}
            {note && <p className={`text-xs ${note.ok ? "text-moss" : "text-clay"}`}>{note.text}</p>}
          </div>
        )}
      </Row>
      {state.user.spaces.garden && <EveningReminderRow />}
    </Section>
  );
}

function EveningReminderRow() {
  const { status } = useGarden();
  const on = gardenStore.nudges();
  return (
    <Row
      lead={<Tile tone="moss"><Glyph><path d="M13.5 9.5A6 6 0 0 1 6.5 2.5a6 6 0 1 0 7 7z" /></Glyph></Tile>}
      title="Evening habit reminder"
      description="At 8:30pm, if a streak of 3 or more isn't marked done yet."
      control={<Toggle checked={on} disabled={status !== "ready"} onChange={(v) => void gardenStore.setNudges(v)} label="Evening habit reminder" />}
    />
  );
}

/* ------------------------------------------------------------------ privacy */

function PrivacySection() {
  const { state } = useApp();
  return (
    <Section id="privacy" title="Privacy & security" description="Who can get into Kairo, and what others can see.">
      <AppLockRow />
      <LinkRow
        lead={<Tile><Glyph><path d="M4.5 7V5.25a3.5 3.5 0 0 1 7 0V7M3.25 7h9.5v6.75h-9.5z" /></Glyph></Tile>}
        title="Locked lists"
        description="Lock a single list with its own PIN, from that list's menu in Lists."
        href="/lists"
      />
      {JOURNAL_SHOWN && state.user.spaces.journal && (
        <LinkRow
          lead={<Tile tone="lilac"><Glyph><path d="M4 2.5h7.5a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4zM4 2.5v11M6.75 5.5h3.5" /></Glyph></Tile>}
          title="Journal PIN"
          description="A lock of its own for your journal, set in its settings."
          onClick={() => navigateApp("/journal#settings")}
        />
      )}
      {CITY_SHOWN && state.user.spaces.garden && <CityRow />}
    </Section>
  );
}

function AppLockRow() {
  const { state, lockApp } = useApp();
  const can = useCan();
  const [modal, setModal] = useState<AppLockMode | null>(null);
  const enabled = state.user.appLockEnabled;
  // an existing lock stays fully usable after a downgrade, removing it included; only setting a new one is gated, as in the API
  const canSetUp = can("app-lock");
  return (
    <>
      <Row
        lead={<Tile tone={enabled ? "sun" : "neutral"}><Glyph><path d="M4.5 7V5.25a3.5 3.5 0 0 1 7 0V7M3.25 7h9.5v6.75h-9.5zM8 9.5v1.75" /></Glyph></Tile>}
        title={
          <span className="flex flex-wrap items-center gap-2">
            App lock <Status on={enabled}>{enabled ? "On" : "Off"}</Status>
          </span>
        }
        description={enabled ? "Kairo asks for your PIN when it opens." : canSetUp ? "Keep Kairo behind a numeric PIN on every device." : "Keep Kairo behind a numeric PIN. Locking single lists stays on every plan."}
        wrap={enabled}
        control={
          enabled ? (
            <>
              <button type="button" onClick={lockApp} className={BTN_PRIMARY} data-lock-now>
                Lock now
              </button>
              <button type="button" onClick={() => setModal("change")} className={BTN}>
                Change PIN
              </button>
              <button type="button" onClick={() => setModal("remove")} className={BTN_DANGER}>
                Remove
              </button>
            </>
          ) : canSetUp ? (
            <button type="button" onClick={() => setModal("set")} className={BTN_PRIMARY} data-applock-setup>
              Set up
            </button>
          ) : (
            <Link href={upgradeHref("app-lock")} className="inline-flex h-9 items-center rounded-full border border-sun/50 bg-sun-soft px-4 text-xs font-semibold text-sun-deep">
              Upgrade
            </Link>
          )
        }
      />
      {modal && <AppLockModal mode={modal} onClose={() => setModal(null)} />}
    </>
  );
}

/** Kairo City and the habit leaderboards share one public name: whether it's out there, and the way in or out. */
function CityRow() {
  const { status, gardener } = useGarden();
  const { showToast } = useApp();
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const openCity = () => window.history.pushState({ kairoCity: true }, "", `${window.location.pathname}?city=open`);

  const showAgain = async () => {
    if (!gardener || busy) return;
    setBusy(true);
    const r = await gardenApi.setProfile({ ...gardener, public: true });
    setBusy(false);
    if (!r.ok) {
      showToast({ message: "That didn't save. Try again." });
      return;
    }
    gardenStore.setGardener(r.data.gardener);
    showToast({ message: `Your garden is back on the street as ${r.data.gardener.name}.` });
  };

  const joined = Boolean(gardener?.public);
  return (
    <>
      <Row
        lead={
          <Tile tone="sky">
            <Glyph>
              <path d="M2 13.75h12M3.5 13.75V7.5L6.25 5.5 9 7.5v6.25M9 13.75V5.75L11.25 4l2.25 1.75v8" />
            </Glyph>
          </Tile>
        }
        title={
          <span className="flex flex-wrap items-center gap-2">
            Kairo City {status === "ready" && <Status on={joined}>{joined ? "On the street" : gardener ? "Hidden" : "Not joined"}</Status>}
          </span>
        }
        description={
          status !== "ready"
            ? "Your garden's place in the city."
            : joined
              ? `Your garden is on the street as ${gardener!.name}, and on the habit leaderboards. Friends can find, visit and cheer it.`
              : gardener
                ? "Your garden is hidden from the city and the leaderboards. Your habits and friends are kept."
                : "Claim a plot in the city to put your garden on the street, next to your friends."
        }
        wrap={joined}
        control={
          status !== "ready" ? undefined : joined ? (
            <>
              <button type="button" onClick={openCity} className={BTN}>
                Open the city
              </button>
              <button type="button" onClick={() => setLeaving(true)} className={BTN_DANGER} data-settings-leave-city>
                Leave
              </button>
            </>
          ) : gardener ? (
            <button type="button" disabled={busy} onClick={() => void showAgain()} className={BTN_PRIMARY}>
              {busy ? "Saving…" : "Put my garden back"}
            </button>
          ) : (
            <button type="button" onClick={openCity} className={BTN_PRIMARY}>
              Open the city
            </button>
          )
        }
      />
      {leaving && (
        <LeaveCity
          onClose={() => setLeaving(false)}
          onLeft={() => {
            setLeaving(false);
            showToast({ message: "Your garden has left the city. Put it back any time." });
          }}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------- connections */

function ConnectionsSection() {
  const [open, setOpen] = useState(false);
  const count = useConnectionCount(open);
  return (
    <Section id="connections" title="Connections" description="Let an AI assistant plan your day, capture what you say, and tick things off.">
      <Row
        lead={<Tile tone="lilac"><Glyph>{SECTIONS[5].icon}</Glyph></Tile>}
        title={
          <span className="flex flex-wrap items-center gap-2">
            AI assistants {count !== null && <Status on={count > 0}>{count === 0 ? "None yet" : `${count} connected`}</Status>}
          </span>
        }
        description="ChatGPT, Claude, Gemini or Grok, each with a key of its own that you can revoke any time."
        control={
          <button type="button" onClick={() => setOpen(true)} className={count ? BTN : BTN_PRIMARY} data-open-connections>
            {count ? "Manage" : "Connect"}
          </button>
        }
      />
      {open && <ConnectionsModal onClose={() => setOpen(false)} />}
    </Section>
  );
}

/* ------------------------------------------------------------------ billing */

function BillingSection() {
  const summary = useSubscriptionSummary();
  return (
    <Section id="billing" title="Plan & billing">
      <LinkRow
        lead={<Tile tone="sun"><Glyph>{SECTIONS[6].icon}</Glyph></Tile>}
        title={summary ? summary.line : "Your plan"}
        description={summary ? `${summary.action} your plan, and find every receipt.` : "Loading…"}
        href="/billing"
        data="data-billing-row"
      />
    </Section>
  );
}

/* ----------------------------------------------------------------- accounts */

function AccountsSection() {
  const { state } = useApp();
  const can = useCan();
  const canMultiAccount = can("multi-account");
  const [busy, setBusy] = useState<string | null>(null);

  const switchTo = async (userId: string) => {
    if (busy) return;
    setBusy(userId);
    try {
      const res = await fetch("/api/auth/switch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      if (res.ok) {
        // leaving an account ends its unlocked session, so switching back to a locked one asks for its PIN again
        try {
          sessionStorage.removeItem(`kairo-applock:${state.user.id}`);
        } catch {}
        // a full load: the other account's data, lock and theme apply cleanly
        window.location.assign("/today");
        return;
      }
    } catch {}
    setBusy(null);
  };

  return (
    <Section id="accounts" title="Accounts" description="Work and personal, a tap apart. Each account keeps its own tasks, lists and settings.">
      {state.accounts.map((a) => {
        const current = a.id === state.user.id;
        return (
          <Row
            key={a.id}
            lead={<PersonAvatar name={a.name} picture={a.picture} size={36} />}
            title={a.name}
            description={a.email}
            control={
              current ? (
                <span className="rounded-full bg-sun-soft px-2.5 py-1 text-[11px] font-semibold text-sun-deep">This account</span>
              ) : (
                <button type="button" disabled={busy !== null} onClick={() => void switchTo(a.id)} className={BTN}>
                  {busy === a.id ? "Switching…" : "Switch"}
                </button>
              )
            }
          />
        );
      })}
      {/* offered whatever the plan: without it, the upgrade page explains instead of a control that silently isn't there */}
      <a href={canMultiAccount ? "/api/auth/google" : upgradeHref("multi-account")} className="flex items-center gap-3 border-t border-line px-4 py-3.5 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-deep/50 hover:text-ink sm:px-5">
        <span className="grid size-9 place-items-center rounded-full border border-dashed border-ink-faint/60 text-lg leading-none" aria-hidden>
          +
        </span>
        <span className="flex-1">Add another account</span>
        {!canMultiAccount && <span className="rounded-full bg-sun-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sun-deep">Upgrade</span>}
      </a>
      <form action="/api/auth/signout" method="POST" className="border-t border-line">
        <button type="submit" className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-semibold text-clay transition-colors hover:bg-clay-soft/60 sm:px-5" data-sign-out>
          <span className="grid size-9 place-items-center rounded-full bg-clay-soft" aria-hidden>
            <Glyph>
              <path d="M6.5 13.75H3.25v-11.5H6.5M10.5 11l3-3-3-3M13.25 8H6" />
            </Glyph>
          </span>
          Sign out of this account
        </button>
      </form>
    </Section>
  );
}

/* --------------------------------------------------------------------- data */

function DataSection() {
  return (
    <Section id="data" title="Your data" description="Everything you write in Kairo can leave with you, as Markdown files." data="data-data-settings">
      <Row
        lead={<Icon3d name="pencil" size={34} />}
        title="Notes"
        description="Every page, with its pages inside it."
        control={
          <form action="/api/notes/export" method="GET">
            <button type="submit" className={BTN}>
              Download notes
            </button>
          </form>
        }
      />
      <Row lead={<Icon3d name="book" size={34} />} title="Journal" description="Every day you've written, one file each." control={<JournalDownload className={BTN} label="Download journal" />} />
    </Section>
  );
}

/* --------------------------------------------------------------------- help */

function HelpSection() {
  const { state } = useApp();
  const [sharing, setSharing] = useState(false);
  const [coffee, setCoffee] = useState(false);
  return (
    <Section id="help" title="Help & more">
      <LinkRow lead={<Tile tone="sky"><Glyph>{SECTIONS[9].icon}</Glyph></Tile>} title="Help & guides" description="How everything in Kairo works, in plain words." href="/support" data="data-settings-help" />
      <LinkRow
        lead={<Tile tone="moss"><Glyph><path d="M8 13.5S2.25 10.25 2.25 6.25A3 3 0 0 1 8 5a3 3 0 0 1 5.75 1.25C13.75 10.25 8 13.5 8 13.5z" /></Glyph></Tile>}
        title="Tell a friend about Kairo"
        description="A link and a sentence. No referral codes."
        onClick={() => setSharing(true)}
      />
      {coffeeEnabled && !state.user.isPaying && (
        <LinkRow lead={<Tile tone="clay"><Icon3d name="coffee" size={18} /></Tile>} title="Buy me a coffee" description="If Kairo helps your days, a coffee says thanks." onClick={() => setCoffee(true)} />
      )}
      <LinkRow lead={<Tile><Glyph><path d="M2.5 7.25L8 2.75l5.5 4.5v6.5H2.5zM6.5 13.75V10h3v3.75" /></Glyph></Tile>} title="The Kairo home page" description="What Kairo is, for sharing with someone new." href="/home" />
      {state.user.isAdmin && (
        <LinkRow lead={<Tile tone="neutral"><Glyph><path d="M2.5 13.5V8M6.5 13.5V4M10.5 13.5V6.5M14 13.5H2" /></Glyph></Tile>} title="Admin dashboard" description="Only you can see this." href="/admin/dashboard" />
      )}
      {sharing && <ShareKairoSheet onClose={() => setSharing(false)} />}
      {coffee && <CoffeeModal onClose={() => setCoffee(false)} />}
    </Section>
  );
}
