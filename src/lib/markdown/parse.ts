/**
 * Mały parser Markdown do dokumentów z `docs/prawne/` (bez zależności).
 * Zwraca drzewo, które renderuje `render.tsx` jako elementy React: surowy HTML nigdy nie przechodzi,
 * bo tekst zawsze trafia do Reacta jako tekst. Obsługuje tylko to, czego używają dokumenty:
 * nagłówki, akapity, pogrubienie, kursywę, kod w linii, linki, listy (także zagnieżdżone),
 * cytaty, tabele i linie poziome.
 */

export type Inline =
  | { type: "text"; value: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "code"; value: string }
  | { type: "link"; href: string; children: Inline[] };

export type Block =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; id: string; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; ordered: boolean; start: number; items: Block[][] }
  | { type: "blockquote"; children: Block[] }
  | { type: "table"; header: Inline[][]; rows: Inline[][][] }
  | { type: "hr" };

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const HR = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>\s?/;
const LIST_ITEM = /^(\s*)([-*+]|(\d{1,9})[.)])\s+(.*)$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks = parseBlocks(lines);
  assignHeadingIds(blocks, new Map());
  return blocks;
}

function indentOf(line: string): number {
  return line.match(/^\s*/)![0].replace(/\t/g, "    ").length;
}

function isTableStart(lines: string[], i: number): boolean {
  return lines[i].trim().startsWith("|") && i + 1 < lines.length && TABLE_SEPARATOR.test(lines[i + 1]);
}

function startsBlock(lines: string[], i: number): boolean {
  const line = lines[i];
  return (
    HEADING.test(line) || HR.test(line) || QUOTE.test(line) || LIST_ITEM.test(line) || isTableStart(lines, i)
  );
}

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    const heading = line.match(HEADING);
    if (heading) {
      const level = heading[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({ type: "heading", level, id: "", children: parseInline(heading[2]) });
      i++;
      continue;
    }
    if (HR.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) inner.push(lines[i++].replace(QUOTE, ""));
      blocks.push({ type: "blockquote", children: parseBlocks(inner) });
      continue;
    }
    if (isTableStart(lines, i)) {
      const header = splitRow(lines[i]);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = splitRow(lines[i++]);
        // Wiersz krótszy niż nagłówek dopełniamy pustymi komórkami, dłuższy przycinamy.
        rows.push(header.map((_, c) => parseInline(cells[c] ?? "")));
      }
      blocks.push({ type: "table", header: header.map(parseInline), rows });
      continue;
    }
    if (LIST_ITEM.test(line)) {
      i = parseList(lines, i, blocks);
      continue;
    }
    const text: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && (text.length === 0 || !startsBlock(lines, i))) {
      text.push(lines[i++].trim());
    }
    blocks.push({ type: "paragraph", children: parseInline(text.join(" ")) });
  }
  return blocks;
}

/** Lista od wiersza `start`; zwraca indeks pierwszego wiersza za listą. */
function parseList(lines: string[], start: number, out: Block[]): number {
  const first = lines[start].match(LIST_ITEM)!;
  const baseIndent = indentOf(first[1]);
  const ordered = first[3] !== undefined;
  const items: Block[][] = [];
  let i = start;

  while (i < lines.length) {
    const m = lines[i].match(LIST_ITEM);
    if (!m || indentOf(m[1]) !== baseIndent || (m[3] !== undefined) !== ordered) break;
    // Treść elementu: pierwszy wiersz bez znacznika, potem wiersze wcięte głębiej niż znacznik.
    const contentIndent = m[1].length + m[2].length + 1;
    const body = [m[4]];
    i++;
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === "") {
        // Pusta linia kończy element, chyba że dalej jest jego wcięta kontynuacja.
        let next = i + 1;
        while (next < lines.length && lines[next].trim() === "") next++;
        if (next < lines.length && indentOf(lines[next]) > baseIndent) {
          body.push("");
          i++;
          continue;
        }
        break;
      }
      if (indentOf(line) <= baseIndent) break;
      body.push(line.slice(Math.min(contentIndent, indentOf(line))));
      i++;
    }
    items.push(parseBlocks(body));
    // Pusta linia między elementami tej samej listy jej nie kończy.
    let next = i;
    while (next < lines.length && lines[next].trim() === "") next++;
    const n = next < lines.length ? lines[next].match(LIST_ITEM) : null;
    if (n && indentOf(n[1]) === baseIndent && (n[3] !== undefined) === ordered) i = next;
    else break;
  }

  out.push({ type: "list", ordered, start: ordered ? Number(first[3]) : 1, items });
  return i;
}

