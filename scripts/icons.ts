/**
 * Ikony PWA, apple-touch-icon, favicon i obraz Open Graph z jednego znaku „N” (SVG).
 * Bez nowych zależności: PNG renderuje przeglądarka z Playwrighta.
 * Uruchom po zmianie znaku lub kolorów marki: `PW_CHANNEL=msedge npx tsx scripts/icons.ts`.
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// Kolory marki z SPEC 20 / globals.css (tu wpisane, bo PNG nie zna zmiennych CSS).
const BRAND = "#2f4fe0";
const ON_BRAND = "#ffffff";
const BG = "#f5f7ff";
const INK = "#0f1638";
const INK_2 = "#3e4a78";
const DOWN_SOFT = "#fbe3e0";
const BRAND_SOFT = "#e4e9ff";

/** Litera N z trzech wielokątów w polu 512 × 512; `scale` zmniejsza ją wokół środka. */
function letterN(scale: number) {
  const w = 200 * scale;
  const h = 240 * scale;
  const stem = 56 * scale;
  const x = 256 - w / 2;
  const y = 256 - h / 2;
  return [
    `<rect x="${x}" y="${y}" width="${stem}" height="${h}"/>`,
    `<rect x="${x + w - stem}" y="${y}" width="${stem}" height="${h}"/>`,
    `<polygon points="${x},${y} ${x + stem},${y} ${x + w},${y + h} ${x + w - stem},${y + h}"/>`,
  ].join("");
}

/** Zwykła ikona: zaokrąglony kwadrat. Maskowalna: tło do krawędzi, znak w strefie bezpiecznej (80%). */
export function iconSvg(kind: "any" | "maskable" | "touch") {
  const rounded = kind === "any";
  const scale = kind === "maskable" ? 0.72 : 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" ${rounded ? 'rx="112"' : ""} fill="${BRAND}"/>
<g fill="${ON_BRAND}">${letterN(scale)}</g>
</svg>`;
}

function ogHtml() {
  // Linia bilansu (SPEC 20) jako tło: aktywa nad zerem, zobowiązania pod nim, linia netto.
  return `<!doctype html><html><body style="margin:0">
<div style="width:1200px;height:630px;background:${BG};display:flex;flex-direction:column;justify-content:space-between;padding:72px 80px;box-sizing:border-box;font-family:'Segoe UI',system-ui,sans-serif;color:${INK}">
  <div style="display:flex;align-items:center;gap:20px">
    <div style="width:72px;height:72px">${iconSvg("any")}</div>
    <span style="font-size:44px;font-weight:700;color:${BRAND};letter-spacing:-0.5px">Neto</span>
  </div>
  <div>
    <div style="font-size:68px;font-weight:600;letter-spacing:-1.5px;line-height:1.05">Cały majątek<br>w jednej liczbie</div>
    <div style="margin-top:20px;font-size:28px;color:${INK_2}">Konta, inwestycje, nieruchomości i kredyty w złotówkach</div>
  </div>
  <svg style="position:absolute;right:80px;top:150px" width="420" height="300" viewBox="0 0 560 260">
    <polygon points="0,70 80,64 160,68 240,56 320,60 400,48 480,42 560,34 560,170 0,170" fill="${BRAND_SOFT}"/>
    <polygon points="0,170 560,170 560,209 480,212 400,215 320,218 240,221 160,224 80,227 0,230" fill="${DOWN_SOFT}"/>
    <line x1="0" y1="170" x2="560" y2="170" stroke="${INK_2}" stroke-width="1.5"/>
    <polyline points="0,130 80,121 160,122 240,107 320,108 400,93 480,84 560,73" fill="none" stroke="${BRAND}" stroke-width="5" stroke-linejoin="round"/>
  </svg>
</div></body></html>`;
}

/** ICO z osadzonymi PNG (obsługiwane przez wszystkie współczesne przeglądarki). */
function ico(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

async function main() {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
  const page = await browser.newPage();

  async function render(svg: string, size: number): Promise<Buffer> {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</div></body></html>`,
    );
    return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  }

  const root = process.cwd();
  const icons = path.join(root, "public/icons");
  mkdirSync(icons, { recursive: true });
  writeFileSync(path.join(icons, "icon.svg"), iconSvg("any"));
  writeFileSync(path.join(icons, "icon-192.png"), await render(iconSvg("any"), 192));
  writeFileSync(path.join(icons, "icon-512.png"), await render(iconSvg("any"), 512));
  writeFileSync(path.join(icons, "maskable-192.png"), await render(iconSvg("maskable"), 192));
  writeFileSync(path.join(icons, "maskable-512.png"), await render(iconSvg("maskable"), 512));
  // Konwencje plików Next: link rel="icon" i rel="apple-touch-icon" dodają się same.
  writeFileSync(path.join(root, "src/app/icon.svg"), iconSvg("any"));
  writeFileSync(path.join(root, "src/app/apple-icon.png"), await render(iconSvg("touch"), 180));
  writeFileSync(
    path.join(root, "src/app/favicon.ico"),
    ico([
      { size: 32, png: await render(iconSvg("any"), 32) },
      { size: 48, png: await render(iconSvg("any"), 48) },
    ]),
  );

  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(ogHtml());
  writeFileSync(
    path.join(icons, "og.png"),
    await page.screenshot({ clip: { x: 0, y: 0, width: 1200, height: 630 } }),
  );

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
