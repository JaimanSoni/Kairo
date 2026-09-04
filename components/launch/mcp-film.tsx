"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The Connections film — Kairo answering from inside someone else's assistant.
 *
 * Same contract as the launch film: every visible property is a function of
 * one number, and nothing reads the wall clock, so the recorder can set a
 * time, photograph, and repeat at whatever speed the machine manages.
 *
 * Unlike that film, no scene here leans on a CSS animation. Every motion is
 * computed from the beat's own elapsed time and passed down as a number. The
 * launch film scrubs `document.getAnimations()` to keep its landing-page demos
 * in step; that works, but it fails silently and invisibly when a new element
 * mounts mid-beat. Numbers cannot drift.
 */

/* ----------------------------------------------------------------- easing */

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeOutBack = (x: number) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a: number, b: number, x: number) => a + (b - a) * x;

/** Progress through a window that starts at `from` and lasts `dur`. */
const seg = (t: number, from: number, dur: number) => clamp01((t - from) / dur);

/** Fade a beat in and out at its edges. */
function beatOpacity(t: number, start: number, dur: number, fade: number): number {
  if (t < start - fade || t > start + dur + fade) return 0;
  return Math.min(seg(t, start - fade, fade), 1 - seg(t, start + dur, fade));
}

/* ------------------------------------------------------------- primitives */

/** A chat window, unbranded on purpose — this runs in all of them. */
function Win({
  title,
  accent,
  children,
  u,
}: {
  title: string;
  accent?: string;
  children: React.ReactNode;
  u: number;
}) {
  return (
    <div
      style={{
        width: "100%",
        borderRadius: 22 * u,
        overflow: "hidden",
        background: "var(--color-card)",
        border: `${Math.max(1, u)}px solid var(--color-line)`,
        boxShadow: `0 ${40 * u}px ${80 * u}px -${20 * u}px rgba(0,0,0,0.22)`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8 * u,
          padding: `${11 * u}px ${16 * u}px`,
          borderBottom: `${Math.max(1, u)}px solid var(--color-line)`,
          background: "var(--color-paper-deep)",
        }}
      >
        {["#e0665c", "#e3b341", "#57b96a"].map((c) => (
          <span
            key={c}
            style={{ width: 9 * u, height: 9 * u, borderRadius: "50%", background: c, display: "block" }}
          />
        ))}
        <span
          style={{
            marginLeft: 8 * u,
            fontSize: 13 * u,
            fontWeight: 600,
            color: accent ?? "var(--color-ink-soft)",
            letterSpacing: "0.01em",
          }}
        >
          {title}
        </span>
      </div>
      <div style={{ padding: 18 * u }}>{children}</div>
    </div>
  );
}

/** Text revealed a character at a time, with a caret while it runs. */
function Type({ text, p, u, style }: { text: string; p: number; u: number; style?: React.CSSProperties }) {
  const n = Math.floor(clamp01(p) * text.length);
  const running = p > 0 && p < 1;
  return (
    <span style={style}>
      {text.slice(0, n)}
      {running && (
        <span
          style={{
            display: "inline-block",
            width: Math.max(1, 2 * u),
            height: "1.05em",
            marginLeft: 2 * u,
            background: "currentColor",
            verticalAlign: "-0.16em",
          }}
        />
      )}
    </span>
  );
}

