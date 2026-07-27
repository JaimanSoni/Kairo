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

## Two charge modes

Razorpay gates **Subscriptions** behind account activation and answers `401` on
`/plans` and `/subscriptions` until it's granted — an account can be perfectly
able to take payments while unable to create a subscription.

So the mode is decided by whether `RAZORPAY_PLAN_ID` is set:

| `RAZORPAY_PLAN_ID` | Mode | What happens |
| --- | --- | --- |
| set | `subscription` | Mandate taken now, first charge at the end of the trial, auto-renews |
| unset | `one-off` | A single month charged through Orders; the user pays again to extend |

Both feed the same `resolveAccess` rules — a one-off payment simply pushes
`currentPeriodEnd` a month forward, which the "paid through" branch already
honours. Nothing else in the app knows the difference.

To move to real subscriptions later: enable Subscriptions in the Razorpay
dashboard, create the plan, set `RAZORPAY_PLAN_ID`, redeploy. No code change.

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

## Testing

1. **Turn payments on** in `/admin/dashboard`.
2. **To land on the paywall immediately**, set `TRIAL_DAYS=0` in `.env.local`
   and restart. Otherwise you'd have to wait out the trial or edit
   `createdAt` in the database. Remove it when you're done.
3. **Pay** with a Razorpay test card: `4111 1111 1111 1111`, any future expiry,
   any CVV, OTP `1234`. To watch a decline instead, use `4000 0000 0000 0002`.
4. **Check the dashboard** — Transactions → Payments. The payment appears with
   the order id, and the `notes` carry the `userId` and email that paid.
5. **Confirm access** — the app should let you straight in, and the profile
   sheet shows the period you've paid through.

### Webhooks

Razorpay can't reach `localhost`, so expose the port first:

```sh
npx localtunnel --port 3010     # or: ngrok http 3010
```

Then add the public URL as a webhook (Settings → Webhooks), set the same
secret in `RAZORPAY_WEBHOOK_SECRET`, restart, and use **Send test webhook** in
the dashboard. An unsigned or wrongly signed request is rejected with 400,
which is the correct response — it won't fix itself on retry.

## Managing users

`/admin/dashboard`:

- **Turn payments on/off** — the master switch. Off is the safe state.
- **Make free / Free ✓** — puts an existing account on the free list, with an
  optional note. Works after signup, which is the point: comp someone once
  they're already using it.
- Each row shows live state: `trial · 2/3d`, `active`, `paid through`,
  `lapsed`, or `free forever`.
