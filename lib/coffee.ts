/**
 * "Buy me a coffee" — tips through Razorpay Checkout.
 *
 * Checkout carries every rail that matters here (UPI, cards, netbanking,
 * wallets), and the server keeps its own tips ledger, so the client needs
 * nothing but the amounts and a name for the thank-you line. The old
 * direct-UPI deep links and QR are gone: one payment surface, one code path.
 */

export const COFFEE = {
  /** Whose pocket the thank-you goes to, for the footer line. */
  payeeName: (process.env.NEXT_PUBLIC_UPI_NAME ?? "").trim() || "Jaiman",
  /** Rupees. A custom amount sits alongside these in the modal. */
  amounts: [99, 259, 499] as const,
};

/**
 * Tips ride the same Razorpay account as the paywall, which the product
 * cannot run without, so the jar is simply always open. The order endpoint
 * still answers 503 if payments are genuinely unconfigured.
 */
export const coffeeEnabled = true;