function Bubble({
  children,
  mine,
  o,
  rise,
  u,
}: {
  children: React.ReactNode;
  mine?: boolean;
  o: number;
  rise: number;
  u: number;
}) {
  return (
    <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", opacity: o }}>
      <div
        style={{
          maxWidth: "86%",
          padding: `${11 * u}px ${15 * u}px`,
          borderRadius: 16 * u,
          borderBottomRightRadius: mine ? 5 * u : 16 * u,
          borderBottomLeftRadius: mine ? 16 * u : 5 * u,
          background: mine ? "var(--color-sun)" : "var(--color-paper-deep)",
          color: mine ? "var(--color-on-accent)" : "var(--color-ink)",
          fontSize: 15 * u,
          lineHeight: 1.45,
          transform: `translateY(${rise * u}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * A tool call, shown rather than hidden.
 *
 * The mechanism IS the feature here: a viewer who sees `get_overview` fire and
 * the day fill in a beat later understands what MCP does without a word of
 * narration. Every name on screen is a real tool from lib/mcp/tools.ts.
 */
function ToolChip({ name, o, u, done }: { name: string; o: number; u: number; done: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6 * u,
        padding: `${5 * u}px ${10 * u}px`,
        borderRadius: 999,
        background: "var(--color-sun-soft)",
        color: "var(--color-sun-deep)",
        fontSize: 12 * u,
        fontWeight: 600,
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        opacity: o,
        transform: `scale(${lerp(0.9, 1, easeOutBack(clamp01(o)))})`,
      }}
    >
      <span
        style={{
          width: 6 * u,
          height: 6 * u,
          borderRadius: "50%",
          background: "currentColor",
          opacity: done ? 1 : 0.45,
          display: "block",
        }}
      />
      {name}
      {done && <span style={{ fontWeight: 700 }}>✓</span>}
    </span>
  );
}

/** Three dots, thinking. Phase is a number so it never free-runs. */
function Dots({ phase, o, u }: { phase: number; o: number; u: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 5 * u, opacity: o, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 7 * u,
            height: 7 * u,
            borderRadius: "50%",
            background: "var(--color-ink-faint)",
            display: "block",
            transform: `translateY(${Math.sin(phase * Math.PI * 2 + i * 0.9) * 3 * u}px)`,
          }}
        />
      ))}
    </span>
  );
}

/** A task row in the Kairo panel. */
function Row({
  title,
  chip,
  o,
  rise,
  u,
  done,
  strike,
  star,
  dim,
}: {
  title: string;
  chip?: string;
  o: number;
  rise: number;
  u: number;
  done?: boolean;
  /** 0–1 sweep of the strike-through, so completion reads as an action. */
  strike?: number;
  star?: boolean;
  dim?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10 * u,
        padding: `${10 * u}px ${13 * u}px`,
        borderRadius: 13 * u,
        background: "var(--color-card)",
        border: `${Math.max(1, u)}px solid var(--color-line)`,
        opacity: o * (dim ? 0.45 : 1),
        transform: `translateY(${rise * u}px)`,
      }}
    >
      <span
        style={{
          width: 17 * u,
          height: 17 * u,
          borderRadius: "50%",
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          border: done ? "none" : `${Math.max(2, 2 * u)}px solid var(--color-ink-faint)`,
          background: done ? "var(--color-moss)" : "transparent",
          color: "#fff",
          fontSize: 10 * u,
        }}
      >
        {done ? "✓" : ""}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 14 * u,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          color: done ? "var(--color-ink-faint)" : undefined,
        }}
      >
        {/* The rule is positioned against a shrink-wrapped inline box, not the
            flexible cell: measured against the cell it sweeps on past the last
            letter and out to the chip, which reads as a stray line, not a
            task being struck through. */}
        <span style={{ position: "relative", display: "inline-block" }}>
          {title}
          {strike !== undefined && strike > 0 && (
            <span
              style={{
                position: "absolute",
                left: 0,
                top: "52%",
                height: Math.max(1, u),
                width: `${clamp01(strike) * 100}%`,
                background: "var(--color-ink-faint)",
                display: "block",
              }}
            />
          )}
        </span>
      </span>
      {star && <span style={{ color: "var(--color-sun)", fontSize: 13 * u, flexShrink: 0 }}>✦</span>}
      {chip && (
        <span
          style={{
            flexShrink: 0,
            fontSize: 11 * u,
            padding: `${3 * u}px ${7 * u}px`,
            borderRadius: 7 * u,
            background: "var(--color-paper-deep)",
            color: "var(--color-ink-soft)",
          }}
        >
          {chip}
        </span>
      )}
    </div>
  );
}

/** The Kairo side of the split: a Today panel that answers the chat. */
function Panel({
  heading,
  sub,
  children,
  u,
  minH,
}: {
  heading: string;
  sub?: React.ReactNode;
  children: React.ReactNode;
  u: number;
  /** Matched to the chat column so the beam joins two equal shapes. */
  minH?: number;
}) {
  return (
    <div
      style={{
        width: "100%",
        minHeight: minH ? minH * u : undefined,
        borderRadius: 22 * u,
        padding: 18 * u,
        background: "var(--color-paper)",
        border: `${Math.max(1, u)}px solid var(--color-line)`,
        boxShadow: `0 ${40 * u}px ${80 * u}px -${20 * u}px rgba(0,0,0,0.22)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 * u }}>
        <span className="font-display" style={{ fontSize: 26 * u, letterSpacing: "-0.02em" }}>
          {heading}
        </span>
        <span style={{ fontSize: 12 * u, color: "var(--color-ink-soft)" }}>{sub}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 * u }}>{children}</div>
    </div>
  );
}

