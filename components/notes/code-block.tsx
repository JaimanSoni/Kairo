"use client";

import { useState } from "react";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight } from "lowlight";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import markdown from "highlight.js/lib/languages/markdown";
import php from "highlight.js/lib/languages/php";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import swift from "highlight.js/lib/languages/swift";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

/**
 * Code blocks in a page: the language on the block itself, colouring that
 * follows it, and one button to copy the lot.
 *
 * Only these languages are carried, each named the way people type it in a
 * fence. Anything else still works as a block of monospaced text: the
 * language is kept as written, the colouring simply stays off, so a page
 * written elsewhere and pasted in never loses its fences.
 */

export const CODE_LANGUAGES: { id: string; label: string; aliases?: string[] }[] = [
  { id: "plaintext", label: "Plain text", aliases: ["text", "txt", "none"] },
  { id: "bash", label: "Bash", aliases: ["sh", "shell", "zsh", "console"] },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++", aliases: ["c++", "cc", "hpp"] },
  { id: "csharp", label: "C#", aliases: ["cs", "c#"] },
  { id: "css", label: "CSS", aliases: ["scss", "less"] },
  { id: "diff", label: "Diff", aliases: ["patch"] },
  { id: "dockerfile", label: "Dockerfile", aliases: ["docker"] },
  { id: "go", label: "Go", aliases: ["golang"] },
  { id: "java", label: "Java" },
  { id: "javascript", label: "JavaScript", aliases: ["js", "jsx", "mjs", "cjs", "node"] },
  { id: "json", label: "JSON", aliases: ["jsonc"] },
  { id: "kotlin", label: "Kotlin", aliases: ["kt"] },
  { id: "markdown", label: "Markdown", aliases: ["md"] },
  { id: "php", label: "PHP" },
  { id: "python", label: "Python", aliases: ["py"] },
  { id: "ruby", label: "Ruby", aliases: ["rb"] },
  { id: "rust", label: "Rust", aliases: ["rs"] },
  { id: "sql", label: "SQL" },
  { id: "swift", label: "Swift" },
  { id: "typescript", label: "TypeScript", aliases: ["ts", "tsx"] },
  { id: "xml", label: "HTML & XML", aliases: ["html", "htm", "svg", "vue"] },
  { id: "yaml", label: "YAML", aliases: ["yml"] },
];

const GRAMMARS = { bash, c, cpp, csharp, css, diff, dockerfile, go, java, javascript, json, kotlin, markdown, php, python, ruby, rust, sql, swift, typescript, xml, yaml };

const lowlight = createLowlight();
for (const [id, grammar] of Object.entries(GRAMMARS)) lowlight.register(id, grammar);
for (const lang of CODE_LANGUAGES) {
  if (lang.aliases?.length && lang.id !== "plaintext") lowlight.registerAlias(lang.id, lang.aliases);
}

/** What a written language means: `ts` and `tsx` are both TypeScript. Unknown ones keep their own name. */
export function canonicalLanguage(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!value) return "plaintext";
  const found = CODE_LANGUAGES.find((l) => l.id === value || l.aliases?.includes(value));
  return found ? found.id : value;
}

function labelFor(id: string): string {
  return CODE_LANGUAGES.find((l) => l.id === id)?.label ?? id;
}

function CodeBlockView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const [copied, setCopied] = useState(false);
  const language = canonicalLanguage(node.attrs.language);
  const known = CODE_LANGUAGES.some((l) => l.id === language);

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
            {!known && <option value="other">{labelFor(language)}</option>}
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
