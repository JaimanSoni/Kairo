import type { Post } from "../types";

/**
 * Pairwise comparison pages. The rule for all of these: Kairo's gaps are
 * stated as plainly as the competitor's, prices carry a checked-on date, and
 * every page names the reader who should pick the other tool. Google and
 * answer engines reward comparison content exactly to the degree it is
 * willing to lose the sale.
 */
export const COMPARISONS: Post[] = [
  /* ---------------------------------------------------------- kairo-vs-motion */
  {
    slug: "kairo-vs-motion",
    kind: "comparison",
    title: "Kairo vs Motion: control vs autopilot",
    metaTitle: "Kairo vs Motion (2026): Honest Comparison by Kairo",
    description:
      "Motion auto-schedules your calendar with AI for about $19 to $34 a month. Kairo keeps you deciding and costs about $3. An honest comparison by the Kairo team.",
    published: "2026-08-03",
    updated: "2026-08-03",
    keywords: ["kairo vs motion", "motion alternative", "motion app comparison", "usemotion review"],
    sections: [
      {
        id: "answer",
        heading: "The short answer",
        blocks: [
          {
            t: "p",
            text: "Motion and Kairo automate opposite halves of planning. Motion's AI takes over scheduling itself: it places your tasks on your calendar, reshuffles them when meetings land, and drives your day from deadlines. Kairo's AI takes over the clerical work, turning plain sentences into dated, estimated, sorted tasks, while you keep deciding what the day looks like. Motion costs about 19 dollars a month billed annually or 34 monthly; Kairo costs 199 to 299 rupees, about 2.50 to 3.60 dollars. Pick Motion for a packed calendar you want machine-managed. Pick Kairo for a calm day you want to own.",
          },
          {
            t: "note",
            text: "Kairo is our product, so read accordingly. We have kept every claim checkable, and the \"pick Motion\" list below is real. Prices are as listed by each vendor in August 2026 and change; check their sites.",
          },
        ],
      },
      {
        id: "table",
        heading: "Side by side",
        blocks: [
          {
            t: "wtable",
            head: ["", "Motion", "Kairo"],
            rows: [
              ["Core promise", "AI schedules everything for you", "AI types, you decide"],
              ["Auto-scheduling", "Yes, continuous reshuffling", "No"],
              ["Calendar sync", "Deep two-way Google and Outlook", "Planned, not shipped yet"],
              ["Natural-language capture", "Partial", "Full sentences, dates, estimates, lists"],
              ["Project and team tools", "Yes: projects, workflows, team plans", "Shared lists only"],
              ["Meeting scheduler", "Yes, booking links", "No"],
              ["Overdue pressure", "Deadline-driven by design", "No overdue state exists"],
              ["Price per month", "About $19 annual, $34 monthly", "₹199 to ₹299, about $2.50 to $3.60"],
              ["Trial", "7 days, card required", "7 days, no card"],
              ["Platforms", "Web, desktop, mobile apps", "Web, installable on phone"],
            ],
          },
        ],
      },
      {
        id: "pick-motion",
        heading: "Pick Motion if",
        blocks: [
          {
            t: "ul",
            items: [
              "Your calendar is genuinely full and reshuffling it by hand is a daily tax worth 30 dollars to delete.",
              "You manage a team's workload and want capacity planning and shared projects in the same tool.",
              "You want booking links and meeting scheduling built into the planner.",
              "You like deadline pressure and trust an optimizer with your hours. Motion's users who love it, love exactly this.",
            ],
          },
        ],
      },
      {
        id: "pick-kairo",
        heading: "Pick Kairo if",
        blocks: [
          {
            t: "ul",
            items: [
              "You have tried autopilot planning and found yourself fighting the robot, dragging blocks back where you wanted them.",
              "Capture speed matters more than scheduling automation: one sentence in Kairo does what a five-field form does elsewhere.",
              "Deadline pressure demotivates you. Kairo has no overdue red at all, and missed routines roll forward quietly.",
              "The price difference matters: a year of Kairo costs about one month of Motion.",
            ],
          },
          {
            t: "p",
            text: "Honest gaps on our side: Kairo does not sync with Google Calendar yet (it is on the roadmap), has no meeting scheduler, no native mobile apps, and no team workload features. If any of those is a dealbreaker, Motion or the tools in our [best Motion alternatives](/blog/best-motion-alternatives) guide will serve you better.",
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
                q: "Is Kairo a Motion alternative?",
                a: "For personal daily planning, yes, and a far cheaper one. For team capacity planning and auto-scheduling, no; those are Motion's moat and Kairo does not attempt them.",
              },
              {
                q: "Why is Motion so much more expensive?",
                a: "You are paying for the scheduling engine, calendar infrastructure, and team features. If you use them, it is fair value. If you only need a personal daily plan, you are paying for a factory to make a sandwich.",
              },
              {
                q: "Can I migrate from Motion to Kairo?",
                a: "There is no importer; most people re-capture their active tasks in a few minutes of brain dump, which doubles as a cleanup. Backlogs rarely deserve migration.",
              },
            ],
          },
          {
            t: "cta",
            heading: "Try the 3 dollar side of the argument",
            text: "Kairo is free for 7 days, no card required. If you end up on Motion, at least the week cost nothing.",
          },
        ],
      },
    ],
    related: ["best-motion-alternatives", "motion-vs-sunsama-vs-akiflow-vs-kairo", "best-ai-planners-2026"],
  },

  /* --------------------------------------------------------- kairo-vs-sunsama */
  {
    slug: "kairo-vs-sunsama",
    kind: "comparison",
    title: "Kairo vs Sunsama: two calm planners, one big price gap",
    metaTitle: "Kairo vs Sunsama (2026): Honest Comparison by Kairo",
    description:
      "Sunsama's guided daily ritual costs about $16 to $20 a month. Kairo reaches a similar calm with AI capture at about $3. The differences that actually matter.",
    published: "2026-08-03",
    updated: "2026-08-03",
    keywords: ["kairo vs sunsama", "sunsama alternative", "sunsama review", "sunsama comparison"],
    sections: [
      {
        id: "answer",
        heading: "The short answer",
        blocks: [
          {
            t: "p",
            text: "Kairo and Sunsama are the two planners in this space that treat calm as the goal, and they reach it differently. Sunsama is a guided ritual: each morning it walks you through pulling tasks from your other tools, Trello, Asana, Gmail, Slack, into a realistic timeboxed day on your calendar, and each evening through a shutdown. Kairo is a home: your tasks live in it, arrive by plain-sentence AI capture, and the calm comes from the structure, no overdue states, a short chosen Today, forgiving resets. Sunsama costs about 16 to 20 dollars a month; Kairo about 2.50 to 3.60.",
          },
          {
            t: "note",
            text: "Kairo is our product. We genuinely like Sunsama, the honest cases for it are below, and prices are as listed in August 2026.",
          },
        ],
      },
      {
        id: "table",
        heading: "Side by side",
        blocks: [
          {
            t: "wtable",
            head: ["", "Sunsama", "Kairo"],
            rows: [
              ["Core idea", "Guided daily ritual over your tools", "A calm home for your tasks"],
              ["Where tasks live", "Pulled from Trello, Asana, Gmail, Slack, more", "In Kairo, captured by AI"],
              ["Calendar sync", "Deep two-way, timeboxing on the grid", "Planned, not shipped yet"],
              ["Guided planning ceremony", "Yes, morning and shutdown rituals", "Lighter: Fresh Start sweep each morning"],
              ["AI capture", "Limited", "Full sentences to dated, estimated tasks"],
              ["Anti-guilt design", "Partly, the tone is mindful", "Structural: no overdue state at all"],
              ["Team features", "Light collaboration", "Shared lists with assignment"],
              ["Price per month", "About $16 annual, $20 monthly", "₹199 to ₹299, about $2.50 to $3.60"],
              ["Trial", "14 days", "7 days, no card"],
            ],
          },
        ],
      },
      {
        id: "pick-sunsama",
        heading: "Pick Sunsama if",
        blocks: [
          {
            t: "ul",
            items: [
              "Your work already lives in Trello, Asana, Jira, or a full inbox, and re-typing tasks anywhere is a dealbreaker. Sunsama's integrations are its moat.",
              "You want to timebox onto the actual calendar grid your meetings live on, today, not when a sync ships.",
              "The ceremony is the product for you: being walked through planning and shutdown daily is worth 20 dollars.",
            ],
          },
        ],
      },
      {
        id: "pick-kairo",
        heading: "Pick Kairo if",
        blocks: [
          {
            t: "ul",
            items: [
              "Your tasks come from your own head more than from other tools, which is most people outside client work.",
              "Capture speed is the bottleneck: one sentence with a date, time, and estimate beats dragging cards between tools.",
              "You want the calm without the subscription guilt: 2.50 versus 20 dollars is an eightfold gap for a solo budget.",
              "You sometimes disappear for a week. Kairo's reset is structural, not a ritual you fell off.",
            ],
          },
          {
            t: "p",
            text: "Kairo's honest gaps against Sunsama: no third-party integrations, no calendar sync yet, no guided shutdown ritual. If you need the integrations, Sunsama is the better tool and our [best AI planners guide](/blog/best-ai-planners-2026) covers the rest of the field.",
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
                q: "Is Kairo a cheaper Sunsama?",
                a: "Only partly. They share the calm philosophy, but Sunsama is an orchestrator of other tools and Kairo is a self-contained planner with stronger AI capture. Cheaper, yes; a clone, no.",
              },
              {
                q: "Does either work without a calendar?",
                a: "Kairo fully, it has its own monthly calendar view. Sunsama leans hard on your Google or Outlook calendar; without one you lose much of its point.",
              },
              {
                q: "Which is better for ADHD?",
                a: "Both are kinder than deadline-driven tools. Kairo goes further structurally, no overdue states, no streaks, one-sentence capture, which our ADHD planner page explains in depth.",
              },
            ],
          },
          {
            t: "cta",
            heading: "Feel the difference in a week",
            text: "Kairo is free for 7 days with no card. Run your mornings in it; keep Sunsama's tab open and see which one you reach for.",
          },
        ],
      },
    ],
    related: ["kairo-vs-motion", "kairo-vs-akiflow", "best-ai-planners-2026"],
  },

  /* --------------------------------------------------------- kairo-vs-akiflow */
  {
    slug: "kairo-vs-akiflow",
    kind: "comparison",
    title: "Kairo vs Akiflow: one inbox for everything vs one calm day",
    metaTitle: "Kairo vs Akiflow (2026): Honest Comparison by Kairo",
    description:
      "Akiflow pipes every tool into one keyboard-fast inbox for about $19 to $34 a month. Kairo captures from your head for about $3. Which consolidation do you need?",
    published: "2026-08-03",
    updated: "2026-08-03",
    keywords: ["kairo vs akiflow", "akiflow alternative", "akiflow review", "akiflow comparison"],
    sections: [
      {
        id: "answer",
        heading: "The short answer",
        blocks: [
          {
            t: "p",
            text: "Akiflow and Kairo both fight scatter, but a different scatter. Akiflow consolidates tools: tasks from Slack, Gmail, Notion, Jira, and thousands more land in one inbox you triage at keyboard speed and timebox onto your calendar. Kairo consolidates attention: whatever is in your head becomes a structured task from one plain sentence, and the day stays a short, chosen, guilt-free list. Akiflow costs about 19 dollars a month billed annually or 34 monthly; Kairo about 2.50 to 3.60. The question that decides it: is your chaos in your tools, or in your head?",
          },
          {
            t: "note",
            text: "Kairo is our product. Akiflow is excellent at what it does, and the cases for it below are genuine. Prices as listed in August 2026.",
          },
        ],
      },
      {
        id: "table",
        heading: "Side by side",
        blocks: [
          {
            t: "wtable",
            head: ["", "Akiflow", "Kairo"],
            rows: [
              ["Core idea", "Universal inbox for all your tools", "Calm daily planner for your own tasks"],
              ["Integrations", "Very wide: Slack, Gmail, Notion, Jira, more", "None"],
              ["Capture", "Command bar with syntax, forwarding", "Plain sentences, AI fills everything"],
              ["Time boxing", "Drag to calendar, keyboard-first", "Planned times and estimates, no grid"],
              ["Calendar sync", "Deep two-way", "Planned, not shipped yet"],
              ["Daily rituals", "Yes, guided rituals feature", "Fresh Start morning sweep"],
              ["Anti-guilt design", "No, productivity-maximalist tone", "Core principle, no overdue state"],
              ["Price per month", "About $19 annual, $34 monthly", "₹199 to ₹299, about $2.50 to $3.60"],
              ["Trial", "7 days", "7 days, no card"],
            ],
          },
        ],
      },
      {
        id: "pick-akiflow",
        heading: "Pick Akiflow if",
        blocks: [
          {
            t: "ul",
            items: [
              "Your tasks genuinely arrive in five tools and forwarding them into one inbox would delete a real daily tax.",
              "You are a keyboard maximalist: Akiflow's command bar and shortcuts are the fastest triage in the category.",
              "You timebox onto a shared calendar and need the grid to be the single source of truth today.",
            ],
          },
        ],
      },
      {
        id: "pick-kairo",
        heading: "Pick Kairo if",
        blocks: [
          {
            t: "ul",
            items: [
              "Most of your tasks are born in your head, errands, ideas, personal projects, follow-ups, not in Slack threads.",
              "You want the AI to do the structuring: \"dentist next Tuesday morning, and start the tax folder this weekend\" files itself.",
              "Productivity-tool intensity burns you out. Kairo is deliberately quiet: no badges, no overdue, three Spotlight slots.",
              "You want under 4 dollars a month, paid month by month, with nothing auto-renewing.",
            ],
          },
          {
            t: "p",
            text: "Kairo's honest gaps against Akiflow: no integrations, no calendar sync yet, no command-bar power syntax. If your life runs through many tools, Akiflow earns its price, and the wider field is in our [best AI planners guide](/blog/best-ai-planners-2026).",
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
                q: "Is Kairo faster than Akiflow at capture?",
                a: "Different fast. Akiflow triages existing items faster; Kairo creates from scratch faster, one sentence with no syntax versus command-bar tokens. Head-born tasks favor Kairo, tool-born tasks favor Akiflow.",
              },
              {
                q: "Do I need both?",
                a: "Some people run Akiflow for work-tool chaos and Kairo for personal life. It works, though most people's chaos is dominated by one kind and one tool wins.",
              },
              {
                q: "Which is better for students?",
                a: "Students rarely have the five-tool problem Akiflow solves and always have budgets. Kairo at 199 rupees with shared lists for group projects is the practical pick; our student planner page has the full case.",
              },
            ],
          },
          {
            t: "cta",
            heading: "Consolidate the chaos that is actually yours",
            text: "If it lives in your head, Kairo will catch it in a sentence. Free for 7 days, no card.",
          },
        ],
      },
    ],
    related: ["kairo-vs-motion", "kairo-vs-sunsama", "motion-vs-sunsama-vs-akiflow-vs-kairo"],
  },

  /* ------------------------------------------------- best-motion-alternatives */
  {
    slug: "best-motion-alternatives",
    kind: "comparison",
    title: "The best Motion alternatives in 2026, by what you actually miss",
    metaTitle: "Best Motion Alternatives 2026: 6 Options by Use Case",
    description:
      "Leaving Motion? The best alternative depends on what you used: Reclaim for auto-scheduling, Sunsama for ritual, Akiflow for speed, Kairo for calm and price.",
    published: "2026-08-03",
    updated: "2026-08-03",
    keywords: ["motion alternative", "motion alternatives", "apps like motion", "usemotion alternative"],
    sections: [
      {
        id: "answer",
        heading: "The short answer",
        blocks: [
          {
            t: "p",
            text: "The best Motion alternative depends on which part of Motion you actually used. If it was the auto-scheduling, Reclaim is the closest and far cheaper, with Trevor AI as the lightweight option. If it was the daily structure, Sunsama's guided ritual is better than Motion ever was at it. If it was speed, Akiflow. If what you want is out of the auto-scheduling business entirely, a calm planner where you decide and AI handles the typing, that is Kairo, at about a tenth of Motion's price. TickTick and Todoist remain the budget generalists.",
          },
          {
            t: "note",
            text: "Disclosure: this page is by the Kairo team and includes our own product. Every alternative's real strength is stated, and prices are as listed in August 2026, rounded.",
          },
        ],
      },
      {
        id: "table",
        heading: "The alternatives at a glance",
        blocks: [
          {
            t: "wtable",
            head: ["Alternative", "Keeps from Motion", "Monthly price (approx.)", "Best when"],
            rows: [
              ["Reclaim", "Auto-scheduling on Google Calendar", "Free tier, paid from $8", "You loved the robot, not the bill"],
              ["Trevor AI", "Time blocking with AI suggestions", "Free tier, about $6", "You want light auto-blocking"],
              ["Sunsama", "Daily planning structure", "$16 to $20", "You want ritual over automation"],
              ["Akiflow", "Speed and consolidation", "$19 to $34", "Your tasks live in many tools"],
              ["Kairo", "A planned day, minus the pressure", "About $2.50 to $3.60", "You want calm, AI capture, and a sane price"],
              ["TickTick / Todoist", "A solid classic to-do list", "$3 to $6", "You realize you never needed AI scheduling"],
            ],
          },
        ],
      },
      {
        id: "why-people-leave",
        heading: "Why people leave Motion, and what that predicts",
        blocks: [
          {
            t: "p",
            text: "Three exit stories repeat. **\"It kept rescheduling things I did not want moved\"**: you want control back, look at Sunsama for structured manual planning or Kairo for lightweight manual planning with AI capture. **\"It was too expensive for what I used\"**: you used a fraction of the feature set, Reclaim's free tier or Kairo's 3 dollars will likely cover that fraction. **\"It stressed me out\"**: the deadline-driven optimizer turned the calendar into a boss, and the anti-guilt design in Kairo, no overdue states, forgiving resets, is the direct counter. Our [Kairo vs Motion](/blog/kairo-vs-motion) page goes deeper on that trade.",
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
                q: "What is the closest free Motion alternative?",
                a: "Reclaim's free tier covers habit and task auto-scheduling on Google Calendar and is the only serious free automation option. Nothing free replicates Motion's project management.",
              },
              {
                q: "What is the cheapest Motion alternative?",
                a: "Among AI planners, Kairo at about 2.50 dollars a month. Among classic to-do apps, Todoist's free tier or TickTick at about 3 dollars.",
              },
              {
                q: "I mainly used Motion for meeting booking links. What replaces that?",
                a: "A dedicated scheduler does it better: Calendly, Cal.com, or Google's own appointment scheduling. None of the planner alternatives here does booking links well.",
              },
              {
                q: "Does Kairo auto-schedule like Motion?",
                a: "No, deliberately. Kairo's bet is that you place your own tasks and the AI removes the typing instead. People leaving Motion because of the robot tend to want exactly this; people leaving over price but loving the robot should pick Reclaim.",
              },
            ],
          },
          {
            t: "cta",
            heading: "Downgrade the price, not the plan",
            text: "Kairo is free for 7 days, no card, and about a tenth of Motion's price after. See if calm suits you.",
          },
        ],
      },
    ],
    related: ["kairo-vs-motion", "best-ai-planners-2026", "motion-vs-sunsama-vs-akiflow-vs-kairo"],
  },
];
