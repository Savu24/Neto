// Zestaw referencyjny kalkulatora emerytury (SPEC 7.11), liczony niezależnie od src/lib/portfolio/retirement.ts.
// Metoda: pętla miesiąc po miesiącu (kapitał × (1 + r_m) + wpłata na koniec miesiąca), zwykłe liczby JS,
// bez wzoru zamkniętego na FV i bez decimal.js. Uruchom: node scripts/emerytura-referencja.mjs
// Wynik: docs/referencje/emerytura.csv (nadpisywany). Opis w docs/referencje/README.md.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const HORIZON_AGE = 80;

// [id, opis, wiek, wiek emerytalny, majątek startowy, wpłata/mies., wydatki/mies., ZUS/mies., stopa wypłaty, realna stopa zwrotu]
const cases = [
  ["makieta-ostrozny", "przyklad z makiety Cele 1%", 34, 60, 422870, 3500, 9000, 2500, 0.04, 0.01],
  ["makieta-bazowy", "przyklad z makiety Cele 3%", 34, 60, 422870, 3500, 9000, 2500, 0.04, 0.03],
  ["makieta-optymistyczny", "przyklad z makiety Cele 5%", 34, 60, 422870, 3500, 9000, 2500, 0.04, 0.05],
  ["stopa-zero", "r = 0 czyli PV + PMT x n", 30, 60, 200000, 4000, 5000, 1000, 0.04, 0],
  [
    "zus-ponad-wydatki",
    "ZUS >= wydatki czyli potrzebny kapital 0",
    50,
    67,
    50000,
    500,
    3000,
    3200,
    0.04,
    0.03,
  ],
  ["juz-osiagniety", "majatek startowy ponad potrzebny kapital", 45, 60, 3000000, 0, 8000, 2000, 0.04, 0.02],
  ["poza-horyzontem", "nie w tym horyzoncie do 80 lat", 55, 65, 20000, 300, 10000, 0, 0.04, 0.02],
  ["wyplata-3-5", "stopa wyplaty 3.5%", 28, 65, 15000, 1500, 7000, 1800, 0.035, 0.04],
  ["stopa-ujemna", "realna stopa -1%", 35, 67, 150000, 2500, 5000, 2000, 0.04, -0.01],
  ["emerytura-teraz", "wiek emerytalny rowny obecnemu", 62, 62, 900000, 0, 4000, 2500, 0.04, 0.03],
  ["stopa-7", "start od zera przy 7%", 25, 55, 0, 1000, 6000, 0, 0.04, 0.07],
];

function simulate([id, opis, age, retireAge, pv, pmt, spending, zus, withdrawal, r]) {
  const need = (12 * Math.max(0, spending - zus)) / withdrawal;
  const rm = Math.pow(1 + r, 1 / 12) - 1;
  let capital = pv;
  let atRetirement = null;
  let earliest = null;
  for (let a = age; ; a++) {
    // Stan w dniu urodzin `a`, po (a − age) × 12 pełnych miesiącach.
    if (a === retireAge) atRetirement = capital;
    if (earliest === null && capital >= need) earliest = a;
    if (a === HORIZON_AGE) break;
    for (let m = 0; m < 12; m++) capital = capital * (1 + rm) + pmt;
  }
  return [
    id,
    opis,
    age,
    retireAge,
    pv,
    pmt,
    spending,
    zus,
    withdrawal,
    r,
    need.toFixed(4),
    atRetirement.toFixed(4),
    atRetirement >= need ? "tak" : "nie",
    earliest ?? "",
    capital.toFixed(4),
  ];
}

const header = [
  "id",
  "opis",
  "wiek",
  "wiek_emerytalny",
  "majatek_startowy",
  "wplata_mies",
  "wydatki_mies",
  "zus_mies",
  "stopa_wyplaty",
  "stopa_zwrotu",
  "potrzebny_kapital",
  "kapital_w_wieku_emerytalnym",
  "wystarcza",
  "najwczesniejszy_wiek",
  "kapital_w_80",
];

const rows = [header, ...cases.map(simulate)].map((row) => row.join(","));
const out = fileURLToPath(new URL("../docs/referencje/emerytura.csv", import.meta.url));
writeFileSync(out, rows.join("\n") + "\n");
console.log(`Zapisano ${cases.length} przypadków do ${out}`);
