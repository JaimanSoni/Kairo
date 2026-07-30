"use client";

import { createContext, useContext } from "react";
import type { FeatureKey } from "@/lib/features";

/**
 * What this account may use, for the browser.
 *
 * Its own context rather than a field on the app store: the store is a reducer
 * over tasks and lists that dispatches on every keystroke, and entitlements
 * never change while the page is open. Keeping them apart means a plan check
 * can't be invalidated by a task edit.
 *
 * This exists to shape the interface — to offer an upgrade instead of a button
 * that would fail. It is not the enforcement. Every gated action is also checked
 * on the server, in lib/entitlements.ts.
 */
const FeaturesContext = createContext<FeatureKey[]>([]);

export function EntitlementsProvider({
  features,
  children,
}: {
  features: FeatureKey[];
  children: React.ReactNode;
}) {
  return <FeaturesContext.Provider value={features}>{children}</FeaturesContext.Provider>;
}

/** `const can = useCan(); can("ai-capture")` */
export function useCan(): (feature: FeatureKey) => boolean {
  const features = useContext(FeaturesContext);
  return (feature: FeatureKey) => features.includes(feature);
}

/** The link a locked control should point at, so the reason survives the jump. */
export function upgradeHref(feature: FeatureKey): string {
  return `/upgrade?feature=${encodeURIComponent(feature)}`;
}
