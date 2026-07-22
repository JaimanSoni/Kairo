"use client";

/** Last-resort boundary — replaces the root layout, so styles are inlined. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#f4f7f6",
          color: "#1c2624",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 40 }}>🫧</div>
          <h1 style={{ margin: "12px 0 4px", fontSize: 24 }}>Something hiccuped</h1>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.7 }}>
            Your tasks are safe. {error.digest ? `(ref: ${error.digest})` : ""}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20,
              padding: "10px 22px",
              borderRadius: 999,
              border: "none",
              background: "#0c9384",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
