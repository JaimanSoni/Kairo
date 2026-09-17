import type { JMark, JNode } from "@/lib/doc-model";
import { embedFor, siteOf } from "@/lib/embeds";
import { sized } from "@/lib/cloudinary";
import { canonicalLanguage, isKnownLanguage, languageLabel, lowlight } from "@/lib/code-highlight";

/**
 * A page, drawn without the editor: what a published note looks like to
 * whoever opens the link.
 *
 * It renders the same blocks the editor does, in the same classes, so a
 * shared page reads exactly like the one that was written — but nothing here
 * is editable, nothing loads the editor, and nothing about the account that
 * wrote it comes along. Anything the reader has no business following (a link
 * to another of their pages, a task of theirs) is drawn as plain words.
 */

const isHttp = (value: unknown): value is string => typeof value === "string" && /^https?:\/\//.test(value);

/** The same colouring the editor gives a code block, drawn here on the server. */
function highlighted(code: string, language: string): React.ReactNode {
  if (!isKnownLanguage(language) || language === "plaintext") return code;
  let tree;
  try {
    tree = lowlight.highlight(language, code);
  } catch {
    return code;
  }
  const draw = (node: { type: string; value?: string; tagName?: string; properties?: { className?: string[] }; children?: unknown[] }, key: number): React.ReactNode => {
    if (node.type === "text") return node.value;
    const kids = ((node.children ?? []) as never[]).map(draw);
    if (node.type !== "element") return kids;
    return (
      <span key={key} className={(node.properties?.className ?? []).join(" ")}>
        {kids}
      </span>
    );
  };
  return (tree.children as never[]).map(draw);
}

function marked(text: string, marks: JMark[] | undefined, key: number): React.ReactNode {
  let node: React.ReactNode = text;
  for (const mark of marks ?? []) {
    if (mark.type === "bold") node = <strong>{node}</strong>;
    else if (mark.type === "italic") node = <em>{node}</em>;
    else if (mark.type === "strike") node = <s>{node}</s>;
    else if (mark.type === "underline") node = <u>{node}</u>;
    else if (mark.type === "code") node = <code>{node}</code>;
    else if (mark.type === "highlight") node = <mark>{node}</mark>;
    else if (mark.type === "link" && isHttp(mark.attrs?.href)) {
      node = (
        <a href={String(mark.attrs.href)} target="_blank" rel="noreferrer noopener nofollow">
          {node}
        </a>
      );
    }
  }
  return <span key={key}>{node}</span>;
}

function inline(nodes: JNode[] | undefined): React.ReactNode[] {
  return (nodes ?? []).map((n, i) => {
    if (n.type === "text") return marked(n.text ?? "", n.marks, i);
    if (n.type === "hardBreak") return <br key={i} />;
    // a mention of one of their other pages is just its name here
    if (n.type === "pageMention") return <span key={i}>{String(n.attrs?.label ?? "a page")}</span>;
    return <span key={i}>{inline(n.content)}</span>;
  });
}

