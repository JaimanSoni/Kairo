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
 * The languages a code block can be written in, and the colouring for them.
 *
 * One list, used by the editor and by a page published to the web, so a block
 * reads the same in both. Each is named the way people type it in a fence;
 * anything else is kept exactly as written and simply stays uncoloured.
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

export const lowlight = createLowlight();
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

export function languageLabel(id: string): string {
  return CODE_LANGUAGES.find((l) => l.id === id)?.label ?? id;
}

export const isKnownLanguage = (id: string) => CODE_LANGUAGES.some((l) => l.id === id);
