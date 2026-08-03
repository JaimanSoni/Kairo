import type { Post } from "../types";

/**
 * Intent landing pages. Each one exists to answer a specific search honestly:
 * what the searcher is trying to do, whether Kairo actually fits, and what to
 * use instead when it does not. The fastest way to lose these rankings is to
 * make every page the same pitch with a different H1.
 */
export const USE_CASES: Post[] = [
  /* ------------------------------------------------------ ai-daily-planner */
  {
    slug: "ai-daily-planner",
    kind: "use-case",
    title: "An AI daily planner that plans with you, not for you",
    metaTitle: "AI Daily Planner: Plan Your Day in Plain English | Kairo",
    description:
      "Kairo is an AI daily planner: type your day in plain sentences and the AI files each task with a date, time, list, and estimate. 7-day free trial, no card.",
    published: "2026-08-03",
    updated: "2026-08-03",
    keywords: ["ai daily planner", "ai planner app", "ai task planner", "plan my day with ai"],
    sections: [
      {
        id: "answer",
        heading: "The short answer",
        blocks: [
          {
            t: "p",
            text: "Kairo is an AI daily planner where you type what you need to do in plain sentences, like \"call the dentist tomorrow morning and finish the report by Friday\", and the AI turns each thought into a scheduled task with a date, a time, the right list, and a time estimate. It costs 199 to 299 rupees a month, roughly 3 US dollars, comes with a 7-day free trial that needs no card, and runs in any browser.",
          },
        ],
      },
      {
        id: "what-ai-should-do",
        heading: "What an AI planner should actually do",
        blocks: [
          {
            t: "p",
            text: "Most of the work of planning a day is not deciding what matters. It is the clerical part: writing tasks down, picking dates, sorting them into projects, guessing how long things take. That is the part an AI is genuinely good at, and it is the part Kairo automates.",
          },
          {
            t: "ul",
            items: [
              "**Capture in one sentence.** Press `N`, type \"buy groceries after work and book flights for the Goa trip next weekend\", press Enter. Kairo creates two tasks, dated correctly, filed into the right lists.",
              "**Dates that understand you.** \"Next weekend\", \"Friday evening\", \"in three weeks\" all resolve against today's actual calendar, not a guess.",
              "**Estimates included.** Say \"should take half an hour\" and the task carries a 30 minute estimate, which is what makes a daily plan honest instead of hopeful.",
              "**Lists inferred.** Mention groceries and it lands in your errands list. New project? Kairo names a sensible list for it.",
            ],
          },
          {
            t: "p",
            text: "What Kairo deliberately does not do is plan your day for you. The AI removes the typing, and you keep the judgment. Tools like Motion take the opposite bet and auto-schedule everything onto your calendar. If you want a robot chief of staff, read our honest [Kairo vs Motion comparison](/blog/kairo-vs-motion). If you want to stay the planner and lose the clerical work, that is Kairo.",
          },
        ],
      },
      {
        id: "a-day-with-kairo",
        heading: "What a day looks like",
        blocks: [
          {
            t: "ol",
            items: [
              "**Morning.** Open Kairo. If yesterday left leftovers, the Fresh Start sweep asks once what to do with each, then gets out of the way. No red badges, no overdue counters.",
              "**Plan.** Pull a few tasks into Today and star up to three as Spotlight. Three real wins is a good day.",
              "**All day.** Anything that lands in your head goes in through capture, in one sentence, without leaving what you were doing.",
              "**Evening.** Check things off. What did not happen rolls forward without shame.",
            ],
          },
          {
            t: "tip",
            text: "Kairo has no overdue state at all. Unfinished tasks wait calmly instead of turning red, which is the main reason people who abandoned other planners stay with this one.",
          },
        ],
      },
      {
        id: "faq",
        heading: "Frequently asked questions",
        blocks: [
          {
            t: "faq",
            items: [
              {
                q: "Is Kairo's AI planner free?",
                a: "There is a 7-day free trial with every feature on and no card required. After that it is 199 rupees a month for Lite or 299 for Full, paid one month at a time. Nothing renews by itself.",
              },
              {
                q: "How is this different from asking ChatGPT to plan my day?",
                a: "A chat gives you a plan as text you then have to maintain by hand. Kairo's AI writes into a real planner: tasks persist, roll forward, repeat, get checked off, and show up on a calendar.",
              },
              {
                q: "Does Kairo auto-schedule tasks onto my calendar?",
                a: "No. Kairo helps you decide and removes the typing; it does not move your tasks around for you. If auto-scheduling is what you want, Motion and Reclaim do that, and our comparison pages cover them honestly.",
              },
              {
                q: "What happens to my data?",
                a: "Your tasks are yours. Kairo shows no ads, sells no data, and lets you lock private lists with a PIN.",
              },
            ],
          },
          {
            t: "cta",
            heading: "Plan tomorrow in one sentence",
            text: "Start the 7-day free trial, no card needed. Type your day the way you would say it, and see it land as a real plan.",
          },
        ],
      },
    ],
    related: ["how-to-plan-your-day-with-ai", "ai-schedule-generator", "best-ai-planners-2026"],
  },

  /* -------------------------------------------------- ai-schedule-generator */
  {
    slug: "ai-schedule-generator",
    kind: "use-case",
    title: "An AI schedule generator for real days, not ideal ones",
    metaTitle: "AI Schedule Generator: Turn Sentences Into a Day Plan | Kairo",
    description:
      "Type your tasks in plain English and Kairo generates a realistic daily schedule with times and estimates. Honest about what it is not: a school timetable maker.",
    published: "2026-08-03",
    updated: "2026-08-03",
    keywords: ["ai schedule generator", "ai schedule maker", "generate daily schedule", "ai day planner"],
    sections: [
      {
        id: "answer",
        heading: "The short answer",
        blocks: [
          {
            t: "p",
            text: "Kairo generates a daily schedule from plain sentences: type everything you need to do, in one go if you like, and the AI gives each item a day, a time when you named one, and a duration estimate, then lays your day out on a Today view and a monthly calendar. It is built for personal daily planning. If you need a class timetable generator or a shift roster, that is a different kind of tool and Kairo is honestly not it.",
          },
        ],
      },
      {
        id: "how-it-works",
        heading: "From a brain dump to a schedule",
        blocks: [
          {
            t: "p",
            text: "The fastest way to use Kairo as a schedule generator is a brain dump. Open capture and type it the way you would tell a friend:",
          },
          {
            t: "note",
            text: "\"Gym at 7, standup at 10, finish the proposal before lunch, call mom in the evening, and start packing for Saturday's trip\"",
          },
          {
            t: "p",
            text: "Kairo reads that as five tasks. The ones with times get times. The proposal gets a before-lunch slot and, because \"finish\" suggests real work, a meaty estimate you can correct with one tap. The trip packing lands on Saturday. Nothing needed a form with eleven fields.",
          },
          {
            t: "ul",
            items: [
              "**Estimates make it a schedule, not a wish.** A list of ten tasks is a hope. Ten tasks with estimates that sum to nine hours is a warning, and Kairo shows you that before the day does.",
              "**The calendar shows the month.** Planned days fill in on a monthly view, so \"when am I actually free\" is a glance, not an audit.",
              "**Repeats schedule themselves.** \"Water the plants every Tuesday\" becomes a repeating task that quietly reappears, and rolls forward if you miss a week instead of guilt-tripping you.",
            ],
          },
        ],
      },
      {
        id: "limits",
        heading: "What it will not generate",
        blocks: [
          {
            t: "p",
            text: "Honesty section. Kairo will not generate a university exam timetable, a team shift roster, or a project Gantt chart. It also does not rearrange your Google Calendar for you; calendar sync is on the roadmap but not shipped today. Kairo's job is the personal day: what you will do, when, and for how long, with an AI doing the typing.",
          },
        ],
      },
      {
        id: "faq",
        heading: "Frequently asked questions",
        blocks: [
          {
            t: "faq",
            items: [
              {
                q: "Can it generate a full week at once?",
                a: "Yes. Mention days in your capture, \"gym Monday Wednesday Friday, review on Sunday\", and each task lands on its day. The calendar view then shows the week taking shape.",
              },
              {
                q: "Does it handle times like \"after lunch\" or \"tonight\"?",
                a: "Yes. Relative phrases resolve against your actual current date and time, so \"tonight\" is tonight and \"next weekend\" is the weekend after this one.",
              },
              {
                q: "Is there a free AI schedule generator in Kairo?",
                a: "The 7-day trial is free with no card and includes the full AI. After the trial, plans start at 199 rupees a month, about 2.5 US dollars.",
              },
              {
                q: "Can I move things after the AI schedules them?",
                a: "Always. Everything the AI writes is a suggestion you can drag, retime, or delete. You stay the editor.",
              },
            ],
          },
          {
            t: "cta",
            heading: "Generate tomorrow's schedule now",
            text: "Free for 7 days, no card. Dump your week into one text box and watch it become a plan.",
          },
        ],
      },
    ],
    related: ["ai-daily-planner", "how-to-plan-your-day-with-ai", "time-blocking-app"],
  },

  /* ------------------------------------------------------ time-blocking-app */
  {
    slug: "time-blocking-app",
    kind: "use-case",
    title: "A time blocking app for people who hate rigid calendars",
    metaTitle: "Time Blocking App Without the Rigid Calendar | Kairo",
    description:
      "Kairo does time blocking with planned times, duration estimates, and a focus timer, without turning your whole day into back-to-back calendar events.",
    published: "2026-08-03",
    updated: "2026-08-03",
    keywords: ["time blocking app", "time boxing app", "time block planner", "daily time blocking"],
    sections: [
      {
        id: "answer",
        heading: "The short answer",
        blocks: [
          {
            t: "p",
            text: "Kairo is a time blocking app for people who found calendar-grid blocking too brittle. You give each task a planned time and a duration estimate, run it with a built-in focus timer, and let the day flex when reality arrives. Blocks live on your task list and monthly calendar rather than as wall-to-wall calendar events, so one overrun does not knock over the whole day.",
          },
        ],
      },
      {
        id: "why-blocking-fails",
        heading: "Why classic time blocking keeps failing",
        blocks: [
          {
            t: "p",
            text: "Time blocking works, the research on implementation intentions is clear that deciding when and where you will do something makes it far more likely to happen. What fails is the brittle version: a calendar packed edge to edge at 8am that is fiction by 11. One meeting overruns and the rest of the day is a wall of lies you now have to re-plan.",
          },
          {
            t: "ul",
            items: [
              "**Blocks in Kairo are intentions, not appointments.** A task planned for 2pm with a 90 minute estimate is a commitment to start, not a contract with the grid.",
              "**Overruns do not cascade.** If the 2pm thing takes until 4, nothing else turns red. The next task is simply still there, and tomorrow's Fresh Start sweep helps if the day defeats you.",
              "**The focus timer closes the loop.** Start a task and a timer runs against its estimate, which is how your guesses get better week over week.",
            ],
          },
          {
            t: "tip",
            text: "Estimate honestly and plan at most five to six hours of blocks in an eight hour day. The unblocked time is not waste, it is where reality lives.",
          },
        ],
      },
      {
        id: "when-calendar-native",
        heading: "When you want a calendar-native blocker instead",
        blocks: [
          {
            t: "p",
            text: "If your day is meetings-first and you want tasks physically drawn on the same Google Calendar your team sees, a calendar-native tool fits better: Akiflow and Sunsama both do drag-to-calendar time boxing, and Motion auto-places blocks for you. We compare them honestly in [Kairo vs Akiflow](/blog/kairo-vs-akiflow) and [Kairo vs Sunsama](/blog/kairo-vs-sunsama). Kairo's calendar sync is on the roadmap but not shipped, so today Kairo is the right pick when you want time blocking that bends instead of breaks, at about a tenth of the price.",
          },
        ],
      },
      {
        id: "faq",
        heading: "Frequently asked questions",
        blocks: [
          {
            t: "faq",
            items: [
              {
                q: "How do I create a time block in Kairo?",
                a: "Type it: \"deep work on the deck 9 to 11\" or \"gym at 6 for an hour\". The AI sets the planned time and estimate in one step. You can also set both by hand on any task.",
              },
              {
                q: "Does Kairo have a Pomodoro or focus timer?",
                a: "Yes. Any task can run a focus timer, and the timer knows the task's estimate, so a block is something you run, not just draw.",
              },
              {
                q: "Can I see my blocks on a calendar?",
                a: "Kairo has a monthly calendar of your planned days. It does not yet sync with Google Calendar; that integration is planned and the app is honest about it in the meantime.",
              },
              {
                q: "What does it cost?",
                a: "199 or 299 rupees a month, roughly 2.5 to 3.6 US dollars, after a 7-day free trial with no card. Most calendar-native blockers run 16 to 34 dollars a month.",
              },
            ],
          },
          {
            t: "cta",
            heading: "Block tomorrow morning, gently",
            text: "Try Kairo free for 7 days. Plan a morning of two honest blocks and see if the day survives contact with reality.",
          },
        ],
      },
    ],
    related: ["time-blocking-for-software-engineers", "deep-work-schedule-template", "kairo-vs-akiflow"],
  },

  /* --------------------------------------------- daily-planner-for-students */
  {
    slug: "daily-planner-for-students",
    kind: "use-case",
    title: "A daily planner for students who are done with guilt apps",
    metaTitle: "Daily Planner for Students: Cheap, Calm, AI-Powered | Kairo",
    description:
      "Kairo is a student daily planner with AI capture, shared lists for group projects, and no overdue shame. 199 rupees a month after a free trial, no card needed.",
    published: "2026-08-03",
    updated: "2026-08-03",
    keywords: ["daily planner for students", "student planner app", "planner app for college", "assignment planner"],
    sections: [
      {
        id: "answer",
        heading: "The short answer",
        blocks: [
          {
            t: "p",
            text: "Kairo is a daily planner built to survive a student's semester: capture assignments in plain English the moment they are announced, keep deadlines rare and real, split group projects into shared lists your teammates can join with just an email, and never face a wall of red when a week goes sideways. It costs 199 rupees a month after a 7-day free trial, no card required, which matters on a student budget when the popular alternatives charge 16 to 34 US dollars.",
          },
        ],
      },
      {
        id: "semester-reality",
        heading: "Built for how semesters actually go",
        blocks: [
          {
            t: "p",
            text: "Every semester starts with a beautiful system and dies in week six under a pile of overdue tasks. The problem is rarely discipline. It is that most planners punish falling behind, and a student's schedule guarantees falling behind at least twice a term.",
          },
          {
            t: "ul",
            items: [
              "**Capture beats organizing.** Professor announces a quiz mid-lecture? Press `N`, type \"physics quiz next Thursday, revise waves chapter before it\", done. Two tasks, dated, filed.",
              "**Deadlines are separate from plans.** The essay is due on the 20th; you plan to work on it Tuesday and Friday. Kairo keeps those as different things, so moving a work session never touches the real deadline.",
              "**Bad weeks do not compound.** Miss three days and the Fresh Start sweep asks once, calmly, what to do with each leftover. No red badge counting your failures.",
              "**Repeats handle routines.** \"Review flashcards every weekday\" reappears each morning and quietly rolls forward when a day is missed instead of stacking into a guilt pile.",
            ],
          },
        ],
      },
      {
        id: "group-projects",
        heading: "Group projects without the group chat chaos",
        blocks: [
          {
            t: "p",
            text: "Make a list for the project and share it by email. Teammates do not need to already have an account; the invite signs them straight in. Everyone sees the same tasks, work can be assigned by name, and \"I thought you were doing that part\" dies quietly. Private lists can be locked with a PIN, so your roommate borrowing your laptop is not reading your journal-adjacent errands.",
          },
        ],
      },
      {
        id: "faq",
        heading: "Frequently asked questions",
        blocks: [
          {
            t: "faq",
            items: [
              {
                q: "Is there a student discount?",
                a: "The base price is already student-shaped: 199 rupees a month, around 2.5 US dollars, paid one month at a time with no auto-renewal. Stop paying during summer break and nothing punishes you.",
              },
              {
                q: "Can I plan my class timetable in Kairo?",
                a: "Kairo plans tasks and days rather than generating a timetable grid. Recurring tasks handle \"lab every Wednesday\" style routines well, but a dedicated timetable app is better for the grid itself.",
              },
              {
                q: "Does it work on my phone?",
                a: "Yes. Kairo runs in any browser and installs to your home screen like an app. Capture and reminders both work on mobile.",
              },
              {
                q: "How is this better than a paper planner?",
                a: "Paper is genuinely great at one thing: writing things down. Kairo keeps that speed with one-sentence capture, then adds what paper cannot do, reminders, repeats, shared project lists, and a calendar that reshuffles without an eraser.",
              },
            ],
          },
          {
            t: "cta",
            heading: "Start the semester system that survives week six",
            text: "Free for 7 days, no card. Capture this week's assignments in one brain dump and see the plan appear.",
          },
        ],
      },
    ],
    related: ["ai-planner-for-college-students", "planning-fallacy", "ai-daily-planner"],
  },

  /* ------------------------------------------- daily-planner-for-developers */
  {
    slug: "daily-planner-for-developers",
    kind: "use-case",
    title: "A daily planner for developers who live on the keyboard",
    metaTitle: "Daily Planner for Developers: Keyboard-First, No Guilt | Kairo",
    description:
      "Kairo is a developer's daily planner: capture tasks mid-flow without losing context, plan deep work with estimates, and never see a red overdue badge during crunch.",
    published: "2026-08-03",
    updated: "2026-08-03",
    keywords: ["daily planner for developers", "developer task planner", "programmer productivity app", "planner for engineers"],
    sections: [
      {
        id: "answer",
        heading: "The short answer",
        blocks: [
          {
            t: "p",
            text: "Kairo is a daily planner that respects a developer's two scarcest resources: focus and keystrokes. Capture a task mid-debugging in one sentence without leaving flow, press `N`, type, Enter, back to the editor. Plan deep work with honest duration estimates and a focus timer, keep a Spotlight of at most three real wins, and when a production incident eats your Tuesday, nothing turns red.",
          },
        ],
      },
      {
        id: "flow",
        heading: "Capture without breaking flow",
        blocks: [
          {
            t: "p",
            text: "The most expensive thing in a developer's day is a broken context. Every \"I should fix that too\" discovered mid-task is a fork: chase it now and lose the thread, or trust your memory and lose the fix. A planner only works for developers if capture costs less than a stack trace read.",
          },
          {
            t: "ul",
            items: [
              "`N` opens capture from anywhere, `Cmd K` searches everything. Hands stay on the keyboard.",
              "Type \"refactor the retry logic after the release on Friday, maybe 2 hours\" and the AI files it with the date and the estimate. No form, no dropdowns.",
              "The inbox catches unsorted captures, and planning time, not coding time, is when you sort them.",
            ],
          },
        ],
      },
      {
        id: "deep-work",
        heading: "Deep work, estimated honestly",
        blocks: [
          {
            t: "p",
            text: "Developers are famously bad at estimates, which is exactly why tasks in Kairo carry them. A day that says \"ship auth refactor\" is a wish. A day that says \"auth refactor, 3 hours, starting 9am, timer running\" is a plan, and when the three hours are honestly wrong, the timer's history is how next sprint's guess gets better. Pair it with our [deep work schedule template](/blog/deep-work-schedule-template) if you want a full-day structure.",
          },
          {
            t: "tip",
            text: "Spotlight holds three tasks, maximum, on purpose. Shipping three real things beats touching nine. Interrupt-driven days still count if the three were chosen honestly at 9am.",
          },
        ],
      },
      {
        id: "faq",
        heading: "Frequently asked questions",
        blocks: [
          {
            t: "faq",
            items: [
              {
                q: "Does Kairo integrate with GitHub or Jira?",
                a: "No, and honestly it may never. Kairo is your personal layer, the three things that matter today, not a mirror of the team backlog. Many developers keep Jira for the team and Kairo for the day.",
              },
              {
                q: "Is there a CLI or API?",
                a: "Not today. Capture is keyboard-first in the browser, which covers the flow-preservation case a CLI usually serves.",
              },
              {
                q: "Can I time-block my maker schedule?",
                a: "Yes: planned times plus estimates make blocks, and the focus timer runs them. See our guide to [time blocking for software engineers](/blog/time-blocking-for-software-engineers).",
              },
              {
                q: "What does it cost?",
                a: "199 or 299 rupees a month, about the price of one coffee, after a free 7-day trial with no card. Paid month by month, nothing auto-renews.",
              },
            ],
          },
          {
            t: "cta",
            heading: "Plan tomorrow before standup",
            text: "Free for 7 days, no card. Capture your open loops tonight and walk into standup with a plan.",
          },
        ],
      },
    ],
    related: ["time-blocking-for-software-engineers", "deep-work-schedule-template", "ai-daily-planner"],
  },

  /* --------------------------------------------------------- planner-for-adhd */
  {
    slug: "planner-for-adhd",
    kind: "use-case",
    title: "A planner that works with an ADHD brain, not against it",
    metaTitle: "ADHD-Friendly Daily Planner: Low Friction, No Shame | Kairo",
    description:
      "Kairo is an ADHD-friendly planner: one-sentence capture before the thought escapes, a short Today list instead of walls of tasks, and zero overdue shame mechanics.",
    published: "2026-08-03",
    updated: "2026-08-03",
    keywords: ["planner for adhd", "adhd planner app", "adhd task manager", "adhd friendly to do list"],
    sections: [
      {
        id: "answer",
        heading: "The short answer",
        blocks: [
          {
            t: "p",
            text: "Kairo is a daily planner designed around the exact places task apps usually fail ADHD brains: capture takes one sentence before the thought escapes, the Today view shows a handful of chosen tasks instead of an overwhelming everything-list, estimates counter time blindness, and there is no red overdue wall to trigger the shame spiral that makes people abandon apps entirely. Kairo is a planning tool, not a treatment, but its defaults were chosen for brains that have been burned by planners before.",
          },
        ],
      },
      {
        id: "friction",
        heading: "Capture faster than the thought fades",
        blocks: [
          {
            t: "p",
            text: "The gap between \"I need to call the pharmacy\" and writing it down is where ADHD brains lose tasks. Every field a planner asks you to fill, project, priority, due date, tags, is another chance for the thought to evaporate or for the capture to feel like too much and be skipped.",
          },
          {
            t: "ul",
            items: [
              "In Kairo the whole capture is one sentence: \"call the pharmacy tomorrow before noon\". The AI fills in the date, time, and list, so the tax on writing something down is close to zero.",
              "Capture works from anywhere in the app with one key, and on your phone from the home screen.",
              "You do not have to organize anything at capture time. Thoughts land in the inbox; sorting happens later, when you choose.",
            ],
          },
        ],
      },
      {
        id: "shame",
        heading: "No shame mechanics, by design",
        blocks: [
          {
            t: "p",
            text: "Most planners are accidentally hostile to ADHD: streaks that break, badges that count how far behind you are, walls of overdue red. Research on task avoidance is blunt about what happens next, the app itself becomes an aversive stimulus and opening it gets harder every day. Kairo removes the trigger entirely.",
          },
          {
            t: "ul",
            items: [
              "**Nothing turns red, ever.** An unfinished task just waits. The number of days it has waited is not displayed anywhere.",
              "**Mornings start with one small decision per leftover.** The Fresh Start sweep shows yesterday's remainder one task at a time: today, later, someday, or let it go. Letting go is a first-class button, not a failure state.",
              "**Missed routines self-heal.** A daily habit missed on Tuesday quietly becomes Wednesday's, with no broken-streak funeral.",
              "**Spotlight caps the day at three.** A short list you might finish beats a long list you definitely will not, and finishing is the dopamine that keeps the system alive.",
            ],
          },
          {
            t: "note",
            text: "Kairo is not medical software and does not replace treatment, coaching, or the systems that work for you. It is a planner whose defaults, low-friction capture, small visible lists, zero shame, happen to be the ones ADHD guides recommend.",
          },
        ],
      },
      {
        id: "faq",
        heading: "Frequently asked questions",
        blocks: [
          {
            t: "faq",
            items: [
              {
                q: "How does Kairo help with time blindness?",
                a: "Every task can carry a duration estimate, and the AI adds one when your capture implies it. Seeing \"today = 6.5 hours of tasks\" before you commit is a concrete counter to the feeling that everything fits.",
              },
              {
                q: "Will reminders nag me?",
                a: "Reminders fire when you set them and arrive as normal notifications, even with the app closed. There is no escalating nag, no daily summary of your failures, and no guilt copy anywhere.",
              },
              {
                q: "What if I abandon it for two weeks?",
                a: "Nothing bad. When you come back there is no wall of red, no 40-item overdue list. Fresh Start walks through what is still relevant, one calm decision at a time, and letting things go is encouraged.",
              },
              {
                q: "Is there body doubling or accountability?",
                a: "Kairo has a gentler version: share your finished day as a card with a friend who is rooting for you. Accountability by celebration, not surveillance.",
              },
            ],
          },
          {
            t: "cta",
            heading: "Try a planner that forgives",
            text: "7 days free, no card. Capture five loose thoughts tonight and notice that none of them needed a form.",
          },
        ],
      },
    ],
    related: ["why-to-do-lists-dont-work", "ai-daily-planner", "planning-fallacy"],
  },

  /* ------------------------------------------- google-calendar-ai-planner */
  {
    slug: "google-calendar-ai-planner",
    kind: "use-case",
    title: "Using an AI planner alongside Google Calendar",
    metaTitle: "Google Calendar AI Planner: What Works Today | Kairo",
    description:
      "How to pair an AI task planner with Google Calendar: calendar for meetings, Kairo for tasks. Honest status: Kairo's Google Calendar sync is planned, not shipped.",
    published: "2026-08-03",
    updated: "2026-08-03",
    keywords: ["google calendar ai planner", "ai planner google calendar", "google calendar task planner", "plan tasks google calendar"],
    sections: [
      {
        id: "answer",
        heading: "The short answer",
        blocks: [
          {
            t: "p",
            text: "The setup that works: Google Calendar stays the source of truth for meetings and appointments, and an AI planner owns the tasks, what you will actually do between those meetings. Kairo fills the task side with plain-English AI capture and a monthly planning calendar. Full honesty up front: Kairo does not sync with Google Calendar yet. The integration is on the roadmap and the button in the app says \"coming soon\". If two-way sync is a hard requirement today, Motion, Sunsama, Akiflow, and Reclaim all have it, and our comparisons cover them fairly.",
          },
        ],
      },
      {
        id: "division",
        heading: "Calendar for commitments, planner for choices",
        blocks: [
          {
            t: "p",
            text: "Google Calendar is excellent at commitments: things with a fixed time involving other people. It is famously bad as a to-do list, tasks pasted into the grid get moved, shrunk, and eventually ignored. The division of labor that survives is simple.",
          },
          {
            t: "wtable",
            head: ["Lives in Google Calendar", "Lives in Kairo"],
            rows: [
              ["Meetings, calls, appointments", "The work those meetings create"],
              ["Things with invited humans", "Things only you are waiting on"],
              ["Fixed times someone else set", "Planned times you chose and can move"],
              ["The week's skeleton", "The day's actual muscle"],
            ],
          },
          {
            t: "p",
            text: "Each morning takes two minutes: glance at the calendar's skeleton, then pick the day's tasks in Kairo around it. The AI does the clerical part, \"prep the client deck before Thursday's call, about an hour\" becomes a dated, estimated task in one sentence.",
          },
        ],
      },
      {
        id: "sync-status",
        heading: "Where Kairo's calendar sync stands",
        blocks: [
          {
            t: "p",
            text: "Kairo has its own monthly calendar of your planned days, and a Google Calendar sync is planned. We would rather say \"not yet\" here than let you discover it after signing up. When it ships, the model above stays the same, your meetings will simply appear alongside your planned tasks. Until then, plenty of people run the two-app split happily, and the honest alternative if you need sync today is in our [Kairo vs Motion](/blog/kairo-vs-motion) and [Kairo vs Sunsama](/blog/kairo-vs-sunsama) pages.",
          },
        ],
      },
      {
        id: "faq",
        heading: "Frequently asked questions",
        blocks: [
          {
            t: "faq",
            items: [
              {
                q: "Does Kairo sync with Google Calendar?",
                a: "Not yet. It is on the roadmap and the in-app button already says coming soon. This page will be updated when it ships.",
              },
              {
                q: "Which AI planners sync with Google Calendar today?",
                a: "Motion, Sunsama, Akiflow, Reclaim, and Trevor AI all offer Google Calendar integration, at prices from about 6 to 34 US dollars a month. Our best AI planners guide compares them.",
              },
              {
                q: "Why not just put tasks in Google Calendar?",
                a: "Because tasks are not events. They move, they take longer than planned, and they do not deserve a fixed slot until you choose one. A calendar full of fake events teaches you to ignore your own calendar.",
              },
              {
                q: "Can Kairo show my planned days on a calendar?",
                a: "Yes, Kairo's Calendar view shows your month with planned tasks on their days, which covers the \"see the shape of my week\" need while sync is pending.",
              },
            ],
          },
          {
            t: "cta",
            heading: "Own the space between meetings",
            text: "Try Kairo free for 7 days, no card. Keep Google Calendar for the skeleton; give the day's real work a home.",
          },
        ],
      },
    ],
    related: ["best-ai-planners-2026", "kairo-vs-motion", "time-blocking-app"],
  },
];