/**
 * The link between the two windows, and the only place the protocol itself is
 * drawn. Packets travel left to right on a tool call and right to left on its
 * answer — which is exactly the shape of the thing being announced.
 */
function Beam({ pulses, t, u, vertical }: { pulses: number[]; t: number; u: number; vertical: boolean }) {
  const TRAVEL = 620;
  const live = pulses.filter((p) => t >= p && t <= p + TRAVEL);
  const lit = live.length > 0 ? 1 : 0.35;
  const len = vertical ? 60 * u : 120 * u;

  return (
    <div
      style={{
        position: "relative",
        width: vertical ? 4 * u : len,
        height: vertical ? len : 4 * u,
        flexShrink: 0,
        borderRadius: 999,
        background: "var(--color-line)",
        overflow: "visible",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 999,
          background: "var(--color-sun)",
          opacity: lit * 0.75,
        }}
      />
      {live.map((p, i) => {
        const q = easeInOut(clamp01((t - p) / TRAVEL));
        const pos = `${q * 100}%`;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: vertical ? "50%" : pos,
              top: vertical ? pos : "50%",
              transform: "translate(-50%, -50%)",
              width: 11 * u,
              height: 11 * u,
              borderRadius: "50%",
              background: "var(--color-sun)",
              boxShadow: `0 0 ${16 * u}px ${4 * u}px color-mix(in srgb, var(--color-sun) 55%, transparent)`,
              display: "block",
            }}
          />
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- scenes */

type SceneProps = { t: number; u: number; portrait: boolean };

/** The split layout both conversation scenes share. */
function Split({
  chat,
  panel,
  pulses,
  t,
  u,
  portrait,
}: SceneProps & { chat: React.ReactNode; panel: React.ReactNode; pulses: number[] }) {
  const w = portrait ? "100%" : 470 * u;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: portrait ? "column" : "row",
        alignItems: "center",
        justifyContent: "center",
        gap: portrait ? 22 * u : 0,
        width: "100%",
      }}
    >
      <div style={{ width: w, flexShrink: 0 }}>{chat}</div>
      <Beam pulses={pulses} t={t} u={u} vertical={portrait} />
      <div style={{ width: w, flexShrink: 0 }}>{panel}</div>
    </div>
  );
}

