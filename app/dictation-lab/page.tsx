import type { Metadata } from "next";
import { DictationLab } from "@/components/dictation/lab";

/**
 * Where the dictation is measured rather than admired. Not linked from
 * anywhere and not indexed: it exists so a change to the model or to the
 * corrections can be judged against the run before it.
 */
export const metadata: Metadata = {
  title: "Dictation bench",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <DictationLab />;
}
