/** Runs once on server boot — keeps the push delivery loop alive across restarts. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureTicker } = await import("./lib/push");
    ensureTicker();
  }
}
