# Rejestr czynności przetwarzania — szablon

> **SZKIC — do zatwierdzenia przez radcę.** Wersja robocza 0.1 z 02.11.2026 (Etap 12). Dokument wewnętrzny (art. 30 ust. 1 RODO), nie publikujemy go. Prowadzi go administrator; aktualizacja przy każdej zmianie dostawcy, zakresu danych lub okresu przechowywania.

**Miejsca do uzupełnienia:**

- [NAZWA ADMINISTRATORA], [ADRES ADMINISTRATORA], [E-MAIL DO SPRAW PRYWATNOŚCI], [IOD]
- [DOSTAWCA E-MAIL], [OCHRONA ANTYBOTOWA], [DOSTAWCA CEN], [DOSTAWCA SKRZYNKI E-MAIL]
- [ZAKRES DANYCH ZACHOWANYCH] — to samo co na stronie „Jak usunąć konto”
- [DO UZUPEŁNIENIA], [DO DECYZJI], [DO SPORZĄDZENIA przez radcę] — pola otwarte w tabelach
- [REGION SUPABASE], [REGION VERCEL], [REGION SENTRY]
- [OKRES KOPII ZAPASOWYCH], [OKRES LOGU ZDARZEŃ], [OKRES RAPORTÓW BŁĘDÓW], [OKRES LOGÓW E-MAIL], [OKRES KORESPONDENCJI] — te same co w Polityce prywatności, pkt 7
- [OSOBA ODPOWIEDZIALNA], [DATA OSTATNIEJ AKTUALIZACJI]

Wyjątek z art. 30 ust. 5 RODO (poniżej 250 pracowników) prawdopodobnie nie ma zastosowania, bo przetwarzanie nie jest sporadyczne — do potwierdzenia przez radcę. Rejestr i tak ułatwia wykazanie rozliczalności (art. 5 ust. 2).

---

## Dane administratora

| Pole                          | Wartość                          |
| ----------------------------- | -------------------------------- |
| Administrator                 | [NAZWA ADMINISTRATORA]           |
| Adres                         | [ADRES ADMINISTRATORA]           |
| Kontakt                       | [E-MAIL DO SPRAW PRYWATNOŚCI]    |
| Inspektor ochrony danych      | [IOD] albo „nie wyznaczono”      |
| Przedstawiciel (art. 27 RODO) | nie dotyczy (administrator w UE) |
| Osoba prowadząca rejestr      | [OSOBA ODPOWIEDZIALNA]           |
| Data ostatniej aktualizacji   | [DATA OSTATNIEJ AKTUALIZACJI]    |

Kategorie danych K1–K10 są zdefiniowane w Polityce prywatności, pkt 3.

## Czynności przetwarzania

### C1. Prowadzenie konta i uwierzytelnianie

| Pole                            | Wartość                                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Cel                             | rejestracja, logowanie (e-mail + hasło, Google), 2FA, reset hasła, synchronizacja web i iPhone           |
| Podstawa                        | art. 6 ust. 1 lit. b RODO                                                                                |
| Kategorie osób                  | użytkownicy                                                                                              |
| Kategorie danych                | K1, K2, K3                                                                                               |
| Odbiorcy                        | Supabase, Vercel, [DOSTAWCA E-MAIL]; Google jako osobny administrator przy logowaniu Google              |
| Przekazanie poza EOG            | Vercel, [DOSTAWCA E-MAIL] — DPF lub SCC                                                                  |
| Okres                           | do usunięcia konta + 14 dni karencji; kopie [OKRES KOPII ZAPASOWYCH]                                     |
| Środki bezpieczeństwa (art. 32) | argon2id, sekret TOTP szyfrowany AES-256-GCM, kody zapasowe jako skróty, limity logowań, HTTPS/HSTS, CSP |

### C2. Świadczenie usługi (dane finansowe, wycena, cele, kalkulator, import, eksport)

| Pole                  | Wartość                                                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cel                   | zapis kont, transakcji i wycen; codzienna migawka; cele; kalkulator emerytury; import CSV; eksport                                                         |
| Podstawa              | art. 6 ust. 1 lit. b RODO                                                                                                                                  |
| Kategorie osób        | użytkownicy; osoby trzecie, jeśli użytkownik wpisze ich dane w notatkach lub nazwach (np. współwłaściciel)                                                 |
| Kategorie danych      | K2, K5, K6, K7                                                                                                                                             |
| Odbiorcy              | Supabase, Vercel; [DOSTAWCA CEN] bez danych osobowych                                                                                                      |
| Przekazanie poza EOG  | Vercel — DPF lub SCC                                                                                                                                       |
| Okres                 | do usunięcia konta + 14 dni karencji; kopie [OKRES KOPII ZAPASOWYCH]                                                                                       |
| Środki bezpieczeństwa | izolacja danych per użytkownik (`scoped.ts`, testy dostępu), szyfrowanie notatek i numerów rachunków, brak danych finansowych w logach i w pamięci offline |

### C3. Powiadomienia (w aplikacji, e-mail, push)

