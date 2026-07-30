import type { Metadata } from "next";
import { IconLab } from "@/components/icon-lab";

/**
 * The icon lab — a working page, like /launch, not a product page. Unlinked
 * and unindexed; it exists so icon candidates are judged in the product's own
 * type and colour rather than in a design tool.
 */
export const metadata: Metadata = {
  title: "Icon lab · Kairo",
  robots: { index: false, follow: false },
};

export default function IconsPage() {
  return (
    <main className="min-h-dvh bg-paper">
      <IconLab />
    </main>
  );
}
