"use client";

/**
 * The thing you talk to.
 *
 * Four soft lobes of colour drifting inside a circle, and a ring around it
 * that swells with your voice. It is alive when it is waiting, it moves with
 * what it hears, and it turns in on itself while it thinks -- so the state of
 * the capture is legible from across the room, without a word of copy.
 *
 * It is all CSS. The lobes drift on keyframes the compositor owns, and the
 * only thing JavaScript touches is one custom property, `--heard`, written
 * straight to this element from the microphone's level. Nothing here
 * re-renders while you speak: a React state update per audio frame would
 * cost more than the rest of the capture box put together.
 */

export type OrbState = "waiting" | "listening" | "thinking";

export function Orb({ state, size = 148 }: { state: OrbState; size?: number }) {
  return (
    <div
      className={`cap-orb cap-orb-${state}`}
      style={{ width: size, height: size }}
      data-orb={state}
      aria-hidden
    >
      <span className="cap-orb-glow" />
      <span className="cap-orb-skin">
        <i className="cap-orb-lobe cap-orb-a" />
        <i className="cap-orb-lobe cap-orb-b" />
        <i className="cap-orb-lobe cap-orb-c" />
        <i className="cap-orb-lobe cap-orb-d" />
        <i className="cap-orb-sheen" />
      </span>
    </div>
  );
}