/** Dzieli wiersz tabeli na komórki: pomija `\|` i kreski w kodzie. */
function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells: string[] = [];
  let current = "";
  let inCode = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && s[i + 1] === "|") {
      current += "|";
      i++;
    } else if (ch === "`") {
      inCode = !inCode;
      current += ch;
    } else if (ch === "|" && !inCode) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

const ESCAPABLE = /[\\`*_{}[\]()#+\-.!|>~]/;

/** Elementy w linii. Niedomknięte znaczniki zostają zwykłym tekstem. */
export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => {
    if (text) out.push({ type: "text", value: text });
    text = "";
  };

  let i = 0;
  while (i < source.length) {
    const ch = source[i];

    if (ch === "\\" && i + 1 < source.length && ESCAPABLE.test(source[i + 1])) {
      text += source[i + 1];
      i += 2;
      continue;
    }

    if (ch === "`") {
      const run = source.slice(i).match(/^`+/)![0];
      const end = source.indexOf(run, i + run.length);
      if (end !== -1) {
        flush();
        out.push({ type: "code", value: source.slice(i + run.length, end).trim() });
        i = end + run.length;
        continue;
      }
      text += run;
      i += run.length;
      continue;
    }

    if (source.startsWith("**", i)) {
      const end = source.indexOf("**", i + 2);
      if (end > i + 2) {
        flush();
        out.push({ type: "strong", children: parseInline(source.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    } else if (ch === "*" && source[i + 1] !== " ") {
      const end = findClosingStar(source, i + 1);
      if (end !== -1) {
        flush();
        out.push({ type: "em", children: parseInline(source.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }

    if (ch === "[") {
      const link = matchLink(source, i);
      if (link) {
        flush();
        const children = parseInline(link.label);
        const href = safeHref(link.href);
        // Niebezpieczny lub nieobsługiwany adres: zostaje sam tekst linku.
        if (href) out.push({ type: "link", href, children });
        else out.push(...children);
        i = link.end;
        continue;
      }
    }

    text += ch;
    i++;
  }
  flush();
  return mergeText(out);
}

function findClosingStar(source: string, from: number): number {
  for (let j = from; j < source.length; j++) {
    if (source[j] === "\\") {
      j++;
      continue;
    }
    if (source[j] === "*" && source[j + 1] !== "*" && source[j - 1] !== " " && j > from) return j;
  }
  return -1;
}

function matchLink(source: string, start: number): { label: string; href: string; end: number } | null {
  let depth = 0;
  let j = start;
  for (; j < source.length; j++) {
    if (source[j] === "\\") {
      j++;
      continue;
    }
    if (source[j] === "[") depth++;
    else if (source[j] === "]" && --depth === 0) break;
  }
  if (j >= source.length || source[j + 1] !== "(") return null;
  // Adres może mieć nawiasy w środku, byle zrównoważone.
  let close = -1;
  for (let k = j + 2, parens = 0; k < source.length; k++) {
    if (source[k] === "(") parens++;
    else if (source[k] === ")" && parens-- === 0) {
      close = k;
      break;
    }
  }
  if (close === -1) return null;
  const href = source.slice(j + 2, close).trim();
  if (/\s/.test(href)) return null;
  return { label: source.slice(start + 1, j), href, end: close + 1 };
}

/** Dozwolone tylko http(s), mailto, ścieżki w obrębie strony i kotwice. */
export function safeHref(href: string): string | null {
  if (/^https?:\/\/[^\s]+$/i.test(href)) return href;
  if (/^mailto:[^\s]+$/i.test(href)) return href;
  if (/^\/(?![/\\])/.test(href)) return href;
  if (/^#[\w-]+$/.test(href)) return href;
  return null;
}

function mergeText(nodes: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const node of nodes) {
    const prev = out.at(-1);
    if (node.type === "text" && prev?.type === "text") prev.value += node.value;
    else out.push(node);
  }
  return out;
}

export function inlineText(nodes: Inline[]): string {
  return nodes
    .map((n) => (n.type === "text" || n.type === "code" ? n.value : inlineText(n.children)))
    .join("");
}

/** Kotwica z nagłówka: bez polskich znaków i interpunkcji, unikalna w dokumencie. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function assignHeadingIds(blocks: Block[], used: Map<string, number>) {
  for (const block of blocks) {
    if (block.type === "heading") {
      const base = slugify(inlineText(block.children)) || "sekcja";
      const count = used.get(base) ?? 0;
      used.set(base, count + 1);
      block.id = count === 0 ? base : `${base}-${count + 1}`;
    } else if (block.type === "blockquote") {
      assignHeadingIds(block.children, used);
    } else if (block.type === "list") {
      for (const item of block.items) assignHeadingIds(item, used);
    }
  }
}
