/**
 * "Buy me a coffee" — UPI tipping.
 *
 * Set these in `.env.local` (they are NEXT_PUBLIC_ because the VPA is printed
 * on the QR anyway — there is nothing secret about a payee address):
 *
 *   NEXT_PUBLIC_UPI_ID=yourname@okhdfcbank
 *   NEXT_PUBLIC_UPI_NAME=Your Name
 *
 * With no UPI id configured the whole feature disappears from the UI, so a
 * half-set-up deploy can never show a payment button that goes nowhere.
 */

/** `user@bank` — letters, digits, dot, hyphen, underscore, then a handle. */
const VPA_RE = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.]{1,63}$/;

const rawId = (process.env.NEXT_PUBLIC_UPI_ID ?? "").trim();

export const COFFEE = {
  /** Empty when unset or malformed — never fall back to a guess. */
  upiId: VPA_RE.test(rawId) ? rawId : "",
  payeeName: (process.env.NEXT_PUBLIC_UPI_NAME ?? "").trim() || "Kairo",
  /** Rupees. `null` means "let them type it in their UPI app". */
  amounts: [49, 99, 199] as const,
  note: "Kairo coffee",
};

export const coffeeEnabled = COFFEE.upiId.length > 0;

/**
 * Builds a UPI intent URI. Every UPI app on Android and iOS understands this
 * scheme, and the same string is what goes inside the QR — one source of
 * truth, so the scanned and tapped paths can never disagree.
 *
 * Omitting `amount` leaves the field blank for the payer to fill in.
 */
export function upiLink(amount?: number | null): string {
  const q = new URLSearchParams({
    pa: COFFEE.upiId,
    pn: COFFEE.payeeName,
    cu: "INR",
    tn: COFFEE.note,
  });
  if (amount != null && amount > 0) q.set("am", amount.toFixed(2));
  return (
    "upi://pay?" +
    q
      .toString()
      // "+" for a space is form encoding; some UPI apps print it literally in
      // the payee name. %20 is understood everywhere.
      .replace(/\+/g, "%20")
      // "@" is legal unencoded in a query (RFC 3986 pchar) and every real UPI
      // QR leaves it that way — naive parsers don't decode %40 and then fail
      // to resolve the payee.
      .replace(/%40/g, "@")
  );
}
