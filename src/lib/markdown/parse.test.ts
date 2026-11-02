import { describe, expect, it } from "vitest";
import { inlineText, parseInline, parseMarkdown, safeHref, slugify } from "./parse";

describe("parseInline", () => {
  it("tekst, pogrubienie, kursywa i kod", () => {
    expect(parseInline("a **b** *c* `d`")).toEqual([
      { type: "text", value: "a " },
      { type: "strong", children: [{ type: "text", value: "b" }] },
      { type: "text", value: " " },
      { type: "em", children: [{ type: "text", value: "c" }] },
      { type: "text", value: " " },
      { type: "code", value: "d" },
    ]);
  });

  it("zagnieżdżenie w pogrubieniu", () => {
    expect(parseInline("**Ustawienia → `Dane`**")).toEqual([
      {
        type: "strong",
        children: [
          { type: "text", value: "Ustawienia → " },
          { type: "code", value: "Dane" },
        ],
      },
    ]);
  });

  it("niedomknięte znaczniki zostają tekstem", () => {
    expect(parseInline("2 * 3 i **bez końca")).toEqual([{ type: "text", value: "2 * 3 i **bez końca" }]);
    expect(parseInline("`kod")).toEqual([{ type: "text", value: "`kod" }]);
    expect(parseInline("[tekst](bez-nawiasu")).toEqual([{ type: "text", value: "[tekst](bez-nawiasu" }]);
  });

  it("nawiasy kwadratowe bez adresu to zwykły tekst (pola do uzupełnienia)", () => {
    expect(parseInline("Kontakt: [E-MAIL KONTAKTOWY].")).toEqual([
      { type: "text", value: "Kontakt: [E-MAIL KONTAKTOWY]." },
    ]);
  });

  it("w kodzie nie ma formatowania", () => {
    expect(parseInline("`**a**`")).toEqual([{ type: "code", value: "**a**" }]);
  });

  it("znaki ucieczki", () => {
    expect(parseInline("\\*nie kursywa\\*")).toEqual([{ type: "text", value: "*nie kursywa*" }]);
  });

  it("linki z bezpiecznym adresem", () => {
    expect(parseInline("[Regulamin](/legal/terms)")).toEqual([
      { type: "link", href: "/legal/terms", children: [{ type: "text", value: "Regulamin" }] },
    ]);
    expect(parseInline("[UOKiK](https://uokik.gov.pl)")[0]).toMatchObject({ type: "link" });
    expect(parseInline("[napisz](mailto:a@b.pl)")[0]).toMatchObject({ type: "link" });
  });

  it("niebezpieczny adres linku zostaje samym tekstem", () => {
    for (const href of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html,x",
      "//evil.example",
      "vbscript:x",
    ]) {
      expect(parseInline(`[kliknij](${href})`), href).toEqual([{ type: "text", value: "kliknij" }]);
    }
  });

  it("HTML jest zwykłym tekstem (escapuje go dopiero React)", () => {
    expect(parseInline("<script>alert(1)</script> <Disclaimer>")).toEqual([
      { type: "text", value: "<script>alert(1)</script> <Disclaimer>" },
    ]);
  });
});

