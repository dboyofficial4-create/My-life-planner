/** Splits Markdown into blocks (paragraphs, headings, lists, rules). Rendering is in markdown.tsx. */
export type Block = { t: 'p'; text: string } | { t: 'h'; level: number; text: string } | { t: 'ul' | 'ol'; items: string[] } | { t: 'hr' };

export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ t: 'p', text: para.join(' ') });
    para = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (!line.trim()) flush();
    else if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flush();
      blocks.push({ t: 'hr' });
    } else if (h) {
      flush();
      blocks.push({ t: 'h', level: h[1]!.length, text: h[2]! });
    } else if (ul || ol) {
      flush();
      const kind = ul ? 'ul' : 'ol';
      const prev = blocks[blocks.length - 1];
      if (prev && prev.t === kind) prev.items.push((ul ?? ol)![1]!);
      else blocks.push({ t: kind, items: [(ul ?? ol)![1]!] });
    } else if (/^\s{2,}\S/.test(raw) && blocks.length && (blocks[blocks.length - 1]!.t === 'ul' || blocks[blocks.length - 1]!.t === 'ol') && !para.length) {
      // continuation of the last list item
      const prev = blocks[blocks.length - 1] as { items: string[] };
      prev.items[prev.items.length - 1] += ` ${line.trim()}`;
    } else para.push(line.trim());
  }
  flush();
  return blocks;
}
