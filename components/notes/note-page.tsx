"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { countWords, docToText, withTrailingParagraph, type JNode } from "@/lib/doc-model";
import { parseQuickAdd } from "@/lib/nlp";
import {
  clearNoteDraft,
  notesApi,
  notesStore,
  readNoteDraft,
  writeNoteDraft,
  type NoteResult,
  type SavedBody,
} from "@/lib/notes-client";
import {
  coverCss,
  linksIn,
  noteToMarkdown,
  type NoteFont,
  type NoteMeta,
  type NoteMetaPatch,
  type NotePage,
  type NoteRef,
} from "@/lib/notes-shared";
import { useApp, visibleLists } from "../store";
import { navigateApp } from "../app-views";
import { IconPlus, IconStar } from "../ui";
import { Icon3d } from "../img3d";
import { pageIconKey } from "@/lib/icons";
import { Callout } from "../editor/callout";
import { NoteCodeBlock } from "./code-block";
import { LinkPreview } from "./link-preview";
import { NoteImage } from "./image";
import { createSlashStore, filterSlash, SlashCommand, type SlashItem } from "../editor/slash";
import { SlashMenu } from "../editor/slash-menu";
import { Divider, SelectionBubble, Tool } from "../editor/bubble";
import { useCoarsePointer } from "../editor/viewport";
import { BlockKeys, createMenuStore, createPageMention, MarkdownPaste, PageLink, TaskRef, type MentionItem } from "./extensions";
import { buildNoteSlashItems, MentionMenu, NotesDock, TableBar, TaskPrompt } from "./menus";
import { BlockHandle } from "./block-handle";
import { CoverPicker, IconPicker, PageIcon } from "./pickers";
import { GlyphArrowLeft, GlyphFace, GlyphImage, GlyphLock, GlyphPanel, GlyphSearch, GlyphTask } from "./glyphs";
import { MoveDialog } from "./dialogs";
import { metaOf, titleOf, useNoteActions } from "./actions";
import { ago } from "./format";
import { TEMPLATES } from "./templates";
import { notesUi, useTreeTick, useUiTick } from "./ui-state";

/* ------------------------------------------------------------------ types */

type Loaded = {
  /** The page as the server holds it. */
  server: NotePage;
  backlinks: NoteRef[];
  /** What the editor opens with — the server's body, or unsynced work from this device. */
  doc: JNode;
  baseVersion: number;
  unsynced: boolean;
};

type Conflict = { theirs: NotePage | null; mine: JNode };

type SaveState = "saved" | "dirty" | "saving" | "offline" | "error" | "conflict" | "locked";

const sameDoc = (a: JNode, b: JNode) =>
  JSON.stringify(withTrailingParagraph(a)) === JSON.stringify(withTrailingParagraph(b));

/** One empty paragraph, the shape of a page nobody has written on. */
const isBlankDoc = (doc: JNode) =>
  (doc.content?.length ?? 0) <= 1 && (!doc.content?.[0] || (doc.content[0].type === "paragraph" && !doc.content[0].content?.length));

/* ---------------------------------------------------------- orchestrator */

/**
 * One page: loading it, reconciling it with work left on this device, and
 * resolving the rare case where two devices wrote at once — the same shape
 * as a journal page, for the same reasons. The writing surface is keyed by
 * page and generation, so a resolved conflict remounts with the chosen words.
 */
