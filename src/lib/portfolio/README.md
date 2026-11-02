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
