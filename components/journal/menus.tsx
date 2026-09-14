"use client";

import { useEditorState, type Editor, type Range } from "@tiptap/react";
import { Tool, useCoarsePointer, useKeyboardInset } from "../editor/bubble";
import type { SlashItem } from "../editor/slash";

/**
 * The journal's own floating pieces: its slash items and the writing dock.
 * The slash menu and selection bubble are shared with notes, in ../editor.
 * None of it is visible until it's useful — a blank page with a toolbar across
 * the top is a form to fill in, not a place to write.
 */

export const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/* ------------------------------------------------------------ slash items */

export function buildSlashItems(opts: {
  prompt: () => string;
  wins: () => Promise<string[]>;
  notify: (message: string) => void;
}): SlashItem[] {
  const clear = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range);

  return [
    { id: "text", group: "Write", icon: "¶", title: "Text", hint: "Just keep writing", keywords: ["paragraph", "plain", "p"],
      run: (e, r) => clear(e, r).setParagraph().run() },
    { id: "h1", group: "Write", icon: "H1", title: "Big heading", hint: "A title for part of the day", keywords: ["heading", "title", "h1", "#"],
      run: (e, r) => clear(e, r).setNode("heading", { level: 1 }).run() },
    { id: "h2", group: "Write", icon: "H2", title: "Heading", hint: "Break the page into parts", keywords: ["heading", "subtitle", "h2", "##"],
      run: (e, r) => clear(e, r).setNode("heading", { level: 2 }).run() },
    { id: "h3", group: "Write", icon: "H3", title: "Small heading", hint: "A quiet label", keywords: ["heading", "h3", "###"],
      run: (e, r) => clear(e, r).setNode("heading", { level: 3 }).run() },
    { id: "quote", group: "Write", icon: "❝", title: "Quote", hint: "Something someone said", keywords: ["blockquote", "cite", ">"],
      run: (e, r) => clear(e, r).toggleBlockquote().run() },
    { id: "thought", group: "Write", icon: "💭", title: "Thought", hint: "Set a thought apart", keywords: ["callout", "note", "aside", "idea"],
      run: (e, r) => clear(e, r).setCallout("💭").run() },
    { id: "spark", group: "Write", icon: "✨", title: "Highlight of the day", hint: "The moment worth finding again", keywords: ["callout", "best", "moment", "highlight"],
      run: (e, r) => clear(e, r).setCallout("✨").run() },
    { id: "grateful", group: "Write", icon: "🙏", title: "Grateful for", hint: "Something that helped", keywords: ["gratitude", "thanks", "callout"],
      run: (e, r) => clear(e, r).setCallout("🙏").run() },

    { id: "bullets", group: "Structure", icon: "•", title: "Bulleted list", hint: "Loose thoughts, in a row", keywords: ["list", "ul", "bullet", "-"],
      run: (e, r) => clear(e, r).toggleBulletList().run() },
    { id: "numbers", group: "Structure", icon: "1.", title: "Numbered list", hint: "Things in order", keywords: ["list", "ol", "ordered", "1"],
      run: (e, r) => clear(e, r).toggleOrderedList().run() },
    { id: "checklist", group: "Structure", icon: "☑", title: "Checklist", hint: "Tick-boxes on the page", keywords: ["todo", "task", "check", "[]"],
      run: (e, r) => clear(e, r).toggleTaskList().run() },
    { id: "divider", group: "Structure", icon: "✱", title: "Divider", hint: "A breath between parts", keywords: ["hr", "line", "separator", "---"],
      run: (e, r) => clear(e, r).setHorizontalRule().run() },
    { id: "code", group: "Structure", icon: "</>", title: "Code", hint: "Monospaced, untouched", keywords: ["codeblock", "pre", "```"],
      run: (e, r) => clear(e, r).toggleCodeBlock().run() },

    { id: "time", group: "From Kairo", icon: "🕐", title: "The time", hint: "Mark when you came back", keywords: ["timestamp", "now", "clock", "stamp"],
      run: (e, r) => clear(e, r).insertEntryTime(nowHHMM()).run() },
    { id: "prompt", group: "From Kairo", icon: "?", title: "A prompt", hint: "A question to write toward", keywords: ["question", "inspire", "stuck", "idea"],
      run: (e, r) =>
        clear(e, r)
          .insertContent([
            { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: opts.prompt() }] }] },
            { type: "paragraph" },
          ])
          .run() },
    { id: "good", group: "From Kairo", icon: "3", title: "Three good things", hint: "Small, ordinary, true", keywords: ["gratitude", "good", "three", "list"],
      run: (e, r) =>
        clear(e, r)
          .insertContent([
            { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Three good things" }] },
            { type: "orderedList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
          ])
          .run() },
    { id: "wins", group: "From Kairo", icon: "✓", title: "What I finished", hint: "Pull in this day's wins from Kairo", keywords: ["wins", "done", "tasks", "log", "finished"],
      run: async (e, r) => {
        clear(e, r).run();
        const lines = await opts.wins();
        if (lines.length === 0) {
          opts.notify("Nothing was finished in Kairo on this day.");
          return;
        }
        e.chain()
          .focus()
          .insertContent([
            {
              type: "callout",
              attrs: { emoji: "✅" },
              content: [
                { type: "paragraph", content: [{ type: "text", text: "What I finished", marks: [{ type: "bold" }] }] },
                {
                  type: "taskList",
                  content: lines.map((text) => ({
                    type: "taskItem",
                    attrs: { checked: true },
                    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
                  })),
                },
              ],
            },
            { type: "paragraph" },
          ])
          .run();
      } },
  ];
}

