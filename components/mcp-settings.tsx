"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { track } from "@/lib/analytics-client";
import Link from "next/link";
import { Modal } from "./ui";

/**
 * Connections — the settings surface for MCP keys.
 *
 * A key is shown exactly once, on the screen that created it. There is no
 * "show again", because the server keeps only a hash: that is the property
 * worth having, and a UI that pretended otherwise would be lying about it.
 */

type KeyInfo = {
  id: string;
  name: string;
  last4: string;
  scope: "read" | "write";
  includeLocked: boolean;
  timezone: string;
  createdAt: string;
  lastUsedAt: string | null;
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtWhen(iso: string | null): string {
  if (!iso) return "never used";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 120_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          // Clipboard access can be refused outright; the value is on screen
          // and selectable either way, so this fails quietly rather than
          // interrupting with an error about a convenience.
          return;
        }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
      className="shrink-0 rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold text-ink-soft transition-colors hover:border-sun hover:text-sun-deep"
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

export function ConnectionsSettings() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mcp/keys")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { keys: KeyInfo[] } | null) => {
        if (!cancelled && d) setCount(d.keys.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <div className="mt-6">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        Connections
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          Let ChatGPT, Claude, Gemini or Grok read and change your tasks.
          <span className="block text-xs text-ink-faint">
            {count === null
              ? " "
              : count === 0
                ? "No connections yet."
                : `${count} active ${count === 1 ? "connection" : "connections"}.`}
          </span>
        </p>
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-full border border-line bg-card px-4 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:border-sun hover:text-sun-deep"
        >
          {count ? "Manage" : "Connect"}
        </button>
      </div>
      {open && <ConnectionsModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function ConnectionsModal({ onClose }: { onClose: () => void }) {
  const [keys, setKeys] = useState<KeyInfo[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"read" | "write">("write");
  const [includeLocked, setIncludeLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The one and only time this value exists outside the assistant. */
  const [fresh, setFresh] = useState<string | null>(null);
  /**
   * The address to paste into an assistant. Read from the browser rather than
   * from APP_URL, which is a server value the client build never sees, and
   * only after mount so the server's render and the browser's first one agree.
   */
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const origin = mounted ? window.location.origin : "";

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/mcp/keys");
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { keys: KeyInfo[] };
      setKeys(data.keys);
    } catch {
      setError("Couldn't load your connections. Check your network and try again.");
      setKeys([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mcp/keys")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("unavailable"))))
      .then((d: { keys: KeyInfo[] }) => {
        if (!cancelled) setKeys(d.keys);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Couldn't load your connections. Check your network and try again.");
        setKeys([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const create = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/mcp/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          scope,
          includeLocked,
          // the zone this browser is in, so an assistant with no clock of ours
          // still knows when "today" starts for you
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const data = (await res.json()) as { key?: string; error?: string };
      if (!res.ok || !data.key) {
        setError(data.error ?? "Couldn't create that connection.");
        return;
      }
      setFresh(data.key);
      setCreating(false);
      setName("");
      track("mcp-connection-created", { scope });
      await load();
    } catch {
      setError("Couldn't create that connection. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    setError(null);
    setKeys((prev) => prev?.filter((k) => k.id !== id) ?? null);
    try {
      const res = await fetch(`/api/mcp/keys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
    } catch {
      setError("Couldn't revoke that one. Reopen this panel to check.");
      await load();
    }
  };

  const endpoint = `${origin}/mcp`;

  return (
    <Modal onClose={onClose} wide anchor="top">
      <div className="max-h-[80vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Connections</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Give an AI assistant its own key and it can plan your day, capture what you say, and
              tick things off — without you opening Kairo.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink-faint hover:bg-paper-deep"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-line bg-paper-deep/40 p-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Server address
          </div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-card px-3 py-2 font-mono text-xs">
              {/* the origin only exists once mounted, so this is "/mcp" for a frame */}
              {origin ? endpoint : "…"}
            </code>
            <CopyButton value={endpoint} />
          </div>
        </div>

        {fresh && <FreshKey value={fresh} endpoint={endpoint} onDismiss={() => setFresh(null)} />}

        {error && <p className="mt-4 text-sm text-clay">{error}</p>}

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Your keys
            </span>
            {!creating && (
              <button
                onClick={() => setCreating(true)}
                className="rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold text-ink-soft transition-colors hover:border-sun hover:text-sun-deep"
              >
                + New connection
              </button>
            )}
          </div>

          {creating && (
            <div className="anim-pop mb-3 rounded-xl border border-line bg-card p-4">
              <label className="block text-xs font-medium text-ink-soft" htmlFor="conn-name">
                What is it for?
              </label>
              <input
                id="conn-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void create();
                }}
                maxLength={60}
                autoFocus
                placeholder="ChatGPT on my laptop"
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-sun"
              />

              <fieldset className="mt-3">
                <legend className="text-xs font-medium text-ink-soft">What may it do?</legend>
                <div className="mt-1 flex flex-wrap gap-2">
                  {(
                    [
                      { v: "write", label: "Add & change things" },
                      { v: "read", label: "Read only" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setScope(opt.v)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                        scope === opt.v
                          ? "bg-sun-soft text-sun-deep"
                          : "border border-line bg-card text-ink-soft hover:border-ink-faint"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="mt-3 flex items-start gap-2 text-xs text-ink-soft">
                <input
                  type="checkbox"
                  checked={includeLocked}
                  onChange={(e) => setIncludeLocked(e.target.checked)}
                  className="mt-0.5 size-3.5 accent-current"
                />
                <span>
                  Include PIN-locked lists
                  <span className="block text-ink-faint">
                    Off by default. An assistant has no PIN, so locked lists stay invisible to it
                    unless you say otherwise.
                  </span>
                </span>
              </label>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={create}
                  disabled={busy || !name.trim()}
                  className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-paper disabled:opacity-40"
                >
                  {busy ? "…" : "Create key"}
                </button>
                <button
                  onClick={() => {
                    setCreating(false);
                    setError(null);
                  }}
                  className="rounded-full border border-line bg-card px-4 py-1.5 text-xs font-medium text-ink-soft hover:border-ink-faint"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {keys === null ? (
            <p className="text-sm text-ink-faint">Loading…</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-ink-faint">
              No connections yet. Create one, then paste it into your assistant.
            </p>
          ) : (
            <ul className="space-y-2">
              {keys.map((k) => (
                <li
                  key={k.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-card px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{k.name}</div>
                    <div className="text-xs text-ink-faint">
                      <span className="font-mono">···{k.last4}</span>
                      {" · "}
                      {k.scope === "read" ? "read only" : "read & write"}
                      {k.includeLocked ? " · locked lists" : ""}
                      {" · "}
                      {fmtWhen(k.lastUsedAt)}
                      {" · added "}
                      {fmtDate(k.createdAt)}
                    </div>
                  </div>
                  <button
                    onClick={() => revoke(k.id)}
                    className="shrink-0 rounded-full border border-line bg-card px-3 py-1 text-xs font-medium text-ink-soft transition-colors hover:border-clay hover:text-clay"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <HowToConnect endpoint={endpoint} />
      </div>
    </Modal>
  );
}

function FreshKey({
  value,
  endpoint,
  onDismiss,
}: {
  value: string;
  endpoint: string;
  onDismiss: () => void;
}) {
  const urlForm = `${endpoint}?key=${value}`;
  return (
    <div className="anim-pop mt-4 rounded-xl border border-sun/60 bg-sun-soft/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold text-sun-deep">
          Here it is — this is the only time you&apos;ll see it.
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 text-xs font-medium text-ink-faint underline hover:text-ink"
        >
          Done
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg bg-card px-3 py-2 font-mono text-xs">
          {value}
        </code>
        <CopyButton value={value} />
      </div>
      <div className="mt-3 text-xs text-ink-soft">
        Or, for anything that only takes a URL, this single link carries the key with it:
      </div>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-card px-3 py-2 font-mono text-[11px]">
          {urlForm}
        </code>
        <CopyButton value={urlForm} label="Copy URL" />
      </div>
      <p className="mt-3 text-xs text-ink-faint">
        Treat it like a password: anyone holding it can act as you in Kairo. Revoke it here the
        moment you stop using it.
      </p>
    </div>
  );
}

function HowToConnect({ endpoint }: { endpoint: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6 border-t border-line pt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-ink-faint"
      >
        How to connect
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 text-xs text-ink-soft">
          <p>
            Kairo speaks MCP over HTTP. Wherever your assistant asks for a custom connector or MCP
            server, give it <code className="font-mono">{endpoint}</code> and your key.
          </p>
          <ul className="space-y-1.5">
            <li>
              <strong>Claude</strong> — Settings → Connectors → Add custom connector. Paste the
              address, and the key as an <code className="font-mono">Authorization</code> header of{" "}
              <code className="font-mono">Bearer YOUR_KEY</code>.
            </li>
            <li>
              <strong>ChatGPT</strong> — Settings → Connectors → Create. If it only offers a URL,
              use the link that already carries the key.
            </li>
            <li>
              <strong>Gemini CLI / Grok / anything else</strong> — add an HTTP MCP server pointing at
              the address, with the header{" "}
              <code className="font-mono">Authorization: Bearer YOUR_KEY</code>. An{" "}
              <code className="font-mono">X-API-Key</code> header works too.
            </li>
            <li>
              <strong>Claude Code</strong> —{" "}
              <code className="font-mono break-all">
                claude mcp add --transport http kairo {endpoint} --header &quot;Authorization: Bearer
                YOUR_KEY&quot;
              </code>
            </li>
          </ul>
          <p className="text-ink-faint">
            Then just talk: &ldquo;plan my day&rdquo;, &ldquo;I finished the launch post&rdquo;,
            &ldquo;what carried over?&rdquo;. Full guide in{" "}
            <Link href="/support/connect-ai" className="underline hover:text-ink">
              Help &amp; guides
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