/** Beat A — "plan my day": one sentence in, a whole day out. */
function PlanScene({ t, u, portrait }: SceneProps) {
  const ask = seg(t, 200, 900);
  const think = beatOpacity(t, 1250, 500, 220);
  const call1 = seg(t, 1750, 300);
  const call1Done = t > 2500;
  const reply = seg(t, 2700, 1500);
  const call2 = seg(t, 4300, 300);
  const call2Done = t > 5000;

  const rows = [
    { title: "Write the launch post", chip: "09:30", star: true, at: 4700 },
    { title: "Review the pull request", chip: "11:00", star: true, at: 5100 },
    { title: "Call the dentist", chip: "15:00", at: 5500 },
    { title: "Fix the tap", chip: "~20m", at: 5900 },
  ];

  return (
    <Split
      t={t}
      u={u}
      portrait={portrait}
      pulses={[1750, 4300]}
      chat={
        <Win title="Your assistant" u={u}>
          <div style={{
              display: "flex",
              flexDirection: "column",
              // bottom-aligned, the way a real conversation sits in its window:
              // top-aligning leaves a growing hole under the last bubble
              justifyContent: "flex-end",
              gap: 12 * u,
              minHeight: 196 * u,
            }}>
            <Bubble mine o={easeOut(ask)} rise={lerp(10, 0, easeOut(ask))} u={u}>
              <Type text="plan my day" p={ask} u={u} />
            </Bubble>

            {think > 0.01 && (
              <div style={{ paddingLeft: 4 * u }}>
                <Dots phase={t / 900} o={think} u={u} />
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 * u }}>
              {call1 > 0.01 && <ToolChip name="get_overview" o={call1} u={u} done={call1Done} />}
              {call2 > 0.01 && <ToolChip name="plan_day" o={call2} u={u} done={call2Done} />}
            </div>

            {reply > 0.01 && (
              <Bubble o={1} rise={lerp(8, 0, easeOut(seg(t, 2700, 400)))} u={u}>
                <Type
                  text="Three carried over and two hours already spoken for. Here's a day that fits — two must-wins, dentist at three."
                  p={reply}
                  u={u}
                />
              </Bubble>
            )}
          </div>
        </Win>
      }
      panel={
        <Panel
          minH={266}
          heading="Today"
          sub={
            <span style={{ opacity: easeOut(seg(t, 6100, 700)) }}>
              holds ~3h 10m · fits ✓
            </span>
          }
          u={u}
        >
          {rows.map((r) => {
            const o = easeOut(seg(t, r.at, 520));
            return (
              <Row
                key={r.title}
                title={r.title}
                chip={r.chip}
                star={r.star}
                o={o}
                rise={lerp(14, 0, o)}
                u={u}
              />
            );
          })}
          {t < 4700 && (
            <div
              style={{
                fontSize: 13 * u,
                color: "var(--color-ink-faint)",
                padding: `${18 * u}px 0`,
                textAlign: "center",
                opacity: 1 - easeOut(seg(t, 4300, 400)),
              }}
            >
              A blank day. Nice, or daunting?
            </div>
          )}
        </Panel>
      }
    />
  );
}

/** Beat B — telling it what you did, and a repeat looking after itself. */
function DoneScene({ t, u, portrait }: SceneProps) {
  const ask = seg(t, 200, 1100);
  const call = seg(t, 1600, 300);
  const callDone = t > 2400;
  const reply = seg(t, 2600, 1400);

  const strike1 = easeInOut(seg(t, 2300, 520));
  const strike2 = easeInOut(seg(t, 2700, 520));

  return (
    <Split
      t={t}
      u={u}
      portrait={portrait}
      pulses={[1600]}
      chat={
        <Win title="Your assistant" u={u}>
          <div style={{
              display: "flex",
              flexDirection: "column",
              // bottom-aligned, the way a real conversation sits in its window:
              // top-aligning leaves a growing hole under the last bubble
              justifyContent: "flex-end",
              gap: 12 * u,
              minHeight: 196 * u,
            }}>
            <Bubble mine o={easeOut(ask)} rise={lerp(10, 0, easeOut(ask))} u={u}>
              <Type text="did the launch post and the gym" p={ask} u={u} />
            </Bubble>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 * u }}>
              {call > 0.01 && <ToolChip name="complete_task ×2" o={call} u={u} done={callDone} />}
            </div>

            {reply > 0.01 && (
              <Bubble o={1} rise={lerp(8, 0, easeOut(seg(t, 2600, 400)))} u={u}>
                <Type
                  text="Both logged. The gym repeats, so it's already moved on to Thursday — nothing left hanging."
                  p={reply}
                  u={u}
                />
              </Bubble>
            )}
          </div>
        </Win>
      }
      panel={
        <Panel
          minH={266}
          heading="Today"
          sub={<span style={{ opacity: easeOut(seg(t, 3400, 600)) }}>done today · 2</span>}
          u={u}
        >
          <Row title="Write the launch post" chip="~90m" o={1} rise={0} u={u} done={strike1 > 0.5} strike={strike1} />
          <Row title="Morning walk" chip="↻ daily" o={1} rise={0} u={u} done={strike2 > 0.5} strike={strike2} />
          <Row title="Call the dentist" chip="15:00" o={1} rise={0} u={u} />
          <div
            style={{
              marginTop: 4 * u,
              fontSize: 12 * u,
              color: "var(--color-sun-deep)",
              opacity: easeOut(seg(t, 3200, 700)),
            }}
          >
            ↻ Morning walk · next Thursday
          </div>
        </Panel>
      }
    />
  );
}