/* ------------------------------------------------------------ writing dock */

/**
 * The writing dock.
 *
 * On a phone it rides on top of the keyboard, because that is the only part
 * of the screen a thumb can reach while typing. On a desktop it sits low and
 * centred, and steps back while you type — the keyboard is already doing its
 * job there, and a toolbar that stays lit is one more thing to look at.
 */
export function WritingDock({
  editor,
  listening,
  onVoice,
  voiceSupported,
  typing,
  onFocusMode,
  focusMode,
}: {
  editor: Editor;
  listening: boolean;
  onVoice: () => void;
  voiceSupported: boolean;
  typing: boolean;
  onFocusMode: () => void;
  focusMode: boolean;
}) {
  const inset = useKeyboardInset();
  const coarse = useCoarsePointer();
  const st = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      focused: e.isFocused,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      bullet: e.isActive("bulletList"),
      tasks: e.isActive("taskList"),
      quote: e.isActive("blockquote"),
      h2: e.isActive("heading", { level: 2 }),
    }),
  });

  // on a phone the dock only exists while writing; the keyboard is its anchor
  if (coarse && !st.focused && !listening) return null;

  const openSlash = () => {
    const { from } = editor.state.selection;
    const before = from > 1 ? editor.state.doc.textBetween(from - 1, from, "\n", "\n") : "";
    // the slash menu only opens after a space or at a line's start
    const insert = before && !/\s/.test(before) ? " /" : "/";
    editor.chain().focus().insertContent(insert).run();
  };

  return (
    <div
      className={`fixed inset-x-0 z-[60] flex justify-center px-3 transition-opacity duration-300 md:px-0 ${
        !coarse && typing && !listening ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      // With the keyboard up the dock rides on it. Without one (a tablet with a
      // hardware keyboard, or the moment before it opens) it clears the tab bar
      // instead of sitting on top of it.
      style={{ bottom: coarse ? (inset > 0 ? inset + 8 : "calc(4.75rem + env(safe-area-inset-bottom))") : 20 }}
    >
      <div className="no-scrollbar flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl border border-line bg-card/95 p-1 shadow-xl shadow-ink/10 backdrop-blur">
        <Tool label="Insert a block" onClick={openSlash}>
          <span className="font-semibold">/</span>
        </Tool>
        <Tool label="Heading" active={st.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <span className="text-xs font-bold">H</span>
        </Tool>
        <Tool label="Checklist" active={st.tasks} onClick={() => editor.chain().focus().toggleTaskList().run()}>
          ☑
        </Tool>
        <Tool label="Bulleted list" active={st.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          •
        </Tool>
        <Tool label="Quote" active={st.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          ❝
        </Tool>
        <Tool label="Mark the time" onClick={() => editor.chain().focus().insertEntryTime(nowHHMM()).run()}>
          🕐
        </Tool>
        {voiceSupported && (
          <Tool label={listening ? "Stop dictating" : "Dictate"} active={listening} onClick={onVoice}>
            {listening ? <span className="size-2.5 rounded-sm bg-clay" /> : "🎙"}
          </Tool>
        )}
        <span className="mx-0.5 h-5 w-px shrink-0 bg-line" />
        <Tool label="Undo" onClick={() => editor.chain().focus().undo().run()} className={st.canUndo ? "" : "opacity-35"}>
          ↶
        </Tool>
        <Tool label="Redo" onClick={() => editor.chain().focus().redo().run()} className={st.canRedo ? "" : "opacity-35"}>
          ↷
        </Tool>
        {!coarse && (
          <Tool label={focusMode ? "Leave focus mode" : "Focus mode"} active={focusMode} onClick={onFocusMode}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="8" cy="8" r="2.2" fill="currentColor" />
              <path d="M2 5V3a1 1 0 011-1h2M11 2h2a1 1 0 011 1v2M14 11v2a1 1 0 01-1 1h-2M5 14H3a1 1 0 01-1-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </Tool>
        )}
        {coarse && (
          <Tool label="Done" onClick={() => editor.commands.blur()}>
            <span className="text-xs font-semibold text-sun-deep">Done</span>
          </Tool>
        )}
      </div>
    </div>
  );
}
