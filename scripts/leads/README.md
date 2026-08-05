# Leads pipeline

Harvests real prospects from public complaint threads about competitor task
apps, then loads them into the `leads` collection shown in `/admin/leads`.

The iron rule: every lead is a real username read off a real page, with their
verbatim words as the summary and a link to the exact post. Emails are stored
only when the person published one themselves. No contact detail is ever
invented, which is what made the original seed batch worthless.

## Usage

```
cd scripts/leads
npm install          # once; puppeteer-core drives the Edge already on Windows
node harvest.mjs     # writes leads-harvest3.json next to the script
node insert.mjs 62 leads-harvest3.json   # min fit score, then file name
```

Edit the `SEARCHES`, `PH`, and `HN_QUERIES` arrays at the top of `harvest.mjs`
to point each run at fresh queries; the insert step dedups against everything
already in the collection, so reruns are safe.

Leads carry `notes: "Tier: hot|warm|cool"` — hot means actively seeking an
alternative and posted recently. Work the list top-down by fit score, reply
where the person posted (never cold-DM first), and mention EARLY10.
