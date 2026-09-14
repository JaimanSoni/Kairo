import { AppViews } from "@/components/app-views";

export const metadata = { title: "Garden · Kairo" };

/**
 * Seeds, the community boards, the basket, or one plant. The slug is read on
 * the client, where the garden's own switch lives; this route exists so a hard
 * load or a shared link enters the app the same way a tap does.
 */
export default function GardenSlugPage() {
  return <AppViews />;
}
