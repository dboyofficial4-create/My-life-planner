/**
 * A small, safe Markdown renderer for Coach replies: paragraphs, headings, bullet and numbered
 * lists, bold, italic, inline code and http(s) links. It builds React elements only (never
 * innerHTML), so nothing in a reply can run as code.
 */
import { Fragment, type ReactNode } from 'react';
import { parseBlocks } from '@shared/text/markdown';

function safeHref(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

/** Inline: **bold**, *italic* / _italic_, `code`, [text](url), bare https links. */
export function inline(text: string, key = 'i'): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(\*([^*\s][^*]*)\*)|(_([^_\s][^_]*)_)|(https?:\/\/[^\s)]+[^\s).,;:!?])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${n++}`;
    if (m[2]) out.push(<strong key={k}>{inline(m[2], k)}</strong>);
    else if (m[4]) out.push(<code key={k}>{m[4]}</code>);
    else if (m[6] && m[7]) {
      const href = safeHref(m[7]);
      out.push(href ? <a key={k} href={href} target="_blank" rel="noopener noreferrer">{m[6]}</a> : m[6]);
    } else if (m[9]) out.push(<em key={k}>{m[9]}</em>);
    else if (m[11]) out.push(<em key={k}>{m[11]}</em>);
    else if (m[12]) {
      const href = safeHref(m[12]);
      out.push(href ? <a key={k} href={href} target="_blank" rel="noopener noreferrer">{new URL(href).hostname.replace(/^www\./, '')}</a> : m[12]);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  return (
    <>
      {parseBlocks(text).map((b, i) => {
        const k = `b${i}`;
        switch (b.t) {
          case 'h':
            return b.level <= 2 ? <h3 key={k}>{inline(b.text, k)}</h3> : <h4 key={k}>{inline(b.text, k)}</h4>;
          case 'ul':
            return <ul key={k}>{b.items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}`)}</li>)}</ul>;
          case 'ol':
            return <ol key={k}>{b.items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}`)}</li>)}</ol>;
          case 'hr':
            return <hr key={k} />;
          default:
            return <p key={k}>{inline(b.text, k).map((n, j) => <Fragment key={j}>{n}</Fragment>)}</p>;
        }
      })}
    </>
  );
}
