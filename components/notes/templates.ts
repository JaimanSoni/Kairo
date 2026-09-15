import type { JNode } from "@/lib/doc-model";

/**
 * Starting points for a blank page. Each is only a shape — headings, a
 * checklist, a table — never filler text a person has to delete first.
 * Icons are keys into Kairo's 3D set, for the page and for its callouts.
 */

export type Template = {
  id: string;
  name: string;
  icon: string;
  hint: string;
  title: string;
  doc: JNode;
};

const t = (text: string, marks?: JNode["marks"]): JNode => ({ type: "text", text, ...(marks ? { marks } : {}) });
const p = (...content: JNode[]): JNode => (content.length ? { type: "paragraph", content } : { type: "paragraph" });
const h = (level: 1 | 2 | 3, text: string): JNode => ({ type: "heading", attrs: { level }, content: [t(text)] });
const bullets = (...items: string[]): JNode => ({
  type: "bulletList",
  content: items.map((i) => ({ type: "listItem", content: [i ? p(t(i)) : p()] })),
});
const todos = (...items: string[]): JNode => ({
  type: "taskList",
  content: items.map((i) => ({ type: "taskItem", attrs: { checked: false }, content: [i ? p(t(i)) : p()] })),
});
const numbered = (...items: string[]): JNode => ({
  type: "orderedList",
  attrs: { start: 1 },
  content: items.map((i) => ({ type: "listItem", content: [i ? p(t(i)) : p()] })),
});
const callout = (icon: string, ...content: JNode[]): JNode => ({ type: "callout", attrs: { emoji: icon }, content });
const toggle = (summary: string, ...content: JNode[]): JNode => ({
  type: "details",
  attrs: { open: false },
  content: [{ type: "detailsSummary", content: [t(summary)] }, { type: "detailsContent", content: content.length ? content : [p()] }],
});
const cell = (type: "tableHeader" | "tableCell", text: string): JNode => ({
  type,
  attrs: { colspan: 1, rowspan: 1, colwidth: null },
  content: [text ? p(t(text)) : p()],
});
const table = (header: string[], rows: number): JNode => ({
  type: "table",
  content: [
    { type: "tableRow", content: header.map((x) => cell("tableHeader", x)) },
    ...Array.from({ length: rows }, () => ({ type: "tableRow", content: header.map(() => cell("tableCell", "")) })),
  ],
});
const doc = (...content: JNode[]): JNode => ({ type: "doc", content });

export const TEMPLATES: Template[] = [
  {
    id: "meeting",
    name: "Meeting notes",
    icon: "pencil",
    hint: "Who, what, and who does what next",
    title: "Meeting notes",
    doc: doc(
      h(2, "Attendees"),
      bullets(""),
      h(2, "Agenda"),
      numbered(""),
      h(2, "Notes"),
      p(),
      h(2, "Action items"),
      todos("")
    ),
  },
  {
    id: "project",
    name: "Project brief",
    icon: "flag",
    hint: "The why, the scope, the milestones",
    title: "Project brief",
    doc: doc(
      callout("list-goals", p(t("In one sentence: ", [{ type: "bold" }]))),
      h(2, "Why it matters"),
      p(),
      h(2, "Scope"),
      bullets("In:", "Out:"),
      h(2, "Milestones"),
      table(["Milestone", "Target date", "Status"], 3),
      h(2, "Open questions"),
      toggle("Risks and unknowns")
    ),
  },
  {
    id: "reading",
    name: "Reading notes",
    icon: "list-books",
    hint: "Ideas worth keeping from a book or article",
    title: "Reading notes",
    doc: doc(
      p(t("Author: ", [{ type: "bold" }])),
      p(t("Link: ", [{ type: "bold" }])),
      h(2, "Key ideas"),
      bullets(""),
      h(2, "Quotes"),
      { type: "blockquote", content: [p()] },
      h(2, "My take"),
      p()
    ),
  },
  {
    id: "weekly",
    name: "Weekly review",
    icon: "repeat",
    hint: "Look back kindly, plan lightly",
    title: "Weekly review",
    doc: doc(
      h(2, "What went well"),
      bullets(""),
      h(2, "What got in the way"),
      bullets(""),
      h(2, "Next week"),
      todos(""),
      callout("list-growth", p(t("One small thing to try:")))
    ),
  },
  {
    id: "todo",
    name: "To-do list",
    icon: "inbox",
    hint: "A plain checklist, nothing else",
    title: "To-do",
    doc: doc(todos("", "", "")),
  },
  {
    id: "idea",
    name: "Idea",
    icon: "sparkle",
    hint: "Catch it before it wanders off",
    title: "",
    doc: doc(
      callout("sparkle", p(t("The idea: ", [{ type: "bold" }]))),
      h(2, "Why it could work"),
      p(),
      h(2, "How to try it"),
      todos(""),
      toggle("What could go wrong")
    ),
  },
];
