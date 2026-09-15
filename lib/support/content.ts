import type { Article, Category } from "./types";
import { JOURNAL_SHOWN } from "../types";

const ALL_CATEGORIES: Category[] = [
  {
    id: "basics",
    name: "Start here",
    description: "What Kairo is for, and the five minutes that make it click.",
  },
  {
    id: "capture",
    name: "Capture",
    description: "Getting thoughts out of your head and into Kairo.",
  },
  {
    id: "planning",
    name: "Plan your day",
    description: "Today, the morning sweep, and sketching the week ahead.",
  },
  {
    id: "tasks",
    name: "Tasks in depth",
    description: "Steps, repeats, estimates, the focus timer, and lists.",
  },
  {
    id: "reminders",
    name: "Reminders",
    description: "Notifications that arrive even when Kairo is closed.",
  },
  {
    id: "sharing",
    name: "Share & collaborate",
    description: "Shared lists, assigning work, and handing tasks off.",
  },
  {
    id: "journal",
    name: "Journal",
    description: "A page a day: writing, the weather inside, and keeping it private.",
  },
  {
    id: "notes",
    name: "Notes",
    description: "Pages inside pages: blocks, templates, tasks in your notes, and the trash.",
  },
  {
    id: "habits",
    name: "Habits",
    description: "Starting habits, marking them done, streaks, strength, and leaderboards.",
  },
  {
    id: "account",
    name: "Privacy & account",
    description: "Locks, multiple accounts, your data, and fixing problems.",
  },
];

/** Shown as the numbered "Start here" row on the help home page. */
export const QUICK_START = ["philosophy", "capture", "today", "notifications"];

/**
 * When the articles below were last revised — bump it when you change them.
 *
 * Hand-maintained rather than taken from the build clock: `lastmod` in the
 * sitemap is only worth sending if it's true, and a date that moves on every
 * deploy teaches crawlers to ignore it.
 */
export const DOCS_UPDATED = "2026-09-15";

