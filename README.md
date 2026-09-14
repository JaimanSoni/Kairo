# ✱ Kairo — a daily planner that forgives

Kairo is a personal task planner built around one insight from market research: **people don't
abandon todo apps because they lack features — they abandon them because the app makes them feel
bad.** The overdue wall of red badges is the #1 documented uninstall trigger; capture friction and
infinite lists are #2 and #3.

## Product principles

| Problem in other apps | Kairo's answer |
| --- | --- |
| "62 overdue tasks" in red → shame → uninstall | **Fresh Start sweep**: every morning, yesterday's leftovers get one decision each (Today / Later / Someday / Did it / Let go). Nothing ever rots in red. |
| Fake due dates on everything | **Planned day ≠ deadline.** `plannedFor` is a promise to yourself; `dueDate` is a rare, real deadline. |
| Everything looks equally urgent | **Spotlight** — max 3 must-wins per day. Win those, the day is won. |
| Capture requires decisions (list? date? priority?) | **Omnibar** (`N`): plain text → inbox. Optional tokens: `tomorrow`, `fri`, `due mon`, `~30m`, `#list`, `!`. Voice capture (Web Speech API) where the browser supports it. |
| Messy thoughts don't fit token syntax | **AI intent parsing** (Ollama cloud, `gemma4:31b`): capture is instant with the local parser, then AI quietly refines title/date/estimate/list/steps in the background. Any AI failure → local parse simply stands. |
| Overplanned days that collapse by noon | **Capacity meter**: estimates roll up to "today holds ~3h — fits ✓" (a suggestion, never a wall). |
| Streaks & gamification that punish | **The Log** — evidence of what you *did* finish. No streaks, no gaps, no guilt. |
| Tasks that carry over silently forever | **Carry counter**: after ×3, Kairo gently suggests breaking it down or letting it go. Both count as wins. |

## Stack

- **Next.js 16** (App Router, `proxy.ts` route guard) + React 19 + Tailwind v4
- **MongoDB** (`users`, `tasks`, `lists` collections)
- **Google OAuth** (hand-rolled authorization-code flow) + `jose`-signed httpOnly session cookies
- **Ollama cloud** for capture intent parsing (`/api/parse`, graceful fallback to `lib/nlp.ts`)
- Optimistic client store (React context/reducer) → REST route handlers
- PWA: installable (manifest + standalone display), bottom-sheet modals, safe-area aware, haptic + audio feedback on completion

## Running

```bash
npm install
npm run dev   # → http://localhost:3010  (port 3010 is wired into the scripts)
```

### Environment (`.env.local`)

```
MONGODB_URI=...                 # Atlas connection string
MONGODB_DB=todo
AUTH_SECRET=...                 # any long random string (session signing)
GOOGLE_CLIENT_ID=...            # see below
GOOGLE_CLIENT_SECRET=...
APP_URL=http://localhost:3010
OLLAMA_API_KEY=...              # optional: enables AI capture parsing (ollama.com)
OLLAMA_MODEL=gemma4:31b         # optional: any Ollama cloud model
DEV_LOGIN=1                     # optional: local-only login bypass at /api/auth/dev
```

### Google OAuth setup

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create an **OAuth client ID** (type: Web application)
3. Add authorized redirect URI: `http://localhost:3010/api/auth/callback/google`
4. Paste the client ID + secret into `.env.local`

Until then, `DEV_LOGIN=1` + `NODE_ENV=development` enables a local test login at
`/api/auth/dev` (never active in production builds).

## Layout

```
app/
  page.tsx            landing page (public)
  (app)/              authed app — today / calendar / lists / log
  api/                auth + tasks/lists/log route handlers
  api/mcp/            the MCP endpoint (served at /mcp) + connection-key CRUD
components/           store (optimistic state), shell, views, task UI
lib/                  db, session, google oauth, task repo, nlp parser, dates
lib/mcp/              MCP protocol, tool registry, per-connection scope
lib/journal*.ts       journal pages: content model, sanitiser, PIN lock, client cache
components/journal/   the journal: calendar home, TipTap editor, slash menu, PIN gate
lib/doc-model.ts      the document model both editors share: sanitiser, plain text, Markdown
lib/notes*.ts         notes: page tree, versioned bodies, trash, search, client store
components/notes/     notes: page tree, block editor, block handle, templates, trash
components/editor/    editor pieces shared by the journal and notes
proxy.ts              optimistic session redirects (Next 16's middleware)
```

