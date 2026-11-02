# Etykiety prywatności App Store („App Privacy”) — szkic

> **SZKIC — do zatwierdzenia przez radcę.** Wersja robocza 0.1 z 02.11.2026 (Etap 12). Odpowiedzi do formularza „App Privacy” w App Store Connect.

**Miejsca do uzupełnienia:**

- [ADRES STRONY] — domena, pod którą będzie Polityka prywatności

- [SENTRY: IDENTYFIKATOR] — czy raporty błędów zawierają wewnętrzny identyfikator użytkownika (decyzja przy konfiguracji Sentry). Jeśli **nie**, w wierszach K9 zmienić „Powiązane z użytkownikiem” na „nie” i usunąć „K3 (identyfikator)” z wiersza Sentry w Polityce prywatności, pkt 5.
- [OCHRONA ANTYBOTOWA] — czy działa także w aplikacji iOS (rejestracja w WebView); jeśli tak, sprawdzić, jakie dane zbiera, i dopisać.

## Zasada zgodności

Kolumna „Kategoria w polityce” zawiera nazwy **dosłownie** z Polityki prywatności, pkt 3 (`docs/prawne/polityka-prywatnosci.md`). Etykiety i polityka zmieniają się razem, w jednym commicie. Przed wysyłką: porównać obie tabele słowo po słowie (grep po „K1”–„K10”).

Apple uznaje dane za „zbierane”, gdy opuszczają urządzenie i są przechowywane dłużej, niż wymaga obsługa żądania w czasie rzeczywistym. Etykieta obejmuje też dane zbierane przez SDK i dostawców (Firebase, Sentry).

## Odpowiedzi ogólne

| Pytanie w App Store Connect                                     | Odpowiedź                                                                     |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Do you or your third-party partners collect data from this app? | Yes                                                                           |
| Data used to track you (Tracking)                               | **Brak.** Nie śledzimy, nie mamy reklam ani analityki; nie pytamy o zgodę ATT |
| Data linked to you                                              | wszystkie typy z tabeli poniżej                                               |
| Data not linked to you                                          | brak                                                                          |
| Privacy Policy URL                                              | [ADRES STRONY]/privacy                                                        |

## Typy danych

Cel we wszystkich wierszach: **App Functionality**. Według definicji Apple obejmuje on uwierzytelnianie, działanie funkcji, zapobieganie nadużyciom, bezpieczeństwo, utrzymanie działania serwera, ograniczanie awarii i obsługę klienta. Żadnych danych nie używamy do: Third-Party Advertising, Developer's Advertising or Marketing, Analytics, Product Personalization, Other Purposes.

| Typ Apple (kategoria → typ)           | Kategoria w polityce                   | Co konkretnie                                                                           | Cel               | Powiązane z użytkownikiem   | Śledzenie |
| ------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------- | ----------------- | --------------------------- | --------- |
| Contact Info → Email Address          | K1 Dane kontaktowe; K10 Korespondencja | adres e-mail konta; adres nadawcy wiadomości                                            | App Functionality | tak                         | nie       |
| Contact Info → Name                   | K1 Dane kontaktowe                     | imię lub nazwa wyświetlana (opcjonalnie; z Google przy logowaniu Google)                | App Functionality | tak                         | nie       |
| Financial Info → Other Financial Info | K5 Dane finansowe                      | konta, salda, transakcje, pozycje, wyceny, kredyty, lokaty, obligacje, numery rachunków | App Functionality | tak                         | nie       |
| Financial Info → Other Financial Info | K6 Cele i plan emerytalny              | kwoty celów, założenia kalkulatora emerytury                                            | App Functionality | tak                         | nie       |
| User Content → Other User Content     | K7 Treści użytkownika                  | nazwy kont i celów, notatki, nazwy plików i mapowania importu CSV                       | App Functionality | tak                         | nie       |
| User Content → Customer Support       | K10 Korespondencja                     | treść wiadomości do nas                                                                 | App Functionality | tak                         | nie       |
| Identifiers → User ID                 | K3 Dane logowania                      | wewnętrzny identyfikator użytkownika, identyfikator konta Google                        | App Functionality | tak                         | nie       |
| Identifiers → Device ID               | K8 Identyfikator urządzenia do push    | token powiadomień push (tylko po włączeniu push)                                        | App Functionality | tak                         | nie       |
| Diagnostics → Crash Data              | K9 Dane diagnostyczne                  | raporty awarii                                                                          | App Functionality | tak [SENTRY: IDENTYFIKATOR] | nie       |
| Diagnostics → Performance Data        | K9 Dane diagnostyczne                  | dane o wydajności                                                                       | App Functionality | tak [SENTRY: IDENTYFIKATOR] | nie       |
| Diagnostics → Other Diagnostic Data   | K9 Dane diagnostyczne                  | raporty błędów                                                                          | App Functionality | tak [SENTRY: IDENTYFIKATOR] | nie       |
| Other Data → Other Data Types         | K2 Dane profilu                        | rok urodzenia (opcjonalnie), język, motyw, format liczb, tryb prywatny                  | App Functionality | tak                         | nie       |
| Other Data → Other Data Types         | K3 Dane logowania                      | skrót hasła, zaszyfrowany sekret 2FA, skróty kodów zapasowych                           | App Functionality | tak                         | nie       |
| Other Data → Other Data Types         | K4 Dane sesji i bezpieczeństwa         | skrócony adres IP, user agent, platforma, czas logowania, zdarzenia bezpieczeństwa      | App Functionality | tak                         | nie       |

## Typy, których nie deklarujemy (i dlaczego)

| Typ Apple                                                                 | Dlaczego nie                                                                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Health & Fitness, Sensitive Info, Contacts                                | nie zbieramy                                                                                            |
| Location (Precise, Coarse)                                                | nie zbieramy lokalizacji; skrócony IP służy tylko bezpieczeństwu i nie jest przeliczany na lokalizację  |
| Financial Info → Payment Info, Credit Info                                | brak płatności i brak historii kredytowej (K5 to dane wpisane przez użytkownika → Other Financial Info) |
| User Content → Photos or Videos, Audio, Gameplay, Emails or Text Messages | nie zbieramy (import CSV to plik tekstowy → Other User Content)                                         |
| Browsing History                                                          | nie zbieramy                                                                                            |
| Search History                                                            | wyszukiwanie instrumentów obsługiwane w czasie rzeczywistym, frazy nie są zapisywane                    |
| Identifiers → Advertising Identifier                                      | brak IDFA                                                                                               |
| Purchases                                                                 | brak zakupów                                                                                            |
| Usage Data (Product Interaction, Advertising Data, Other Usage Data)      | brak analityki w 1.0                                                                                    |
| Biometryka (Face ID / Touch ID)                                           | działa na urządzeniu, aplikacja dostaje tylko wynik „tak/nie”                                           |

## Kiedy zaktualizować etykiety

- dodanie analityki, reklam, nowego SDK albo nowego dostawcy,
- Sign in with Apple (dojdzie identyfikator Apple — K3),
- zmiana konfiguracji Sentry (identyfikator, replay sesji),
- budżet i kategorie wydatków (po 1.0).