/**
 * Beat C — the guardrail.
 *
 * The most important shot in the film. Anyone can bolt an API onto a chatbot;
 * what makes this Kairo is that the assistant refuses to wreck the day the way
 * a generic to-do integration would. The cap is quoted verbatim from the
 * server's own error string.
 */
function GuardScene({ t, u, portrait }: SceneProps) {
  const ask = seg(t, 200, 1200);
  const reply = seg(t, 1900, 1500);
  const shake = t > 1900 && t < 2300 ? Math.sin((t - 1900) / 42) * 3 : 0;

  return (
    <Split
      t={t}
      u={u}
      portrait={portrait}
      pulses={[1500]}
      chat={
        <Win title="Your assistant" u={u}>
          <div style={{
              display: "flex",
              flexDirection: "column",
              // bottom-aligned, the way a real conversation sits in its window:
              // top-aligning leaves a growing hole under the last bubble
              justifyContent: "flex-end",
              gap: 12 * u,
              minHeight: 196 * u,
            }}>
            <Bubble mine o={easeOut(ask)} rise={lerp(10, 0, easeOut(ask))} u={u}>
              <Type text="make all five of these must-wins" p={ask} u={u} />
            </Bubble>
            {reply > 0.01 && (
              <Bubble o={1} rise={0} u={u}>
                <Type
                  text="Spotlight holds three — that's the point. Win those and the day is won. Which three?"
                  p={reply}
                  u={u}
                />
              </Bubble>
            )}
          </div>
        </Win>
      }
      panel={
        <Panel
          minH={266}
          heading="Spotlight"
          sub={<span style={{ color: "var(--color-sun-deep)" }}>3 of 3</span>}
          u={u}
        >
          <div style={{ transform: `translateX(${shake * u}px)`, display: "flex", flexDirection: "column", gap: 8 * u }}>
            <Row title="Write the launch post" star o={1} rise={0} u={u} />
            <Row title="Review the pull request" star o={1} rise={0} u={u} />
            <Row title="Call the dentist" star o={1} rise={0} u={u} />
          </div>
          <Row title="Tidy the garage" o={easeOut(seg(t, 2200, 500))} rise={0} u={u} dim />
          <Row title="Reply to the landlord" o={easeOut(seg(t, 2400, 500))} rise={0} u={u} dim />
        </Panel>
      }
    />
  );
}

/** Beat D — the clients. Names, not logos: nobody's trademark is borrowed. */
function ClientsScene({ t, u }: SceneProps) {
  const names = ["ChatGPT", "Claude", "Gemini", "Grok", "Cursor", "Copilot"];
  return (
    <div style={{ display: "grid", placeItems: "center", width: "100%" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 16 * u,
          maxWidth: 1020 * u,
        }}
      >
        {names.map((n, i) => {
          const o = easeOut(seg(t, 250 + i * 200, 520));
          return (
            <span
              key={n}
              style={{
                padding: `${15 * u}px ${30 * u}px`,
                borderRadius: 999,
                border: `${Math.max(1, 1.5 * u)}px solid var(--color-line)`,
                background: "var(--color-card)",
                fontSize: 31 * u,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                opacity: o,
                transform: `translateY(${lerp(16, 0, o)}px) scale(${lerp(0.94, 1, easeOutBack(o))})`,
                boxShadow: `0 ${10 * u}px ${28 * u}px -${10 * u}px rgba(0,0,0,0.18)`,
              }}
            >
              {n}
            </span>
          );
        })}
      </div>
      <p
        style={{
          marginTop: 34 * u,
          fontSize: 25 * u,
          color: "var(--color-ink-soft)",
          opacity: easeOut(seg(t, 1700, 700)),
        }}
      >
        …and anything else that speaks MCP.
      </p>
    </div>
  );
}

