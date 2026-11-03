# snapshots

Nocna wycena i historia wartości netto (Etap 6, SPEC 7.7). Migawka `PortfolioSnapshot(userId, date)` to wynik silnika `valuation` (`netWorthAt`) na dany dzień: aktywa, zobowiązania, wartość netto, podział na klasy, waluty i konta oraz licznik pozycji z problemem wyceny (`staleCount`). Pulpit (Etap 7) może czytać historię stąd zamiast liczyć ją na bieżąco.

| Plik          | Co robi                                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `schedule.ts` | czyste funkcje: dni migawek (`snapshotDates`, `recalcDates`), brakujące przedziały kursów (`missingRanges`), wiersz migawki z wyniku silnika |
| `inputs.ts`   | pełna historia użytkownika przez `scopedDb` → wejście silnika (konta, transakcje, ceny, kursy); mapowanie jak w `ledger/load.ts`             |
| `service.ts`  | migawki jednego użytkownika: `backfillSnapshots(db, userId, from, to)`, `refreshUserSnapshots`, zapis idempotentny                           |
| `nightly.ts`  | zadanie systemowe crona: kursy NBP → ceny rynkowe → migawki i kolejka `RecalcJob`, z licznikami i limitem czasu                              |

Route `src/app/api/cron/valuation/route.ts` (GET, `Authorization: Bearer CRON_SECRET`, bez sekretu 404) tylko woła `runNightlyValuation` i zwraca JSON z licznikami.

## Reguły

- **Harmonogram migawek**: dzień początkowy, koniec każdego miesiąca i codziennie przez ostatnie 31 dni. Pierwszy przebieg u użytkownika bez migawek buduje tak historię od pierwszej transakcji (lub założenia lokaty); potem cron dopisuje co noc dzień bieżący, a po przerwie uzupełnia dni od ostatniej migawki.
- **Idempotencja**: migawki zapisujemy w jednej transakcji jako „usuń (userId, dni) + wstaw”, kursy i ceny przez `createMany` z pominięciem istniejących kluczy (`(date, currency)`, `(assetId, date)`). Drugi przebieg tego samego dnia nic nie dubluje; użytkownik z migawką z dziś i pustą kolejką jest pomijany.
- **RecalcJob** („przelicz od D”, zakładane przez `ledger/service.ts` i import): przeliczamy wszystkie istniejące migawki od D i punkty harmonogramu od D (nie wcześniej niż pierwsze dane). Zadanie: PENDING → RUNNING (attempts + 1) → DONE; po błędzie wraca do PENDING z `lastError`, po 3 próbach FAILED. Zadania RUNNING z przerwanego przebiegu wracają na początku crona do kolejki.
- **Kursy NBP**: waluty używane w kontach, transakcjach i instrumentach z transakcjami. Dociągamy brakujący koniec (od ostatniego kursu do dziś) i brakujący początek (od pierwszej transakcji w walucie − 14 dni, nie wcześniej niż 02.01.2002). Waluty bez kursów w tabeli A (404 z ostatnich 14 dni) są zgłaszane jako `unsupported` i nie ściągają co noc całej historii; potrzebują kursu ręcznego. Dziur w środku zakresu nie szukamy.
- **Ceny rynkowe**: tylko gdy rejestr ma aktywnego dostawcę (`features().marketPricing` i implementacja w `pricing/market.ts`); bez niego krok jest pomijany (`status` w odpowiedzi). Instrumenty `priceSource: PROVIDER` z transakcjami, od dnia po ostatniej cenie (albo od pierwszej transakcji) do dziś. Ceny ręczne są już w `PriceSnapshot` i cron ich nie rusza.
- **Konta zarchiwizowane** nie wchodzą do migawek, tak jak na ekranie Majątek (migawka z dziś = suma z ekranu). Po archiwizacji konta wcześniejsze migawki zmienią się dopiero przy przeliczeniu.
- **Błędy**: błąd waluty, instrumentu albo użytkownika jest liczony w odpowiedzi i logowany `console.error` z kontekstem (waluta, `assetId`, `userId`), reszta idzie dalej. Sentry nie jest podłączone.
- **Limit czasu**: route ma `maxDuration = 60` (Vercel Hobby) i po 45 s nie zaczyna kolejnych użytkowników (`more: true`); kolejne wywołanie dokończy resztę.
