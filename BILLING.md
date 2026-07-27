# Billing — Razorpay subscriptions

Kairo ships with payments **off**. Nothing charges anyone until you turn the
switch on in `/admin/dashboard`, and the switch refuses to arm without keys.

## What the rules are

Decided in `lib/access.ts` (`resolveAccess`) — pure functions, no I/O, so the
rule that gates the whole product can be read and tested on its own.

In order of precedence:

1. **Payments off** → everyone is in. The master switch beats everything.
2. **Comped** → free forever. Granted per account by an admin.
3. **Subscription `active` or `authenticated`** → in.
4. **Paid period not yet elapsed** → in, even after cancelling. Access already
   paid for is never clawed back.
5. **Within 3 days of signup** → in, on trial.
6. Otherwise → the paywall.

## Setup

1. **Create a plan** in the Razorpay dashboard (Subscriptions → Plans):
   monthly, $5.99. Copy the plan id (`plan_...`).

   > Razorpay only allows non-INR plans once international payments are
   > enabled on the account. If USD is refused, create the plan in INR — the
   > code takes its amount from the plan, so only the label in
   > `components/paywall.tsx` needs changing.

2. **Add the keys.** Locally in `.env.local`, and on Vercel under Settings →
   Environment Variables:

   ```
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxx
   RAZORPAY_PLAN_ID=plan_xxxxxxxx
   RAZORPAY_WEBHOOK_SECRET=whatever-you-set-in-the-dashboard
   ```

   `RAZORPAY_KEY_SECRET` must never be prefixed `NEXT_PUBLIC_` — that would
   publish it to every browser. Only the key id reaches the client, which is
   what Checkout expects.

3. **Add the webhook** (Settings → Webhooks):

   - URL: `https://your-domain/api/billing/webhook`
   - Secret: the same value as `RAZORPAY_WEBHOOK_SECRET`
   - Events: `subscription.authenticated`, `subscription.activated`,
     `subscription.charged`, `subscription.pending`, `subscription.halted`,
     `subscription.cancelled`, `subscription.completed`

4. **Redeploy**, then flip the switch in `/admin/dashboard`.

The admin panel warns loudly if the webhook secret is missing: Checkout would
still work, but renewals, failures and cancellations would never reach us and
every subscription state would silently go stale.

## How money is confirmed

Two independent paths, and the client is trusted in neither.

- **`/api/billing/verify`** runs right after Checkout so the UI unlocks without
  waiting. It verifies the HMAC over `payment_id|subscription_id` with the key
  secret, checks the subscription belongs to the signed-in account, then
  re-reads the real state from Razorpay rather than believing the request.
- **`/api/billing/webhook`** is the authority. It verifies an HMAC over the
  *raw* body (parsing and re-serialising would change the bytes and break the
  signature), and finds the account by looking the subscription id up in our
  own records — never from the payload's `notes`, which a forger controls.

## Testing with test mode

Razorpay test cards: `4111 1111 1111 1111`, any future expiry, any CVV.

To exercise the webhook locally, expose the port and point the dashboard at it:

```sh
npx localtunnel --port 3010     # or ngrok http 3010
```

## Managing users

`/admin/dashboard`:

- **Turn payments on/off** — the master switch. Off is the safe state.
- **Make free / Free ✓** — puts an existing account on the free list, with an
  optional note. Works after signup, which is the point: comp someone once
  they're already using it.
- Each row shows live state: `trial · 2/3d`, `active`, `paid through`,
  `lapsed`, or `free forever`.