/** Beat E — the setup, which is the whole objection answered. */
function KeyScene({ t, u }: SceneProps) {
  const cardIn = easeOut(seg(t, 150, 600));
  const keyIn = easeOut(seg(t, 900, 600));
  const copied = t > 1900;

  return (
    <div style={{ display: "grid", placeItems: "center", width: "100%" }}>
      <div
        style={{
          width: 560 * u,
          borderRadius: 22 * u,
          padding: 24 * u,
          background: "var(--color-card)",
          border: `${Math.max(1, u)}px solid var(--color-line)`,
          boxShadow: `0 ${40 * u}px ${80 * u}px -${20 * u}px rgba(0,0,0,0.22)`,
          opacity: cardIn,
          transform: `translateY(${lerp(16, 0, cardIn)}px)`,
        }}
      >
        <div
          style={{
            fontSize: 12 * u,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--color-ink-faint)",
            marginBottom: 10 * u,
          }}
        >
          Connections
        </div>
        <div
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: 17 * u,
            padding: `${12 * u}px ${14 * u}px`,
            borderRadius: 12 * u,
            background: "var(--color-paper-deep)",
          }}
        >
          kairo.jaimansoni.com/mcp
        </div>

        <div
          style={{
            marginTop: 12 * u,
            display: "flex",
            alignItems: "center",
            gap: 10 * u,
            opacity: keyIn,
            transform: `translateY(${lerp(10, 0, keyIn)}px)`,
          }}
        >
          <span
            style={{
              flex: 1,
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              fontSize: 15 * u,
              padding: `${12 * u}px ${14 * u}px`,
              borderRadius: 12 * u,
              background: "var(--color-sun-soft)",
              color: "var(--color-sun-deep)",
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            kairo_sk_
            <Type text="7Kd2pQm4xR9vLb3W" p={seg(t, 1000, 700)} u={u} />
          </span>
          <span
            style={{
              padding: `${11 * u}px ${18 * u}px`,
              borderRadius: 999,
              border: `${Math.max(1, u)}px solid var(--color-line)`,
              fontSize: 14 * u,
              fontWeight: 600,
              color: copied ? "var(--color-moss)" : "var(--color-ink-soft)",
              whiteSpace: "nowrap",
            }}
          >
            {copied ? "Copied ✓" : "Copy"}
          </span>
        </div>

        <p
          style={{
            marginTop: 14 * u,
            fontSize: 13 * u,
            color: "var(--color-ink-faint)",
            opacity: easeOut(seg(t, 2100, 600)),
          }}
        >
          Shown once. Revoked in one tap.
        </p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- timeline */

type Common = { start: number; dur: number; fade?: number };
type Title = Common & { kind: "title"; lines: string[]; accent?: number };
type Shot = Common & {
  kind: "shot";
  scene: (p: SceneProps) => React.ReactNode;
  caption: string;
  /** Scenes carry their own frame; wide ones need the stage, not a column. */
  wide?: boolean;
};
type Beat = Title | Shot;

const DEFAULT_FADE = 620;
const CUT_FADE = 340;

/**
 * ~46 seconds, cut to the trailer bed. Shorter than the product film on
 * purpose: this argues one idea, and a feature announcement that outstays a
 * launch film is announcing the wrong thing.
 */
export const TIMELINE: Beat[] = [
  {
    kind: "title",
    start: 3300,
    dur: 3400,
    lines: ["You don't always", "want to open", "another app."],
    accent: 2,
  },

  { kind: "shot", start: 7600, dur: 7000, scene: (p) => <PlanScene {...p} />, caption: "Ask, wherever you already are", wide: true },

  { kind: "title", start: 15300, dur: 2900, lines: ["Say it anywhere.", "It lands in Kairo."], accent: 1 },

  { kind: "shot", start: 19000, dur: 5600, scene: (p) => <DoneScene {...p} />, caption: "Tell it what you finished", wide: true },

  { kind: "title", start: 25300, dur: 2900, lines: ["And it plans", "the way Kairo does."], accent: 1 },

  { kind: "shot", start: 29000, dur: 4400, scene: (p) => <GuardScene {...p} />, caption: "Three must-wins. Not five.", wide: true },

  { kind: "shot", start: 34100, dur: 3400, fade: CUT_FADE, scene: (p) => <ClientsScene {...p} />, caption: "" },

  { kind: "shot", start: 38100, dur: 3000, fade: CUT_FADE, scene: (p) => <KeyScene {...p} />, caption: "One key. Thirty seconds." },
];

const OPEN_END = 3000;
const END_CARD = 41600;

/** Held just under the 46s bed so the track never runs out under picture. */
export const DURATION = 45800;

/* ----------------------------------------------------------------- stage */

type Stage = { w: number; h: number; portrait: boolean };

function useStage(): Stage {
  const [stage, setStage] = useState<Stage>({ w: 1920, h: 1080, portrait: false });
  useEffect(() => {
    const read = () =>
      setStage({
        w: window.innerWidth,
        h: window.innerHeight,
        portrait: window.innerHeight > window.innerWidth,
      });
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return stage;
}

function Star({ size }: { size: number }) {
  return (
    <span style={{ fontSize: size, lineHeight: 1, color: "var(--color-sun)" }} aria-hidden>
      ✱
    </span>
  );
}

/* ------------------------------------------------------------------ film */

export function McpFilm() {
  const stage = useStage();
  const [t, setT] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const w = window as unknown as {
      __seek?: (ms: number) => Promise<void>;
      __duration?: number;
      __ready?: boolean;
    };
    const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

    w.__duration = DURATION;
    w.__seek = async (ms: number) => {
      setT(ms);
      await nextFrame(); // React commits
      await nextFrame(); // …and the browser lays it out

      // Nothing here animates in CSS, but a stray transition on a freshly
      // mounted node would still free-run against the wall clock. Pausing is
      // cheap insurance against one creeping in later.
      for (const anim of document.getAnimations()) anim.pause();
      await nextFrame();
    };
    w.__ready = true;
    return () => {
      delete w.__seek;
      delete w.__ready;
    };
  }, []);

  // One scale factor drives every size, so both aspects stay in proportion.
  // Portrait is scaled off the 1080-wide phone frame rather than the 1920
  // timeline, which is why a caption there is nearly twice the nominal size.
  const unit = stage.portrait ? stage.w / 1080 : stage.w / 1920;
  /**
   * Scenes are laid out at a comfortable reading size and then grown to fill
   * the frame — the same trick the launch film uses on its demos. Drawn at
   * their nominal size they occupy barely half a 1080p frame and read as
   * miniatures; on a phone the frame is already narrow, so portrait needs
   * almost none of the lift.
   */
  // Portrait needs MORE lift, not less: the cards go full-bleed there, so the
  // same nominal type that fills a 680px landscape card is lost across a
  // 1000px phone one.
  const u = stage.portrait ? unit * 1.75 : unit * 1.45;

  const openIn = easeOut(seg(t, 250, 1000));
  const openOut = 1 - seg(t, OPEN_END - 650, 650);
  const wordIn = easeOut(seg(t, 1150, 850));
  const tagIn = easeOut(seg(t, 1800, 800));

  const endIn = easeOut(seg(t, END_CARD, 1100));
  const endLift = lerp(26, 0, endIn);

  return (
    <div
      ref={root}
      className="mesh"
      style={{
        width: "100vw",
        height: "100dvh",
        overflow: "hidden",
        position: "relative",
        background: "var(--color-paper)",
      }}
    >
      {/* ---------------------------------------------------------- opening */}
      {t < OPEN_END + 200 && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", opacity: openIn * openOut }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 * unit }}>
              <div style={{ transform: `scale(${lerp(0.7, 1, openIn)}) rotate(${lerp(-25, 0, openIn)}deg)` }}>
                <Star size={86 * unit} />
              </div>
              <span
                className="font-display"
                style={{
                  fontSize: 80 * unit,
                  letterSpacing: "-0.03em",
                  opacity: wordIn,
                  transform: `translateX(${lerp(-14, 0, wordIn) * unit}px)`,
                }}
              >
                kairo
              </span>
            </div>
            <p
              style={{
                marginTop: 20 * unit,
                fontSize: 26 * unit,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--color-ink-faint)",
                opacity: tagIn,
              }}
            >
              Connections
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ beats */}
      {TIMELINE.map((beat, i) => {
        const fade = beat.fade ?? DEFAULT_FADE;
        const o = beatOpacity(t, beat.start, beat.dur, fade);
        if (o <= 0.001) return null;

        if (beat.kind === "title") {
          const drift = lerp(16, -16, easeInOut(clamp01((t - beat.start + fade) / (beat.dur + fade * 2))));
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                opacity: o,
                padding: `0 ${8 * unit}%`,
              }}
            >
              <h2
                className="font-display"
                style={{
                  fontSize: (stage.portrait ? 94 : 100) * unit,
                  lineHeight: 1.05,
                  letterSpacing: "-0.035em",
                  textAlign: "center",
                  transform: `translateY(${drift * unit}px)`,
                  margin: 0,
                }}
              >
                {beat.lines.map((line, n) => (
                  <span
                    key={n}
                    style={{
                      display: "block",
                      color: n === beat.accent ? "var(--color-sun)" : undefined,
                      fontStyle: n === beat.accent ? "italic" : undefined,
                      opacity: clamp01(seg(t, beat.start - fade + n * 180, 760)),
                    }}
                  >
                    {line}
                  </span>
                ))}
              </h2>
            </div>
          );
        }

        // A shot holds its own frame, so the push is gentler than the launch
        // film's — a chat window drifting under a slow zoom reads as a wobble.
        const p = seg(t, beat.start, beat.dur);
        const push = lerp(1, 1.022, easeInOut(p));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 34 * unit,
              opacity: o,
              padding: `0 ${(stage.portrait ? 5 : 4) * unit}%`,
            }}
          >
            <div style={{ transform: `scale(${push})`, transformOrigin: "center 50%", width: "100%" }}>
              {beat.scene({ t: t - beat.start, u, portrait: stage.portrait })}
            </div>
            {beat.caption && (
              <p
                style={{
                  fontSize: (stage.portrait ? 36 : 26) * unit,
                  letterSpacing: "0.01em",
                  color: "var(--color-ink-soft)",
                  margin: 0,
                  textAlign: "center",
                  opacity: clamp01(seg(t, beat.start + 350, 800)),
                }}
              >
                {beat.caption}
              </p>
            )}
          </div>
        );
      })}

      {/* -------------------------------------------------------- end card */}
      {t >= END_CARD - 200 && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", opacity: endIn }}>
          <div style={{ textAlign: "center", transform: `translateY(${endLift * unit}px)` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 * unit }}>
              <Star size={68 * unit} />
              <span className="font-display" style={{ fontSize: 64 * unit, letterSpacing: "-0.03em" }}>
                kairo
              </span>
            </div>
            <p
              className="font-display"
              style={{
                marginTop: 24 * unit,
                fontSize: 44 * unit,
                fontStyle: "italic",
                color: "var(--color-sun)",
                opacity: clamp01(seg(t, END_CARD + 600, 850)),
              }}
            >
              Now it answers anywhere.
            </p>
            <p
              style={{
                marginTop: 30 * unit,
                fontSize: 27 * unit,
                fontWeight: 600,
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                opacity: clamp01(seg(t, END_CARD + 1300, 850)),
              }}
            >
              kairo.jaimansoni.com/mcp
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