function Block({ node }: { node: JNode }): React.ReactNode {
  const kids = node.content ?? [];
  switch (node.type) {
    case "paragraph":
      return <p>{inline(kids)}</p>;
    case "heading": {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 2)));
      const Tag = (["h1", "h2", "h3"] as const)[level - 1];
      return <Tag>{inline(kids)}</Tag>;
    }
    case "bulletList":
      return <ul>{kids.map((k, i) => <Block key={i} node={k} />)}</ul>;
    case "orderedList":
      return <ol start={Number(node.attrs?.start ?? 1)}>{kids.map((k, i) => <Block key={i} node={k} />)}</ol>;
    case "listItem":
      return <li>{kids.map((k, i) => <Block key={i} node={k} />)}</li>;
    case "taskList":
      return (
        <ul data-type="taskList">
          {kids.map((k, i) => (
            <Block key={i} node={k} />
          ))}
        </ul>
      );
    case "taskItem":
      return (
        <li data-type="taskItem" data-checked={node.attrs?.checked === true ? "true" : "false"}>
          <label>
            <input type="checkbox" checked={node.attrs?.checked === true} disabled readOnly />
          </label>
          <div>{kids.map((k, i) => <Block key={i} node={k} />)}</div>
        </li>
      );
    case "blockquote":
      return <blockquote>{kids.map((k, i) => <Block key={i} node={k} />)}</blockquote>;
    case "horizontalRule":
      return <hr />;
    case "codeBlock": {
      const language = canonicalLanguage(node.attrs?.language);
      const code = (kids ?? []).map((k) => k.text ?? "").join("");
      return (
        <div className="nt-code">
          <div className="nt-code-head">
            <span className="nt-code-lang">
              <span className="nt-code-name">{languageLabel(language)}</span>
            </span>
          </div>
          <pre>
            <code className={`language-${language}`}>{highlighted(code, language)}</code>
          </pre>
        </div>
      );
    }
    case "image": {
      const src = node.attrs?.src;
      if (!isHttp(src)) return null;
      const width = Number(node.attrs?.width ?? 100);
      return (
        <div className="nt-image">
          <span className="nt-image-frame" style={{ maxWidth: `${width}%` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sized(src, 1400)} alt={typeof node.attrs?.alt === "string" ? node.attrs.alt : ""} loading="lazy" />
          </span>
        </div>
      );
    }
    case "linkPreview": {
      const url = node.attrs?.url;
      if (!isHttp(url)) return null;
      const title = typeof node.attrs?.title === "string" ? node.attrs.title : null;
      const description = typeof node.attrs?.description === "string" ? node.attrs.description : null;
      const image = node.attrs?.image;
      const site = (typeof node.attrs?.site === "string" ? node.attrs.site : null) ?? siteOf(url);
      const embed = node.attrs?.layout === "embed" ? embedFor(url) : null;
      if (embed) {
        return (
          <div className="nt-link">
            <div className={`nt-embed nt-embed-${embed.shape}`}>
              <iframe src={embed.src} title={title ?? embed.provider} loading="lazy" allow="accelerometer; autoplay; encrypted-media; picture-in-picture; web-share; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
            </div>
          </div>
        );
      }
      return (
        <div className="nt-link">
          <a href={url} target="_blank" rel="noreferrer noopener nofollow" className="nt-link-card">
            <span className="nt-link-words">
              <span className="nt-link-title">{title || url}</span>
              {description && <span className="nt-link-desc">{description}</span>}
              <span className="nt-link-site">{site}</span>
            </span>
            {isHttp(image) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="nt-link-thumb" loading="lazy" referrerPolicy="no-referrer" />
            )}
          </a>
        </div>
      );
    }
    case "details":
      return (
        <details data-type="details" open>
          {kids.map((k, i) => (
            <Block key={i} node={k} />
          ))}
        </details>
      );
    case "detailsSummary":
      return <summary>{inline(kids)}</summary>;
    case "detailsContent":
      return <div data-type="detailsContent">{kids.map((k, i) => <Block key={i} node={k} />)}</div>;
    case "callout":
      return (
        <div className="jr-callout" data-type="callout">
          <span className="jr-callout-emoji">{String(node.attrs?.emoji ?? "💭")}</span>
          <div>{kids.map((k, i) => <Block key={i} node={k} />)}</div>
        </div>
      );
    case "table":
      return (
        <div className="tableWrapper">
          <table className="nt-table">
            <tbody>
              {kids.map((k, i) => (
                <Block key={i} node={k} />
              ))}
            </tbody>
          </table>
        </div>
      );
    case "tableRow":
      return <tr>{kids.map((k, i) => <Block key={i} node={k} />)}</tr>;
    case "tableHeader":
      return <th colSpan={Number(node.attrs?.colspan ?? 1)} rowSpan={Number(node.attrs?.rowspan ?? 1)}>{kids.map((k, i) => <Block key={i} node={k} />)}</th>;
    case "tableCell":
      return <td colSpan={Number(node.attrs?.colspan ?? 1)} rowSpan={Number(node.attrs?.rowspan ?? 1)}>{kids.map((k, i) => <Block key={i} node={k} />)}</td>;
    // a sub-page of theirs: named, but not a door into anything
    case "pageLink":
      return null;
    case "taskRef":
      return <p>{String(node.attrs?.title ?? "")}</p>;
    default:
      return kids.length ? <div>{kids.map((k, i) => <Block key={i} node={k} />)}</div> : null;
  }
}

export function ReadOnlyDoc({ doc }: { doc: JNode }) {
  return (
    <div className="jr-prose nt-prose" data-read-only>
      {(doc.content ?? []).map((node, i) => (
        <Block key={i} node={node} />
      ))}
    </div>
  );
}
