import type { Metadata } from "next";
import Landing from "../page";

/**
 * The marketing page, reachable while signed in.
 *
 * "/" bounces anyone with a session straight to /today, so this is the way
 * back to it without signing out. It renders the same page, so it must not be
 * indexed as a separate URL — canonical points at "/".
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  robots: { index: false, follow: true },
};

export default Landing;
