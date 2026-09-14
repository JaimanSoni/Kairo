"use client";

import { useSyncExternalStore } from "react";
import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { notesStore } from "@/lib/notes-client";
import { useApp } from "../store";
import { navigateApp } from "../app-views";

/**
 * How links to pages and Kairo tasks look inside a page. Each reads the live
 * tree or the live task list, so renaming a page renames every mention of it
 * and ticking a task anywhere ticks it here.
 */

const useTree = () => useSyncExternalStore(notesStore.subscribe, notesStore.snapshot, () => 0);

export function PageMentionView({ node }: ReactNodeViewProps) {
  useTree();
  const id = typeof node.attrs.id === "string" ? node.attrs.id : null;
  const meta = notesStore.get(id);
  const gone = !meta && notesStore.status() === "ready";
  const title = meta ? meta.title || "Untitled" : String(node.attrs.label || "Untitled");

  return (
    <NodeViewWrapper
      as="span"
      className={`nt-mention ${gone ? "is-gone" : ""}`}
      data-page-mention=""
      contentEditable={false}
      title={gone ? "This page is in the trash or was deleted" : `Open ${title}`}
      onClick={(e: React.MouseEvent) => {
        e.preventDefault();
        if (id && !gone) navigateApp(`/notes/${id}`);
      }}
    >
      <span className="nt-mention-icon" aria-hidden>
        {meta?.icon ?? "📄"}
      </span>
      <span className="nt-mention-title">{title}</span>
    </NodeViewWrapper>
  );
}

export function PageLinkView({ node, selected }: ReactNodeViewProps) {
  useTree();
  const id = typeof node.attrs.id === "string" ? node.attrs.id : null;
  const meta = notesStore.get(id);
  const gone = !meta && notesStore.status() === "ready";
  const kids = meta ? notesStore.children(meta.id).length : 0;

  return (
    <NodeViewWrapper className={`nt-pagelink ${selected ? "is-selected" : ""} ${gone ? "is-gone" : ""}`} data-page-link="" contentEditable={false}>
      <button
        type="button"
        onClick={() => id && !gone && navigateApp(`/notes/${id}`)}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-paper-deep"
      >
        <span className="text-lg leading-none" aria-hidden>
          {gone ? "🗑️" : meta?.icon ?? "📄"}
        </span>
        <span className={`min-w-0 flex-1 truncate font-medium ${gone ? "text-ink-faint line-through" : "underline decoration-line underline-offset-4"}`}>
          {gone ? "A page that's in the trash" : meta?.title || "Untitled"}
        </span>
        {kids > 0 && <span className="shrink-0 text-xs text-ink-faint">{kids} inside</span>}
      </button>
    </NodeViewWrapper>
  );
}

export function TaskRefView({ node }: ReactNodeViewProps) {
  const { state, completeTask, uncompleteTask, setEditing } = useApp();
  const id = typeof node.attrs.id === "string" ? node.attrs.id : null;
  const task = id ? state.tasks[id] : undefined;
  const done = task?.status === "done";
  const title = task?.title ?? String(node.attrs.title || "Task");

  return (
    <NodeViewWrapper as="span" className={`nt-task ${done ? "is-done" : ""} ${task ? "" : "is-away"}`} data-task-ref="" contentEditable={false}>
      <button
        type="button"
        className="nt-task-box"
        aria-label={done ? `Mark "${title}" not done` : `Mark "${title}" done`}
        aria-pressed={done}
        disabled={!task}
        onClick={() => {
          if (!task || !id) return;
          if (done) uncompleteTask(id);
          else completeTask(id);
        }}
      >
        {done ? "✓" : ""}
      </button>
      <button
        type="button"
        className="nt-task-title"
        title={task ? "Open this task" : "This task isn't loaded right now — it may be finished or deleted"}
        onClick={() => task && id && setEditing(id)}
      >
        {title}
      </button>
    </NodeViewWrapper>
  );
}
