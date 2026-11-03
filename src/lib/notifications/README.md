# notifications

Powiadomienia (Etap 9, HU-6.1–6.3, SPEC sekcja 9): w aplikacji, e-mail (Resend za flagą `features().email`), push (tylko ścieżka wyłączona flagą `features().push`).

| Plik         | Co robi                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| `service.ts` | `runNotifications(db, userId, deps, now)`: tworzy wpisy `Notification` i wysyła kanały; ekran listy   |
| `content.ts` | treści PL/EN: lista w aplikacji, e-mail (z kwotami i stopką), push (bez kwot); odczyt `data`          |
| `prefs.ts`   | preferencje typ × kanał (`NotificationPref`), brak wpisu = włączone; odczyt formularza i zapis upsert |
| `cron.ts`    | `runNotificationsForAll(base, deps)`: wszyscy użytkownicy partiami po 50, błąd jednego nie przerywa   |
| `deps.ts`    | zależności w aplikacji: `sendEmail`, `emailAvailable()`, push wyłączony bez klucza FCM, `APP_URL`     |
| `push.ts`    | typ `PushSender`; implementacja FCM dojdzie z aplikacją na iPhone'a                                   |

Wywołuje go cron `src/app/api/cron/notifications` (Bearer `CRON_SECRET`, codziennie).

## Typy i idempotencja

Każdy wpis ma w `data` pola treści (`kind`, kwoty jako napisy z Decimal) oraz `key` i `inApp`.

- **Podsumowanie tygodnia** (`WEEKLY_SUMMARY`, `key = weekly:<niedziela>`): ostatni pełny tydzień przed bieżącym poniedziałkiem, zmiana wartości netto od niedzieli tydzień wcześniej. Wartości z `PortfolioSnapshot` dla obu dni, a bez migawki z `loadPortfolio(db, dzień)`. Ten sam okres w każdy dzień tygodnia, więc cron może chodzić codziennie (albo się spóźnić) i nie zdubluje wpisu. Bez kont nic nie powstaje.
- **Osiągnięty cel** (`GOAL_ACHIEVED`, `key = goal:<id>`): cel z `loadGoals` z planem `achieved` i pustym `Goal.achievedAt`. Znacznik ustawiamy atomowo (`updateMany … achievedAt: null`), więc raz na cel. Zmiana kwoty celu nie zeruje znacznika (do decyzji: `updateGoal` mógłby to robić przy podniesieniu kwoty).
- **Wycena do aktualizacji** (`STALE_VALUATION`): `staleCount` z `loadPortfolio` na dziś > 0 i brak takiego wpisu w ostatnich 7 dniach. `staleCount` liczy też pozycje bez ceny lub kursu (silnik wyceny, `net-worth.ts`).

Sprawdzenie „czy już było” i zapis idą w jednej transakcji z blokadą doradczą Postgresa na użytkownika (`pg_advisory_xact_lock`), więc równoległe przebiegi nie tworzą duplikatów. E-mail i push wychodzą po zatwierdzeniu wpisu; błąd wysyłki jest liczony w wyniku (`failed`) i logowany bez kwot, wpis zostaje (bez ponawiania).

## Kanały i preferencje

- W aplikacji: wpis widoczny na `/notifications`. Gdy typ jest wyłączony w aplikacji, a włączony inny kanał, wpis powstaje z `data.inApp = false` i `readAt` ustawionym (tylko ślad idempotencji); lista i licznik go pomijają. Wpisy bez `data.inApp` (np. przyszłe „Bezpieczeństwo”) są widoczne.
- E-mail: tylko przy włączonej preferencji, `emailAvailable()` i potwierdzonym adresie (SPEC 4). Język z `User.locale`. Treść ma kwoty, stopkę „nie stanowi porady inwestycyjnej” i link do ustawień powiadomień.
- Push: tylko przy `deps.push` (dziś `null`, bo `features().push` = false). Treść bez kwot i nazw instrumentów.
- Wszystkie kanały typu wyłączone: nic nie powstaje (cel i tak dostaje `achievedAt`).
- Bezpieczeństwo: e-maile wysyła moduł `auth` (zawsze, nie do wyłączenia); ten moduł ich nie tworzy.

Tekst listy składamy przy wyświetlaniu z `data` w bieżącym języku (`renderNotification`); `title`/`body` w bazie to treść w języku użytkownika z chwili utworzenia (zapas, gdy `data` ma inny kształt).
