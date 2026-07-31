import { SITE_URL, SUPPORT_EMAIL } from "./site";

/**
 * Where a human should write. The sender address is not monitored and carries
 * no reply-to on purpose, so every email says this address out loud instead.
 */
const SUPPORT_INBOX = "kairo.support@jaimansoni.com";

/**
 * The emails, written as plain HTML with inline styles — email clients load no
 * stylesheets and Gmail strips SVG, so the mark is the ✱ character in brand
 * teal and every style rides on the element itself. Each template returns a
 * text twin too: multipart mail scores honestly with spam filters and reads
 * fine in terminals.
 *
 * House rules, same as the notifications: no emojis, no em dashes, and the
 * copy never blames the reader. Every email says why it was sent, because all
 * of these are transactional and the privacy policy promises nothing else.
 */

type Rendered = { subject: string; html: string; text: string };

const INK = "#1c2624";
const SOFT = "#54655f";
const FAINT = "#93a39d";
const TEAL = "#0c9384";
const PAPER = "#f4f7f6";
const LINE = "#dfe7e4";

function shell(bodyHtml: string, reason: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:${PAPER};">
<div style="max-width:520px;margin:0 auto;padding:32px 20px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK};">
  <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;margin-bottom:20px;">
    <span style="color:${TEAL};">&#10033;</span> kairo
  </div>
  <div style="background:#ffffff;border:1px solid ${LINE};border-radius:16px;padding:28px 24px;">
    ${bodyHtml}
  </div>
  <p style="font-size:12px;line-height:18px;color:${FAINT};margin:20px 4px 0;">
    ${reason} Questions? Write to <a href="mailto:${SUPPORT_INBOX}" style="color:${FAINT};">${SUPPORT_INBOX}</a>.
    <br/>Kairo &middot; <a href="${SITE_URL}" style="color:${FAINT};">kairo.jaimansoni.com</a>
  </p>
</div>
</body></html>`;
}

const h = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const heading = (s: string) =>
  `<h1 style="font-size:22px;line-height:28px;margin:0 0 12px;font-weight:700;">${s}</h1>`;
const para = (s: string) =>
  `<p style="font-size:15px;line-height:24px;margin:0 0 14px;color:${SOFT};">${s}</p>`;
const strong = (s: string) => `<strong style="color:${INK};">${s}</strong>`;
const button = (label: string, href: string) =>
  `<a href="${href}" style="display:inline-block;background:${TEAL};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:999px;margin-top:6px;">${label}</a>`;

const footerText = (reason: string) =>
  `\n\n${reason} Questions? Write to ${SUPPORT_INBOX}.\nKairo · ${SITE_URL}`;

/* ------------------------------------------------------------------ money */

export function receiptEmail(input: {
  name: string;
  amountLabel: string;
  planName: string;
  coversUntil: string;
  paymentId: string;
}): Rendered {
  const reason = "You received this because a payment was made on your Kairo account.";
  return {
    subject: `Payment received. You are covered until ${input.coversUntil}`,
    html: shell(
      heading("Thank you.") +
        para(
          `Your payment of ${strong(h(input.amountLabel))} for the ${strong(h(input.planName))} plan went through. Kairo is yours until ${strong(h(input.coversUntil))}.`
        ) +
        para(
          `Nothing renews by itself. When the month runs out, you decide again, and paying before it ends stacks the new month on top so no days are lost.`
        ) +
        para(
          `<span style="font-size:12px;color:${FAINT};">Payment reference: ${h(input.paymentId)}</span>`
        ) +
        button("Open Kairo", `${SITE_URL}/today`),
      reason
    ),
    text: `Thank you.\n\nYour payment of ${input.amountLabel} for the ${input.planName} plan went through. Kairo is yours until ${input.coversUntil}.\n\nNothing renews by itself. When the month runs out, you decide again.\n\nPayment reference: ${input.paymentId}\n\nOpen Kairo: ${SITE_URL}/today${footerText(reason)}`,
  };
}

export function renewalEmail(input: {
  name: string;
  endsOn: string;
  priceLabel: string;
  planName: string;
}): Rendered {
  const reason = "You received this because your paid month on Kairo is about to end.";
  return {
    subject: `Your Kairo month ends on ${input.endsOn}`,
    html: shell(
      heading("Your month is nearly up.") +
        para(
          `Your ${strong(h(input.planName))} plan runs until ${strong(h(input.endsOn))}. Kairo never renews by itself, so if you want to keep going, it takes one payment of ${strong(h(input.priceLabel))} and about thirty seconds.`
        ) +
        para(
          `If you let it lapse, nothing is deleted. Everything you wrote waits for you, exactly as you left it.`
        ) +
        button("Renew from your billing page", `${SITE_URL}/billing`),
      reason
    ),
    text: `Your month is nearly up.\n\nYour ${input.planName} plan runs until ${input.endsOn}. Kairo never renews by itself, so if you want to keep going, it takes one payment of ${input.priceLabel}.\n\nIf you let it lapse, nothing is deleted.\n\nRenew: ${SITE_URL}/billing${footerText(reason)}`,
  };
}

export function trialEndingEmail(input: { name: string; daysLeft: number }): Rendered {
  const days = input.daysLeft === 1 ? "tomorrow" : `in ${input.daysLeft} days`;
  const reason = "You received this because your Kairo free trial is ending.";
  return {
    subject: `Your Kairo trial ends ${days}`,
    html: shell(
      heading("The trial is almost over.") +
        para(
          `Your free trial ends ${strong(days)}. If Kairo has earned a place in your day, picking a plan takes about thirty seconds.`
        ) +
        para(
          `And if not, that is fine too. Nothing you wrote is deleted either way, it all waits for you.`
        ) +
        button("See the plans", `${SITE_URL}/pricing`),
      reason
    ),
    text: `The trial is almost over.\n\nYour free trial ends ${days}. If Kairo has earned a place in your day, picking a plan takes about thirty seconds.\n\nNothing you wrote is deleted either way.\n\nPlans: ${SITE_URL}/pricing${footerText(reason)}`,
  };
}

/* ---------------------------------------------------------- collaboration */

export function listSharedEmail(input: {
  inviterName: string;
  listName: string;
}): Rendered {
  const reason = `You received this because ${h(input.inviterName)} shared a list with your Kairo account.`;
  return {
    subject: `${input.inviterName} shared "${input.listName}" with you`,
    html: shell(
      heading(`${h(input.inviterName)} shared a list with you.`) +
        para(
          `You now have access to ${strong(h(input.listName))}. Everyone on the list sees the same tasks, and anything assigned to you will show up in your own Today.`
        ) +
        button("Open the list", `${SITE_URL}/lists`),
      reason
    ),
    text: `${input.inviterName} shared a list with you.\n\nYou now have access to "${input.listName}". Everyone on the list sees the same tasks.\n\nOpen it: ${SITE_URL}/lists${footerText(reason)}`,
  };
}

export function taskAssignedEmail(input: {
  assignerName: string;
  taskTitle: string;
  listName: string;
}): Rendered {
  const reason = `You received this because ${h(input.assignerName)} assigned a task to you on Kairo.`;
  return {
    subject: `${input.assignerName} sent this your way: ${input.taskTitle}`,
    html: shell(
      heading("A task landed with you.") +
        para(
          `${strong(h(input.assignerName))} assigned ${strong(h(input.taskTitle))} to you in ${strong(h(input.listName))}.`
        ) +
        button("See it in Kairo", `${SITE_URL}/today`),
      reason
    ),
    text: `A task landed with you.\n\n${input.assignerName} assigned "${input.taskTitle}" to you in ${input.listName}.\n\nSee it: ${SITE_URL}/today${footerText(reason)}`,
  };
}

export function taskSentEmail(input: { senderName: string; taskTitle: string }): Rendered {
  const reason = `You received this because ${h(input.senderName)} sent a task to your Kairo account.`;
  return {
    subject: `${input.senderName} sent you a task: ${input.taskTitle}`,
    html: shell(
      heading(`${h(input.senderName)} sent you a task.`) +
        para(
          `${strong(h(input.taskTitle))} is waiting in your inbox. It is your copy now, plan it whenever it suits you.`
        ) +
        button("Open your inbox", `${SITE_URL}/lists`),
      reason
    ),
    text: `${input.senderName} sent you a task.\n\n"${input.taskTitle}" is waiting in your inbox. It is your copy now.\n\nOpen it: ${SITE_URL}/lists${footerText(reason)}`,
  };
}

/* ------------------------------------------------------------------ admin */

export function adminMismatchEmail(input: {
  paymentId: string;
  orderId: string;
  amount: number | undefined;
  currency: string | undefined;
  expectedMinor: number;
  expectedCurrency: string;
}): Rendered {
  const reason = "Admin alert from Kairo billing.";
  const line = `Payment ${input.paymentId} on order ${input.orderId} arrived with amount ${input.amount ?? "?"} ${input.currency ?? "?"} but the plan expected ${input.expectedMinor} ${input.expectedCurrency}. The payment was NOT credited. The customer has paid and has nothing, check Razorpay and credit them by hand.`;
  return {
    subject: `Kairo alert: payment received but not credited (${input.paymentId})`,
    html: shell(heading("A payment did not match its plan.") + para(h(line)), reason),
    text: `A payment did not match its plan.\n\n${line}${footerText(reason)}`,
  };
}

export const ADMIN_EMAIL = SUPPORT_EMAIL;
