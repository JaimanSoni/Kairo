"use client";

import { useState } from "react";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { canonicalLanguage, CODE_LANGUAGES, isKnownLanguage, languageLabel, lowlight } from "@/lib/code-highlight";

/**
 * Code blocks in a page: the language on the block itself, colouring that
 * follows it, and one button to copy the lot. The languages themselves, and
 * the colouring, are shared with the read-only page a note is published at.
 */

function CodeBlockView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const [copied, setCopied] = useState(false);
  const language = canonicalLanguage(node.attrs.language);
  const known = isKnownLanguage(language);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // a browser that refuses the clipboard leaves the text on screen to select
    }
  };

  return (
    <NodeViewWrapper className="nt-code" data-code-block={language}>
      <div className="nt-code-head" contentEditable={false}>
        <label className="nt-code-lang">
          <span className="sr-only">Language for this code block</span>
          <select
            value={known ? language : "other"}
            disabled={!editor.isEditable}
            onChange={(e) => updateAttributes({ language: e.target.value === "other" ? language : e.target.value })}
            aria-label="Language for this code block"
            data-code-language
          >
            {CODE_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
            {!known && <option value="other">{languageLabel(language)}</option>}
          </select>
          <span aria-hidden className="nt-code-caret">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <path d="M4 6.5L8 10.5 12 6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </label>
        <button type="button" onClick={() => void copy()} className="nt-code-copy" data-copy-code>
          {copied ? (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
              <rect x="5.5" y="5.5" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 5.5v-1a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre spellCheck={false}>
        <NodeViewContent<"code"> as="code" className={`language-${language}`} />
      </pre>
    </NodeViewWrapper>
  );
}

/**
 * The block itself. Tab indents inside it rather than leaving the page, the
 * way every code editor behaves; Escape then Tab still moves on for anyone
 * using the keyboard alone.
 */
export const NoteCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Tab: ({ editor }) => {
        if (!editor.isActive("codeBlock")) return false;
        return editor.commands.insertContent("  ");
      },
      "Shift-Tab": ({ editor }) => {
        if (!editor.isActive("codeBlock")) return false;
        const { state } = editor;
        const { $from } = state.selection;
        const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 2), $from.parentOffset);
        if (before !== "  ") return true;
        return editor.commands.deleteRange({ from: state.selection.from - 2, to: state.selection.from });
      },
    };
  },
}).configure({ lowlight, defaultLanguage: null, HTMLAttributes: { class: "nt-code-pre" } });