describe("safeHref", () => {
  it("dopuszcza tylko znane schematy i ścieżki lokalne", () => {
    expect(safeHref("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(safeHref("/delete-account")).toBe("/delete-account");
    expect(safeHref("#sekcja-2")).toBe("#sekcja-2");
    expect(safeHref("/\\evil.example")).toBeNull();
    expect(safeHref("regulamin.md")).toBeNull();
    expect(safeHref("ftp://x")).toBeNull();
  });
});

describe("parseMarkdown", () => {
  it("nagłówki z unikalnymi kotwicami", () => {
    const blocks = parseMarkdown("# Tytuł\n\n## § 1. Postanowienia ogólne\n\n## Zmiany\n\n## Zmiany");
    expect(blocks.map((b) => (b.type === "heading" ? [b.level, b.id] : null))).toEqual([
      [1, "tytul"],
      [2, "1-postanowienia-ogolne"],
      [2, "zmiany"],
      [2, "zmiany-2"],
    ]);
  });

  it("akapity łączą wiersze, pusta linia je rozdziela", () => {
    expect(parseMarkdown("pierwszy\ndrugi\n\ntrzeci")).toEqual([
      { type: "paragraph", children: [{ type: "text", value: "pierwszy drugi" }] },
      { type: "paragraph", children: [{ type: "text", value: "trzeci" }] },
    ]);
  });

  it("CRLF jak LF", () => {
    expect(parseMarkdown("a\r\nb\r\n\r\nc")).toEqual(parseMarkdown("a\nb\n\nc"));
  });

  it("linia pozioma i cytat", () => {
    expect(parseMarkdown("> **SZKIC** tekst\n> dalej\n\n---")).toEqual([
      {
        type: "blockquote",
        children: [
          {
            type: "paragraph",
            children: [
              { type: "strong", children: [{ type: "text", value: "SZKIC" }] },
              { type: "text", value: " tekst dalej" },
            ],
          },
        ],
      },
      { type: "hr" },
    ]);
  });

  it("lista numerowana z zagnieżdżoną (jak § 6 regulaminu)", () => {
    const blocks = parseMarkdown(
      [
        "1. Nie wolno:",
        "   1. podawać danych cudzych,",
        "   2. przeciążać Usługi.",
        "2. Za dane odpowiadasz Ty.",
        "",
        "Po liście.",
      ].join("\n"),
    );
    expect(blocks).toHaveLength(2);
    const list = blocks[0];
    expect(list).toMatchObject({ type: "list", ordered: true, start: 1 });
    if (list.type !== "list") throw new Error();
    expect(list.items).toHaveLength(2);
    expect(list.items[0][0]).toEqual({
      type: "paragraph",
      children: [{ type: "text", value: "Nie wolno:" }],
    });
    expect(list.items[0][1]).toMatchObject({ type: "list", ordered: true, items: [[{}], [{}]] });
    expect(blocks[1]).toEqual({ type: "paragraph", children: [{ type: "text", value: "Po liście." }] });
  });

  it("lista punktowana, numer startowy, zmiana rodzaju listy", () => {
    const blocks = parseMarkdown("- a\n- b\n3. c\n4. d");
    expect(blocks.map((b) => b.type === "list" && [b.ordered, b.start, b.items.length])).toEqual([
      [false, 1, 2],
      [true, 3, 2],
    ]);
  });

  it("pusta linia między elementami nie kończy listy", () => {
    const blocks = parseMarkdown("- a\n\n- b\n\nakapit");
    expect(blocks[0]).toMatchObject({ type: "list", items: [[{}], [{}]] });
    expect(blocks[1]).toMatchObject({ type: "paragraph" });
  });

  it("akapit przechodzi w listę bez pustej linii", () => {
    const blocks = parseMarkdown("**Miejsca do uzupełnienia:**\n- [NIP]\n- [REGON]");
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "list"]);
  });

  it("tabela z kodem, \\| i brakującymi komórkami", () => {
    const blocks = parseMarkdown(
      [
        "| Nazwa | Do czego |",
        "| ----- | :------: |",
        "| `a|b` | x \\| y |",
        "| tylko jedna |",
        "",
        "dalej",
      ].join("\n"),
    );
    expect(blocks[0]).toEqual({
      type: "table",
      header: [[{ type: "text", value: "Nazwa" }], [{ type: "text", value: "Do czego" }]],
      rows: [
        [[{ type: "code", value: "a|b" }], [{ type: "text", value: "x | y" }]],
        [[{ type: "text", value: "tylko jedna" }], []],
      ],
    });
    expect(blocks[1]).toMatchObject({ type: "paragraph" });
  });

  it("wiersz z kreską bez separatora to zwykły akapit", () => {
    expect(parseMarkdown("| nie tabela |")).toEqual([
      { type: "paragraph", children: [{ type: "text", value: "| nie tabela |" }] },
    ]);
  });
});

describe("slugify i inlineText", () => {
  it("polskie znaki", () => {
    expect(slugify("Zażółć gęślą jaźń — Łódź")).toBe("zazolc-gesla-jazn-lodz");
  });
  it("tekst z drzewa", () => {
    expect(inlineText(parseInline("a **b `c`** [d](/e)"))).toBe("a b c d");
  });
});
