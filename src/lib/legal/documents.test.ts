import { describe, expect, it } from "vitest";
import { locales } from "@/i18n/config";
import type { Block } from "@/lib/markdown/parse";
import { inlineText } from "@/lib/markdown/parse";
import { isLegalSlug, legalHref, legalSlugs, loadLegalDocument, publicPart } from "./documents";

function allText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "heading":
        case "paragraph":
          return inlineText(b.children);
        case "blockquote":
          return allText(b.children);
        case "list":
          return b.items.map(allText).join("\n");
        case "table":
          return [b.header, ...b.rows].map((r) => r.map(inlineText).join(" ")).join("\n");
        case "hr":
          return "";
      }
    })
    .join("\n");
}

function headingLevels(blocks: Block[]): number[] {
  return blocks.flatMap((b) => (b.type === "heading" ? [b.level] : []));
}

describe("publicPart", () => {
  const doc = [
    "# Tytuł",
    "",
    "> szkic",
    "**Miejsca do uzupełnienia:** [X]",
    "",
    "---",
    "",
    "## 1. Treść",
    "Akapit.",
    "",
    "---",
    "",
    "**Uwagi dla radcy**",
  ].join("\n");

  it("bierze tytuł i treść między pierwszą a drugą linią ---", () => {
    expect(publicPart(doc)).toEqual({ title: "Tytuł", body: "## 1. Treść\nAkapit." });
  });

  it("bez linii --- cała treść bez tytułu", () => {
    expect(publicPart("# T\n\nTekst")).toEqual({ title: "T", body: "Tekst" });
  });

  it("od wskazanego nagłówka, z przesunięciem poziomów", () => {
    const risk = "# R\n\n---\n\n## A. Krótka\n\nwewnętrzne\n\n## B. Pełna\n\n### 1. Punkt\n\ntekst";
    expect(publicPart(risk, { from: /^## B\./, shiftHeadings: -1 })).toEqual({
      title: "R",
      body: "## 1. Punkt\n\ntekst",
    });
  });

  it("CRLF", () => {
    expect(publicPart(doc.replace(/\n/g, "\r\n")).body).toBe("## 1. Treść\nAkapit.");
  });
});

describe("dokumenty z docs/prawne", () => {
  for (const slug of legalSlugs) {
    for (const locale of locales) {
      it(`${slug} (${locale}): tylko część publiczna`, async () => {
        const { title, blocks } = await loadLegalDocument(slug, locale);
        expect(title.length).toBeGreaterThan(3);
        expect(blocks.length).toBeGreaterThan(3);
        const text = allText(blocks);
        // Bez notatek dla właściciela i radcy.
        expect(text).not.toMatch(
          /Miejsca do uzupełnienia|Placeholders to fill in|Uwagi dla radcy|Do potwierdzenia po Etapie|To confirm after Stage/,
        );
        expect(text).not.toMatch(/SZKIC —|DRAFT —/);
        // Nagłówki od h2 (h1 to tytuł strony), bez przeskoków poziomów w dół o więcej niż jeden.
        const levels = headingLevels(blocks);
        expect(levels.length).toBeGreaterThan(0);
        expect(Math.min(...levels)).toBe(2);
        levels.forEach((l, i) => i > 0 && expect(l - levels[i - 1]).toBeLessThanOrEqual(1));
      });
    }
  }

  it("informacja o ryzyku bez części A (teksty ze słownika)", async () => {
    for (const locale of locales) {
      const text = allText((await loadLegalDocument("risk", locale)).blocks);
      expect(text).not.toMatch(/disclaimerResults|Wersja krótka/);
    }
  });
});

describe("adresy", () => {
  it("usuwanie konta ma stały adres, reszta pod /legal", () => {
    expect(legalHref("delete-account")).toBe("/delete-account");
    expect(legalHref("terms")).toBe("/legal/terms");
    expect(isLegalSlug("privacy")).toBe(true);
    expect(isLegalSlug("../etc")).toBe(false);
  });
});