export function NotePageView({ id, onFind }: { id: string; onFind: () => void }) {
  const { state } = useApp();
  const userId = state.user.id;
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "offline">("loading");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [generation, setGeneration] = useState(0);
  const [reload, setReload] = useState(0);
  const actions = useNoteActions();

  useEffect(() => {
    let cancelled = false;
    notesApi.get(id).then((r) => {
      if (cancelled) return;
      const draft = readNoteDraft(userId, id);

      if (!r.ok) {
        if (r.kind === "missing") {
          setStatus("missing");
          return;
        }
        // offline: a page this device has a draft of still opens
        const cached = notesStore.get(id);
        if (draft && cached) {
          setLoaded({
            server: { ...cached, doc: draft.doc, version: draft.baseVersion, trashedAt: null },
            backlinks: [],
            doc: draft.doc,
            baseVersion: draft.baseVersion,
            unsynced: true,
          });
          setStatus("ready");
        } else {
          setStatus("offline");
        }
        return;
      }

      const { page: server, backlinks } = r.data;
      if (!server.trashedAt) notesStore.upsert(metaOf(server));

      if (draft && !sameDoc(draft.doc, server.doc)) {
        if (draft.baseVersion === server.version) {
          setLoaded({ server, backlinks, doc: draft.doc, baseVersion: server.version, unsynced: true });
        } else {
          setLoaded({ server, backlinks, doc: server.doc, baseVersion: server.version, unsynced: false });
          setConflict({ theirs: server, mine: draft.doc });
        }
      } else {
        if (draft) clearNoteDraft(userId, id);
        setLoaded({ server, backlinks, doc: server.doc, baseVersion: server.version, unsynced: false });
      }
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [id, userId, reload]);

  const resolve = async (choice: "both" | "mine" | "theirs") => {
    if (!conflict || !loaded) return;
    const { theirs, mine } = conflict;

    if (!theirs) {
      // deleted for good elsewhere while this was written
      setConflict(null);
      clearNoteDraft(userId, id);
      if (choice === "mine") {
        await actions.create({ title: loaded.server.title, icon: loaded.server.icon, doc: mine });
      } else {
        navigateApp("/notes");
      }
      return;
    }

    let doc: JNode;
    if (choice === "theirs") {
      doc = theirs.doc;
      clearNoteDraft(userId, id);
    } else if (choice === "mine") {
      doc = mine;
    } else {
      doc = {
        type: "doc",
        content: [
          ...(theirs.doc.content ?? []),
          { type: "horizontalRule" },
          { type: "callout", attrs: { emoji: "repeat" }, content: [{ type: "paragraph", content: [{ type: "text", text: "Also written on another device" }] }] },
          ...(mine.content ?? []),
        ],
      };
    }
    // the choice is kept on this device first, so a reload can't undo it
    if (choice !== "theirs") writeNoteDraft(userId, id, { doc, baseVersion: theirs.version, savedAt: Date.now() });
    setLoaded({ ...loaded, server: theirs, doc, baseVersion: theirs.version, unsynced: choice !== "theirs" });
    setConflict(null);
    setGeneration((g) => g + 1);
  };

  if (status === "missing") {
    return (
      <div className="mx-auto max-w-md px-6 pb-32 pt-24 text-center">
        <Icon3d name="list-folder" size={64} className="mx-auto" />
        <h1 className="font-display mt-3 text-2xl">This page isn&apos;t here</h1>
        <p className="mt-2 text-sm text-ink-soft">It may have been deleted for good, or the link is from another account.</p>
        <button onClick={() => navigateApp("/notes")} className="mt-5 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper">
          Back to notes
        </button>
      </div>
    );
  }

  if (status === "offline") {
    return (
      <div className="mx-auto max-w-md px-6 pb-32 pt-24 text-center">
        <Icon3d name="sun-cloud" size={64} className="mx-auto" />
        <h1 className="font-display mt-3 text-2xl">This page isn&apos;t on this device yet</h1>
        <p className="mt-2 text-sm text-ink-soft">You look offline. It opens once you&apos;re back.</p>
        <button
          onClick={() => {
            setStatus("loading");
            setReload((n) => n + 1);
          }}
          className="mt-5 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper"
        >
          Try again
        </button>
      </div>
    );
  }

  if (status === "loading" || !loaded) {
    return (
      <div className="mx-auto w-full max-w-3xl px-5 pb-32 pt-16 sm:px-12">
        <div className="size-14 animate-pulse rounded-2xl bg-paper-deep" />
        <div className="mt-5 h-10 w-80 max-w-full animate-pulse rounded-xl bg-paper-deep" />
        <div className="mt-8 space-y-3">
          {[94, 80, 88, 62, 75].map((w) => (
            <div key={w} className="h-4 animate-pulse rounded-full bg-paper-deep" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {conflict && <ConflictBanner onResolve={(c) => void resolve(c)} theirsDeleted={!conflict.theirs} />}
      <NoteSurface
        key={`${id}:${generation}`}
        id={id}
        userId={userId}
        loaded={loaded}
        frozen={conflict !== null}
        onConflict={(theirs, mine) => setConflict({ theirs, mine })}
        onReload={() => setReload((n) => n + 1)}
        onFind={onFind}
      />
    </>
  );
}

function ConflictBanner({ onResolve, theirsDeleted }: { onResolve: (c: "both" | "mine" | "theirs") => void; theirsDeleted: boolean }) {
  return (
    <div className="sticky top-14 z-40 mx-auto mt-3 w-[min(42rem,calc(100%-2rem))] md:top-3">
      <div className="anim-pop rounded-2xl border border-sun/40 bg-card p-4 shadow-xl shadow-ink/10">
        <p className="text-sm font-semibold">
          {theirsDeleted ? "This page was deleted on another device while you wrote." : "This page changed on another device while you wrote."}
        </p>
        <p className="mt-0.5 text-xs text-ink-soft">
          {theirsDeleted ? "Your words are still here. Keep them as a new page, or let them go." : "Nothing has been lost yet. Pick what to keep."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {!theirsDeleted && (
            <button onClick={() => onResolve("both")} className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-paper">
              Keep both
            </button>
          )}
          <button onClick={() => onResolve("mine")} className="rounded-full border border-line bg-card px-4 py-1.5 text-xs font-semibold text-ink-soft hover:border-ink-faint">
            {theirsDeleted ? "Keep as a new page" : "Keep mine"}
          </button>
          <button onClick={() => onResolve("theirs")} className="rounded-full border border-line bg-card px-4 py-1.5 text-xs font-semibold text-ink-soft hover:border-ink-faint">
            {theirsDeleted ? "Let it go" : "Use the other"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- the page */

type EditorStorage = { slashCommand: { items: SlashItem[] }; pageMention: { pageId: string | null; createPage: ((title: string) => Promise<NoteMeta | null>) | null } };
const storageOf = (e: Editor) => e.storage as unknown as EditorStorage;

const SAVE_DEBOUNCE_MS = 800;
const TITLE_DEBOUNCE_MS = 600;
const DRAFT_THROTTLE_MS = 250;
const RETRY_MS = 6000;

function NoteSurface({
  id,
  userId,
  loaded,
  frozen,
  onConflict,
  onReload,
  onFind,
}: {
  id: string;
  userId: string;
  loaded: Loaded;
  frozen: boolean;
  onConflict: (theirs: NotePage | null, mine: JNode) => void;
  onReload: () => void;
  onFind: () => void;
}) {
  useTreeTick();
  useUiTick();
  const { state, addTask, showToast } = useApp();
  const actions = useNoteActions();
  const coarse = useCoarsePointer();

  const trashed = Boolean(loaded.server.trashedAt);
  // the tree holds the live title, icon and settings; a trashed page isn't in it
  const page: NoteMeta = notesStore.get(id) ?? metaOf(loaded.server);
  const readOnly = trashed || page.locked || frozen;

  const [save, setSave] = useState<SaveState>(loaded.unsynced ? "dirty" : "saved");
  const [words, setWords] = useState(() => countWords(docToText(loaded.doc)));
  // tracked by hand: an editor that nobody has touched sends no transaction to read it from
  const [blank, setBlank] = useState(() => isBlankDoc(loaded.doc));
  const [linked, setLinked] = useState(() => new Set(linksIn(loaded.doc)));
  const [menuOpen, setMenuOpen] = useState(false);
  const [picker, setPicker] = useState<"icon" | "cover" | null>(null);
  const [calloutPick, setCalloutPick] = useState<({ pos: number } & Anchor) | null>(null);
  const [askTaskAt, setAskTaskAt] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);

  const versionRef = useRef(loaded.baseVersion);
  const editorRef = useRef<Editor | null>(null);
  const dirtyRef = useRef(loaded.unsynced);
  const changeRef = useRef(0);
  const savingRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const linkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<() => void>(() => {});
  const conflictedRef = useRef(false);
  /** Locked, trashed or frozen — set from an effect, before any save can be scheduled. */
  const blockedRef = useRef(false);
  const lastDocRef = useRef<JNode | null>(null);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMeta = useRef<NoteMetaPatch>({});
  const flushMetaRef = useRef<() => void>(() => {});
  const areaRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  /* ---------------------------------------------------------- meta saves */

  const flushMeta = useCallback(async () => {
    if (titleTimer.current) {
      clearTimeout(titleTimer.current);
      titleTimer.current = null;
    }
    const patch = pendingMeta.current;
    if (Object.keys(patch).length === 0) return;
    pendingMeta.current = {};
    const r = await notesApi.patch(id, patch);
    if (r.ok) {
      // only take the server's word for fields nobody has touched since
      const fresh: Partial<NoteMeta> = { ...r.data.page };
      for (const key of Object.keys(pendingMeta.current) as (keyof NoteMetaPatch)[]) delete fresh[key];
      if (notesStore.get(id)) notesStore.upsert(fresh as NoteMeta);
      return;
    }
    if (r.kind === "offline" || r.kind === "error") {
      // kept, and sent again when the connection is back
      pendingMeta.current = { ...patch, ...pendingMeta.current };
      return;
    }
    showToast({ message: r.kind === "locked" || r.kind === "invalid" || r.kind === "conflict" ? r.message : "Couldn't save that change." });
  }, [id, showToast]);

  useEffect(() => {
    flushMetaRef.current = () => void flushMeta();
  }, [flushMeta]);

  const setMeta = useCallback(
    (patch: NoteMetaPatch, debounce = false) => {
      notesStore.patchLocal(id, patch);
      pendingMeta.current = { ...pendingMeta.current, ...patch };
      if (titleTimer.current) clearTimeout(titleTimer.current);
      if (debounce) titleTimer.current = setTimeout(() => flushMetaRef.current(), TITLE_DEBOUNCE_MS);
      else flushMetaRef.current();
    },
    [id]
  );

  /* ---------------------------------------------------------- body saves */

  /** The body as it stands, or null when no editor has ever said — see the journal for why that matters. */
  const snapshot = useCallback((): JNode | null => {
    const ed = editorRef.current;
    return ed && !ed.isDestroyed ? (ed.getJSON() as JNode) : lastDocRef.current;
  }, []);

  const persistDraft = useCallback(() => {
    if (draftTimer.current) return;
    draftTimer.current = setTimeout(() => {
      draftTimer.current = null;
      const doc = snapshot();
      if (doc) writeNoteDraft(userId, id, { doc, baseVersion: versionRef.current, savedAt: Date.now() });
    }, DRAFT_THROTTLE_MS);
  }, [id, snapshot, userId]);

  const flush = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (!dirtyRef.current || savingRef.current || conflictedRef.current || blockedRef.current) return;
    const doc = snapshot();
    if (!doc) return;
    savingRef.current = true;
    setSave("saving");
    const sentChange = changeRef.current;
    const r: NoteResult<{ page: SavedBody }> = await notesApi.saveDoc(id, {
      doc,
      baseVersion: versionRef.current,
      // this body came from a live editor, so an empty one is a person clearing the page
      allowEmpty: docToText(doc).trim().length === 0,
    });
    savingRef.current = false;

    if (r.ok) {
      const { version, ...meta } = r.data.page;
      versionRef.current = version;
      const current = notesStore.get(id);
      if (current) notesStore.upsert({ ...current, words: meta.words, updatedAt: meta.updatedAt });
      if (changeRef.current === sentChange) {
        dirtyRef.current = false;
        clearNoteDraft(userId, id);
        setSave("saved");
      } else {
        const latest = snapshot();
        if (latest) writeNoteDraft(userId, id, { doc: latest, baseVersion: version, savedAt: Date.now() });
        saveTimer.current = setTimeout(() => flushRef.current(), 200);
      }
      return;
    }

    switch (r.kind) {
      case "conflict":
      case "missing":
        conflictedRef.current = true;
        editorRef.current?.setEditable(false, false);
        setSave("conflict");
        onConflict(r.kind === "conflict" ? r.current : null, snapshot() ?? doc);
        return;
      case "trashed": {
        // trashed elsewhere: the words stay on this device, and come back if the page does
        const latest = snapshot() ?? doc;
        writeNoteDraft(userId, id, { doc: latest, baseVersion: versionRef.current, savedAt: Date.now() });
        // nothing more saves from this surface; the reload shows the page as it now is
        conflictedRef.current = true;
        onReload();
        return;
      }
      case "locked":
        notesStore.patchLocal(id, { locked: true });
        setSave("locked");
        return;
      case "invalid":
        setSave("error");
        showToast({ message: r.message });
        return;
      default:
        setSave(r.kind === "offline" ? "offline" : "error");
        saveTimer.current = setTimeout(() => flushRef.current(), RETRY_MS);
    }
  }, [id, onConflict, onReload, showToast, snapshot, userId]);

  useEffect(() => {
    flushRef.current = () => void flush();
  }, [flush]);

  const changed = useCallback(
    (doc?: JNode) => {
      if (doc) lastDocRef.current = doc;
      dirtyRef.current = true;
      changeRef.current++;
      setSave((s) => (s === "saving" ? s : "dirty"));
      persistDraft();
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => flushRef.current(), SAVE_DEBOUNCE_MS);
      if (linkTimer.current) clearTimeout(linkTimer.current);
      linkTimer.current = setTimeout(() => {
        const latest = lastDocRef.current;
        if (latest) setLinked(new Set(linksIn(latest)));
      }, 600);
    },
    [persistDraft]
  );

  /* ------------------------------------------------------------- editor */

  const slashStore = useMemo(() => createSlashStore(), []);
  const mentionStore = useMemo(() => createMenuStore<MentionItem>(), []);
  const pageMention = useMemo(() => createPageMention(mentionStore), [mentionStore]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // ours carries a language, colours itself, and copies
        codeBlock: false,
        dropcursor: { color: "#0c9384", width: 3 },
        link: {
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          defaultProtocol: "https",
          protocols: ["http", "https", "mailto"],
          isAllowedUri: (url, ctx) => ctx.defaultValidate(url) && !/^\s*(javascript|data|vbscript):/i.test(url),
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      Typography,
      Details.configure({ persist: true, HTMLAttributes: { class: "nt-toggle" } }),
      DetailsSummary,
      DetailsContent,
      TableKit.configure({ table: { resizable: true, HTMLAttributes: { class: "nt-table" } } }),
      Placeholder.configure({
        includeChildren: true,
        showOnlyCurrent: true,
        placeholder: ({ node, editor: ed, pos }) => {
          if (node.type.name === "heading") return `Heading ${node.attrs.level}`;
          // a code block has a header of its own; a hint here would sit on top of it
          if (node.type.name === "codeBlock") return "";
          if (node.type.name === "detailsSummary") return "Toggle";
          const parent = pos > 0 && pos <= ed.state.doc.content.size ? ed.state.doc.resolve(pos).parent.type.name : "doc";
          if (parent === "detailsContent") return "Empty toggle. Write inside it, or drop blocks in.";
          if (parent === "tableCell" || parent === "tableHeader") return "";
          if (ed.isEmpty) return "Write something, or press / for blocks and @ to link a page";
          return "Type / for blocks, @ to link a page";
        },
      }),
      NoteCodeBlock,
      LinkPreview,
      NoteImage.configure({ onRefuse: (reason: string) => showToast({ message: reason }) }),
      Callout.configure({ icons: true }),
      PageLink,
      TaskRef,
      pageMention,
      BlockKeys,
      MarkdownPaste,
      SlashCommand.configure({ store: slashStore, filter: filterSlash }),
    ],
    // already in the shape the editor keeps, so opening a page never counts as an edit
    content: withTrailingParagraph(loaded.doc),
    editorProps: {
      attributes: { class: "jr-prose nt-prose", spellcheck: "true", dir: "auto", "aria-label": "Page content" },
    },
    onUpdate: ({ editor: ed }) => {
      const doc = ed.getJSON() as JNode;
      setWords(countWords(docToText(doc)));
      setBlank(ed.isEmpty);
      changed(doc);
    },
  });

  useEffect(() => {
    editorRef.current = editor;
    if (!editor) return;
    lastDocRef.current = editor.getJSON() as JNode;
    // work left on this device by an earlier visit saves as soon as it can
    if (dirtyRef.current) saveTimer.current = setTimeout(() => flushRef.current(), 400);
  }, [editor]);

  // locked, trashed or waiting on a conflict: the page holds still, and saving resumes when it's free
  useEffect(() => {
    blockedRef.current = readOnly;
    if (editor && !editor.isDestroyed) editor.setEditable(!readOnly, false);
    if (!readOnly && dirtyRef.current) saveTimer.current = setTimeout(() => flushRef.current(), 300);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor) return;
    storageOf(editor).slashCommand.items = buildNoteSlashItems({
      newSubPage: async () => (await actions.create({ parentId: id, open: false }))?.id ?? null,
      openPage: (pageId) => navigateApp(`/notes/${pageId}`),
      askTask: () => setAskTaskAt(editor.state.selection.from),
      todayLabel: () => new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    });
    const mention = storageOf(editor).pageMention;
    mention.pageId = id;
    mention.createPage = async (title) => {
      const created = await actions.create({ parentId: id, title, open: false });
      return created ? metaOf(created) : null;
    };
  }, [editor, id, actions]);


  /* ------------------------------------------------------------ leaving */

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        flushRef.current();
        flushMetaRef.current();
      }
    };
    const onOnline = () => {
      flushRef.current();
      flushMetaRef.current();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onOnline);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onOnline);
      window.removeEventListener("online", onOnline);
      if (draftTimer.current) {
        clearTimeout(draftTimer.current);
        draftTimer.current = null;
        const last = snapshot();
        const settled = !conflictedRef.current && !blockedRef.current;
        if (dirtyRef.current && last && settled) writeNoteDraft(userId, id, { doc: last, baseVersion: versionRef.current, savedAt: Date.now() });
      }
      if (linkTimer.current) clearTimeout(linkTimer.current);
      flushRef.current();
      flushMetaRef.current();
    };
  }, [id, snapshot, userId]);

  // ⌘S saves now
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        flushRef.current();
        flushMetaRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // a page made moments ago opens with the caret in its title, ready to be named
  useEffect(() => {
    const fresh = Date.now() - Date.parse(loaded.server.createdAt) < 20_000;
    if (fresh && !loaded.server.title && !loaded.server.trashedAt && docToText(loaded.doc).trim() === "") {
      titleRef.current?.focus();
    }
  }, [loaded]);

  // the tab carries the page's name
  const tabTitle = `${titleOf(page)} · Kairo`;
  useEffect(() => {
    document.title = tabTitle;
  }, [tabTitle]);

  // the title grows with what's typed into it
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [page.title, page.fullWidth]);

  /* ------------------------------------------------------------ actions */

  const applyTemplate = (templateId: string) => {
    const tpl = TEMPLATES.find((t) => t.id === templateId);
    if (!tpl || !editor) return;
    const patch: NoteMetaPatch = {};
    if (!page.title && tpl.title) patch.title = tpl.title;
    if (!pageIconKey(page.icon)) patch.icon = tpl.icon;
    if (Object.keys(patch).length) setMeta(patch);
    editor.chain().setContent(tpl.doc, { emitUpdate: true }).focus("start").run();
  };

  const makeTaskFromSelection = async () => {
    if (!editor) return;
    const { from, to, $from, $to } = editor.state.selection;
    if (!$from.sameParent($to)) {
      showToast({ message: "Select words within one line to make a task." });
      return;
    }
    const before = editor.state.doc.textBetween(from, to, " ");
    const raw = before.trim().slice(0, 500);
    if (!raw) return;
    const parsed = parseQuickAdd(raw, visibleLists(state));
    const title = parsed.title || raw;
    const taskId = await addTask({ ...parsed, title });
    if (!taskId) {
      showToast({ message: "Couldn't make that task." });
      return;
    }
    if (to <= editor.state.doc.content.size && editor.state.doc.textBetween(from, to, " ") === before) {
      editor.chain().focus().insertContentAt({ from, to }, [{ type: "taskRef", attrs: { id: taskId, title } }]).run();
    }
    showToast({ message: `Added “${title}” to Kairo.` });
  };

  const downloadPage = () => {
    setMenuOpen(false);
    const doc = snapshot() ?? loaded.doc;
    const md = noteToMarkdown({ title: page.title, icon: page.icon, doc }, { titleOf: (pid) => notesStore.get(pid)?.title || null });
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    const slug = (page.title || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "page";
    a.download = `${slug}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const onPageClick = (e: React.MouseEvent) => {
    const emoji = (e.target as HTMLElement).closest(".jr-callout-emoji");
    if (!emoji || !editor || !editor.isEditable) return;
    const box = emoji.parentElement;
    if (!box) return;
    try {
      const $p = editor.state.doc.resolve(editor.view.posAtDOM(box, 0));
      for (let d = $p.depth; d > 0; d--) {
        if ($p.node(d).type.name === "callout") {
          const r = emoji.getBoundingClientRect();
          setCalloutPick({ pos: $p.before(d), top: r.top, bottom: r.bottom, left: r.left });
          return;
        }
      }
    } catch {
      /* a click that doesn't land in the document has nothing to change */
    }
  };

  /* ---------------------------------------------------------- rendering */

  const ancestors = notesStore.ancestors(id);
  const crumbs = ancestors.length > 3 ? [ancestors[0], null, ...ancestors.slice(-2)] : ancestors;
  const kids = trashed ? [] : notesStore.children(id).filter((k) => !linked.has(k.id));
  const cover = coverCss(page.cover);
  // an old emoji with no matching icon counts as no icon, so "Add icon" offers one
  const iconKey = pageIconKey(page.icon);
  const panelOpen = notesUi.panelOpen();
  const width = page.fullWidth ? "max-w-none px-6 sm:px-16" : "max-w-3xl px-5 sm:px-14";

  return (
    <div className={`nt-font-${page.font} ${page.smallText ? "nt-small" : ""} min-h-dvh`}>
      {/* header: breadcrumbs, save state, favorite, page menu */}
      <header className="relative z-30 border-b border-line/60 bg-paper/85 backdrop-blur md:sticky md:top-0">
        <div className="flex h-12 items-center gap-1.5 px-3 sm:px-4">
          {!panelOpen && (
            <button
              type="button"
              onClick={() => notesUi.setPanel(true)}
              aria-label="Show the page panel"
              title="Show pages (Ctrl+\)"
              className="hidden size-8 shrink-0 place-items-center rounded-lg text-ink-faint hover:bg-card hover:text-ink md:grid"
            >
              <GlyphPanel size={15} />
            </button>
          )}
          <button
            type="button"
            onClick={() => navigateApp(page.parentId && notesStore.get(page.parentId) ? `/notes/${page.parentId}` : "/notes")}
            aria-label="Back to the page above"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-card md:hidden"
          >
            <GlyphArrowLeft size={15} />
          </button>
          <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-0.5 text-sm">
            <button type="button" onClick={() => navigateApp("/notes")} className="hidden shrink-0 rounded-md px-1.5 py-1 text-ink-faint hover:bg-card hover:text-ink sm:block">
              Notes
            </button>
            {crumbs.map((c, i) => (
              <span key={c?.id ?? `gap-${i}`} className="flex min-w-0 items-center">
                <span className="hidden px-0.5 text-ink-faint/60 sm:inline">/</span>
                {c ? (
                  <button
                    type="button"
                    onClick={() => navigateApp(`/notes/${c.id}`)}
                    className="hidden min-w-0 max-w-[10rem] items-center gap-1.5 rounded-md px-1.5 py-1 text-ink-faint hover:bg-card hover:text-ink sm:flex"
                  >
                    {pageIconKey(c.icon) && <PageIcon icon={c.icon} size={15} className="shrink-0" />}
                    <span className="truncate">{titleOf(c)}</span>
                  </button>
                ) : (
                  <span className="hidden px-1 text-ink-faint sm:inline">…</span>
                )}
              </span>
            ))}
            <span className="hidden px-0.5 text-ink-faint/60 sm:inline">/</span>
            <span className="flex min-w-0 items-center gap-1.5 px-1.5 font-medium text-ink">
              {pageIconKey(page.icon) && <PageIcon icon={page.icon} size={16} className="shrink-0" />}
              <span className="truncate">{titleOf(page)}</span>
            </span>
            {page.locked && !trashed && (
              <button
                type="button"
                onClick={() => setMeta({ locked: false })}
                className="ml-1 flex shrink-0 items-center gap-1 rounded-full border border-line bg-card px-2 py-0.5 text-[11px] font-medium text-ink-soft hover:border-sun/50 hover:text-sun-deep"
                title="Unlock to edit"
              >
                <GlyphLock size={11} />
                Locked
              </button>
            )}
          </nav>
          <SaveBadge state={frozen ? "conflict" : save} onRetry={() => flushRef.current()} />
          <button type="button" onClick={onFind} aria-label="Search notes" title="Search notes (Ctrl+P)" className="hidden size-8 shrink-0 place-items-center rounded-lg text-ink-faint hover:bg-card hover:text-ink sm:grid">
            <GlyphSearch size={15} />
          </button>
          {!trashed && (
            <button
              type="button"
              onClick={() => void actions.toggleFavorite(id)}
              aria-label={page.favorite ? "Remove from favorites" : "Add to favorites"}
              aria-pressed={page.favorite}
              className={`grid size-8 shrink-0 place-items-center rounded-lg hover:bg-card ${page.favorite ? "text-[#d8a03e]" : "text-ink-faint hover:text-ink"}`}
            >
              <IconStar size={15} filled={page.favorite} />
            </button>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Page options"
              aria-expanded={menuOpen}
              className="grid size-8 place-items-center rounded-lg text-ink-soft hover:bg-card hover:text-ink"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <circle cx="3" cy="8" r="1.5" />
                <circle cx="8" cy="8" r="1.5" />
                <circle cx="13" cy="8" r="1.5" />
              </svg>
            </button>
            {menuOpen && (
              <PageMenu
                page={page}
                trashed={trashed}
                words={words}
                onClose={() => setMenuOpen(false)}
                onSet={(patch) => setMeta(patch)}
                onDownload={downloadPage}
                onMove={() => {
                  setMenuOpen(false);
                  setMoving(true);
                }}
              />
            )}
          </div>
        </div>
      </header>

      {trashed && (
        <div className="border-b border-clay/20 bg-clay-soft/60 px-4 py-2.5">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-ink-soft">This page is in the trash.</span>
            <span className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (await actions.restore(id)) onReload();
                }}
                className="rounded-full bg-ink px-3.5 py-1 text-xs font-semibold text-paper"
              >
                Restore
              </button>
              <button
                type="button"
                onClick={async () => {
                  const r = await notesApi.deleteForever(id);
                  if (r.ok) {
                    clearNoteDraft(userId, id);
                    navigateApp("/notes");
                    showToast({ message: "Deleted for good." });
                  } else {
                    showToast({ message: "Couldn't delete that page." });
                  }
                }}
                className="rounded-full border border-clay/40 px-3.5 py-1 text-xs font-semibold text-clay"
              >
                Delete forever
              </button>
            </span>
          </div>
        </div>
      )}

      {cover && (
        <div className="group/cover relative h-40 w-full sm:h-52" style={{ background: cover }}>
          {!readOnly && (
            <div className={`absolute bottom-3 right-4 flex gap-1.5 transition-opacity ${coarse ? "" : "opacity-0 group-hover/cover:opacity-100"}`}>
              <button type="button" onClick={() => setPicker("cover")} className="rounded-lg bg-card/85 px-2.5 py-1 text-xs font-medium text-ink-soft backdrop-blur hover:text-ink">
                Change cover
              </button>
              <button type="button" onClick={() => setMeta({ cover: null })} className="rounded-lg bg-card/85 px-2.5 py-1 text-xs font-medium text-ink-soft backdrop-blur hover:text-ink">
                Remove
              </button>
            </div>
          )}
          {picker === "cover" && (
            <CoverPicker
              className="bottom-12 right-4"
              current={page.cover}
              onPick={(key) => {
                setPicker(null);
                setMeta({ cover: key });
              }}
              onRemove={() => {
                setPicker(null);
                setMeta({ cover: null });
              }}
              onClose={() => setPicker(null)}
            />
          )}
        </div>
      )}

      <main className={`mx-auto w-full ${width} pb-40 ${cover ? "" : "pt-10 sm:pt-16"}`}>
        <div className="group/head relative">
          {iconKey && (
            <div className={`relative ${cover ? "-mt-12" : ""}`}>
              <button
                type="button"
                onClick={() => !readOnly && setPicker("icon")}
                aria-label="Change icon"
                data-icon={iconKey}
                className={`block rounded-2xl p-1 transition-colors ${readOnly ? "cursor-default" : "hover:bg-paper-deep/70"}`}
              >
                <Icon3d name={iconKey} size={76} className="drop-shadow-sm" />
              </button>
            </div>
          )}
          {!readOnly && (!iconKey || !page.cover) && (
            <div className={`mt-2 flex h-7 gap-1 text-sm text-ink-faint transition-opacity ${coarse ? "" : "opacity-0 focus-within:opacity-100 group-hover/head:opacity-100"} ${!iconKey && cover ? "mt-4" : ""}`}>
              {!iconKey && (
                <button type="button" onClick={() => setPicker("icon")} className="flex items-center gap-1.5 rounded-md px-2 py-0.5 hover:bg-paper-deep hover:text-ink-soft">
                  <GlyphFace size={14} /> Add icon
                </button>
              )}
              {!page.cover && (
                <button
                  type="button"
                  onClick={() => setMeta({ cover: ["lagoon", "dawn", "bloom", "mint", "aurora"][words % 5] })}
                  className="flex items-center gap-1.5 rounded-md px-2 py-0.5 hover:bg-paper-deep hover:text-ink-soft"
                >
                  <GlyphImage size={14} /> Add cover
                </button>
              )}
            </div>
          )}
          {picker === "icon" && (
            <IconPicker
              className="left-0 top-full mt-1"
              current={page.icon}
              onPick={(key) => {
                setPicker(null);
                setMeta({ icon: key });
              }}
              onRemove={
                page.icon
                  ? () => {
                      setPicker(null);
                      setMeta({ icon: null });
                    }
                  : undefined
              }
              onClose={() => setPicker(null)}
            />
          )}
        </div>

        <textarea
          ref={titleRef}
          rows={1}
          value={page.title}
          readOnly={readOnly}
          onChange={(e) => setMeta({ title: e.target.value.replace(/\n/g, " ").slice(0, 200) }, true)}
          onBlur={() => flushMetaRef.current()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || (e.key === "ArrowDown" && !e.shiftKey && e.currentTarget.selectionStart === e.currentTarget.value.length)) {
              e.preventDefault();
              const ed = editorRef.current;
              if (!ed || readOnly) return;
              // focus now, not next frame, or a fast typist's first letters land in the title
              ed.view.focus();
              ed.commands.setTextSelection(1);
            }
          }}
          placeholder="Untitled"
          aria-label="Page title"
          className="nt-title mt-3 block w-full resize-none overflow-hidden bg-transparent text-ink outline-none placeholder:text-ink-faint/60"
        />

        {!readOnly && blank && !page.title && (
          <div className="anim-rise mt-4 rounded-2xl border border-dashed border-line p-3">
            <div className="px-1 pb-2 text-xs text-ink-faint">Start writing, or begin from a template</div>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t.id)}
                  title={t.hint}
                  className="flex h-9 items-center gap-2 rounded-full border border-line bg-card pl-2 pr-3.5 text-sm text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
                >
                  <Icon3d name={t.icon} size={20} />
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={areaRef} className="relative mt-5" onClick={onPageClick}>
          <EditorContent editor={editor} />
        </div>

        {kids.length > 0 && (
          <section className="mt-2 border-t border-line/70 pt-4">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">Pages inside</div>
            <ul>
              {kids.map((k) => (
                <li key={k.id}>
                  <button
                    type="button"
                    onClick={() => navigateApp(`/notes/${k.id}`)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[0.95rem] hover:bg-paper-deep"
                  >
                    <span className="grid w-5 shrink-0 place-items-center" aria-hidden>
                      <PageIcon icon={k.icon} size={18} />
                    </span>
                    <span className="min-w-0 flex-1 truncate underline decoration-line underline-offset-4">{titleOf(k)}</span>
                    <span className="shrink-0 text-xs text-ink-faint">{ago(k.updatedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={() => void actions.create({ parentId: id })}
            className="mt-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-faint transition-colors hover:bg-paper-deep hover:text-ink-soft"
          >
            <IconPlus size={13} /> Add a page inside
          </button>
        )}

        {loaded.backlinks.length > 0 && (
          <section className="mt-6 rounded-2xl border border-line bg-card/60 p-3">
            <div className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">
              Linked from {loaded.backlinks.length} {loaded.backlinks.length === 1 ? "page" : "pages"}
            </div>
            <ul className="mt-1">
              {loaded.backlinks.map((b) => {
                const live = notesStore.get(b.id);
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => navigateApp(`/notes/${b.id}`)}
                      className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-sm text-ink-soft hover:bg-paper-deep hover:text-ink"
                    >
                      <span className="grid w-5 shrink-0 place-items-center" aria-hidden>
                        <PageIcon icon={(live ?? b).icon} size={16} />
                      </span>
                      <span className="truncate">{titleOf(live ?? b)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <footer className="mt-8 flex items-center justify-between text-xs text-ink-faint">
          <span>
            {words.toLocaleString()} {words === 1 ? "word" : "words"}
            {words >= 200 && ` · ${Math.max(1, Math.round(words / 230))} min read`}
          </span>
          <span>Edited {ago(page.updatedAt)}</span>
        </footer>
      </main>

      {editor && (
        <>
          <SelectionBubble
            editor={editor}
            colors
            code
            extra={
              <>
                <Divider />
                <Tool label="Make it a Kairo task" onClick={() => void makeTaskFromSelection()}>
                  <span className="flex items-center gap-1 px-1 text-xs font-semibold">
                    <GlyphTask size={13} /> Task
                  </span>
                </Tool>
              </>
            }
          />
          <TableBar editor={editor} />
          {!coarse && !readOnly && <BlockHandle editor={editor} area={areaRef} />}
          <NotesDock editor={editor} />
          {askTaskAt !== null && <TaskPrompt editor={editor} pos={askTaskAt} onClose={() => setAskTaskAt(null)} />}
        </>
      )}
      <SlashMenu store={slashStore} />
      <MentionMenu store={mentionStore} />

      {calloutPick && editor && (
        <FloatingAt anchor={calloutPick}>
          <IconPicker
            className="left-0 top-0"
            label="Choose the callout's icon"
            current={String(editor.state.doc.nodeAt(calloutPick.pos)?.attrs.emoji ?? "")}
            onPick={(key) => {
              editor.chain().focus().setCalloutEmoji(calloutPick.pos, key).run();
              setCalloutPick(null);
            }}
            onClose={() => setCalloutPick(null)}
          />
        </FloatingAt>
      )}

      {moving && <MoveDialog id={id} onClose={() => setMoving(false)} />}
    </div>
  );
}

/* -------------------------------------------------------------- floating */

type Anchor = { top: number; bottom: number; left: number };

/**
 * A popover pinned beside something on screen: below it when there's room,
 * above it when there isn't, and never past the edge. Placed by writing to the
 * node once it can be measured, so it never draws in the wrong place first.
 */
function FloatingAt({ anchor, children }: { anchor: Anchor; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.querySelector<HTMLElement>('[role="dialog"]');
    if (!el || !box) return;
    const h = box.offsetHeight;
    const w = box.offsetWidth;
    const below = anchor.bottom + 6;
    const top = below + h > window.innerHeight - 8 ? Math.max(8, anchor.top - 6 - h) : below;
    el.style.top = `${top}px`;
    el.style.left = `${Math.max(8, Math.min(anchor.left, window.innerWidth - w - 8))}px`;
    el.style.visibility = "visible";
  }, [anchor]);
  return (
    <div ref={ref} style={{ position: "fixed", top: 0, left: 0, visibility: "hidden" }} className="z-[72]">
      <div className="relative">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------ page menu */

function PageMenu({
  page,
  trashed,
  words,
  onClose,
  onSet,
  onDownload,
  onMove,
}: {
  page: NoteMeta;
  trashed: boolean;
  words: number;
  onClose: () => void;
  onSet: (patch: NoteMetaPatch) => void;
  onDownload: () => void;
  onMove: () => void;
}) {
  const actions = useNoteActions();
  const item = (label: string, run: () => void, opts: { hint?: string; danger?: boolean; on?: boolean } = {}) => (
    <button
      type="button"
      role={opts.on === undefined ? "menuitem" : "menuitemcheckbox"}
      aria-checked={opts.on}
      onClick={run}
      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
        opts.danger ? "text-clay hover:bg-clay-soft" : "text-ink-soft hover:bg-paper-deep hover:text-ink"
      }`}
    >
      {label}
      {opts.on !== undefined && (
        <span className={`relative h-4 w-7 rounded-full transition-colors ${opts.on ? "bg-sun" : "bg-line"}`}>
          <span className={`absolute top-0.5 size-3 rounded-full bg-white shadow transition-all ${opts.on ? "left-3.5" : "left-0.5"}`} />
        </span>
      )}
      {opts.hint && <span className="text-[11px] text-ink-faint">{opts.hint}</span>}
    </button>
  );

  return (
    <>
      <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={onClose} />
      <div role="menu" className="anim-pop absolute right-0 top-10 z-50 w-64 rounded-2xl border border-line bg-card p-1.5 shadow-2xl shadow-ink/10">
        {!trashed && (
          <>
            <div className="grid grid-cols-3 gap-1 px-1 pb-1.5 pt-1">
              {(
                [
                  ["sans", "Default", ""],
                  ["serif", "Serif", "font-display"],
                  ["mono", "Mono", "font-mono"],
                ] as [NoteFont, string, string][]
              ).map(([f, label, cls]) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onSet({ font: f })}
                  disabled={page.locked}
                  className={`flex flex-col items-center rounded-lg py-1.5 disabled:opacity-40 ${page.font === f ? "bg-sun-soft text-sun-deep" : "text-ink-soft hover:bg-paper-deep"}`}
                >
                  <span className={`text-lg ${cls}`}>Ag</span>
                  <span className="text-[10px]">{label}</span>
                </button>
              ))}
            </div>
            <div className="my-1 h-px bg-line" />
            {item("Small text", () => onSet({ smallText: !page.smallText }), { on: page.smallText })}
            {item("Full width", () => onSet({ fullWidth: !page.fullWidth }), { on: page.fullWidth })}
            {item("Lock page", () => onSet({ locked: !page.locked }), { on: page.locked })}
            <div className="my-1 h-px bg-line" />
            {item(page.favorite ? "Remove from favorites" : "Add to favorites", () => {
              onClose();
              void actions.toggleFavorite(page.id);
            })}
            {item("Copy link", () => {
              onClose();
              void actions.copyLink(page.id);
            })}
            {item("Duplicate", () => {
              onClose();
              void actions.duplicate(page.id);
            })}
            {item("Move to…", onMove)}
          </>
        )}
        {item("Export as Markdown", onDownload)}
        {!trashed && (
          <>
            <div className="my-1 h-px bg-line" />
            {item(
              "Move to trash",
              () => {
                onClose();
                void actions.trash(page.id);
              },
              { danger: true }
            )}
          </>
        )}
        <div className="mt-1 border-t border-line px-2.5 pb-1 pt-2 text-[11px] leading-relaxed text-ink-faint">
          {words.toLocaleString()} {words === 1 ? "word" : "words"} · Edited {ago(page.updatedAt)}
          <br />
          Created {new Date(page.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
        </div>
      </div>
    </>
  );
}

function SaveBadge({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  const view: Record<SaveState, { dot: string; label: string }> = {
    saved: { dot: "bg-moss", label: "Saved" },
    dirty: { dot: "bg-ink-faint", label: "Edited" },
    saving: { dot: "bg-sun jr-breathe", label: "Saving" },
    offline: { dot: "bg-[#d8a03e]", label: "Offline · kept on this device" },
    error: { dot: "bg-clay", label: "Couldn't save · retrying" },
    conflict: { dot: "bg-sun", label: "Paused · pick what to keep" },
    locked: { dot: "bg-ink-faint", label: "Locked · kept on this device" },
  };
  const v = view[state];
  const retryable = state === "offline" || state === "error";
  return (
    <button
      type="button"
      onClick={retryable ? onRetry : undefined}
      aria-live="polite"
      title={v.label}
      className={`flex min-w-0 shrink items-center gap-1.5 rounded-full px-2 py-1 text-xs text-ink-faint ${retryable ? "hover:bg-card" : "cursor-default"}`}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${v.dot}`} />
      <span className="hidden truncate sm:inline">{v.label}</span>
    </button>
  );
}

