import { Retry } from "./retry";

export const metadata = { title: "Offline · Kairo" };

/**
 * What the service worker shows instead of the browser's error page.
 *
 * Held in the cache from the moment the worker installs, so it is there on
 * the one occasion it is needed — a train, a lift, a dead patch of signal.
 * Static on purpose: it reads no session and touches no database, because
 * the whole point is that nothing can be reached.
 *
 * The tone matters here. Losing signal is not a fault of the person holding
 * the phone, and the thing they actually want to know is whether the morning's
 * work is still there. It is: everything is written to the server as it
 * happens, and this screen is only a closed door, not a lost room.
 */
export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-6 py-16 text-ink">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-8 text-center shadow-lg">
        <div className="text-4xl" aria-hidden>
          🌙
        </div>
        <h1 className="font-display mt-3 text-3xl leading-tight">No connection</h1>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          Kairo can&apos;t reach the internet just now. Nothing is lost — your tasks, habits and notes are all saved,
          and they&apos;ll be here the moment you&apos;re back.
        </p>
        <Retry />
        <p className="mt-4 text-[12px] text-ink-faint">This page will return on its own once you&apos;re online.</p>
      </div>
    </main>
  );
}
