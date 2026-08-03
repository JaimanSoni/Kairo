import type { Post } from "../types";

/**
 * Editorial guides. These earn links and answer-engine citations by being
 * genuinely useful without Kairo, then honest about where Kairo fits. The
 * roundups disclose that Kairo is ours in the first screen, always.
 */
export const GUIDES: Post[] = [
  /* --------------------------------------------------- best-ai-planners-2026 */
  {
    slug: "best-ai-planners-2026",
    kind: "guide",
    title: "The best AI planners in 2026, honestly compared",
    metaTitle: "Best AI Planners in 2026: Honest Comparison of 6 Apps",
    description:
      "Motion, Sunsama, Akiflow, Reclaim, Trevor AI, and Kairo compared by what each is actually best at, with real prices. Written by the Kairo team, disclosed up front.",
    published: "2026-08-03",
    updated: "2026-08-03",
    keywords: ["best ai planners", "best ai planner 2026", "ai planner comparison", "ai productivity apps"],
    sections: [
      {
        id: "answer",
        heading: "The short answer",
        blocks: [
          {
            t: "p",
            text: "There is no best AI planner, there is a best one for how you work. In 2026 the honest short list is: Motion if you want AI to auto-schedule your whole calendar, Sunsama if you want a guided daily ritual over your existing tools, Akiflow if you want a keyboard-fast universal inbox with time boxing, Reclaim if you want free calendar automation for habits, Trevor AI if you want simple drag-and-drop time blocking, and Kairo if you want plain-English capture into a calm, guilt-free day plan at a fraction of the price.",
          },
          {
            t: "note",
            text: "Disclosure: this guide is written by the team behind Kairo. We have kept the comparison factual and we list Kairo's gaps as plainly as everyone else's. Prices are what each vendor listed in August 2026, rounded; check their sites for current numbers.",
          },
        ],
      },
      {
        id: "comparison-table",
        heading: "The six at a glance",
        blocks: [
          {
            t: "wtable",
            head: ["App", "Core idea", "Monthly price (approx.)", "Best for"],
            rows: [
              ["Motion", "AI auto-schedules tasks and meetings onto your calendar", "$19 annual, $34 monthly", "Hands-off scheduling, busy calendars, teams"],
              ["Sunsama", "A guided daily planning ritual over your existing tools", "$16 annual, $20 monthly", "Mindful planning, consultants, integrators"],
              ["Akiflow", "Universal task inbox with keyboard time boxing", "$19 annual, $34 monthly", "Power users drowning in tool sprawl"],
              ["Reclaim", "Calendar automation for habits, tasks, and breaks", "Free tier, paid from about $8", "Google Calendar loyalists on a budget"],
              ["Trevor AI", "Simple drag-and-drop time blocking with AI suggestions", "Free tier, about $6 paid", "Time blocking beginners"],
              ["Kairo", "Plain-English AI capture into a forgiving daily plan", "₹199 to ₹299, about $2.50 to $3.60", "Personal planning without guilt or bloat"],
            ],
          },
        ],
      },
      {
        id: "picks",
        heading: "What each one is actually best at",
        blocks: [
          {
            t: "p",
            text: "**Motion** is the maximalist bet: feed it your tasks, deadlines, and meetings, and its scheduler continuously rearranges your calendar so everything fits. When it works it feels like a chief of staff. The costs are real too: you surrender control, the learning curve is steep, and it is among the priciest tools here. See our full [Kairo vs Motion](/blog/kairo-vs-motion) comparison.",
          },
          {
            t: "p",
            text: "**Sunsama** is the mindful one. Each morning it walks you through pulling tasks from Trello, Asana, Gmail, Slack, and friends into a realistic day, and each evening through a shutdown ritual. It is genuinely lovely and genuinely 20 dollars. If the ritual is the point, nothing else does it as well. Full comparison: [Kairo vs Sunsama](/blog/kairo-vs-sunsama).",
          },
          {
            t: "p",
            text: "**Akiflow** wins on speed. Every task from every tool lands in one inbox, and a command bar plus keyboard shortcuts make triaging and time boxing feel like a game. It shares Motion's price tag and assumes you live in many tools at once. Full comparison: [Kairo vs Akiflow](/blog/kairo-vs-akiflow).",
          },
          {
            t: "p",
            text: "**Reclaim** and **Trevor AI** are the budget calendar-native picks: Reclaim automates habits and buffers directly inside Google Calendar with a generous free tier, and Trevor makes drag-to-block planning pleasant with AI-suggested slots.",
          },
          {
            t: "p",
            text: "**Kairo**, ours, takes a different bet than all five: the AI should remove planning's clerical work, typing, dating, sorting, estimating, while you keep the decisions. Capture is one plain sentence. The day is a short chosen list, never a wall of red. Missed routines roll forward without shame. It costs about a tenth of Motion, and it is honest about its gaps: no Google Calendar sync yet, no third-party integrations, no team features.",
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
                q: "What is the best free AI planner?",
                a: "Reclaim's free tier is the strongest ongoing free plan for calendar automation. Kairo, Motion, Sunsama, and Akiflow are paid with trials; Kairo's 7-day trial needs no card.",
              },
              {
                q: "What is the cheapest AI planner worth using?",
                a: "Kairo at 199 rupees, about 2.50 dollars a month, is the cheapest full AI planner on this list, and Trevor AI at about 6 dollars is the cheapest calendar-native one.",
              },
              {
                q: "Do any of these replace a to-do list app like Todoist?",
                a: "Motion, Akiflow, and Kairo can fully replace one. Sunsama prefers to sit on top of your existing list. Reclaim and Trevor assume the list lives elsewhere.",
              },
              {
                q: "Which should a student pick?",
                a: "On price alone: Kairo or Reclaim's free tier. Kairo also has shared lists for group projects, covered in our student planner guide.",
              },
            ],
          },
          {
            t: "cta",
            heading: "See if the calm one fits",
            text: "Kairo is free for 7 days, no card. If you end up with Motion or Sunsama instead, this guide did its job.",
          },
        ],
      },
    ],
    related: ["motion-vs-sunsama-vs-akiflow-vs-kairo", "kairo-vs-motion", "best-motion-alternatives"],
  },

  /* ------------------------------------- motion-vs-sunsama-vs-akiflow-vs-kairo */
  {
    slug: "motion-vs-sunsama-vs-akiflow-vs-kairo",
    kind: "guide",
    title: "Motion vs Sunsama vs Akiflow vs Kairo: the four-way honest test",
    metaTitle: "Motion vs Sunsama vs Akiflow vs Kairo (2026 Comparison)",
    description:
      "The four daily planners compared head to head: auto-scheduling, rituals, universal inboxes, and calm AI capture, with prices and the gaps nobody advertises.",
    published: "2026-08-03",
    updated: "2026-08-03",
    keywords: ["motion vs sunsama", "sunsama vs akiflow", "motion vs akiflow", "motion sunsama akiflow comparison"],
    sections: [
      {
        id: "answer",
        heading: "The short answer",
        blocks: [
          {
            t: "p",
            text: "Motion, Sunsama, Akiflow, and Kairo solve the same problem, deciding what to do today, with four different philosophies. Motion says let the AI schedule everything. Sunsama says follow a guided ritual. Akiflow says pipe every tool into one fast inbox. Kairo says keep the human deciding and let AI kill the typing. Motion and Akiflow cost about 19 to 34 dollars monthly, Sunsama 16 to 20, and Kairo about 2.50 to 3.60.",
          },
          {
            t: "note",
            text: "Kairo is our product. The comparison below stays factual, and Kairo's missing features are listed exactly as prominently as everyone else's. Prices as listed in August 2026, rounded.",
          },
        ],
      },
      {
        id: "table",
        heading: "Head to head",
        blocks: [
          {
            t: "wtable",
            head: ["", "Motion", "Sunsama", "Akiflow", "Kairo"],
            rows: [
              ["Philosophy", "AI schedules for you", "Guided daily ritual", "One inbox, fast triage", "You decide, AI types"],
              ["Auto-scheduling", "Yes, continuous", "No, manual timebox", "No, manual timebox", "No"],
              ["Calendar sync", "Deep, two-way", "Deep, two-way", "Deep, two-way", "Planned, not shipped"],
              ["Integrations", "Calendar, email, teams", "Trello, Asana, Gmail, Slack, more", "Widest: 3,000+ via tools", "None"],
              ["Natural-language AI capture", "Partial", "Partial", "Command bar syntax", "Yes, full sentences"],
              ["Anti-guilt design", "No, deadline-driven", "Partly, mindful tone", "No", "Core principle"],
              ["Team features", "Yes", "Light", "Light", "Shared lists only"],
              ["Approx. monthly price", "$19 to $34", "$16 to $20", "$19 to $34", "$2.50 to $3.60"],
              ["Trial", "7 days, card required", "14 days", "7 days", "7 days, no card"],
            ],
          },
        ],
      },
      {
        id: "verdicts",
        heading: "Who should pick which",
        blocks: [
          {
            t: "ul",
            items: [
              "**Pick Motion** if your calendar is genuinely full and you want software to fight it for you. The auto-scheduler is the product; if you will not trust it, skip it.",
              "**Pick Sunsama** if the daily planning ritual itself is what you are missing and your tasks already live in Trello, Asana, or email. It is the most humane of the integrators.",
              "**Pick Akiflow** if you are a keyboard person with tasks scattered across five tools and triage speed is your bottleneck.",
              "**Pick Kairo** if your planning happens in your own head, you want capture to cost one sentence, and you have quit planners before because they made you feel bad. Also if 30 dollars a month for a to-do app makes you laugh.",
            ],
          },
          {
            t: "p",
            text: "The deeper pairwise comparisons live on their own pages: [Kairo vs Motion](/blog/kairo-vs-motion), [Kairo vs Sunsama](/blog/kairo-vs-sunsama), and [Kairo vs Akiflow](/blog/kairo-vs-akiflow).",
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
                q: "Which is best for ADHD?",
                a: "Opinions differ, but shame mechanics matter most: Motion's deadline pressure can backfire, Sunsama's ritual helps some people, and Kairo was explicitly designed without overdue states or broken streaks. Our ADHD planner page goes deeper.",
              },
              {
                q: "Which has the best free option?",
                a: "None of the four has a permanent free tier. Kairo's trial is the only one that never asks for a card.",
              },
              {
                q: "Can I use two of them together?",
                a: "A common pair is Kairo for personal daily planning plus the team's existing tool, Jira, Asana, Trello, for team work. Motion and Akiflow want to be your only system; pairing them defeats their point.",
              },
            ],
          },
          {
            t: "cta",
            heading: "Try the 2.50 dollar one first",
            text: "Kairo is free for 7 days with no card. Worst case, you learn what you actually need before paying 34 dollars for it.",
          },
        ],
      },
    ],
    related: ["best-ai-planners-2026", "kairo-vs-motion", "best-motion-alternatives"],
  },

  /* ------------------------------------------------ how-to-plan-your-day-with-ai */
  {
    slug: "how-to-plan-your-day-with-ai",
    kind: "guide",
    title: "How to plan your day with AI, in 10 minutes a day",
    metaTitle: "How to Plan Your Day With AI: A 10-Minute Daily Method",
    description:
      "A practical daily planning method using AI: brain dump in sentences, let the AI structure it, pick three priorities, and review without guilt. Works in any tool.",
    published: "2026-08-03",
    updated: "2026-08-03",
    keywords: ["how to plan your day with ai", "ai day planning", "plan my day", "daily planning method"],
    sections: [
      {
        id: "answer",
        heading: "The short answer",
        blocks: [
          {
            t: "p",
            text: "Planning a day with AI takes about ten minutes: two minutes dumping everything in your head into an AI planner in plain sentences, three minutes correcting what it structured, dates, times, estimates, three minutes choosing at most three priorities for the day, and two minutes at night reviewing what happened without judgment. The AI's job is the clerical work. The choosing stays yours, because no model knows what you will regret not doing.",
          },
        ],
      },
      {
        id: "method",
        heading: "The 10-minute method",
        blocks: [
          {
            t: "ol",
            items: [
              "**Dump (2 min).** Everything in your head, in sentences, into the planner: \"finish the slides by Thursday, gym at 7, reply to Nina, book the dentist sometime next week\". Do not organize while dumping; that is the AI's job now.",
              "**Correct (3 min).** Scan what the AI structured. Fix the one date it got wrong, bump an estimate you know is optimistic. Correcting is faster than creating, which is the entire trick.",
              "**Choose three (3 min).** Pick at most three tasks that would make today a win. Everything else is a bonus. This is the step people skip and the step that matters most.",
              "**Review (2 min, evening).** Check off what happened. Move what did not. No commentary, no catching up on guilt. Tomorrow's dump starts fresh.",
            ],
          },
          {
            t: "tip",
            text: "Sum your estimates before committing. If the three priorities plus the bonus pile total nine hours of focused work, the plan is fiction and you now know it at 9am instead of 6pm.",
          },
        ],
      },
      {
        id: "mistakes",
        heading: "The three ways AI planning goes wrong",
        blocks: [
          {
            t: "ul",
            items: [
              "**Letting the AI choose priorities.** Models optimize for what sounds urgent, not what you value. Use AI for structure, never for meaning.",
              "**Planning the whole day.** Blocking eight of eight hours guarantees the plan dies by noon. Plan five, keep three loose. Our piece on the [planning fallacy](/blog/planning-fallacy) explains why your estimates lie.",
              "**Re-planning as procrastination.** If you have reorganized the same task three times, the task is either scary or wrong. Do two minutes of it right now, or delete it honestly.",
            ],
          },
          {
            t: "p",
            text: "Any AI planner can run this method. In [Kairo](/blog/ai-daily-planner) the dump step is literally one text box that accepts a paragraph, and the choose step is the three-slot Spotlight, so the method is the interface.",
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
                q: "Should I plan in the morning or the night before?",
                a: "The night before wins for most people: the day starts with a decision already made, which spends no morning willpower. The 10-minute method splits fine, dump and choose at night, review in the morning.",
              },
              {
                q: "Can ChatGPT plan my day?",
                a: "It can draft one, but the plan lives in a chat: nothing persists, repeats, reminds, or rolls forward. Use a chat to think and a planner to run the day.",
              },
              {
                q: "How many tasks should a daily plan have?",
                a: "Three chosen priorities, plus whatever small stuff genuinely fits. A 15-item daily list is a backlog wearing a costume.",
              },
            ],
          },
          {
            t: "cta",
            heading: "Run the method tonight",
            text: "Kairo's free 7-day trial needs no card. Dump tomorrow into one text box before bed and wake up to a day already shaped.",
          },
        ],
      },
    ],
    related: ["ai-daily-planner", "planning-fallacy", "why-to-do-lists-dont-work"],
  },

  /* ------------------------------------------------- why-to-do-lists-dont-work */
  {
    slug: "why-to-do-lists-dont-work",
    kind: "guide",
    title: "Why to-do lists don't work, and what does",
    metaTitle: "Why To-Do Lists Don't Work (and the Fix That Does)",
    description:
      "To-do lists fail for structural reasons: infinite growth, no time dimension, and guilt compounding. Here is the psychology, and the day-first fix that works.",
    published: "2026-08-03",
    updated: "2026-08-03",
    keywords: ["why to do lists don't work", "to do list problems", "to do list alternative", "task list psychology"],
    sections: [
      {
        id: "answer",
        heading: "The short answer",
        blocks: [
          {
            t: "p",
            text: "To-do lists fail for three structural reasons, not because you lack discipline: they grow without limit so they can never be finished, they have no time dimension so a 40-item list and a free Tuesday afternoon never meet, and they compound guilt because every glance shows you everything you have not done. The fix is not a better list. It is planning days instead of maintaining lists: a short list chosen for today, a time estimate on each item, and a rule that leftover tasks reset calmly instead of accumulating as shame.",
          },
        ],
      },
      {
        id: "three-failures",
        heading: "The three structural failures",
        blocks: [
          {
            t: "p",
            text: "**Failure one: the list is infinite and the day is not.** A to-do list accepts entries forever and completes them at whatever rate your life allows. The gap between those two rates is the backlog, and it only grows. A system whose steady state is \"further behind every week\" does not need more willpower, it needs a different shape.",
          },
          {
            t: "p",
            text: "**Failure two: no time dimension.** \"Write report\" sits next to \"buy stamps\" as equals. The list knows nothing about the two hours one needs and the two minutes the other needs, so the day fills with easy two-minute wins while the report ages. Psychologists call the systematic underestimate of task time the planning fallacy, and a list without estimates runs on it exclusively. We wrote a full guide to [beating the planning fallacy](/blog/planning-fallacy).",
          },
          {
            t: "p",
            text: "**Failure three: guilt compounds.** Unfinished items do not just wait, in most apps they turn red, grow badges, and greet you en masse every morning. The Zeigarnik effect means unfinished tasks already occupy your mind rent-free; the app adds a public scoreboard. Eventually opening the list feels worse than avoiding it, and avoidance wins. This is the documented path by which most task apps get abandoned.",
          },
        ],
      },
      {
        id: "what-works",
        heading: "What works instead: plan days, not lists",
        blocks: [
          {
            t: "ul",
            items: [
              "**Today is the unit.** Each day gets a short list chosen that morning or the night before. The backlog exists but lives out of sight until planning time.",
              "**Every task gets a time cost.** Estimates turn \"can I do all this?\" from a feeling into arithmetic.",
              "**Three priorities, maximum.** Constraint is the feature. Three finished tasks that mattered beats eleven ticked trivia.",
              "**Leftovers reset without ceremony.** Yesterday's remainder gets one calm decision each, do today, later, someday, or let go, and letting go is a normal, praised outcome.",
            ],
          },
          {
            t: "p",
            text: "This day-first shape is exactly what Kairo implements, capture into an inbox, plan a short Today, estimates on everything, a morning Fresh Start sweep, and no red anywhere. But the shape matters more than the tool: you can run it on paper tomorrow morning, and it will already work better than the infinite list.",
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
                q: "Is this just GTD?",
                a: "It borrows GTD's capture-everything instinct but rejects the giant next-actions list as the daily driver. GTD tells you to trust the system; day-first planning tells you to trust today.",
              },
              {
                q: "What about people who thrive on long lists?",
                a: "They exist, and they are usually running a hidden day-first system anyway, scanning the long list each morning and mentally shortlisting. Making the shortlist explicit just removes the rescanning tax.",
              },
              {
                q: "Do paper planners avoid these failures?",
                a: "Partly. Paper naturally limits the day and hides the backlog, which is why bullet journaling works for many. What paper cannot do is estimates arithmetic, repeats, reminders, and painless rescheduling.",
              },
            ],
          },
          {
            t: "cta",
            heading: "Retire the infinite list",
            text: "Kairo is the day-first system with the clerical work automated. Free for 7 days, no card, and your backlog stays out of sight until you ask.",
          },
        ],
      },
    ],
    related: ["planning-fallacy", "how-to-plan-your-day-with-ai", "planner-for-adhd"],
  },

  /* --------------------------------------------------------- planning-fallacy */
  {
    slug: "planning-fallacy",
    kind: "guide",
    title: "How to avoid the planning fallacy (without becoming a pessimist)",
    metaTitle: "How to Avoid the Planning Fallacy: 5 Tactics That Work",
    description:
      "Why every estimate you make is optimistic, the Kahneman and Tversky research behind it, and five practical tactics to plan days that actually finish.",
    published: "2026-08-03",
    updated: "2026-08-03",
    keywords: ["planning fallacy", "avoid planning fallacy", "why am i always behind schedule", "time estimation"],
    sections: [
      {
        id: "answer",
        heading: "The short answer",
        blocks: [
          {
            t: "p",
            text: "The planning fallacy, named by psychologists Daniel Kahneman and Amos Tversky in 1979, is the systematic tendency to underestimate how long tasks will take even when you know your past estimates were wrong. You beat it with outside evidence rather than optimism: estimate from how long similar tasks actually took last time, multiply gut estimates by 1.5, plan at most five focused hours into an eight hour day, and track actual durations so next week's guesses inherit this week's reality.",
          },
        ],
      },
      {
        id: "why",
        heading: "Why your brain does this",
        blocks: [
          {
            t: "p",
            text: "When you estimate a task you imagine the best-case path: the version where the file opens, the answer is where you expected, and nobody messages you. Kahneman called this the inside view. The outside view, how long did things like this actually take, lives in your memory but does not volunteer. The famous demonstration: students asked to estimate their thesis completion \"if everything goes as badly as it possibly could\" still finished later than that worst-case guess.",
          },
          {
            t: "p",
            text: "Two details make it stubborn. It survives experience, knowing about the fallacy does not stop it, and it is asymmetric, tasks run late far more often than early, so errors never cancel out. A plan of eight optimistic estimates is not slightly wrong, it is compounding fiction.",
          },
        ],
      },
      {
        id: "tactics",
        heading: "Five tactics that actually work",
        blocks: [
          {
            t: "ol",
            items: [
              "**Use reference-class estimates.** Before guessing, ask \"how long did the last one like this take?\" Your history outpredicts your imagination every time.",
              "**Multiply by 1.5, mechanically.** Feels like two hours, write three. Do not negotiate; the multiplier exists because negotiation is the fallacy talking.",
              "**Cap the planned day at five focused hours.** Meetings, messages, and life claim the rest whether you budget them or not. An eight hour plan is a resignation letter to your evening.",
              "**Write the estimate down and compare after.** The gap between guessed and actual is the only teacher. Tracking it for two weeks recalibrates you more than any technique.",
              "**Split anything over two hours.** Big tasks hide their surprises inside. \"Redo the website\" cannot be estimated; \"draft the pricing page copy\" can.",
            ],
          },
          {
            t: "tip",
            text: "In Kairo every task carries an estimate, the AI proposes one from your phrasing, the day view sums them against realistic capacity, and the focus timer records what actually happened. The tactics above stop being discipline and become the interface.",
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
                q: "Is the planning fallacy the same as being bad at time management?",
                a: "No. It is a documented cognitive bias that affects experts and novices equally. The fix is structural, outside-view estimates and buffers, not trying harder.",
              },
              {
                q: "Does the planning fallacy apply to teams?",
                a: "It gets worse in teams: optimistic estimates stack across dependencies, and social pressure rewards confident numbers. Reference-class forecasting was developed for exactly this, originally for infrastructure megaprojects.",
              },
              {
                q: "What multiplier should I use?",
                a: "Start at 1.5 for familiar work and 2 for novel work, then let two weeks of tracked actuals tune it. Your personal multiplier is an empirical fact, not a personality trait.",
              },
            ],
          },
          {
            t: "cta",
            heading: "Plan a day that finishes",
            text: "Kairo puts estimates on everything and shows you the arithmetic before the day starts. Free for 7 days, no card.",
          },
        ],
      },
    ],
    related: ["why-to-do-lists-dont-work", "how-to-plan-your-day-with-ai", "deep-work-schedule-template"],
  },

  /* ---------------------------------------------- deep-work-schedule-template */
  {
    slug: "deep-work-schedule-template",
    kind: "guide",
    title: "A deep work schedule template you can start tomorrow",
    metaTitle: "Deep Work Schedule Template: A Realistic Daily Structure",
    description:
      "A copy-ready deep work daily template: two 90-minute blocks, a shallow-work window, and a shutdown ritual, with the reasoning and the common failure modes.",
    published: "2026-08-03",
    updated: "2026-08-03",
    keywords: ["deep work schedule", "deep work template", "deep work routine", "focus schedule"],
    sections: [
      {
        id: "answer",
        heading: "The short answer",
        blocks: [
          {
            t: "p",
            text: "A sustainable deep work schedule is two 90-minute focus blocks a day, one mid-morning and one early afternoon, separated by real breaks, with all shallow work, messages, email, admin, batched into one bounded window and a written shutdown at day's end. That is three hours of deep work daily, which sounds modest and is roughly the trained maximum most knowledge workers sustain; Cal Newport, who coined the term, puts the ceiling around four hours even for professionals.",
          },
        ],
      },
      {
        id: "template",
        heading: "The template",
        blocks: [
          {
            t: "wtable",
            head: ["Time", "Block", "Rules"],
            rows: [
              ["8:30 to 9:00", "Plan and warm up", "Choose the day's one deep task. Coffee, notes open, phone elsewhere."],
              ["9:00 to 10:30", "Deep block 1", "One task. Notifications off. Internet only if the task needs it."],
              ["10:30 to 11:00", "Real break", "Walk, food, anything without a screen. Not email."],
              ["11:00 to 12:30", "Deep block 2", "Same task or the next hardest. Protect it from meetings."],
              ["12:30 to 14:00", "Lunch and slack", "Genuinely off. The afternoon depends on it."],
              ["14:00 to 16:00", "Shallow window", "All email, messages, admin, and meetings, batched here."],
              ["16:00 to 16:30", "Shutdown", "Tick off, move leftovers to tomorrow, write tomorrow's deep task down, close the lid."],
            ],
          },
          {
            t: "note",
            text: "Adapt the clock, not the structure. Night people shift everything three hours; parents split the blocks around school runs. The invariants are: deep before shallow, breaks that are actually breaks, and a shutdown that ends the day on purpose.",
          },
        ],
      },
      {
        id: "failure-modes",
        heading: "Where this template usually breaks",
        blocks: [
          {
            t: "ul",
            items: [
              "**The 9am inbox peek.** One look and the morning belongs to other people's priorities. The template's first block starts before email opens, that ordering is the whole trick.",
              "**Fake breaks.** Scrolling is not rest; attention residue carries into block two. Newport's research point is that focus is depleted by context switches, not by minutes worked.",
              "**Unbounded shallow work.** Without the 2pm fence, admin metastasizes across the day. Give it a window and it obediently shrinks to fit.",
              "**No shutdown.** Open loops follow you home and tomorrow starts with re-deciding everything. The written handoff to tomorrow is what lets the brain release it, the Zeigarnik effect works for you once the task has a plan.",
            ],
          },
          {
            t: "p",
            text: "To run this template in Kairo: make the two deep blocks recurring tasks with 90 minute estimates and planned times, run each with the focus timer, and let the shutdown be Kairo's evening check-off plus tomorrow's Spotlight pick. Engineers, we wrote a variant for you: [time blocking for software engineers](/blog/time-blocking-for-software-engineers).",
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
                q: "How many hours of deep work per day is realistic?",
                a: "Three to four for a trained practitioner, one to two when starting. Scheduling more does not produce more; it produces fake deep work with a phone in it.",
              },
              {
                q: "What counts as deep work?",
                a: "Anything cognitively demanding that creates value and cannot be done while distracted: writing, coding, design, analysis, studying. If you could do it in a waiting room, it is shallow.",
              },
              {
                q: "What if my job is meetings?",
                a: "Defend one 90-minute block, mornings win, and batch meetings after lunch where possible. One protected block daily compounds into a different career within a year.",
              },
            ],
          },
          {
            t: "cta",
            heading: "Install the template in five minutes",
            text: "Kairo's repeats, estimates, and focus timer run this schedule out of the box. Free for 7 days, no card.",
          },
        ],
      },
    ],
    related: ["time-blocking-for-software-engineers", "time-blocking-app", "planning-fallacy"],
  },

  /* --------------------------------------- time-blocking-for-software-engineers */
  {
    slug: "time-blocking-for-software-engineers",
    kind: "guide",
    title: "Time blocking for software engineers who get interrupted",
    metaTitle: "Time Blocking for Software Engineers: A Realistic Guide",
    description:
      "A time blocking system that survives standups, code review, and incidents: maker blocks, an interrupt budget, and honest estimates. Template included.",
    published: "2026-08-03",
    updated: "2026-08-03",
    keywords: ["time blocking for engineers", "time blocking software developer", "maker schedule", "developer productivity"],
    sections: [
      {
        id: "answer",
        heading: "The short answer",
        blocks: [
          {
            t: "p",
            text: "Time blocking works for software engineers only if it plans for interruption instead of pretending it away. The version that survives: two protected maker blocks of 90 to 120 minutes for real engineering, standup and meetings batched against lunch so they cannot split a morning, an explicit daily interrupt budget of about an hour for review requests and questions, and estimates multiplied by 1.5 because engineering estimates are famously optimistic. Paul Graham's maker's schedule essay explains the core truth: a single meeting placed mid-morning costs the whole morning.",
          },
        ],
      },
      {
        id: "template",
        heading: "A day that survives contact with Slack",
        blocks: [
          {
            t: "wtable",
            head: ["Time", "Block", "Notes"],
            rows: [
              ["9:00 to 9:15", "Plan + triage", "Pick today's one meaty task. Skim, do not answer, the overnight pings."],
              ["9:15 to 11:15", "Maker block 1", "The hard thing. Slack closed, not snoozed, closed."],
              ["11:15 to 12:00", "Interrupt budget", "Code reviews, questions, unblocking teammates. Bounded, so it cannot eat the day."],
              ["12:00 to 13:30", "Lunch + standup + meetings", "Meetings batched against lunch split nothing."],
              ["13:30 to 15:00", "Maker block 2", "Second push, or finishing block 1 honestly."],
              ["15:00 to 16:30", "Shallow work", "Email, tickets, PR comments, docs, small fixes."],
              ["16:30 to 17:00", "Shutdown", "Push the branch, write tomorrow's first task down, close the laptop on purpose."],
            ],
          },
        ],
      },
      {
        id: "principles",
        heading: "The rules behind the template",
        blocks: [
          {
            t: "ul",
            items: [
              "**Protect mornings, concede afternoons.** Deep engineering quality tracks the first clean 2-hour block. Fight for one; be generous with the rest.",
              "**Budget interruptions instead of banning them.** \"No interruptions\" fails in any real team and makes you the blocker. A bounded window keeps you a good teammate at a fixed price.",
              "**Estimates get the 1.5x tax.** The task that feels like an afternoon is two days. Write the honest number and the plan stops lying; our [planning fallacy guide](/blog/planning-fallacy) has the research.",
              "**One meaty task per day.** Shipping one hard thing daily is a phenomenal pace. Three half-touched hard things is a bad week wearing a busy costume.",
            ],
          },
          {
            t: "p",
            text: "Running this in Kairo: the maker blocks are recurring tasks with planned times and estimates, captured once. Mid-flow discoveries, \"that retry logic needs a fix too\", go in through one-sentence capture without leaving the editor, and the focus timer keeps the block honest. The general version of this system is our [time blocking app guide](/blog/time-blocking-app).",
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
                q: "How do I time block with daily standups?",
                a: "Anchor standup against another boundary, start of day, end of lunch, so it fences a block instead of splitting one. A 10:30 standup in the middle of the morning costs far more than its fifteen minutes.",
              },
              {
                q: "What about on-call and incidents?",
                a: "On-call days are not maker days; plan them as pure interrupt budget and shallow work, and protect zero blocks. Pretending an on-call day is normal is how both the plan and the incident response go badly.",
              },
              {
                q: "Do I need my calendar to enforce blocks?",
                a: "Public calendar blocks help in meeting-heavy orgs. The private plan matters more: knowing today's one meaty task beats any colored rectangle.",
              },
            ],
          },
          {
            t: "cta",
            heading: "Block tomorrow's maker morning",
            text: "Kairo is free for 7 days, no card. Capture your maker blocks once and let them recur.",
          },
        ],
      },
    ],
    related: ["deep-work-schedule-template", "daily-planner-for-developers", "planning-fallacy"],
  },

  /* ----------------------------------------------- ai-planner-for-college-students */
  {
    slug: "ai-planner-for-college-students",
    kind: "guide",
    title: "An AI planner workflow for college students",
    metaTitle: "AI Planner for College Students: The Semester System",
    description:
      "How to run a whole semester with an AI planner: dump the syllabus in week one, plan in weekly sweeps, count down to exams, and share group project lists.",
    published: "2026-08-03",
    updated: "2026-08-03",
    keywords: ["ai planner for students", "college planner app", "semester planning", "study planner ai"],
    sections: [
      {
        id: "answer",
        heading: "The short answer",
        blocks: [
          {
            t: "p",
            text: "The AI planner workflow that survives a college semester has four habits: dump every syllabus date into the planner in week one, in plain sentences the AI can file; run a ten minute weekly sweep every Sunday to plan the week from what is coming; work backward from exams with countdown tasks instead of a single terrifying deadline; and give every group project a shared list so the work is visible to everyone. The tool matters less than the habits, but an AI planner makes each habit nearly free.",
          },
        ],
      },
      {
        id: "week-one",
        heading: "Week one: dump the whole semester",
        blocks: [
          {
            t: "p",
            text: "Sit down with each syllabus and type the dates as sentences: \"econ midterm October 14, essay due September 30, lab reports every second Friday\". In an AI planner this is minutes per course, the dates, repeats, and lists file themselves. From this point the semester has one source of truth, and nothing announced in week one ambushes you in week nine.",
          },
          {
            t: "tip",
            text: "Add a task for each syllabus itself: \"dump the biology syllabus into the planner\". The system should schedule its own setup.",
          },
        ],
      },
      {
        id: "rhythm",
        heading: "The weekly rhythm that does the real work",
        blocks: [
          {
            t: "ol",
            items: [
              "**Sunday sweep (10 min).** Look at the two weeks ahead. Pull what matters into the coming days, three or four items per day, no more.",
              "**Exam countdowns.** Three weeks out from every exam, add \"revise chapter X\" tasks spread across days. An exam with fifteen small dated tasks in front of it is a plan; an exam with one red deadline is a panic scheduled in advance.",
              "**Daily pick.** Each morning, star the day's honest top three. Lectures already own part of the day; respect that in the count.",
              "**Let bad weeks reset.** Fell apart during fest week? A forgiving planner asks one question per leftover task and moves on. The system surviving matters more than any single week.",
            ],
          },
        ],
      },
      {
        id: "groups",
        heading: "Group projects: make the work visible",
        blocks: [
          {
            t: "p",
            text: "Every group project deserves a shared list with the work broken into named, assigned tasks. In Kairo, teammates join a shared list from just an email invite, no existing account needed, and everyone sees the same truth. \"I thought you had the slides\" is a visibility bug, and shared lists patch it. Costs matter for students too: Kairo runs 199 rupees a month after a free no-card trial, while the popular US planners run 16 to 34 dollars; the full picture is in our [student daily planner page](/blog/daily-planner-for-students) and [best AI planners guide](/blog/best-ai-planners-2026).",
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
                q: "Is an AI planner worth it over Google Calendar plus notes?",
                a: "Calendar plus notes handles commitments fine and tasks badly: no estimates, no rollover, no repeats for revision. The AI planner earns its place at capture time, one sentence per syllabus line, and at reset time after bad weeks.",
              },
              {
                q: "How do I plan revision with AI?",
                a: "Type it as intent: \"revise thermodynamics one chapter a day for the week before the midterm\". The AI spreads dated tasks; you adjust. Small dated tasks beat one giant \"STUDY\" block every time.",
              },
              {
                q: "What about part-time work and society commitments?",
                a: "They go in as repeats like everything else. The point of one system is that Tuesday shows the lab, the shift, and the essay session together, so conflicts appear on the screen instead of in person.",
              },
            ],
          },
          {
            t: "cta",
            heading: "Set up the semester in one evening",
            text: "Kairo is free for 7 days, no card. Dump one syllabus tonight; future you sits exams calmer.",
          },
        ],
      },
    ],
    related: ["daily-planner-for-students", "how-to-plan-your-day-with-ai", "planning-fallacy"],
  },
];