## Journal

One page per day at `/journal` (shortcut `5`, or `J` for today's page). A TipTap editor with
Markdown shortcuts, a `/` menu, a selection bubble, focus mode, dictation and mood as weather; a
calendar tinted by that mood; search; and *on this day*. Each page can pull in what was finished in
Kairo that day.

Design notes worth knowing before changing it:

- **Pages are editor JSON, not HTML.** `lib/journal-shared.ts` rebuilds every page from a short
  whitelist of nodes and marks on the way in. Unknown blocks are refused, links are http, https or
  mailto only, so nothing ever has to be sanitised on the way out.
- **Every save names the version it started from.** A stale save gets a 409 carrying the newer page,
  and the editor offers Keep both, Keep mine or Use the other. Nothing is silently overwritten, and
  a unique index makes one page per day true under concurrency.
- **Words land on the device first.** Drafts go to localStorage before the network and are removed
  only once the server confirms that exact version.
- **The journal PIN is enforced by the server.** Pages aren't sent until a signed, PIN-bound cookie
  arrives, so changing the PIN locks every other browser. Wrong PINs are counted in the database,
  not in memory, so a cold serverless instance can't reset the cool-down.
- **Never sent to the AI parser**, and reachable over MCP only by keys created with *Include journal*.
- **Export ignores the subscription.** A lapsed card must not cost anyone their diary.

## Notes

Pages inside pages at `/notes` (shortcut `6`; on a phone, the round button bottom-right). A block
editor with a `/` menu, a drag handle on every block, toggles, tables, callouts, text colours, `@`
links between pages with backlinks, templates, and Kairo tasks that live inside a page and tick
everywhere. Favorites, a drag-to-nest tree, quick find (`⌘P`), a 30-day trash, and Markdown export.

Design notes worth knowing before changing it:

- **The body is versioned; the rest is last-writer-wins.** A body save names the version it started
  from and a stale one gets a 409, exactly like a journal page. Title, icon, cover and page settings
  are plain fields, so renaming a page in the tree never collides with typing on it.
- **Order is a number between neighbours.** Moving a page rewrites one row; siblings are renumbered
  only when the gap between two ranks runs out.
- **Trash is two steps.** Deleting trashes a page with everything beneath it; restoring brings back
  what went together; anything older than 30 days is purged lazily when the trash is read.
- **A blank body over a written one is refused** unless the editor says a person cleared it.
- **One document model.** `lib/doc-model.ts` holds the sanitiser, plain text and Markdown for both
  editors; each brings its own whitelist of blocks.
- Reachable over MCP only by keys created with *Include notes*, and there is no delete tool.

## Connect an assistant (MCP)

Kairo is an MCP server at **`/mcp`**, so ChatGPT, Claude, Gemini, Grok and any
coding assistant that speaks MCP can plan the day, capture, complete and sweep
without the app being open. 26 tools cover everything a person can do in the UI.

Auth is a connection key, not OAuth, so it works in clients whose connector UI
offers only a URL and a header. Create one under **Settings → Connections**; it is
shown once and stored only as a SHA-256.

```bash
# header (preferred)
curl -s https://kairo.jaimansoni.com/mcp \
  -H 'Authorization: Bearer kairo_sk_...' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# or X-API-Key, or ?key=... for clients that can only take a URL
```

Design notes worth knowing before changing it:

- **Stateless Streamable HTTP.** One POST, one answer. No session id, no SSE:
  nothing here is server-initiated, and that is what keeps each request
  independent on serverless.
- **The zone lives on the key.** Every Kairo date is a local day string, and an
  assistant has no clock of ours — so a key remembers the browser's IANA zone
  and `lib/tz.ts` computes every day boundary in it.
- **PIN-locked lists are out of scope by default**, tasks inside them included,
  unless the key was created with that box ticked. Same rule `/api/parse` uses.
- **Read-only keys are not shown the write tools at all**, rather than being
  refused after the model has already spent a turn on one.
- **The server sends `instructions` on `initialize`** (see `lib/mcp/server.ts`)
  so the model plans the way Kairo does: planned day ≠ deadline, spotlight holds
  three, carried-over work is never called overdue.

No new environment variables. Keys live in the `api_keys` collection.

## Keyboard

`N` capture · `J` today's journal page · `1–6` switch views · `⌘K` search everything · `⌘P` find a note · `Enter` save · `Shift+Enter` capture & keep going · `Esc` close