const ALL_ARTICLES: Article[] = [
  /* ---------------------------------------------------------------- basics */
  {
    slug: "philosophy",
    title: "What makes Kairo different",
    summary:
      "Kairo is built around one idea: a to-do list should never make you feel bad. Here's what that changes.",
    categoryId: "basics",
    keywords: ["philosophy", "overdue", "guilt", "why", "principles", "overwhelmed"],
    sections: [
      {
        id: "the-problem",
        heading: "The problem Kairo solves",
        blocks: [
          {
            t: "p",
            text: "Most people abandon task apps within a few weeks, and it's rarely because a feature was missing. It's because the app turned into a scoreboard of failure, a wall of red, overdue items that makes opening it feel worse than avoiding it.",
          },
          {
            t: "p",
            text: "Kairo is designed around that moment. Everything here exists to keep a bad day from becoming a dead app.",
          },
        ],
      },
      {
        id: "principles",
        heading: "The four rules Kairo plays by",
        blocks: [
          {
            t: "ul",
            items: [
              "**Nothing ever goes red.** There is no overdue count anywhere in Kairo. Unfinished work waits for you calmly.",
              "**The day is the unit.** [Today](/support/today) shows a short list you chose, not everything you've ever written down. The backlog stays out of sight until you ask for it.",
              "**Planning a day is not a deadline.** The day you intend to *do* something is separate from a real, external [deadline](/support/deadlines), and deadlines should be rare.",
              "**Falling behind is normal.** Each morning the [Fresh Start sweep](/support/fresh-start) helps you decide once about yesterday's leftovers, then moves on.",
            ],
          },
        ],
      },
      {
        id: "what-you-wont-find",
        heading: "What you won't find",
        blocks: [
          {
            t: "p",
            text: "Some omissions are deliberate. Kairo has no streaks, no productivity score, no priority levels, no nested folders, and no badge counting how far behind you are. Each of those is a well-documented reason people quit task apps.",
          },
          {
            t: "tip",
            text: "The one hard limit in Kairo is **Spotlight**, which holds three tasks. It's a constraint, not a bug, three real wins is a good day.",
          },
        ],
      },
      {
        id: "shape-of-a-day",
        heading: "The shape of a normal day",
        blocks: [
          {
            t: "ol",
            items: [
              "**Morning.** Open Kairo. If anything is left over, the Fresh Start card at the top of Today asks what to do with it, one decision each.",
              "**Plan.** Pull a few things into today from your inbox and star up to three as Spotlight.",
              "**During the day.** Capture whatever lands in your head with `N`. Don't organize it, that's what planning time is for.",
              "**Evening.** Check off what you did. Whatever's left is tomorrow's problem, and tomorrow will offer you a clean slate.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "getting-started",
    title: "Sign in and install Kairo",
    summary:
      "Sign in with Google, then install Kairo to your home screen so it opens like a real app.",
    categoryId: "basics",
    keywords: ["install", "pwa", "sign in", "login", "google", "home screen", "app", "offline"],
    sections: [
      {
        id: "sign-in",
        heading: "Sign in",
        blocks: [
          {
            t: "p",
            text: "Kairo uses Google sign-in only, there's no password to create or forget. Click **Continue with Google** and pick an account.",
          },
          {
            t: "note",
            text: "If you use Kairo on more than one web address, each one keeps its own sign-in. That's how browsers work: a session belongs to a single domain.",
          },
        ],
      },
      {
        id: "install",
        heading: "Install it to your home screen",
        blocks: [
          {
            t: "p",
            text: "Kairo is a progressive web app, so it installs without an app store and opens full-screen, without browser chrome.",
          },
          {
            t: "ul",
            items: [
              "**iPhone / iPad (Safari):** tap the Share button, then **Add to Home Screen**.",
              "**Android (Chrome):** tap the ⋮ menu, then **Install app** or **Add to Home screen**.",
              "**Desktop (Chrome/Edge):** click the install icon at the right end of the address bar.",
            ],
          },
          {
            t: "warn",
            text: "On iPhone, installing is **required** for [notifications](/support/notifications) to work at all. Safari won't deliver push to a normal browser tab.",
          },
        ],
      },
      {
        id: "find-your-way",
        heading: "How Kairo is laid out",
        blocks: [
          {
            t: "p",
            text: "Everything in Kairo lives in one of four places, and they sit in the same order on a computer and a phone.",
          },
          {
            t: "table",
            head: ["Place", "What's in it"],
            rows: [
              ["**Today**", "The day you're in: what to do, the habits due, and what you've finished."],
              ["**Plan**", "**Calendar** for when things happen, **Lists** for what they belong to, and the **Log** of what you finished."],
              ["**Notes**", "Pages inside pages, for plans, ideas and everything else."],
              ["**Habits**", "The habits you're building, one day at a time."],
            ],
          },
          {
            t: "p",
            text: "On a computer the sidebar lists every page under its place. On a phone the bottom bar has one tab for each place, with **Capture** in the middle; inside Plan, a switch at the top moves between Calendar, Lists and the Log, and the tab remembers the one you were last on.",
          },
        ],
      },
      {
        id: "make-it-yours",
        heading: "Keep only what you use",
        blocks: [
          {
            t: "p",
            text: "Planning is always there. **Habits** and **Notes** are yours to keep or put away. The first time you open Kairo it asks which you'd like; after that, open your profile, then **Settings**, and use the switches under **Your Kairo**.",
          },
          {
            t: "ul",
            items: [
              "A place you put away leaves the sidebar, the bottom bar, search, Capture and the day views, and the number keys close up behind it.",
              "Nothing in it is deleted, and a link to one of its pages still opens. Turn it back on and it's all there as you left it.",
            ],
          },
        ],
      },
      {
        id: "first-five-minutes",
        heading: "Your first five minutes",
        blocks: [
          {
            t: "ol",
            items: [
              "Press `N` and type a few things that are on your mind. Don't add dates yet, just get them out.",
              "Go to **Lists** and create one or two lists, like Work and Home.",
              "Back on **Today**, pull two or three tasks in from the inbox panel.",
              "Star the one that matters most, that's your first [Spotlight](/support/today).",
              "Optional: open a task, give it an estimate, and press **Start** to try the [focus timer](/support/focus-timer).",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "shortcuts",
    title: "Keyboard shortcuts",
    summary: "Every shortcut in Kairo, and when they're active.",
    categoryId: "basics",
    keywords: ["keyboard", "shortcuts", "hotkeys", "cmd k", "ctrl k", "keys"],
    sections: [
      {
        id: "global",
        heading: "Anywhere in the app",
        blocks: [
          {
            t: "keys",
            rows: [
              { k: "N", d: "Open capture. `C` does the same thing." },
              { k: "⌘K / Ctrl K", d: "Open the search palette, find any task, list, or action." },
              { k: "1", d: "Go to Today" },
              { k: "2", d: "Go to Calendar" },
              { k: "3", d: "Go to Lists" },
              { k: "4", d: "Go to Log" },
              { k: "5", d: "Go to Notes" },
              { k: "6", d: "Go to Habits" },
            ],
          },
          {
            t: "p",
            text: "The numbers follow the sidebar from the top, so if you put a place away, the ones below it move up a number.",
          },
          {
            t: "note",
            text: "Single-key shortcuts are ignored while you're typing in a field, and **all** shortcuts are disabled while the [app lock](/support/locks) screen is up.",
          },
        ],
      },
      {
        id: "in-dialogs",
        heading: "In capture and dialogs",
        blocks: [
          {
            t: "keys",
            rows: [
              { k: "Enter", d: "Capture the task and close" },
              { k: "Shift Enter", d: "Capture and keep the box open for the next one" },
              { k: "Esc", d: "Close any dialog" },
              { k: "↑ ↓", d: "Move through search results" },
            ],
          },
        ],
      },
      {
        id: "help-site",
        heading: "On this help site",
        blocks: [
          {
            t: "keys",
            rows: [
              { k: "/", d: "Search the guides" },
              { k: "⌘K / Ctrl K", d: "Search the guides" },
            ],
          },
        ],
      },
    ],
  },

  /* --------------------------------------------------------------- capture */
  {
    slug: "capture",
    title: "Capture a task in seconds",
    summary:
      "Press N, type the thought, hit Enter. Nothing else is required, deciding comes later.",
    categoryId: "capture",
    keywords: ["add task", "new task", "capture", "quick add", "omnibar", "inbox"],
    sections: [
      {
        id: "how",
        heading: "Capture something",
        blocks: [
          {
            t: "ol",
            items: [
              "Press `N` anywhere in Kairo (or tap the ✦ button in the mobile bar, or **Capture** in the desktop sidebar).",
              "Type the thought exactly as you'd say it.",
              "Press `Enter`.",
            ],
          },
          {
            t: "p",
            text: "That's it. With no date, the task lands in your **Inbox**, a holding pen you triage later, when you're planning rather than thinking.",
          },
          {
            t: "p",
            text: "After Enter, the panel stays with you for a moment: AI reads your sentence, and the finished task appears right there, its day, time, estimate and list, with a note on what AI filled in. **Done** closes it, **Capture another** keeps going, **Open** jumps into the task.",
          },
          {
            t: "tip",
            text: "Capturing several things at once? Use `Shift Enter` instead, it saves instantly, keeps the box open for the next one, and AI tidies in the background.",
          },
        ],
      },
      {
        id: "shortcuts-in-text",
        heading: "Add details inline (optional)",
        blocks: [
          {
            t: "p",
            text: "You can put dates, times, estimates and lists straight into the sentence, and Kairo pulls them out as you type. Live chips under the box preview what it understood.",
          },
          {
            t: "table",
            head: ["You type", "Kairo understands"],
            rows: [
              ["`call mom tomorrow`", "Planned for tomorrow"],
              ["`gym fri 6pm`", "Next Friday at 6 PM"],
              ["`taxes due mon`", "A real deadline on Monday"],
              ["`review deck ~45m`", "45-minute estimate"],
              ["`buy milk #home`", "Filed to your Home list"],
              ["`ship the release !`", "Marked as a Spotlight must-win"],
            ],
          },
          {
            t: "p",
            text: "The full reference, including repeats like `every mon and wed`, is in [dates, times, and other shortcuts](/support/quick-add-syntax).",
          },
        ],
      },
      {
        id: "notes-and-journal",
        heading: "Capture a note",
        blocks: [
          {
            t: "p",
            text: "Capture isn't only for tasks. Across its top are **Task** and **Note**; pick one before you type.",
          },
          {
            t: "table",
            head: ["Pick", "What happens"],
            rows: [
              ["**Task**", "The usual: AI reads it and fills in the day, time, list and steps."],
              ["**Note**", "A new page in [Notes](/support/notes). A short thought is its title; a longer one takes its first sentence as the title and keeps the rest as the page."],
            ],
          },
          {
            t: "p",
            text: "A note is saved exactly as typed, with no AI. A small message says it went to Notes, with **Open** to go straight there. `Shift Enter` saves and keeps the box open for the next one.",
          },
        ],
      },
      {
        id: "where-it-goes",
        heading: "Where a captured task ends up",
        blocks: [
          {
            t: "ul",
            items: [
              "**No date** → your Inbox, waiting to be planned.",
              "**A day** (`today`, `fri`, `next week`) → planned for that day, so it shows up on [Today](/support/today) or the [Calendar](/support/calendar).",
              "**A time but no day** → today, at that time.",
              "**A repeat but no day** → the rule's first occurrence.",
            ],
          },
          {
            t: "note",
            text: "After you capture, AI quietly reviews the raw sentence and can fill in details you didn't type, see [how AI tidies your captures](/support/ai).",
          },
        ],
      },
      {
        id: "elsewhere",
        heading: "The quick add rows",
        blocks: [
          {
            t: "p",
            text: "Every list, every day in the Calendar's week view, and Today itself have their own inline add row. They understand the same syntax, but default to that context, typing in Thursday's row plans it for Thursday, and typing in a list files it there.",
          },
          {
            t: "note",
            text: "The inline rows save on `Enter` and don't run the AI pass. They're for when you already know where something belongs.",
          },
        ],
      },
    ],
  },
  {
    slug: "quick-add-syntax",
    title: "Dates, times, and other shortcuts",
    summary:
      "The complete list of words Kairo recognises while you type, with the exact rules for each.",
    categoryId: "capture",
    keywords: [
      "syntax",
      "natural language",
      "parser",
      "tokens",
      "dates",
      "time",
      "estimate",
      "repeat",
      "hashtag",
    ],
    sections: [
      {
        id: "days",
        heading: "Days",
        blocks: [
          {
            t: "table",
            head: ["Word", "Means"],
            rows: [
              ["`today`, `tod`", "Today"],
              ["`tomorrow`, `tmr`, `tmrw`, `tom`", "Tomorrow"],
              ["`mon` … `sunday`", "The **next** one of that weekday"],
              ["`next week`", "Next Monday"],
            ],
          },
          {
            t: "warn",
            text: "Weekday words always mean the *next* one. Typing `mon` on a Monday plans it for **next** Monday, not today.",
          },
          {
            t: "note",
            text: "Only the first day word counts. Kairo ignores a second one rather than guessing.",
          },
        ],
      },
      {
        id: "times",
        heading: "Times",
        blocks: [
          {
            t: "table",
            head: ["You type", "Result"],
            rows: [
              ["`6pm`, `6 pm`, `at 6pm`", "18:00"],
              ["`6:30pm`", "18:30"],
              ["`18:00`, `at 9:30`", "That exact time"],
            ],
          },
          {
            t: "p",
            text: "A 24-hour time needs the colon (`18:00`) so it isn't confused with an estimate. If you give a time without a day, Kairo plans it for today.",
          },
        ],
      },
      {
        id: "deadline",
        heading: "Deadlines",
        blocks: [
          {
            t: "p",
            text: "Write `due` followed by a day word, `due fri`, `due tomorrow`, to set a real deadline instead of a planned day. The two are deliberately different things; see [deadlines vs planned days](/support/deadlines).",
          },
        ],
      },
      {
        id: "estimates",
        heading: "Estimates",
        blocks: [
          {
            t: "ul",
            items: [
              "`~30m`, `45m`, `2h`, `1h30m` and `1h15` all work.",
              "A bare number is **not** an estimate, `30` stays in the title. Write `~30` or `30m`.",
              "Estimates power the day's capacity line and unlock the [focus timer](/support/focus-timer).",
            ],
          },
        ],
      },
      {
        id: "lists-spotlight",
        heading: "Lists and Spotlight",
        blocks: [
          {
            t: "ul",
            items: [
              "`#work` files the task into the first list whose name starts with “work”. If nothing matches, the `#word` simply stays in the title.",
              "A standalone `!` marks the task as a Spotlight must-win. It has to be its own word, `Call mom!` won't do it.",
            ],
          },
          {
            t: "note",
            text: "Locked lists are never matched by `#`, and their names are never sent to the AI.",
          },
        ],
      },
      {
        id: "repeats",
        heading: "Repeats",
        blocks: [
          {
            t: "table",
            head: ["You type", "Rule created"],
            rows: [
              ["`daily`, `every day`", "Every day"],
              ["`every 3 days`", "Every 3 days (1–365)"],
              ["`every mon and wed`", "Weekly on those days"],
              ["`weekly`", "Weekly on today's weekday"],
              ["`monthly`", "Monthly on today's date"],
            ],
          },
          {
            t: "warn",
            text: "`every 2 days` on its own starts **tomorrow**, not today, the first occurrence is one interval from now. Add `today` if you want it to start immediately.",
          },
        ],
      },
      {
        id: "leftovers",
        heading: "Everything else stays in the title",
        blocks: [
          {
            t: "p",
            text: "Anything Kairo doesn't recognise is left alone, in the order you typed it. You never have to escape or quote normal words.",
          },
        ],
      },
    ],
  },
  {
    slug: "voice",
    title: "Capture with your voice",
    summary: "Speak a task instead of typing it, useful when your hands are busy.",
    categoryId: "capture",
    keywords: ["voice", "speech", "dictation", "microphone", "speak", "talk"],
    sections: [
      {
        id: "how",
        heading: "Dictate a task",
        blocks: [
          {
            t: "ol",
            items: [
              "Press `N` to open capture.",
              "Tap the microphone button and allow microphone access if asked.",
              "Say the task naturally, “water the plants tomorrow evening, about fifteen minutes”.",
              "The words appear in the box as you speak. Review them, then press `Enter`.",
            ],
          },
          {
            t: "note",
            text: "Kairo never submits a dictated task by itself. You always get to read it first.",
          },
        ],
      },
      {
        id: "support",
        heading: "Where it works",
        blocks: [
          {
            t: "p",
            text: "Voice capture uses your browser's built-in speech recognition. The microphone button only appears when your browser supports it, Chrome and Edge do, on desktop and Android. Firefox and some privacy browsers don't, so the button is simply hidden there.",
          },
          {
            t: "tip",
            text: "Messy speech is exactly what the [AI pass](/support/ai) is best at. Ramble freely, it strips the filler and pulls out the date, duration and list.",
          },
        ],
      },
      {
        id: "trouble",
        heading: "If it doesn't hear you",
        blocks: [
          {
            t: "ul",
            items: [
              "You'll see “Couldn't hear that, try again, or just type” if recognition fails. Retrying usually fixes it.",
              "Check that the site has microphone permission in your browser's address-bar settings.",
              "Speech recognition needs a network connection in most browsers.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "ai",
    title: "How AI tidies your captures",
    summary:
      "After you capture, AI reads the raw sentence, splits it into as many tasks as it holds, and fills in details you didn't type.",
    categoryId: "capture",
    keywords: ["ai", "gemma", "smart", "parsing", "automatic", "magic", "split", "multiple tasks"],
    sections: [
      {
        id: "what-happens",
        heading: "What happens after you press Enter",
        blocks: [
          {
            t: "p",
            text: "Your task is saved **instantly** by Kairo's own parser, the AI never makes you wait. A moment later, the original sentence is sent for a second read, and anything useful it finds is added quietly. You'll see a small toast like `✨ Tomorrow · ~45m · #Work` when it adjusts something.",
          },
          {
            t: "p",
            text: "It can set: a cleaner title, a planned day, a real deadline, a time estimate, a list, Spotlight, and a list of steps.",
          },
          {
            t: "p",
            text: "One breath can hold several tasks. Say \"call the bank tomorrow at 11 and gym today at 7\" and AI files **two** tasks, each with its own day and time, and shows you every one it created. Things that belong to the same errand stay together: \"go shopping and buy fruits\" stays one task.",
          },
        ],
      },
      {
        id: "rules",
        heading: "The rules it plays by",
        blocks: [
          {
            t: "ul",
            items: [
              "**It never overrules you.** If you typed a date or edited a field after capturing, AI leaves that field alone.",
              "**It never clears anything.** AI can only add detail, never remove it.",
              "**It respects Spotlight's limit.** If three tasks are already starred, it won't add a fourth.",
              "**It only adds steps to an empty checklist**, and at most 20.",
              "**Locked list names are never sent.** A locked list can't be chosen by AI.",
            ],
          },
        ],
      },
      {
        id: "failure",
        heading: "When AI is unavailable",
        blocks: [
          {
            t: "p",
            text: "If the service is slow or offline, Kairo gives up after about twelve seconds and simply keeps what its own parser understood. Nothing breaks, nothing is lost, and no error interrupts you, you just don't get the extra polish on that one capture.",
          },
          {
            t: "note",
            text: "AI never sets a repeat rule. Repeats come only from what you type or pick yourself.",
          },
        ],
      },
      {
        id: "examples",
        heading: "Examples worth trying",
        blocks: [
          {
            t: "table",
            head: ["Say or type", "What you get"],
            rows: [
              [
                "“umm I need to call the dentist tomorrow to reschedule, maybe fifteen minutes”",
                "**Call dentist to reschedule** · tomorrow · ~15m",
              ],
              [
                "“before friday I must finish the tax filing, first gather receipts then fill the form, two hours”",
                "**Finish tax filing** · due Friday · ~2h · ✦ · 2 steps",
              ],
            ],
          },
        ],
      },
    ],
  },

  /* -------------------------------------------------------------- planning */
  {
    slug: "today",
    title: "Plan today",
    summary:
      "Today shows only what you chose for today, with up to three Spotlight must-wins and an honest capacity line.",
    categoryId: "planning",
    keywords: ["today", "spotlight", "capacity", "plan", "day won", "must win", "star"],
    sections: [
      {
        id: "what-shows",
        heading: "What appears on Today",
        blocks: [
          {
            t: "ul",
            items: [
              "Tasks you planned for today, nothing else.",
              "**Spotlight** at the top: up to three must-wins.",
              "**Steps today**, if you scheduled individual [steps](/support/steps) of bigger tasks.",
              "**Done today**, so the day's wins stay visible.",
            ],
          },
          {
            t: "p",
            text: "Your backlog isn't here on purpose. It lives in [Lists](/support/lists) until you deliberately pull something in.",
          },
        ],
      },
      {
        id: "filling",
        heading: "Fill the day",
        blocks: [
          {
            t: "ol",
            items: [
              "Type into the add row at the bottom of the list, it plans straight to today.",
              "Or use the **Plan today from your inbox** panel that appears when today is empty, and tap **+ Today** on anything you want.",
              "Or drag tasks onto today in the [Calendar](/support/calendar).",
            ],
          },
        ],
      },
      {
        id: "spotlight",
        heading: "Spotlight: three, no more",
        blocks: [
          {
            t: "p",
            text: "Tap the star on a task to make it a Spotlight must-win. Kairo holds a maximum of three at a time and will refuse a fourth with the message “Spotlight holds 3, that's the point ✦”.",
          },
          {
            t: "warn",
            text: "The limit of three counts **every** unfinished starred task, not just today's. If a task starred for next week is using a slot, unstar it to free one up.",
          },
          {
            t: "p",
            text: "Completing a task clears its star automatically, as does sending it back to the inbox or to Someday.",
          },
        ],
      },
      {
        id: "capacity",
        heading: "The capacity line",
        blocks: [
          {
            t: "p",
            text: "If your today tasks have [estimates](/support/focus-timer), the header adds them up: `holds ~2h 45m · fits ✓`. Once the total passes six hours it changes tone, `holds ~7h, that's a lot. Trim one?`",
          },
          {
            t: "note",
            text: "It's a nudge, never a block. Kairo will happily let you overload a day; it just won't pretend that's realistic.",
          },
        ],
      },
      {
        id: "day-won",
        heading: "“Day won”",
        blocks: [
          {
            t: "p",
            text: "When nothing is left on today, no steps are due, and you finished at least one thing, Today turns into a small celebration panel: **Day won.** It's the only scoreboard Kairo keeps.",
          },
        ],
      },
    ],
  },
  {
    slug: "fresh-start",
    title: "Start fresh when you fall behind",
    summary:
      "Unfinished tasks never pile up in red. Each morning, one decision each, then a clean day.",
    categoryId: "planning",
    keywords: [
      "overdue",
      "fresh start",
      "sweep",
      "carry over",
      "yesterday",
      "behind",
      "missed",
      "leftovers",
    ],
    sections: [
      {
        id: "what-it-is",
        heading: "What the sweep does",
        blocks: [
          {
            t: "p",
            text: "If tasks were planned for a day that has passed and are still unfinished, a **Fresh start** card sits at the top of Today the next time you visit. It lists each leftover and asks for a single decision, while the rest of your day stays in view below it.",
          },
          {
            t: "p",
            text: "This replaces the overdue list you'd find in other apps. Nothing rots, nothing turns red, nothing accumulates silently.",
          },
        ],
      },
      {
        id: "choices",
        heading: "Your choices",
        blocks: [
          {
            t: "table",
            head: ["Choice", "What happens"],
            rows: [
              ["**Today**", "Moves to today. Its carry counter goes up by one."],
              ["**Later**", "Back to the Inbox with no date, decide another time."],
              ["**Someday**", "Parked in Someday, guilt-free."],
              ["**Did it**", "Marked done, and it shows up in your Log."],
              ["**Let go**", "Deleted. Sometimes that's the honest answer."],
            ],
          },
          {
            t: "p",
            text: "With more than one leftover there are also **All to today** and **All to later** buttons for when the answer is the same for everything. Anything you don't explicitly choose defaults to **Later**. **Start the day** applies your choices.",
          },
          {
            t: "warn",
            text: "**Let go** in the sweep deletes immediately, without an undo prompt. Use **Someday** if you're unsure.",
          },
        ],
      },
      {
        id: "recurring",
        heading: "Repeating tasks are different",
        blocks: [
          {
            t: "p",
            text: "A [repeating task](/support/recurring) offers three options instead: **Today**, **Did it**, and **Skip**. Skipping jumps to the next occurrence, so missing one gym day never deletes your gym habit. A repeating series can't be lost in the sweep.",
          },
        ],
      },
      {
        id: "carry-count",
        heading: "When something keeps coming back",
        blocks: [
          {
            t: "p",
            text: "Each time you move a task to today from the sweep, Kairo counts it. After a couple of rounds you'll see a `↻ ×3` badge, and a gentle line: *“Keeps carrying over, too big? Try breaking it into steps, or let it go. Both are wins.”*",
          },
          {
            t: "tip",
            text: "A high carry count almost always means the task is too big or too vague. [Breaking it into steps](/support/steps) is usually the fix.",
          },
        ],
      },
      {
        id: "later",
        heading: "Dismissing and reopening",
        blocks: [
          {
            t: "p",
            text: "The **×** in its corner (Not now) folds the card away without changing anything. A small button then appears in the Today header, **3 from before**, to bring it back whenever you're ready. It returns on its own the next morning.",
          },
        ],
      },
    ],
  },
  {
    slug: "times",
    title: "Set a time of day",
    summary:
      "Give a planned task a clock time, “31 July at 6 PM”, and optionally get a reminder then.",
    categoryId: "planning",
    keywords: ["time", "clock", "hour", "6pm", "schedule", "time of day", "appointment"],
    sections: [
      {
        id: "adding",
        heading: "Add a time",
        blocks: [
          {
            t: "ol",
            items: [
              "Open the task and expand **Planned day**.",
              "Pick a date on the calendar. A **Time** row appears underneath.",
              "Tap a quick pick, 9 AM, Noon, 3 PM, 6 PM, 9 PM, or use the time field for anything else.",
            ],
          },
          {
            t: "p",
            text: "You can also type it while capturing: `dentist 31 jul 6pm`, `standup at 9:30`. See the [syntax reference](/support/quick-add-syntax).",
          },
        ],
      },
      {
        id: "reminder",
        heading: "Get reminded at that time",
        blocks: [
          {
            t: "p",
            text: "Once a time is set, a **🔔 Remind me at this time** button appears right below it. One tap schedules a push notification for that exact moment. It then reads *Reminder set for 6 PM*.",
          },
          {
            t: "note",
            text: "Reminders need [notifications turned on](/support/notifications). If they aren't, Kairo asks as part of the same tap.",
          },
        ],
      },
      {
        id: "behaviour",
        heading: "Good to know",
        blocks: [
          {
            t: "ul",
            items: [
              "A time always belongs to a day. Clear the day and the time clears with it.",
              "The time shows as a `🕐 6 PM` chip on the task card.",
              "A time doesn't move the task or block anything, Kairo plans days, not hour-by-hour calendars.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "deadlines",
    title: "Deadlines vs planned days",
    summary:
      "The day you'll work on something and the day it's actually due are two different fields, on purpose.",
    categoryId: "planning",
    keywords: ["deadline", "due date", "due", "planned", "difference"],
    sections: [
      {
        id: "difference",
        heading: "Two different questions",
        blocks: [
          {
            t: "table",
            head: ["Field", "Answers"],
            rows: [
              ["**Planned day**", "When do I intend to *work* on this?"],
              ["**Deadline**", "When does the outside world need it?"],
            ],
          },
          {
            t: "p",
            text: "Most task apps collapse these into one “due date”, which is why everything ends up dated and everything ends up overdue. Kairo keeps them apart so your plan can move freely while a real commitment stays fixed.",
          },
        ],
      },
      {
        id: "setting",
        heading: "Set a deadline",
        blocks: [
          {
            t: "ul",
            items: [
              "While capturing: `file taxes due fri`.",
              "In the task editor: expand **Deadline** and pick a date.",
            ],
          },
          {
            t: "p",
            text: "Deadlines appear as a `due Fri 31 Jul` chip, which warms to a stronger colour within two days of the date.",
          },
        ],
      },
      {
        id: "advice",
        heading: "Use them rarely",
        blocks: [
          {
            t: "tip",
            text: "If you set a deadline on everything, the chip stops meaning anything. Reserve it for dates someone else actually cares about, a bill, a flight, a filing.",
          },
          {
            t: "p",
            text: "Kairo never turns a passed deadline red or blocks anything because of it. It reports the fact and leaves the judgement to you.",
          },
        ],
      },
    ],
  },
  {
    slug: "calendar",
    title: "Plan the week and month",
    summary:
      "The Calendar has two views: a month grid for the bigger picture, and a seven-day spread for sketching the week.",
    categoryId: "planning",
    keywords: ["calendar", "upcoming", "week", "month", "drag", "schedule", "legend", "colors"],
    sections: [
      {
        id: "month",
        heading: "Month view",
        blocks: [
          {
            t: "p",
            text: "The Calendar opens on a full month grid, Monday-first, with today circled.",
          },
          {
            t: "ul",
            items: [
              "**Desktop:** each day shows up to three task chips, plus `+2 more` when there are extras.",
              "**Mobile:** each day shows coloured dots instead, so the grid stays readable.",
              "**Click any day** to open its detail panel, the full task list, planned steps, what's done, and an add row for that date. It also shows the day's habits: the ones done, or due on days to come.",
              "**Drag chips** between days to reschedule.",
            ],
          },
        ],
      },
      {
        id: "week",
        heading: "Week view",
        blocks: [
          {
            t: "p",
            text: "Switch to **Week** with the toggle in the header, Kairo remembers your choice. It lists the next seven days, each with its own tasks, load estimate and add row. Your Inbox sits alongside so you can pull work into days.",
          },
          {
            t: "ul",
            items: [
              "**Drag** a task from the Inbox onto a day to plan it (desktop).",
              "**Type** into any day's add row to create something there directly.",
              "Days further out than a week collect under **Further out**.",
            ],
          },
          {
            t: "note",
            text: "Drag-and-drop is a mouse feature. On a phone, use a task's ⋯ menu, **Do today**, **Tomorrow**, or open it and pick a date.",
          },
        ],
      },
      {
        id: "colors",
        heading: "Colours and the legend",
        blocks: [
          {
            t: "p",
            text: "Each list gets its own colour, and the dots and chips wear it. Below the grid, a legend spells out which colour is which list, plus two fixed meanings: **green is done**, and a **grey dot means no list**. A gold ✦ marks Spotlight tasks.",
          },
          {
            t: "note",
            text: "Locked lists don't appear in the legend, and their tasks don't appear in the grid. Colours follow each list's position, so [reordering](/support/lists) or deleting a list can shift the colours of the ones after it.",
          },
        ],
      },
      {
        id: "capacity",
        heading: "Load per day",
        blocks: [
          {
            t: "p",
            text: "Each day shows the total of its estimates, so an overloaded Thursday is visible days before it hurts. In the month grid, days over six hours are highlighted.",
          },
        ],
      },
    ],
  },

  /* ----------------------------------------------------------------- tasks */
  {
    slug: "steps",
    title: "Break a task into steps",
    summary:
      "Split a big task into a checklist, and schedule individual steps onto their own days.",
    categoryId: "tasks",
    keywords: ["steps", "subtasks", "checklist", "break down", "split", "sub-tasks"],
    sections: [
      {
        id: "adding",
        heading: "Add steps",
        blocks: [
          {
            t: "ol",
            items: [
              "Open a task.",
              "Type into **Add a step…** under **Steps** and press `Enter`.",
              "Repeat for each step. Up to 100 per task.",
            ],
          },
          {
            t: "warn",
            text: "Changes you make inside the editor, the title, notes, and the steps list, save when you **close** the editor. Ticking a step from a task card saves immediately.",
          },
        ],
      },
      {
        id: "checking",
        heading: "Tick steps off without opening the task",
        blocks: [
          {
            t: "p",
            text: "Task cards show a `2/5 ▸` chip when they have steps. Tap it to expand the checklist right there and tick items off.",
          },
          {
            t: "p",
            text: "When the last step is done, Kairo offers a shortcut: a toast reading **All steps done 🎉** with a **Finish the task** button. It never completes the task behind your back.",
          },
        ],
      },
      {
        id: "planning-steps",
        heading: "Give a step its own day",
        blocks: [
          {
            t: "p",
            text: "This is what makes steps more than a checklist. Each step row has a **+ day** button, pick a day and that single step appears on [Today](/support/today) under **Steps today**, and inside that day in the Calendar.",
          },
          {
            t: "p",
            text: "So “File taxes” can stay one task while *Gather receipts* lands on Wednesday and *Fill the form* on Thursday.",
          },
          {
            t: "note",
            text: "Steps can be planned within the next seven days only (today through today + 6). For anything further out, make it a real task.",
          },
        ],
      },
      {
        id: "step-rows",
        heading: "Reading a step row",
        blocks: [
          {
            t: "ul",
            items: [
              "A scheduled step shows its own row with the parent task's name after it (`↳ File taxes`). Tapping the text opens the parent.",
              "A step you didn't get to shows `from yesterday`.",
              "Steps don't count toward the day's capacity estimate, only whole tasks do.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "recurring",
    title: "Repeat a task",
    summary:
      "Daily, weekly on chosen days, or monthly, a repeating task is one card that rolls forward as you complete it.",
    categoryId: "tasks",
    keywords: ["repeat", "recurring", "every day", "weekly", "monthly", "habit", "routine"],
    sections: [
      {
        id: "setting",
        heading: "Make a task repeat",
        blocks: [
          {
            t: "ol",
            items: [
              "Open the task and expand **Repeat**.",
              "Choose **Daily**, **Weekly** or **Monthly**.",
              "Adjust the detail: every N days, which weekdays, or which day of the month.",
            ],
          },
          {
            t: "p",
            text: "Or type it while capturing: `water plants every mon and thu`, `stretch daily`, `pay rent monthly`, `review notes every 3 days`.",
          },
        ],
      },
      {
        id: "rules",
        heading: "The three rule types",
        blocks: [
          {
            t: "table",
            head: ["Type", "Options"],
            rows: [
              ["**Daily**", "Every 1–365 days"],
              ["**Weekly**", "Any combination of weekdays (at least one)"],
              ["**Monthly**", "A day of the month, 1–31"],
            ],
          },
          {
            t: "note",
            text: "Monthly rules handle short months gracefully, the 31st becomes the 30th in April and the 28th or 29th in February.",
          },
        ],
      },
      {
        id: "completing",
        heading: "What completing one does",
        blocks: [
          {
            t: "p",
            text: "A repeating task is a single card, not a pre-generated pile. When you complete it, two things happen:",
          },
          {
            t: "ol",
            items: [
              "A finished copy is written to **Done today** and your [Log](/support/log), so your history stays honest.",
              "The card itself rolls forward to the next occurrence, with the star cleared, the carry count reset, and every step unticked for a fresh round.",
            ],
          },
          {
            t: "p",
            text: "You'll see a small confirmation: `↻ Next: Thursday`.",
          },
        ],
      },
      {
        id: "missing",
        heading: "Missing one",
        blocks: [
          {
            t: "p",
            text: "In the [morning sweep](/support/fresh-start), repeating tasks get their own options: **Today**, **Did it**, and **Skip**. Skip jumps to the next occurrence with no penalty, and crucially, *Let go* and *Someday* aren't offered, so a bad week can't silently delete a habit.",
          },
          {
            t: "p",
            text: "To end a series for good, delete the task from its ⋯ menu or the editor, or set Repeat back to **Never**.",
          },
        ],
      },
    ],
  },
  {
    slug: "focus-timer",
    title: "Estimate a task and focus on it",
    summary:
      "Give a task a duration, then run a full-screen countdown with pause, reset, extra time, and overtime.",
    categoryId: "tasks",
    keywords: [
      "focus",
      "timer",
      "pomodoro",
      "estimate",
      "duration",
      "countdown",
      "overtime",
      "concentrate",
    ],
    sections: [
      {
        id: "estimate",
        heading: "Set an estimate",
        blocks: [
          {
            t: "p",
            text: "Open a task, expand **Estimate**, and scroll the hour and minute wheels. Estimates feed the day's capacity line and unlock the timer.",
          },
          {
            t: "p",
            text: "You can also type one while capturing: `review deck ~45m`.",
          },
        ],
      },
      {
        id: "starting",
        heading: "Start a focus session",
        blocks: [
          {
            t: "p",
            text: "Any task with an estimate shows a **▶** button on its card, and a **Start** button in the editor. Either opens a full-screen countdown with a progress ring, already running.",
          },
          {
            t: "note",
            text: "The timer needs an estimate, that's the only requirement. No estimate, no play button.",
          },
        ],
      },
      {
        id: "controls",
        heading: "The controls",
        blocks: [
          {
            t: "table",
            head: ["Control", "What it does"],
            rows: [
              ["**Pause / Start**", "Freezes the countdown, or picks it back up"],
              ["**Reset**", "Returns to the full duration, and leaves the timer **paused**"],
              ["**+5 min**", "Adds five minutes, whether running or paused"],
              ["**Done**", "Completes the task and closes focus"],
              ["**Minimize** (⌄)", "Shrinks to a floating pill that keeps ticking"],
              ["**Exit** (✕)", "Ends the session, the task is *not* completed"],
            ],
          },
        ],
      },
      {
        id: "overtime",
        heading: "Reaching zero",
        blocks: [
          {
            t: "p",
            text: "At zero you get a chime and a vibration, and, if Kairo isn't open in front of you, a notification saying **⏱ Time's up**. The timer then keeps counting *upward* in overtime, showing `+4:20` and turning terracotta.",
          },
          {
            t: "p",
            text: "Overtime is not a failure state. The message reads *“Overtime, still going. Respect.”*",
          },
        ],
      },
      {
        id: "persistence",
        heading: "It survives reloads",
        blocks: [
          {
            t: "ul",
            items: [
              "Refresh the page and a running session comes back as the floating pill.",
              "Because the end time is absolute, the countdown keeps burning while the tab is closed.",
              "Each account keeps its own timer, so [switching accounts](/support/accounts) doesn't disturb one.",
              "Completing or deleting the task elsewhere ends the session automatically.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "lists",
    title: "Organize with lists",
    summary:
      "Lists hold your backlog: the Inbox for undecided things, Someday for parked ideas, and your own lists for everything else.",
    categoryId: "tasks",
    keywords: [
      "lists",
      "inbox",
      "someday",
      "projects",
      "folders",
      "organize",
      "icons",
      "reorder",
      "collapse",
      "hide",
      "expand",
      "order",
      "sort",
    ],
    sections: [
      {
        id: "three-kinds",
        heading: "The three kinds of list",
        blocks: [
          {
            t: "ul",
            items: [
              "**Inbox**, everything captured without a decision. It's meant to be temporary.",
              "**Your lists**, Work, Home, Errands, whatever fits. Give each an icon.",
              "**Someday**, ideas you're not ready for. Parking something here is a legitimate outcome, not a failure.",
            ],
          },
        ],
      },
      {
        id: "creating",
        heading: "Create a list",
        blocks: [
          {
            t: "ol",
            items: [
              "Go to **Lists** and click **New list**.",
              "Pick an icon and type a name.",
              "Click **Create**.",
            ],
          },
          {
            t: "p",
            text: "Click a list's name to rename it. Its colour in the [calendar](/support/calendar) is assigned automatically.",
          },
        ],
      },
      {
        id: "filing",
        heading: "File tasks into lists",
        blocks: [
          {
            t: "ul",
            items: [
              "While capturing, type `#work`, it matches on the first few letters.",
              "In a task, expand **List** and pick one.",
              "Use a list's own add row to create tasks directly there.",
            ],
          },
        ],
      },
      {
        id: "reorder",
        heading: "Put your lists in order",
        blocks: [
          {
            t: "ol",
            items: [
              "On the Lists page, click **Reorder** in the header.",
              "**Drag a list by its grip handle** (the dotted square on the left) to slide it into place, or use the ↑ and ↓ buttons.",
              "Click **Done** when the order looks right.",
            ],
          },
          {
            t: "p",
            text: "Dragging works with a finger as well as a mouse, and the other lists shuffle aside as you move. Every change saves immediately, and the order follows you to your other devices. Inbox always sits at the top and Someday at the bottom, they're fixed on purpose, so your captured and parked items always live in the same place.",
          },
          {
            t: "tip",
            text: "The arrows are there for precision and for keyboard use, you never have to drag if you'd rather not.",
          },
          {
            t: "tip",
            text: "The order is **yours alone**. Rearranging a [shared list](/support/sharing-lists) changes nothing for the people you share it with, everyone keeps their own arrangement.",
          },
        ],
      },
      {
        id: "collapse",
        heading: "Collapse lists you're not using",
        blocks: [
          {
            t: "p",
            text: "Once you have a lot of lists, the page gets long. Click the small chevron beside any list's name to fold it away, the header stays visible with its count, and the tasks tuck out of sight.",
          },
          {
            t: "ul",
            items: [
              "**Collapse all** / **Expand all** in the header folds or unfolds everything at once.",
              "Inbox and Someday collapse too.",
              "Kairo remembers which sections you folded, per account, on that device.",
            ],
          },
          {
            t: "note",
            text: "Collapsing is only about the view, it doesn't hide anything from Today, search or the calendar. To genuinely hide a list's contents, [lock it with a PIN](/support/locks).",
          },
        ],
      },
      {
        id: "deleting",
        heading: "Delete a list",
        blocks: [
          {
            t: "p",
            text: "Hover a list and click the bin icon, then confirm. **Its tasks are not deleted**, they simply lose their list label. A task planned for Friday stays planned for Friday; an undated one shows up in your Inbox.",
          },
          {
            t: "note",
            text: "Lists can also be [locked with a PIN](/support/locks) or [shared with other people](/support/sharing-lists).",
          },
          {
            t: "tip",
            text: "A task can legitimately appear twice on this page, once under its list and once under **Inbox**, because “in a list” and “not yet planned” are different things.",
          },
        ],
      },
    ],
  },
  {
    slug: "log",
    title: "See what you finished",
    summary: "The Log is the opposite of an overdue list: a running record of what you actually did.",
    categoryId: "tasks",
    keywords: ["log", "history", "done", "completed", "archive", "record"],
    sections: [
      {
        id: "what",
        heading: "What the Log shows",
        blocks: [
          {
            t: "p",
            text: "Every completed task, newest first, grouped by day, with a count of what you finished in the last seven days.",
          },
          {
            t: "p",
            text: "Each day also shows the habits you marked done, and a day where you only did a habit still counts. Habits you didn't do never show here.",
          },
          {
            t: "p",
            text: "It sits under **Plan**, beside Calendar and Lists: in the sidebar on a computer, or press `4`; on a phone, tap **Plan**, then **Log** at the top.",
          },
          {
            t: "p",
            text: "There are no streaks and no gaps highlighted. A quiet week isn't a broken chain, it's just a quiet week.",
          },
        ],
      },
      {
        id: "recurring",
        heading: "Repeating tasks in the Log",
        blocks: [
          {
            t: "p",
            text: "Each completion of a [repeating task](/support/recurring) is written as its own entry, so ten weeks of Monday gym sessions read as ten wins, not one task that keeps moving.",
          },
        ],
      },
      {
        id: "undo",
        heading: "Un-completing something",
        blocks: [
          {
            t: "p",
            text: "Tick the circle again on a done task to bring it back. It returns to its planned day, or to the Inbox if it had none.",
          },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------- reminders */
  {
    slug: "notifications",
    title: "Turn on notifications",
    summary:
      "Get a ping when a focus timer ends, when a reminder fires, or when someone assigns you a task, even with Kairo closed.",
    categoryId: "reminders",
    keywords: [
      "notifications",
      "push",
      "alerts",
      "enable",
      "permission",
      "not working",
      "blocked",
      "iphone",
      "sound",
    ],
    sections: [
      {
        id: "enable",
        heading: "Turn them on",
        blocks: [
          {
            t: "ol",
            items: [
              "Open your profile (your avatar, top right on mobile, bottom of the sidebar on desktop).",
              "Under **Notifications**, click **Enable**.",
              "Allow notifications when your browser asks.",
            ],
          },
          {
            t: "p",
            text: "The button then reads **On ✓**, and a **Send a test notification** link appears, use it to confirm the whole chain works.",
          },
        ],
      },
      {
        id: "types",
        heading: "What Kairo will send",
        blocks: [
          {
            t: "table",
            head: ["Notification", "When"],
            rows: [
              ["**⏱ Time's up**", "A [focus timer](/support/focus-timer) reaches zero"],
              ["**🔔 Task name**", "A [reminder](/support/reminders) you set arrives"],
              ["**📋 Someone assigned you a task**", "A person [assigns you](/support/assigning) work in a shared list"],
            ],
          },
          {
            t: "p",
            text: "That's the complete list. Kairo will never send you a nag about being behind, a broken streak, or an unopened app.",
          },
        ],
      },
      {
        id: "iphone",
        heading: "On iPhone and iPad",
        blocks: [
          {
            t: "warn",
            text: "Safari only delivers push to **installed** web apps. Add Kairo to your home screen first (Share → **Add to Home Screen**), open it from there, and then enable notifications from inside that app. iOS 16.4 or later is required.",
          },
        ],
      },
      {
        id: "sound",
        heading: "Sound and vibration",
        blocks: [
          {
            t: "ul",
            items: [
              "Notifications use your device's normal notification sound and a short vibration, and stay on screen until you dismiss them.",
              "If a Kairo tab is open when one arrives, it also plays a soft two-note chime.",
              "Custom notification sounds aren't possible on the web, browsers don't support them.",
            ],
          },
        ],
      },
      {
        id: "not-working",
        heading: "If enabling fails",
        blocks: [
          {
            t: "p",
            text: "Kairo tells you exactly what went wrong rather than failing silently:",
          },
          {
            t: "table",
            head: ["Message", "Fix"],
            rows: [
              [
                "Push needs a secure connection",
                "You're on an address like `192.168.x.x`. Push only works over HTTPS or on `localhost`.",
              ],
              [
                "Blocked, allow notifications for this site",
                "You (or the browser) denied permission before. Tap the lock icon in the address bar, allow notifications, then try again.",
              ],
              [
                "This browser doesn't support push",
                "Use Chrome, Edge, or an installed app on iPhone.",
              ],
              ["Couldn't enable: …", "The detail is the real error, send it to us and we'll dig in."],
            ],
          },
          {
            t: "note",
            text: "Notifications are also silenced by your operating system's Do Not Disturb or Focus modes. If the test ping doesn't arrive, check there too.",
          },
        ],
      },
    ],
  },
  {
    slug: "reminders",
    title: "Remind me at a specific time",
    summary:
      "Set a one-off reminder on any task. It skips itself if the task is already done by then.",
    categoryId: "reminders",
    keywords: ["reminder", "remind me", "alarm", "notify", "later", "ping"],
    sections: [
      {
        id: "setting",
        heading: "Set a reminder",
        blocks: [
          {
            t: "ol",
            items: [
              "Open the task and expand **Reminder**.",
              "Pick a quick option, **In 1 hour**, **In 3 hours**, **Evening 18:00**, **Tomorrow 9:00**, or choose an exact date and time.",
            ],
          },
          {
            t: "p",
            text: "You'll see a confirmation like `🔔 Tomorrow 09:00`, and the task card carries a 🔔 chip so pending reminders are visible at a glance.",
          },
          {
            t: "tip",
            text: "If the task already has a [time of day](/support/times), there's a one-tap **Remind me at this time** button in the Planned day section.",
          },
        ],
      },
      {
        id: "behaviour",
        heading: "How reminders behave",
        blocks: [
          {
            t: "ul",
            items: [
              "They arrive even if Kairo is closed and your phone is locked.",
              "**A reminder for something you've already done never fires.** Completing or deleting the task cancels it, and Kairo double-checks at send time.",
              "Setting a new time replaces the old one, there's one reminder per task.",
              "Reminders can be set up to 30 days ahead, and must be at least a moment in the future.",
              "Completing a [repeating task](/support/recurring) clears its reminder, since it belonged to that occurrence.",
            ],
          },
        ],
      },
      {
        id: "requirements",
        heading: "Requirements",
        blocks: [
          {
            t: "p",
            text: "Reminders are push notifications, so they need [notifications turned on](/support/notifications). If they aren't yet, setting a reminder will ask.",
          },
        ],
      },
    ],
  },

  /* --------------------------------------------------------------- sharing */
  {
    slug: "sharing-lists",
    title: "Share a list with someone",
    summary:
      "Invite someone to a list and you both see and edit the same tasks, groceries, a project, a household.",
    categoryId: "sharing",
    keywords: ["share", "shared", "collaborate", "invite", "team", "family", "together", "members"],
    sections: [
      {
        id: "invite",
        heading: "Share a list",
        blocks: [
          {
            t: "ol",
            items: [
              "Go to **Lists** and find the list you own.",
              "Click **👥 Share**.",
              "Type their email address and click **Share**.",
            ],
          },
          {
            t: "p",
            text: "They don't need a Kairo account. If the address is new to Kairo, an invite email goes out with a sign-in link: one click and they're in, with your list already waiting. The link works for 14 days, and signing in with Google on the same address later opens the same account.",
          },
        ],
      },
      {
        id: "what-happens",
        heading: "What sharing does",
        blocks: [
          {
            t: "ul",
            items: [
              "Both of you see the same tasks in that list, and either can add, edit, or complete them.",
              "The list shows a **👥** badge with the number of people on it.",
              "Tasks in a shared list can be [assigned](/support/assigning) to a specific person.",
              "Everyone's own Today, Calendar and Log stay personal, only the list's contents are shared.",
            ],
          },
        ],
      },
      {
        id: "sync",
        heading: "Seeing each other's changes",
        blocks: [
          {
            t: "p",
            text: "Kairo re-checks for changes when you return to the tab, at most once every 20 seconds, so a partner's additions appear when you come back to the app. It isn't live, cursor-by-cursor collaboration; refresh the page if you're working side by side in real time.",
          },
        ],
      },
      {
        id: "roles",
        heading: "Who can do what",
        blocks: [
          {
            t: "table",
            head: ["Action", "Who"],
            rows: [
              ["Add, edit, complete tasks", "Owner and members"],
              ["Assign tasks to people", "Owner and members"],
              ["Invite or remove people", "Owner only"],
              ["Rename or delete the list", "Owner only"],
              ["Set, change, or remove the PIN", "Owner only"],
              ["Leave the list", "Members (via Share → Leave)"],
            ],
          },
        ],
      },
      {
        id: "locked",
        heading: "Sharing a locked list",
        blocks: [
          {
            t: "p",
            text: "A [locked list](/support/locks) stays locked for everyone, with the same PIN. Members unlock it with that PIN on their own device; only the owner can change or remove the lock. Kairo warns you when you're sharing a locked list so nobody is surprised.",
          },
          {
            t: "note",
            text: "Two practical notes: you'll need to **unlock a locked list before you can open its Share dialog**, and Kairo has no way to deliver the PIN, tell your people out of band.",
          },
        ],
      },
    ],
  },
  {
    slug: "assigning",
    title: "Assign a task to someone",
    summary: "In a shared list, put someone's name on a task, and let them know.",
    categoryId: "sharing",
    keywords: ["assign", "assignee", "delegate", "owner", "responsible", "who"],
    sections: [
      {
        id: "how",
        heading: "Assign a task",
        blocks: [
          {
            t: "ol",
            items: [
              "Open a task that lives in a [shared list](/support/sharing-lists).",
              "Expand **Assignee**.",
              "Pick a person, or **Anyone** to leave it unassigned.",
            ],
          },
          {
            t: "note",
            text: "The Assignee row only appears for tasks in a shared list. There's nobody to assign a private task to.",
          },
        ],
      },
      {
        id: "what-happens",
        heading: "What the other person gets",
        blocks: [
          {
            t: "p",
            text: "They get a push notification, **📋 Alex assigned you a task**, if they've [enabled notifications](/support/notifications). The task then carries their avatar as a chip.",
          },
          {
            t: "p",
            text: "When a task is assigned to **you**, the chip is highlighted, so scanning any view tells you what's yours.",
          },
        ],
      },
      {
        id: "philosophy",
        heading: "Assignment is a hint, not a lock",
        blocks: [
          {
            t: "p",
            text: "Anyone on the list can still see, edit and complete an assigned task. Kairo marks who's expected to do it; it doesn't fence anyone out.",
          },
          {
            t: "note",
            text: "You can only assign to people who are actually on that list, Kairo checks on the server, not just in the interface.",
          },
        ],
      },
    ],
  },
  {
    slug: "send-copy",
    title: "Share a task, or send a copy",
    summary:
      "Put people on one live task the way you'd invite guests to a calendar event, or hand someone their own independent copy.",
    categoryId: "sharing",
    keywords: ["send", "copy", "handoff", "forward", "give", "delegate", "share task", "people", "collaborate"],
    sections: [
      {
        id: "share-live",
        heading: "Put people on a task",
        blocks: [
          {
            t: "ol",
            items: [
              "Open a task's **⋯** menu and choose **Share**.",
              "Add people by email, anyone already on the task can add more, like guests on a calendar invite.",
              "Everyone now sees the same live task. Edits sync, and when anyone finishes it, it's done for everyone.",
            ],
          },
          {
            t: "p",
            text: "A shared task shows a small 👥 count on its row. The owner can remove anyone from the People sheet; everyone else can leave whenever they like, and leaving (or choosing Let it go) removes the task from your world without touching the owner's.",
          },
        ],
      },
      {
        id: "difference",
        heading: "Share vs send a copy",
        blocks: [
          {
            t: "table",
            head: ["Share a task", "Send a copy"],
            rows: [
              ["One live task for everyone", "Two independent tasks"],
              ["Edits and completion sync", "Changes don't sync"],
              ["Do something together", "Hand something off"],
              ["Plan and time are shared", "They plan it their way"],
            ],
          },
          {
            t: "p",
            text: "**Send a copy** lives inside the same Share sheet. The copy lands in their Inbox marked `↪ from your name`, carrying the title, notes, deadline, estimate, and step titles (unticked). Your Spotlight star, list, repeat rule, and reminders stay yours. For sharing a whole project rather than one task, see [shared lists](/support/sharing-lists).",
          },
        ],
      },
      {
        id: "no-account",
        heading: "They don't need an account",
        blocks: [
          {
            t: "note",
            text: "Either way, the recipient doesn't need Kairo yet: a new address gets an invite email with a one-click sign-in link, and the task is already waiting inside. Existing accounts get an email, and a notification if they've turned those on.",
          },
        ],
      },
    ],
  },

  /* --------------------------------------------------------------- account */
  {
    slug: "locks",
    title: "Lock a list or the whole app",
    summary:
      "Put a numeric PIN on a single list, or on Kairo itself, so a passing glance doesn't reveal everything.",
    categoryId: "account",
    keywords: ["lock", "pin", "password", "private", "hide", "secure", "passcode", "privacy"],
    sections: [
      {
        id: "list-lock",
        heading: "Lock a list",
        blocks: [
          {
            t: "ol",
            items: [
              "Go to **Lists** and find the list.",
              "Click **Lock**.",
              "Enter a PIN of 4–8 digits, then confirm it.",
            ],
          },
          {
            t: "p",
            text: "Its tasks now disappear from **everywhere**, Today, the Calendar, the Log, search, the inbox count, even the AI's context. The list itself shows only its name and a *Locked, tap to unlock* panel.",
          },
          {
            t: "note",
            text: "If a locked list has tasks planned for today, Today shows a discreet `🔒 2 hidden` note without revealing any titles.",
          },
        ],
      },
      {
        id: "app-lock",
        heading: "Lock all of Kairo",
        blocks: [
          {
            t: "ol",
            items: [
              "Open your profile and find **App lock**.",
              "Click **Set up**, then choose and confirm a PIN.",
            ],
          },
          {
            t: "p",
            text: "A full-screen PIN pad now guards the app. Use **🔒 Lock now** whenever you step away, and note that keyboard shortcuts are disabled while the lock screen is up.",
          },
          {
            t: "tip",
            text: "On a computer, just type: digits enter the PIN, `Backspace` deletes, `Enter` confirms. No clicking required.",
          },
        ],
      },
      {
        id: "unlocking",
        heading: "How unlocking lasts",
        blocks: [
          {
            t: "ul",
            items: [
              "An unlock applies to **this browser** until you close it, for at most 12 hours. Refreshing, navigating and new tabs keep it open.",
              "Another browser, another device, or reopening the browser asks for the PIN again.",
              "**Hide it again now** (for a list) and **Lock now** (for the app) close it immediately, useful before handing someone your laptop.",
              "Changing a PIN closes it everywhere except the browser you changed it in.",
              "Unlocks are per account: unlocking as one [account](/support/accounts) never reveals anything in another, and switching away or signing out locks everything that account had opened.",
            ],
          },
        ],
      },
      {
        id: "managing",
        heading: "Change or remove a PIN",
        blocks: [
          {
            t: "p",
            text: "Both locks offer **Change PIN** and **Remove** while unlocked. Each requires the current PIN, knowing the old one is always the price of changing it.",
          },
          {
            t: "warn",
            text: "There is no PIN recovery. If you forget a list's PIN, its contents stay hidden; if you forget the app PIN, you can still sign out from the lock screen and sign in again, but the list PIN can't be reset for you.",
          },
        ],
      },
      {
        id: "security",
        heading: "What a lock actually protects",
        blocks: [
          {
            t: "p",
            text: "PINs are never stored as text: only a salted hash lives on the server, and every check happens there. Locks are enforced by the server, not drawn over the screen — while the app is locked, Kairo sends that browser nothing, and a locked list's tasks are never sent at all until its PIN is entered. Someone with your unlocked laptop and the developer tools open still gets nothing.",
          },
          {
            t: "p",
            text: "Guessing is limited: after five wrong PINs, each further try waits longer, up to fifteen minutes, no matter how many tries are sent at once. Connection keys can only be given locked lists from a browser that has already opened them.",
          },
          {
            t: "warn",
            text: "A lock is not encryption: someone with access to the database itself could read what's stored. And there's no PIN recovery, so pick one you'll remember.",
          },
          {
            t: "note",
            text: "The app lock guards **one account**. If you have other [accounts](/support/accounts) signed in, the lock screen lets you switch to them without unlocking this one, by design, so you're never trapped.",
          },
        ],
      },
    ],
  },
  {
    slug: "accounts",
    title: "Use more than one account",
    summary: "Keep work and personal separate, and switch between them in a tap.",
    categoryId: "account",
    keywords: ["accounts", "switch", "multiple", "work", "personal", "sign out", "add account", "avatar", "profile picture"],
    sections: [
      {
        id: "avatar",
        heading: "Pick your avatar",
        blocks: [
          {
            t: "p",
            text: "Open your profile and tap the little pencil on your picture. Seven choices appear: your Google photo, and six hand-drawn animals. Whichever you pick is what everyone sees, in shared lists and on assignments too.",
          },
          {
            t: "note",
            text: "No Google photo? Kairo assigns you one of the animals automatically, the same one every time.",
          },
        ],
      },
      {
        id: "adding",
        heading: "Add another account",
        blocks: [
          {
            t: "ol",
            items: [
              "Open your profile and find **Accounts**.",
              "Click **+ Add another account**.",
              "Sign in with the other Google account.",
            ],
          },
          {
            t: "warn",
            text: "Five accounts is the limit for one browser. Adding a sixth quietly signs out the one you added first, no warning, so keep the roster tidy.",
          },
        ],
      },
      {
        id: "switching",
        heading: "Switch between them",
        blocks: [
          {
            t: "p",
            text: "Tap any account in the list. Kairo reloads straight into that account's tasks, lists, and settings, no re-login.",
          },
        ],
      },
      {
        id: "locks",
        heading: "Locks and switching",
        blocks: [
          {
            t: "ul",
            items: [
              "Each account keeps its own [lock state](/support/locks). Unlocking one never unlocks another.",
              "Switching to an account with an app lock lands you on its PIN screen, and its data never flashes on screen first.",
              "From a lock screen you can switch to another account without unlocking the locked one.",
              "Focus timers and notification settings are per account too.",
            ],
          },
        ],
      },
      {
        id: "sign-out",
        heading: "Signing out",
        blocks: [
          {
            t: "p",
            text: "**Sign out of this account** removes only the current one. If others are still signed in, you land in the first account on your list; sign out of the last and you return to the landing page. There's no “sign out everywhere” button, sign out once per account.",
          },
        ],
      },
    ],
  },
  {
    slug: "search",
    title: "Find anything with search",
    summary: "One shortcut opens a palette that searches your tasks, lists, notes and habits, and runs common actions.",
    categoryId: "account",
    keywords: ["search", "find", "command palette", "cmd k", "filter", "lookup"],
    sections: [
      {
        id: "opening",
        heading: "Open search",
        blocks: [
          {
            t: "p",
            text: "Press `⌘K` (Mac) or `Ctrl K` (Windows) anywhere in Kairo. On mobile, tap the magnifier in the top bar; on desktop there's a **Search** button in the sidebar.",
          },
        ],
      },
      {
        id: "what",
        heading: "What it searches",
        blocks: [
          {
            t: "ul",
            items: [
              "Task titles **and** notes.",
              "List names. Picking one opens Lists right at that list.",
              "Note titles.",
              "Habit names, which open that habit.",
              "Actions: capture a task or a note, jump to any page, and lock Kairo.",
            ],
          },
          {
            t: "p",
            text: "Before you type anything, it shows your five most recent tasks, so `⌘K` doubles as “take me back to what I just added”.",
          },
        ],
      },
      {
        id: "keyboard",
        heading: "Keyboard",
        blocks: [
          {
            t: "keys",
            rows: [
              { k: "↑ ↓", d: "Move through results" },
              { k: "Enter", d: "Open the selected task" },
              { k: "Esc", d: "Close" },
            ],
          },
        ],
      },
      {
        id: "limits",
        heading: "Limits worth knowing",
        blocks: [
          {
            t: "ul",
            items: [
              "Tasks in [locked lists](/support/locks) never appear, search can't be used to peek.",
              "It covers your live tasks plus anything completed in the **last three days**. Older history lives in the [Log](/support/log).",
              "It matches whole words as you type them, there's no typo correction, and it doesn't search inside steps.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Your data and privacy",
    summary: "What Kairo stores, what leaves your device, and what the locks really do.",
    categoryId: "account",
    keywords: ["privacy", "data", "security", "ai", "google", "storage", "delete"],
    sections: [
      {
        id: "stored",
        heading: "What's stored",
        blocks: [
          {
            t: "p",
            text: "Your tasks, lists, and settings live in Kairo's database, tied to your Google account ID. Signing in with Google shares only your name, email address, and profile picture, Kairo never sees your password and never asks for access to Gmail, Drive, or your calendar.",
          },
        ],
      },
      {
        id: "ai-data",
        heading: "What the AI sees",
        blocks: [
          {
            t: "ul",
            items: [
              "Only the text of the task you just captured, plus today's date and your **unlocked** list names, is sent for parsing.",
              "Locked list names are never sent.",
              "Nothing else, no other tasks, no history, no account details.",
              "If you'd rather not use it at all, capture still works completely without AI; it's an enhancement layered on top of the local parser.",
            ],
          },
        ],
      },
      {
        id: "device",
        heading: "What stays on your device",
        blocks: [
          {
            t: "p",
            text: "Your theme choice, which view you last used in the Calendar, running focus timers, and which locks you've unlocked this session are all stored locally in your browser, never on the server.",
          },
        ],
      },
      {
        id: "locks-note",
        heading: "The honest note about locks",
        blocks: [
          {
            t: "warn",
            text: "PIN [locks](/support/locks) hide content in the interface and are enforced on the server, but the underlying tasks are stored normally. Treat locks as privacy from people using your device, not as encryption.",
          },
        ],
      },
      {
        id: "delete",
        heading: "Deleting things",
        blocks: [
          {
            t: "p",
            text: "Deleting a task removes it. Deleting a list keeps its tasks and moves them to your Inbox. If you'd like your whole account and its data removed, [ask us](/support/contact) and we'll take care of it.",
          },
        ],
      },
    ],
  },
  /* --------------------------------------------------------------- journal */
  {
    slug: "journal",
    title: "Keep a journal",
    summary:
      "One page per day, written your way, with the weather inside, what you finished, and a PIN of its own.",
    categoryId: "journal",
    keywords: ["journal", "diary", "write", "writing", "reflection", "mood", "gratitude", "entry", "page", "notes"],
    sections: [
      {
        id: "a-page-a-day",
        heading: "A page a day",
        blocks: [
          {
            t: "p",
            text: "The **Journal** is a private diary inside Kairo, and every day has one page. Open it in the evening to write about the day, first thing for morning pages, or for a single line in between. All of it lands on that day's page.",
          },
          {
            t: "p",
            text: "On a computer it's in the sidebar under **Write**, or press `5`. Press `J` to jump straight to today's page. On a phone, tap **Write** in the bottom bar, then **Journal** at the top.",
          },
          {
            t: "note",
            text: "There are no streaks, and nothing is ever marked as missed. An empty day on the calendar is just an empty day.",
          },
        ],
      },
      {
        id: "writing",
        heading: "Writing",
        blocks: [
          { t: "p", text: "Just type. Formatting happens as you write, with shortcuts you may already know:" },
          {
            t: "keys",
            rows: [
              { k: "# ", d: "Big heading, or `## ` and `### ` for smaller ones" },
              { k: "- ", d: "Bulleted list" },
              { k: "1. ", d: "Numbered list" },
              { k: "[ ] ", d: "Checklist" },
              { k: "> ", d: "Quote" },
              { k: "---", d: "Divider" },
              { k: "==word==", d: "Highlight" },
              { k: "/", d: "Everything else: callouts, prompts, the time, what you finished" },
              { k: "⌘S", d: "Save right now. It saves on its own anyway." },
            ],
          },
          {
            t: "p",
            text: "Select any words to make them bold or italic, highlight them in one of six colours, or turn them into a link.",
          },
        ],
      },
      {
        id: "coming-back",
        heading: "Coming back later in the day",
        blocks: [
          {
            t: "p",
            text: "Because each day is one page, a morning thought and an evening one share it. When you come back to today's page after a while and carry on writing at the end, Kairo adds a small divider with the time, so the day reads in the order it happened.",
          },
          {
            t: "tip",
            text: "Fixing a typo further up doesn't add a time; only continuing at the end does. You can add one yourself with `/` then **The time**.",
          },
        ],
      },
      {
        id: "weather",
        heading: "The weather inside",
        blocks: [
          {
            t: "p",
            text: "Each page asks once how the day felt, as weather rather than a score: **Stormy**, **Cloudy**, **Mixed**, **Sunny** or **Radiant**. It's optional, and you can also pick it from the evening card on [Today](/support/today). The journal's calendar is tinted by it, and the main [Calendar](/support/calendar) and the [Log](/support/log) show each day's weather beside its tasks, so over a month you can see the shape of how things have been.",
          },
        ],
      },
      {
        id: "wins",
        heading: "What you finished",
        blocks: [
          {
            t: "p",
            text: "Under each page, **This day in Kairo** lists the tasks and steps you completed that day and the [habits](/support/habits) you marked done. Tap **Add to page** to bring them in as a checklist, or type `/` then **What I finished** anywhere on the page.",
          },
          { t: "note", text: "Tasks in [PIN-locked lists](/support/locks) never appear here." },
        ],
      },
      {
        id: "tools",
        heading: "Focus, fonts and dictation",
        blocks: [
          {
            t: "ul",
            items: [
              "**Focus mode** (⌘⇧F, or the page menu) fades everything except the paragraph you're in and keeps the line you're writing near eye level. Press Esc to leave it.",
              "**Writing font**: switch between sans, serif and mono from the page menu. Each device remembers its own choice.",
              "**Dictation**: tap the microphone in the writing toolbar and talk. It works in browsers with speech recognition, such as Chrome and Safari.",
            ],
          },
        ],
      },
      {
        id: "finding",
        heading: "Finding old pages",
        blocks: [
          {
            t: "ul",
            items: [
              "The **calendar** marks every day you wrote, tinted by its weather. Swipe or use the arrows to go back through the months, and tap any day to read it or write about it.",
              "**Search** looks through the words and titles of every page.",
              "**On this day** shows what you wrote a week ago, a month ago, and on this date in earlier years.",
            ],
          },
        ],
      },
      {
        id: "privacy",
        heading: "Privacy",
        blocks: [
          {
            t: "p",
            text: "Set a **Journal PIN** from the journal's settings. It's separate from the [app lock](/support/locks), and the server enforces it: your pages aren't even sent to a browser until the PIN is entered. The journal then stays open in that browser for up to 12 hours, or until you tap 🔒 to lock it again.",
          },
          {
            t: "ul",
            items: [
              "Journal pages are never sent to Kairo's AI.",
              "Assistants you connect to Kairo can only read or write your journal if you tick **Include journal** on their [connection key](/support/connect-ai). A key with the journal ticked can reach it even when the journal has a PIN, so only tick it for assistants you trust with your diary.",
              "Deleting your account deletes every page.",
            ],
          },
          { t: "warn", text: "There's no reset link for a journal PIN, so choose one you'll remember." },
        ],
      },
      {
        id: "offline",
        heading: "Offline, and two devices at once",
        blocks: [
          {
            t: "p",
            text: "Everything you type is kept on your device first and synced moments later, so a dropped connection, a closed tab or a flat battery doesn't lose words. The page says **Offline · kept on this device** when that's happening, and finishes saving once you're back.",
          },
          {
            t: "p",
            text: "If the same page changes on two devices at once, nothing is overwritten. Kairo shows you and lets you **Keep both**, keep yours, or use the other one.",
          },
        ],
      },
      {
        id: "export",
        heading: "Downloading and deleting",
        blocks: [
          {
            t: "ul",
            items: [
              "**Download your journal** from the journal's settings: every page in one Markdown file that opens in any text editor. It works even after a subscription has ended.",
              "To download or delete a single page, use that page's ⋯ menu. A deleted page can be brought back for a few seconds with **Undo**.",
            ],
          },
        ],
      },
    ],
  },
  /* ----------------------------------------------------------------- notes */
  {
    slug: "notes",
    title: "Keep notes",
    summary:
      "Pages inside pages, with toggles, tables, links between pages and live Kairo tasks. Organise them your way.",
    categoryId: "notes",
    keywords: ["notes", "notion", "pages", "wiki", "docs", "document", "subpage", "toggle", "table", "template", "markdown"],
    sections: [
      {
        id: "pages",
        heading: "Pages inside pages",
        blocks: [
          {
            t: "p",
            text: "**Notes** is where anything bigger than a task lives: a plan, meeting notes, a recipe, a page for everything about one project. Every page can hold more pages, so your notes grow into a shape that fits you.",
          },
          {
            t: "p",
            text: "On a computer it's in the sidebar, or press `5`. The panel beside your pages shows the whole tree, and `Ctrl+\\` hides it. On a phone, tap **Notes** in the bottom bar; **New page** is at the top of Notes.",
          },
          {
            t: "ul",
            items: [
              "**Organise** by dragging pages in the panel: onto the top or bottom edge of a page to reorder, onto its middle to put it inside. Or use a page's ⋯ menu and **Move to…**.",
              "**Favorites** sit at the top of the panel. Tap the star on any page.",
              "**Templates** give a blank page a shape to start from: meeting notes, a project brief, reading notes, a weekly review.",
            ],
          },
        ],
      },
      {
        id: "writing",
        heading: "Writing on a page",
        blocks: [
          { t: "p", text: "Type `/` anywhere for the full list of blocks. Formatting also happens as you type:" },
          {
            t: "keys",
            rows: [
              { k: "# ", d: "Heading, or `## ` and `### ` for smaller ones" },
              { k: "[ ] ", d: "To-do list" },
              { k: "- ", d: "Bulleted list" },
              { k: "1. ", d: "Numbered list" },
              { k: "> ", d: "Quote" },
              { k: "```", d: "Code block" },
              { k: "@ or [[", d: "Link to another page, or make a new one" },
              { k: "⌘⇧↑ / ⌘⇧↓", d: "Move the block you're in up or down" },
              { k: "⌘D", d: "Duplicate the block you're in" },
              { k: "⌘P", d: "Find any page" },
            ],
          },
          {
            t: "p",
            text: "Hover a block to see its handle: drag it to move the block, click it to turn the block into another kind, duplicate it or delete it, or **+** to add a block below. Select words to make them bold, colour them, highlight them, or link them.",
          },
          {
            t: "tip",
            text: "Paste Markdown straight in, from a chat with an assistant or a README, and it arrives as real headings, lists, checkboxes and tables.",
          },
        ],
      },
      {
        id: "blocks",
        heading: "Toggles, tables and callouts",
        blocks: [
          {
            t: "ul",
            items: [
              "**Toggle lists** tuck details away until you open them. Click the arrow to open or close one.",
              "**Tables** grow with **+ Row** and **+ Column** in the bar above them. Drag a column's edge to widen it.",
              "**Callouts** make something stand out. Click the icon to change it.",
              "**Sub-pages** made with `/` then **Page** appear as a link on the page they live in.",
            ],
          },
        ],
      },
      {
        id: "tasks",
        heading: "Kairo tasks inside notes",
        blocks: [
          {
            t: "p",
            text: "A line of a note can become a real Kairo task. Select the words and tap **✓ Task**, use a block's handle and **Make it a Kairo task**, or type `/task`. What you type is read the same way Capture reads it, so \"pay rent friday\" is planned for Friday.",
          },
          {
            t: "p",
            text: "The task shows on the page as a live chip: tick it there and it's ticked everywhere in Kairo, and the other way round.",
          },
        ],
      },
      {
        id: "look",
        heading: "Icons, covers and the page menu",
        blocks: [
          {
            t: "ul",
            items: [
              "Hover over a page's title for **Add icon** and **Add cover**. Click either later to change it.",
              "The ⋯ menu sets the font, small text and full width for that page.",
              "**Lock page** stops a page from being edited by accident, on every device, until you unlock it.",
              "**Linked from** at the bottom of a page lists every page that links to it.",
            ],
          },
        ],
      },
      {
        id: "trash",
        heading: "Trash",
        blocks: [
          {
            t: "p",
            text: "Deleting a page moves it and every page inside it to the **Trash**, with an **Undo** straight away. Restore it from the Trash for 30 days; after that it's deleted for good.",
          },
        ],
      },
      {
        id: "saving",
        heading: "Saving, offline, and two devices",
        blocks: [
          {
            t: "p",
            text: "Pages save as you type, and everything is kept on your device first, so a dropped connection or a closed tab doesn't lose words. If the same page changes on two devices at once, nothing is overwritten: Kairo lets you **Keep both**, keep yours, or use the other one.",
          },
          {
            t: "ul",
            items: [
              "Assistants you connect to Kairo can only use your notes if you tick **Include notes** on their [connection key](/support/connect-ai). They can search, read, make pages and add to them, but never delete or rewrite one.",
              "**Export as Markdown** from a page's ⋯ menu. Everything at once is downloadable too, even after a subscription has ended.",
              "Deleting your account deletes every page, trash included.",
            ],
          },
        ],
      },
    ],
  },
  /* ---------------------------------------------------------------- habits */
  {
    slug: "habits",
    title: "Build habits",
    summary:
      "Mark a habit done on the days you do it. Kairo counts your streak, shows how strong the habit is getting, and grows a plant for it as it takes root.",
    categoryId: "habits",
    keywords: ["habits", "habit tracker", "streak", "strength", "garden", "plant", "idea", "leaderboard", "streak saver", "routine", "kairo city", "cheer", "garden level"],
    sections: [
      {
        id: "start",
        heading: "Start a habit",
        blocks: [
          {
            t: "p",
            text: "**Habits** is in the sidebar on a computer, or press `6`. On a phone it's the last tab in the bottom bar, with a dot while a habit is still to do today. **Today** shows a small window onto your garden with the day's progress: tap it to open the garden full screen.",
          },
          {
            t: "ul",
            items: [
              "**New habit** opens on ideas: drink water, read, meditate, work out and more. Tap one and it arrives filled in. Or type your own and tap **Create**.",
              "Then there are only three things to choose: its name, how often (every day, weekdays, a number of times a week, or days you pick) and whether to be reminded in the morning, the evening or at a time you set. A daily goal like 8 glasses, why it matters and its plant and colour wait under **More options**.",
              "People doing the same idea share a leaderboard. **Ideas**, at the top of Habits, lists them all.",
              "Keep it small enough to do on a busy day. Two minutes of reading still counts, and small habits are the ones that last.",
              "You can keep up to 40 habits. Most people do best with three or four.",
            ],
          },
        ],
      },
      {
        id: "done",
        heading: "Mark it done",
        blocks: [
          {
            t: "p",
            text: "Tap the circle next to a habit on a day you did it. A habit with a target, like 8 glasses, fills up one tap at a time. Tapped by mistake? Tap again to take it back, or use **Undo**.",
          },
          {
            t: "ul",
            items: [
              "Forgot to mark it yesterday? Habits shows **Did you do these yesterday?** until the end of today. Tap **Mark yesterday done** and your streak carries on.",
              "Days a habit doesn't ask for never count against it.",
            ],
          },
        ],
      },
      {
        id: "streaks",
        heading: "Streaks and streak savers",
        blocks: [
          {
            t: "p",
            text: "A streak counts the days in a row you kept a habit. For a habit that's a number of times a week, it counts the weeks in a row you hit it.",
          },
          {
            t: "ul",
            items: [
              "Every 7 in a row earns a **streak saver**, up to three. If you miss a day, one is used by itself and your streak carries on, so one bad day doesn't erase a month.",
              "Changing a habit's schedule or target re-counts its current streak under the new rules. Your history and best streak stay.",
            ],
          },
        ],
      },
      {
        id: "strength",
        heading: "Strength, and the plant",
        blocks: [
          {
            t: "p",
            text: "**Strength** shows how rooted a habit is, from 0 to 100%. Every day you keep it adds a little, and every miss takes a little away, with recent days counting most. A single miss barely dents it; missing often brings it down. Most habits take around two months of steady keeping to feel automatic.",
          },
          {
            t: "ul",
            items: [
              "**Just started** below 10%, **Taking root** from 10%, **Growing strong** from 40%, **Almost automatic** from 70%, and **Rooted** from 85%. A habit's page shows about how many more days it takes to reach the next.",
              "Each habit has a plant, and it grows with strength: a sprout while the habit is new, in bloom once it's rooted. The garden at the top of Habits shows them all together, and a plant can be tapped to mark its habit done.",
              "The garden follows your day. The sky follows the clock, clouds gather while habits are still to do, and when everything due today is done the sky clears for a rainbow.",
              "**Open garden** on Today, or **Full screen** on Habits, fills the screen with it. Tap plants there to mark habits done; close it with the cross, Escape or your back button.",
            ],
          },
        ],
      },
      {
        id: "city",
        heading: "Kairo City",
        blocks: [
          {
            t: "p",
            text: "**Kairo City** is a street of real gardens, one plot beside the next, each grown by someone's habits. Open it from **Kairo City** on Habits, or the button on Today's garden card (it's there before your first habit too). Swipe or drag along the street, and tap any garden to walk into it.",
          },
          {
            t: "ul",
            items: [
              "**Your garden's score** is the strength of your 5 strongest habits added up, from 0 to 500. Adding more habits doesn't raise it; keeping them does. A garden whose owner stops coming by slowly fades.",
              "**Levels** turn the score into your plot: a Sprouting garden gets flower beds, then come a stone path, a pond, a rose arch, a fountain, and for a Legendary garden, golden lanterns and a golden gate. They show in your own garden too.",
              "**Neighbours** is the stretch of street around your garden, with the garden just ahead of you and how many points it's ahead. **Friends** is your friends in the city, and **Top gardens** the best in the city.",
              "**Cheers**: walk into someone's garden and leave a cheer, once a day. There are no messages. You see who cheered your own garden; nobody else does.",
              "**Share** gives your garden a link of its own that anyone can open, with a picture of your level for when it's posted.",
              "**Friends**: tap **Friends** at the top of the city. Find a gardener by the name on their gate and tap **Add friend**, or tap **Add friend** inside their garden. They get a request to accept; once they do, you're on each other's Friends street and each get a bench. Requests waiting for you show as a red count on the Friends button, on Kairo City on Today and on Habits. People you share a list with are friends already.",
              "**People you might know** are gardeners who cheered your garden lately, then gardens near yours on the street. Search only finds gardens already on the street, by their gate name, never by email.",
              "**Declining** a request is quiet: they aren't told. **Requested** in someone's garden takes a request back, and **Remove** in your friends list ends a friendship, even with someone you share a list with. You can send 30 requests a day.",
              "**Invite a friend**: tap the free plot beside your garden to save it for someone. Send them the link; when they claim it (signing in on the way if they need to), they move in next door, you each appear on the other's Friends street, and both gardens get a bench for two. A saved plot shows on your street until it's claimed, and tapping it lets you send the link again or let the plot go. You can hold 10 at a time.",
            ],
          },
          {
            t: "p",
            text: "Your garden only appears once you **claim your plot** with a name and an animal. Until then it stands on your street where only you can see it. Visitors see your plants, your level and the names of habits started from Ideas, never your email, your photo or habits you wrote yourself.",
          },
          {
            t: "p",
            text: "**Leaving the city**: walk into your own garden and tap **Leave Kairo City**. Your garden comes off the street, so nobody can find, visit or cheer it, it leaves the habit leaderboards, and plots you saved for friends are let go. Your habits, your garden and your friends stay; claim your plot again any time to come back under the same name.",
          },
        ],
      },
      {
        id: "community",
        heading: "Leaderboards",
        blocks: [
          {
            t: "p",
            text: "Every idea has a leaderboard of current streaks: **Everyone**, or **Friends** (the people you share lists or tasks with). You only appear once you join from **Leaderboards**, at the bottom of Habits, with a name and an animal. Nobody sees your email, your photo, or any habit you made yourself.",
          },
          {
            t: "p",
            text: "Until you join, Kairo still shows *you* where you'd rank, and how many days it would take to pass the next person up. **Hide me** takes you off every leaderboard at once.",
          },
        ],
      },
      {
        id: "reminders",
        heading: "Reminders",
        blocks: [
          {
            t: "p",
            text: "Give a habit a reminder time and Kairo reminds you then, only on days it's due and only if it isn't done yet. At 8:30pm, if a streak of three or more still isn't marked done, you'll get one last reminder; switch that off under **Evening reminder** at the bottom of Habits. Reminders use the same notifications as tasks, so turn those on in Settings.",
          },
        ],
      },
      {
        id: "archive",
        heading: "Archive or delete a habit",
        blocks: [
          {
            t: "ul",
            items: [
              "**Archive habit**, at the bottom of a habit's page, takes it off your list and stops its reminders. Its history is kept. Archived habits are listed at the bottom of Habits, where you can **Restore** them.",
              "**Delete habit** removes a habit and every day you marked it, for good. It's the bin button at the top of a habit's page, at the bottom under **Stop this habit**, and in **Edit**. Kairo asks once before deleting, and offers to archive instead.",
              "Assistants you connect to Kairo only reach your habits if you tick **Include habits** on their [connection key](/support/connect-ai). Then they can see your habits, mark one done when you tell them you did it, and start new ones. They can't archive or delete anything.",
              "Deleting your account deletes your habits and every day you marked.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "connect-ai",
    title: "Use Kairo from ChatGPT, Claude or Gemini",
    summary:
      "Give an assistant its own key and it can plan your day, capture what you say and tick things off, without you opening Kairo.",
    categoryId: "account",
    keywords: [
      "mcp",
      "chatgpt",
      "claude",
      "gemini",
      "grok",
      "ai",
      "assistant",
      "api",
      "api key",
      "connector",
      "integration",
      "connect",
    ],
    sections: [
      {
        id: "what-it-is",
        heading: "What this is",
        blocks: [
          {
            t: "p",
            text: "Kairo can be connected to an AI assistant, so the planner lives wherever you are already typing. You say **plan my day** and it reads what is on today, what carried over and how full the day already looks. You say **I finished the launch post** and it ticks it off. You say **remind me to call the bank at four** and the reminder is set.",
          },
          {
            t: "p",
            text: "It works through MCP, an open standard that ChatGPT, Claude, Gemini, Grok and most coding assistants now speak. Kairo's address is `https://kairo.jaimansoni.com/mcp`.",
          },
          {
            t: "note",
            text: "The assistant is not given your password and never sees your Google account. It gets a key that you create, that you can read the usage of, and that you can revoke in one click.",
          },
        ],
      },
      {
        id: "create-a-key",
        heading: "Create a key",
        blocks: [
          {
            t: "ol",
            items: [
              "Open your profile (top right) and find **Connections**.",
              "Tap **Connect**, then **New connection**.",
              "Name it after where it will live, `ChatGPT on my laptop`, so you know which one to revoke later.",
              "Choose whether it may change things or only read.",
              "Copy the key. **It is shown once and never again**, because Kairo stores only a fingerprint of it.",
            ],
          },
          {
            t: "warn",
            text: "Treat a key like a password. Anyone holding it can act as you in Kairo. If one leaks, revoke it, the next request made with it fails immediately.",
          },
        ],
      },
      {
        id: "connecting",
        heading: "Point your assistant at it",
        blocks: [
          {
            t: "p",
            text: "Wherever your assistant asks for a **custom connector** or an **MCP server**, give it the address and the key.",
          },
          {
            t: "table",
            head: ["Assistant", "Where to put it"],
            rows: [
              [
                "Claude",
                "Settings → Connectors → Add custom connector. Address `https://kairo.jaimansoni.com/mcp`, header `Authorization: Bearer YOUR_KEY`.",
              ],
              [
                "ChatGPT",
                "Settings → Connectors → Create. If it accepts only a URL, use the link Kairo shows you with the key already in it.",
              ],
              [
                "Gemini CLI, Grok, others",
                "Add an HTTP MCP server at the same address with the header `Authorization: Bearer YOUR_KEY`. An `X-API-Key` header works too.",
              ],
              [
                "Claude Code",
                "`claude mcp add --transport http kairo https://kairo.jaimansoni.com/mcp --header \"Authorization: Bearer YOUR_KEY\"`",
              ],
            ],
          },
          {
            t: "tip",
            text: "A key in a URL is convenient but travels through logs and browser history in a way a header does not. Prefer the header where your assistant supports one.",
          },
        ],
      },
      {
        id: "what-it-can-do",
        heading: "What it can do",
        blocks: [
          {
            t: "p",
            text: "Everything you can do in the app: capture, plan, complete, reschedule, break work into steps, run the morning sweep, set reminders, make and share lists, assign work inside a shared list, and read back the Log.",
          },
          {
            t: "ul",
            items: [
              "**\"Plan my day\"** reads today, what carried over, what is due soon and what capacity is left, then proposes a plan.",
              "**\"I did the gym and the invoice\"** finds both and completes them, advancing anything that repeats.",
              "**\"What carried over?\"** offers the same five choices the morning sweep does, including letting something go.",
              "**\"What did I get done this week?\"** reads the Log.",
            ],
          },
          {
            t: "note",
            text: "The assistant is told how Kairo thinks before it touches anything: a planned day is not a deadline, [spotlight](/support/today) holds three, and carried-over work is never presented as overdue. It plans the way Kairo does, not the way a generic to-do list would.",
          },
        ],
      },
      {
        id: "privacy",
        heading: "What stays private",
        blocks: [
          {
            t: "p",
            text: "[PIN-locked lists](/support/locks) are invisible to a connection by default, including every task filed inside one. A key carries no PIN, so it gets nothing the PIN was protecting.",
          },
          {
            t: "p",
            text: "If you do want an assistant to see them, there is a checkbox when you create the key, off unless you tick it. You can create one key that can see them and another that cannot.",
          },
          {
            t: "ul",
            items: [
              "A **read only** key can never add, change or delete anything, and the tools to do so are not even offered to the assistant.",
              "Your [notes](/support/notes) are out of reach unless you tick **Include notes** when creating the key: an assistant can search and read them, make new pages and add to existing ones, but never delete or rewrite a page.",
              "Your [habits](/support/habits) work the same way, with **Include habits**: an assistant can see your habits and streaks, mark a habit done when you say you did it, and start a new one. It can't archive, delete or edit a habit, and it never sees who's on a leaderboard.",
              "Giving a key locked lists takes a browser where they're unlocked.",
              "A connection can only reach what you can reach: your own work, plus lists and tasks shared with you.",
              "Nothing about your billing, your PIN or your sign-in is exposed.",
            ],
          },
        ],
      },
      {
        id: "managing",
        heading: "Revoking and keeping track",
        blocks: [
          {
            t: "p",
            text: "**Connections** lists every key with its last four characters and when it was last used, so an unfamiliar one is easy to spot. **Revoke** kills it immediately.",
          },
          {
            t: "ul",
            items: [
              "You can hold up to 10 live keys at once.",
              "Revoking cannot be undone, create a new key and paste it in again.",
              "Deleting your Kairo account deletes every key with it.",
            ],
          },
        ],
      },
      {
        id: "problems",
        heading: "If it will not connect",
        blocks: [
          {
            t: "ul",
            items: [
              "**Unauthorized, or the assistant says the server rejected it** — the key is wrong, was revoked, or has a stray space. Create a fresh one.",
              "**Payment required** — the Kairo account's [access has ended](/support/troubleshooting). Connections stop when the app does.",
              "**Wrong dates** — the key remembers the time zone of the browser that made it. If you have moved, make a new key from where you now are.",
              "**Too many calls** — an assistant stuck in a loop will be slowed down for a minute. Start a new chat.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "troubleshooting",
    title: "Fix a problem",
    summary: "The handful of things that occasionally go wrong, and what to do about each.",
    categoryId: "account",
    keywords: [
      "problem",
      "bug",
      "error",
      "not working",
      "hiccup",
      "sync",
      "couldn't save",
      "broken",
      "troubleshoot",
    ],
    sections: [
      {
        id: "couldnt-save",
        heading: "“Couldn't save that. It's still here. Try again in a moment.”",
        blocks: [
          {
            t: "p",
            text: "A change didn't reach the server, so Kairo rolled it back rather than lying to you about it.",
          },
          {
            t: "ol",
            items: [
              "Check your internet connection.",
              "Refresh the page, you'll see the true saved state.",
              "Redo the change.",
            ],
          },
          {
            t: "p",
            text: "If it keeps happening on every action, [tell us](/support/contact), something server-side needs attention.",
          },
        ],
      },
      {
        id: "hiccup",
        heading: "“Something hiccuped”",
        blocks: [
          {
            t: "p",
            text: "Almost always a stale tab: the app updated while your page was open. Kairo reloads itself once automatically, which fixes it invisibly.",
          },
          {
            t: "p",
            text: "If the screen stays, note the `ref:` code shown under the message and [send it to us](/support/contact), it points straight at the cause.",
          },
        ],
      },
      {
        id: "notifications",
        heading: "Notifications aren't arriving",
        blocks: [
          {
            t: "ul",
            items: [
              "Use **Send a test notification** in your profile, it verifies the whole chain in two seconds.",
              "On iPhone, Kairo must be [installed to the home screen](/support/getting-started) first.",
              "Push needs HTTPS. Opening Kairo through a local network address like `192.168.x.x` can't receive notifications.",
              "Check your device's Do Not Disturb or Focus mode.",
              "Full detail: [turn on notifications](/support/notifications).",
            ],
          },
        ],
      },
      {
        id: "shared",
        heading: "I can't see my partner's changes",
        blocks: [
          {
            t: "p",
            text: "Shared lists sync when you return to the tab rather than continuously. Switch away and back, or refresh, and their changes appear. Also confirm you're both on the same list, and that you're signed into the [account](/support/accounts) you shared from.",
          },
        ],
      },
      {
        id: "missing-tasks",
        heading: "Tasks seem to be missing",
        blocks: [
          {
            t: "ul",
            items: [
              "Check whether the list is [locked](/support/locks), locked tasks are hidden everywhere by design.",
              "Check you're in the right [account](/support/accounts).",
              "Deleted a list? Its tasks survive without a list label, undated ones sit in the Inbox, dated ones stay on their day.",
              "Look in the [Log](/support/log): it may simply be done.",
            ],
          },
        ],
      },
      {
        id: "login",
        heading: "Sign-in bounces back",
        blocks: [
          {
            t: "p",
            text: "Each web address keeps its own session, so signing in on one doesn't sign you in on another. Make sure you're returning to the same address you signed in on, and that cookies aren't blocked for the site.",
          },
        ],
      },
    ],
  },
];

/** The help centre as shown: the journal's guide comes back when the journal does. */
export const CATEGORIES: Category[] = ALL_CATEGORIES.filter((c) => c.id !== "journal" || JOURNAL_SHOWN);
export const ARTICLES: Article[] = ALL_ARTICLES.filter((a) => a.categoryId !== "journal" || JOURNAL_SHOWN);
