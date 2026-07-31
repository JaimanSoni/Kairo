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
components/           store (optimistic state), shell, views, task UI
lib/                  db, session, google oauth, task repo, nlp parser, dates
proxy.ts              optimistic session redirects (Next 16's middleware)
```

## Keyboard

`N` capture · `1–4` switch views · `Enter` save · `Shift+Enter` capture & keep going · `Esc` close
