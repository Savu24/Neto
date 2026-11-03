# portfolio

Logika majątku (Etapy 5–8): pozycje, transakcje, FIFO, wycena dzienna, wartość netto, cele i kalkulator emerytury. Czyste funkcje z testami; reguły w SPEC sekcja 7.

## valuation/

Silnik wyceny bez bazy danych (SPEC 7.1–7.9). Wejście to zwykłe obiekty (`AccountInput`, `PositionInput`, `TradeInput`, `FxTable`…), które warstwa bazy mapuje z modeli Prisma. Kwoty jako `Decimal` z `src/lib/money.ts`, daty dni wyceny jako napisy `YYYY-MM-DD` (Europe/Warsaw).

| Plik                           | Co liczy                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `dates.ts`, `calendar.ts`      | arytmetyka dni, dni robocze w Polsce (weekendy + święta ustawowe, Wielkanoc liczona)                 |
| `series.ts`                    | „ostatni punkt ≤ D” dla cen, kursów, wycen i sald                                                    |
| `fx.ts`                        | kurs na dzień D z przeniesieniem na dni wolne                                                        |
| `fifo.ts`, `result.ts`         | partie FIFO, wynik zrealizowany przy sprzedaży, wynik niezrealizowany = zmiana ceny + efekt walutowy |
| `deposit.ts`                   | lokaty z kapitalizacją i odnawianiem                                                                 |
| `retail-bonds.ts`              | detaliczne obligacje skarbowe: OTS, ROR, DOR, TOS, COI, EDO, ROS, ROD                                |
| `positions.ts`, `net-worth.ts` | wartość pozycji na dzień D, wartość netto z udziałem własności, alokacja, licznik problemów          |
| `changes.ts`                   | zmiana dzienna, miesięczna i roczna z migawek                                                        |
| `staleness.ts`                 | nieaktualne ceny, kursy, wyceny ręczne i salda zobowiązań                                            |
| `xirr.ts`                      | XIRR (Newton + bisekcja), `null` = „—”                                                               |

Uwagi do decyzji:

- Lokata: wzór z SPEC 7.4 liczy pełne okresy jako `r·k/12`, a bieżący liniowo `dni/365`. Przy okresie dłuższym niż 182,5 dnia wartość dzień przed terminem jest wyższa niż w terminie (np. 10 250,68 → 10 250,00 zł). Banki zwykle liczą cały okres `dni/365`; zmiana wymaga decyzji i wpisu w SPEC.
- Obligacje: bez zaokrągleń pośrednich do groszy; kupon okresu = `100 × r × miesiące/12`. Nie porównano z kalkulatorem obligacjeskarbowe.pl.
- Kalendarz „PL” to dni publikacji kursów NBP; dni wolne giełd zagranicznych i 31.12 na GPW nie są uwzględnione (przy progu 3 dni najwyżej przyspiesza to ostrzeżenie o dzień).

## ledger/ (Etap 5)

Konta, instrumenty i transakcje na bazie (HU-2.1–2.8). Źródłem prawdy są transakcje; `Holding` i `Lot` to pamięć podręczna przeliczana FIFO po każdej zmianie kupna/sprzedaży.

| Plik                           | Co robi                                                                                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `types.ts`                     | typy kont: rodzaj, grupa na ekranie Majątek, sposób wyceny, dozwolone transakcje, znak kwoty               |
| `input.ts`, `account-input.ts` | walidacja formularzy (liczby po polsku i angielsku, data nie z przyszłości); kody błędów = klucze `err_*`  |
| `positions.ts`                 | konto + transakcje → `AccountInput` silnika wyceny (czyste)                                                |
| `service.ts`                   | zapis przez `scopedDb` w transakcji Serializable, `RecalcJob` przy dacie wstecznej, ceny ręczne, obligacje |
| `load.ts`                      | model odczytu ekranów: wartości bieżące z ostatnich cen i kursów, brak ceny/kursu = `null`, nie zero       |
| `history.ts`                   | wartość i koszt pozycji na koniec miesięcy (wykres)                                                        |

Reguły przyjęte w Etapie 5:

- `Transaction.amount` to skutek dla gotówki konta ze znakiem (kupno < 0, sprzedaż > 0); `VALUATION` i `BALANCE_SET` to nowa wartość/saldo.
- Gotówka kont inwestycyjnych: kupno zużywa gotówkę najwyżej do wysokości salda, reszta to dopłata z zewnątrz (konto z samymi kupnami nie ma ujemnej gotówki, a sprzedaż daje gotówkę). W obrębie dnia kolejność zapisu, kupna na końcu dnia.
- Gotówka jest liczona osobno w każdej walucie transakcji (np. dywidenda w USD na koncie w PLN).
- Lokatę kończy przelew `TRANSFER_OUT` na konto wypłaty; jego data to `closedAt` w silniku.
- Obligacje skarbowe: seria (np. EDO1136) to instrument własny użytkownika z `RetailBondSeries`; każda partia FIFO jest wyceniana od własnej daty zakupu; oprocentowanie okresów wpisuje użytkownik.
- Cena ręczna instrumentu własnego trafia do `PriceSnapshot` (tabela globalna) surowym klientem, po sprawdzeniu właściciela przez `scopedDb`.

## snapshots/ (Etap 6)

Nocna wycena (`/api/cron/valuation`): kursy NBP do `FxRate`, ceny dostawcy rynkowego do `PriceSnapshot` (tylko z flagą `marketPricing`), migawki `PortfolioSnapshot` z historią wstecz od pierwszej transakcji i obsługa kolejki `RecalcJob`. Szczegóły i reguły w `snapshots/README.md`.

## import/ (Etap 5)

Import CSV bez bibliotek: `csv.ts` (kodowanie UTF-8/Windows-1250, separator, RFC 4180, wiersz nagłówka pod metryczką banku), `numbers.ts` (1 234,56 i 1,234.56, daty), `mapping.ts` (propozycja mapowania z nazw kolumn, wiersze → szkice transakcji, odciski duplikatów), `service.ts` (podgląd i import tą samą funkcją, duplikaty po `fingerprint`, sprzedaż ponad stan jako błąd wiersza, zapamiętane mapowanie po nagłówku, cofnięcie w 24 h).

## catalog/ (Etap 5)

Katalog wspólny popularnych instrumentów GPW, ETF-ów UCITS i krypto (`instruments.ts`, tylko dane publiczne), seed idempotentny (`npx tsx scripts/seed-catalog.ts`, też w `npm run db:seed` i serwerze e2e) i wyszukiwarka po nazwie, tickerze i ISIN.
