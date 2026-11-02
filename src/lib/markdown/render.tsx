import Link from "next/link";
import type { ReactNode } from "react";
import type { Block, Inline } from "./parse";

/**
 * Drzewo z `parseMarkdown` jako elementy React. Bez dangerouslySetInnerHTML: tekst zawsze
 * jest escapowany przez Reacta, a adresy linków przeszły już przez `safeHref`.
 */
export function Markdown({ blocks }: { blocks: Block[] }) {
  return <>{blocks.map(renderBlock)}</>;
}

const HEADING_CLASS: Record<number, string> = {
  1: "text-2xl font-semibold tracking-tight lg:text-[28px]",
  2: "mt-9 text-lg font-semibold tracking-tight",
  3: "mt-6 text-base font-semibold",
  4: "mt-5 font-semibold",
  5: "mt-4 font-semibold",
  6: "mt-4 font-semibold",
};

function renderBlock(block: Block, key: number): ReactNode {
  switch (block.type) {
    case "heading": {
      const Tag = `h${block.level}` as const;
      return (
        <Tag key={key} id={block.id} className={`scroll-mt-6 ${HEADING_CLASS[block.level]}`}>
          {renderInlines(block.children)}
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p key={key} className="mt-3">
          {renderInlines(block.children)}
        </p>
      );
    case "list": {
      const className = `mt-3 space-y-1.5 pl-6 ${block.ordered ? "list-decimal" : "list-disc"} marker:text-ink-3`;
      const items = block.items.map((item, i) => <li key={i}>{renderListItem(item)}</li>);
      return block.ordered ? (
        <ol key={key} start={block.start === 1 ? undefined : block.start} className={className}>
          {items}
        </ol>
      ) : (
        <ul key={key} className={className}>
          {items}
        </ul>
      );
    }
    case "blockquote":
      return (
        <blockquote key={key} className="mt-4 border-l-2 border-line pl-4 text-ink-2">
          {block.children.map(renderBlock)}
        </blockquote>
      );
    case "table":
      // Przewijanie w ramce tabeli, nie całej strony (SPEC 13: brak poziomego przewijania).
      return (
        <div key={key} className="mt-4 overflow-x-auto rounded-lg border border-line" tabIndex={0}>
          <table className="w-full min-w-[480px] border-collapse text-left text-[13.5px]">
            <thead className="bg-surface">
              <tr>
                {block.header.map((cell, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="border-b border-line px-3 py-2 align-bottom font-semibold"
                  >
                    {renderInlines(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r} className="border-b border-line last:border-b-0">
                  {row.map((cell, c) => (
                    <td key={c} className="px-3 py-2 align-top">
                      {renderInlines(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "hr":
      return <hr key={key} className="mt-8 border-line" />;
  }
}

/** W elemencie listy pierwszy akapit bez <p>, żeby zwarte listy nie miały odstępów. */
function renderListItem(blocks: Block[]): ReactNode {
  const [first, ...rest] = blocks;
  if (first?.type !== "paragraph") return blocks.map(renderBlock);
  return (
    <>
      {renderInlines(first.children)}
      {rest.map((b, i) => renderBlock(b, i + 1))}
    </>
  );
}

function renderInlines(nodes: Inline[]): ReactNode {
  return nodes.map(renderInline);
}

function renderInline(node: Inline, key: number): ReactNode {
  switch (node.type) {
    case "text":
      return node.value;
    case "strong":
      return (
        <strong key={key} className="font-semibold">
          {renderInlines(node.children)}
        </strong>
      );
    case "em":
      return <em key={key}>{renderInlines(node.children)}</em>;
    case "code":
      return (
        <code key={key} className="rounded bg-surface px-1 py-px text-[0.92em] [overflow-wrap:anywhere]">
          {node.value}
        </code>
      );
    case "link":
      return node.href.startsWith("/") || node.href.startsWith("#") ? (
        <Link key={key} href={node.href} className="text-brand underline underline-offset-2">
          {renderInlines(node.children)}
        </Link>
      ) : (
        <a
          key={key}
          href={node.href}
          rel="noopener noreferrer"
          className="text-brand underline underline-offset-2"
        >
          {renderInlines(node.children)}
        </a>
      );
  }
}
