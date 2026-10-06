import { Fragment, type ReactNode } from "react";

// A small Markdown renderer for the vault: headings, paragraphs, lists, tables, bold, italics, code,
// external links and [[wiki links]]. Builds React elements, never raw HTML.

function inline(text: string, onLink: (id: string) => void, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\[\[([^\]|]+)(?:\|([^\]]*))?\]\])|(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[1]) {
      const id = m[2]!.trim();
      out.push(
        <button key={k} type="button" className="md-wiki" onClick={() => onLink(id)}>
          {m[3] ?? id}
        </button>,
      );
    } else if (m[4]) {
      out.push(
        <a key={k} href={m[6]} target="_blank" rel="noopener noreferrer">
          {m[5]}
        </a>,
      );
    } else if (m[7]) out.push(<strong key={k}>{inline(m[8]!, onLink, k)}</strong>);
    else if (m[9]) out.push(<em key={k}>{m[10]}</em>);
    else if (m[11]) out.push(<code key={k}>{m[12]}</code>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, onLink }: { text: string; onLink: (id: string) => void }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let n = 0;
  while (i < lines.length) {
    const l = lines[i]!;
    const k = `b${n++}`;
    if (!l.trim()) {
      i++;
      continue;
    }
    const h = l.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const lvl = h[1]!.length;
      const C = lvl === 1 ? "h2" : lvl === 2 ? "h3" : "h4";
      blocks.push(<C key={k}>{inline(h[2]!, onLink, k)}</C>);
      i++;
      continue;
    }
    if (/^\|/.test(l)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i]!)) {
        const cells = lines[i]!.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells);
        i++;
      }
      blocks.push(
        <table key={k}>
          <thead>
            <tr>
              {rows[0]!.map((c, j) => (
                <th key={j}>{inline(c, onLink, `${k}h${j}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(1).map((r, ri) => (
              <tr key={ri}>
                {r.map((c, j) => (
                  <td key={j}>{inline(c, onLink, `${k}r${ri}c${j}`)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      );
      continue;
    }
    if (/^(\s*[-*]|\s*\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l);
      const items: string[] = [];
      while (i < lines.length && /^(\s*[-*]|\s*\d+\.)\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^(\s*[-*]|\s*\d+\.)\s+/, ""));
      const L = ordered ? "ol" : "ul";
      blocks.push(
        <L key={k}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, onLink, `${k}i${j}`)}</li>
          ))}
        </L>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,3}\s|\||\s*[-*]\s|\s*\d+\.\s)/.test(lines[i]!)) para.push(lines[i++]!);
    // like Obsidian: a single newline inside a paragraph is a line break
    blocks.push(
      <p key={k}>
        {para.map((ln, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(ln, onLink, `${k}l${j}`)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <Fragment>{blocks}</Fragment>;
}
