# Majątek — zestaw referencyjny (Etap 5)

Scenariusz liczony ręcznie, sprawdzany dwa razy:

- `src/lib/portfolio/ledger/reference.test.ts` — czyste funkcje (parser CSV, mapowanie, FIFO, wycena), bez bazy;
- `e2e/assets.spec.ts` — ten sam scenariusz wyklikany na ekranach (konto, import pliku, kupno, sprzedaż, cena ręczna).

Dzień wyceny: 3 listopada 2026 (w e2e: dzień uruchomienia testu, scenariusz używa dat z października 2026).

## Konto osobiste (rachunek, PLN)

| Data       | Operacja                             | Kwota     | Saldo     |
| ---------- | ------------------------------------ | --------- | --------- |
| 01.10.2026 | saldo startowe przy zakładaniu konta | 10 000,00 | 10 000,00 |
| 02.10.2026 | import: Wynagrodzenie za wrzesień    | +8 000,00 | 18 000,00 |
| 05.10.2026 | import: Czynsz                       | −2 150,00 | 15 850,00 |
| 06.10.2026 | import: Kawa „Pod Lipą”              | −12,50    | 15 837,50 |

Plik: `e2e/data/wyciag-przyklad.csv` (UTF-8, separator `;`, metryczka banku nad nagłówkiem, liczby `1 234,56`, pole w cudzysłowie z cudzysłowem w środku). Ponowny import tego pliku: 3 duplikaty, 0 nowych transakcji.

## IKE (konto maklerskie, PLN)

Instrument ręczny „ETF testowy” (PLN), cena ręczna 120,00 zł z dnia wyceny.

| Data       | Operacja                                 | Rozliczenie |
| ---------- | ---------------------------------------- | ----------- |
| 10.10.2026 | kupno 10 szt. po 100,00, prowizja 5,00   | −1 005,00   |
| 20.10.2026 | sprzedaż 4 szt. po 110,00, prowizja 3,00 | +437,00     |

- Partia FIFO: koszt jednostkowy (10 × 100 + 5) / 10 = 100,50 zł.
- Sprzedaż 4 szt.: koszt 402,00, przychód 440 − 3 = 437,00, **wynik zrealizowany +35,00 zł**.
- Zostaje 6 szt., **koszt nabycia 603,00 zł**, wartość 6 × 120 = **720,00 zł**, **wynik +117,00 zł (+19,4%)**.
- Gotówka na koncie: kupno bez wcześniejszej wpłaty jest traktowane jak dopłata z zewnątrz (gotówka nie spada poniżej zera), sprzedaż daje **437,00 zł** gotówki.
- Wartość konta: 720,00 + 437,00 = **1 157,00 zł**.
- Sprzedaż 10 szt. po tej sprzedaży: błąd „Nie możesz sprzedać 10 szt.: na dzień … masz 6 szt.”.

## Wartość netto

15 837,50 + 1 157,00 = **16 994,50 zł** (brak zobowiązań).