| Pole                  | Wartość                                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Cel                   | podsumowanie tygodnia, cel osiągnięty, wyceny do aktualizacji                                                                      |
| Podstawa              | art. 6 ust. 1 lit. b RODO; push po zgodzie systemowej iOS                                                                          |
| Kategorie osób        | użytkownicy                                                                                                                        |
| Kategorie danych      | K1, K5, K6 (e-mail z kwotami), K8 (push bez kwot)                                                                                  |
| Odbiorcy              | [DOSTAWCA E-MAIL], Google (Firebase), Apple (APNs, osobny administrator)                                                           |
| Przekazanie poza EOG  | Firebase, [DOSTAWCA E-MAIL] — DPF lub SCC                                                                                          |
| Okres                 | powiadomienia w aplikacji — [DO UZUPEŁNIENIA]; token push do wyłączenia push lub usunięcia konta; logi e-mail [OKRES LOGÓW E-MAIL] |
| Środki bezpieczeństwa | push bez kwot i nazw instrumentów; osobne wyłączniki dla każdego typu i kanału                                                     |

### C4. Bezpieczeństwo usługi i kont

| Pole                     | Wartość                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Cel                      | log zdarzeń (audyt), lista sesji, e-maile bezpieczeństwa, limity logowań, ochrona antybotowa, sprawdzanie haseł w wyciekach |
| Podstawa                 | art. 6 ust. 1 lit. f RODO (ochrona kont i usługi)                                                                           |
| Kategorie osób           | użytkownicy; osoby próbujące się zalogować                                                                                  |
| Kategorie danych         | K1, K3, K4                                                                                                                  |
| Odbiorcy                 | Supabase, Vercel, [DOSTAWCA E-MAIL], [OCHRONA ANTYBOTOWA]; Pwned Passwords bez danych osobowych (5 znaków skrótu)           |
| Przekazanie poza EOG     | Vercel, [DOSTAWCA E-MAIL], [OCHRONA ANTYBOTOWA] — DPF lub SCC                                                               |
| Okres                    | sesje 30 dni (web) / 90 dni (iOS) bezczynności; log zdarzeń [OKRES LOGU ZDARZEŃ]                                            |
| Środki bezpieczeństwa    | skrócone IP, brak kwot w logach                                                                                             |
| Test równowagi interesów | [DO SPORZĄDZENIA przez radcę]                                                                                               |

### C5. Monitoring błędów

| Pole                     | Wartość                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Cel                      | wykrywanie i naprawa błędów, błędy crona wyceny                                                |
| Podstawa                 | art. 6 ust. 1 lit. f RODO                                                                      |
| Kategorie osób           | użytkownicy                                                                                    |
| Kategorie danych         | K3 (wewnętrzny identyfikator), K9                                                              |
| Odbiorcy                 | Sentry                                                                                         |
| Przekazanie poza EOG     | zależnie od [REGION SENTRY] — DPF lub SCC                                                      |
| Okres                    | [OKRES RAPORTÓW BŁĘDÓW]                                                                        |
| Środki bezpieczeństwa    | filtrowanie kwot i danych osobowych przed wysłaniem (do skonfigurowania przy włączeniu Sentry) |
| Test równowagi interesów | [DO SPORZĄDZENIA przez radcę]                                                                  |

### C6. Kontakt, reklamacje i żądania z RODO

| Pole                  | Wartość                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------- |
| Cel                   | odpowiedzi na wiadomości, reklamacje, realizacja praw z art. 15–22 RODO, wykazanie realizacji |
| Podstawa              | art. 6 ust. 1 lit. b, c i f RODO                                                              |
| Kategorie osób        | użytkownicy, osoby kontaktujące się                                                           |
| Kategorie danych      | K1, K4 (do weryfikacji tożsamości), K10                                                       |
| Odbiorcy              | [DOSTAWCA SKRZYNKI E-MAIL — DO UZUPEŁNIENIA]                                                  |
| Przekazanie poza EOG  | [DO UZUPEŁNIENIA]                                                                             |
| Okres                 | [OKRES KORESPONDENCJI]; potwierdzenia realizacji żądań [DO DECYZJI]                           |
| Środki bezpieczeństwa | [DO UZUPEŁNIENIA]                                                                             |

### C7. Usuwanie konta

| Pole             | Wartość                                                                              |
| ---------------- | ------------------------------------------------------------------------------------ |
| Cel              | obsługa żądania usunięcia, karencja 14 dni, trwałe usunięcie, potwierdzenie e-mailem |
| Podstawa         | art. 6 ust. 1 lit. b i c RODO (art. 17 RODO)                                         |
| Kategorie osób   | użytkownicy                                                                          |
| Kategorie danych | wszystkie przypisane do konta; po usunięciu [ZAKRES DANYCH ZACHOWANYCH]              |
| Odbiorcy         | Supabase, Vercel, [DOSTAWCA E-MAIL]                                                  |
| Okres            | 14 dni karencji; potwierdzenie [DO DECYZJI]                                          |

## Rejestr kategorii czynności przetwarzania jako podmiot przetwarzający (art. 30 ust. 2)

Nie dotyczy: Neto nie przetwarza danych w imieniu innych administratorów.
