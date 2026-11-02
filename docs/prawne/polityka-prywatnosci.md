# Polityka prywatności Neto

> **SZKIC — do zatwierdzenia przez radcę.** Wersja robocza 0.1 z 02.11.2026 (Etap 12). Nie publikować przed akceptacją.

**Miejsca do uzupełnienia:**

- [NAZWA ADMINISTRATORA] — pełna nazwa firmy lub imię i nazwisko z nazwą działalności
- [ADRES ADMINISTRATORA]
- [NIP], [REGON], [KRS lub CEIDG]
- [E-MAIL DO SPRAW PRYWATNOŚCI]
- [IOD] — dane inspektora ochrony danych albo zdanie „Nie wyznaczyliśmy inspektora ochrony danych”
- [DOSTAWCA E-MAIL] — nazwa, siedziba, lokalizacja danych
- [DOSTAWCA CEN] — nazwa (albo usunąć wiersz, jeśli 1.0 startuje tylko z NBP i cenami ręcznymi)
- [OCHRONA ANTYBOTOWA] — nazwa dostawcy (albo usunąć wiersz)
- [REGION SUPABASE], [REGION VERCEL], [REGION SENTRY]
- [OKRES KOPII ZAPASOWYCH], [OKRES LOGU ZDARZEŃ], [OKRES RAPORTÓW BŁĘDÓW], [OKRES LOGÓW E-MAIL], [OKRES KORESPONDENCJI]
- [MINIMALNY WIEK]
- [DO UZUPEŁNIENIA] — lokalizacja danych u dostawców bez ustalonego regionu (tabela w pkt 5)
- [LICZBA DNI] — wyprzedzenie przy zmianie polityki
- [DO DECYZJI] — okres przechowywania potwierdzeń wykonania żądań
- [DATA WEJŚCIA W ŻYCIE]

---

## 1. Kto jest administratorem danych

Administratorem Twoich danych osobowych jest [NAZWA ADMINISTRATORA], [ADRES ADMINISTRATORA], [NIP], [REGON], [KRS lub CEIDG] („my”). Neto to aplikacja w przeglądarce (także jako PWA) i na iPhonie; obie korzystają z tego samego konta i tych samych danych.

Kontakt w sprawach danych osobowych: [E-MAIL DO SPRAW PRYWATNOŚCI]. [IOD]

## 2. Skąd mamy dane

Prawie wszystkie dane wpisujesz sam: przy rejestracji, w ustawieniach, przy dodawaniu kont, transakcji, wycen i celów albo importując plik CSV. Część danych powstaje automatycznie, gdy korzystasz z Neto (np. sesje, zdarzenia bezpieczeństwa, raporty błędów). Jeśli logujesz się przez Google, Google przekazuje nam Twój adres e-mail, imię i nazwisko (jeśli są w profilu) oraz identyfikator konta Google.

Neto **nie łączy się z Twoim bankiem ani biurem maklerskim** i nie pobiera z nich danych.

## 3. Jakie dane przetwarzamy

Poniższe nazwy kategorii są używane bez zmian w etykietach prywatności App Store (`docs/sklep/etykiety-prywatnosci.md`). Zmiana nazwy lub zakresu kategorii wymaga zmiany w obu miejscach.

| Nr  | Kategoria                        | Co obejmuje                                                                                                                                                                      |
| --- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1  | Dane kontaktowe                  | adres e-mail; imię lub nazwa wyświetlana (opcjonalnie)                                                                                                                           |
| K2  | Dane profilu                     | rok urodzenia (opcjonalnie, do kalkulatora emerytury), język, motyw, format liczb, tryb prywatny                                                                                 |
| K3  | Dane logowania                   | skrót hasła (argon2id, nie znamy hasła), zaszyfrowany sekret 2FA, skróty kodów zapasowych, identyfikator konta Google, wewnętrzny identyfikator użytkownika                      |
| K4  | Dane sesji i bezpieczeństwa      | skrócony adres IP, typ przeglądarki lub urządzenia (user agent), platforma (web lub iOS), czas logowania i ostatniej aktywności, zdarzenia bezpieczeństwa                        |
| K5  | Dane finansowe                   | konta i ich typy, nazwy instytucji, numery rachunków (zaszyfrowane), salda, transakcje, pozycje, wyceny aktywów, lokaty, obligacje, kredyty, udział własności, historia wartości |
| K6  | Cele i plan emerytalny           | nazwy i kwoty celów, terminy, założenia kalkulatora emerytury (m.in. planowane wydatki, spodziewana emerytura z ZUS, wpłaty)                                                     |
| K7  | Treści użytkownika               | nazwy kont i celów, notatki (zaszyfrowane), nazwy plików i mapowania kolumn importu CSV                                                                                          |
| K8  | Identyfikator urządzenia do push | token powiadomień push iPhone'a, wersja aplikacji (tylko jeśli włączysz powiadomienia push)                                                                                      |
| K9  | Dane diagnostyczne               | raporty błędów i awarii, dane o wydajności (bez kwot i bez danych finansowych)                                                                                                   |
| K10 | Korespondencja                   | treść wiadomości do nas, adres e-mail nadawcy                                                                                                                                    |

Czego **nie** zbieramy: lokalizacji, kontaktów, zdjęć, historii przeglądania, danych o zdrowiu, danych do reklam. Nie używamy analityki ani śledzenia (w wersji 1.0). Blokada Face ID / Touch ID działa w całości na iPhonie: nie dostajemy żadnych danych biometrycznych. Wyszukiwanie instrumentów jest obsługiwane na bieżąco i nie zapisujemy wpisywanych fraz.

Dane finansowe nie należą do szczególnych kategorii danych z art. 9 RODO, ale traktujemy je jako wrażliwe: wybrane pola szyfrujemy w bazie (AES-256-GCM), a w logach nie zapisujemy kwot.

## 4. W jakich celach i na jakiej podstawie

| Cel                                                                                    | Kategorie      | Podstawa prawna                                                                                    |
| -------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------- |
| Założenie i prowadzenie konta, logowanie, 2FA, synchronizacja web i iPhone             | K1, K2, K3     | art. 6 ust. 1 lit. b RODO — wykonanie umowy (regulamin)                                            |
| Świadczenie usługi: zapis danych, codzienna wycena, wykresy, cele, kalkulator, eksport | K2, K5, K6, K7 | art. 6 ust. 1 lit. b RODO                                                                          |
| Powiadomienia w aplikacji i e-mail (podsumowanie tygodnia, cel osiągnięty, wyceny)     | K1, K5, K6     | art. 6 ust. 1 lit. b RODO; możesz je wyłączyć w ustawieniach                                       |
| Powiadomienia push na iPhonie                                                          | K8             | art. 6 ust. 1 lit. b RODO; push działa tylko po Twojej zgodzie w systemie iOS, którą możesz cofnąć |
| E-maile bezpieczeństwa (nowe urządzenie, zmiana hasła lub 2FA, reset hasła)            | K1, K4         | art. 6 ust. 1 lit. f RODO — prawnie uzasadniony interes: ochrona Twojego konta                     |
| Bezpieczeństwo: limity logowań, ochrona antybotowa, log zdarzeń, lista sesji           | K3, K4         | art. 6 ust. 1 lit. f RODO — ochrona usługi i kont przed nadużyciami                                |
| Wykrywanie i naprawa błędów                                                            | K3, K9         | art. 6 ust. 1 lit. f RODO — utrzymanie działającej usługi                                          |
| Kontakt i obsługa zgłoszeń, w tym reklamacji                                           | K1, K10        | art. 6 ust. 1 lit. b RODO (sprawy umowy), art. 6 ust. 1 lit. f RODO (pozostałe)                    |
| Obsługa Twoich praw z RODO i wykazanie, że to zrobiliśmy                               | K1, K4, K10    | art. 6 ust. 1 lit. c RODO — obowiązek prawny (art. 12–22 i art. 5 ust. 2 RODO)                     |
| Ustalenie, dochodzenie lub obrona roszczeń                                             | K1, K4, K10    | art. 6 ust. 1 lit. f RODO                                                                          |

Nie podejmujemy wobec Ciebie decyzji opartych wyłącznie na automatycznym przetwarzaniu, które wywołują skutki prawne (art. 22 RODO). Wyliczenia w aplikacji (wycena, tempo celu, scenariusze emerytury) to obliczenia na Twoich danych, pokazywane tylko Tobie.

Podanie danych z K1 i K3 jest potrzebne do założenia konta. Pozostałe dane podajesz dobrowolnie; bez nich część funkcji nie zadziała (np. kalkulator bez roku urodzenia).

## 5. Komu przekazujemy dane

Nie sprzedajemy danych i nie udostępniamy ich reklamodawcom. Dane przekazujemy wyłącznie podmiotom, które pomagają nam prowadzić usługę, na podstawie umów powierzenia przetwarzania (art. 28 RODO), chyba że wskazano inaczej.

| Odbiorca                                   | Rola                                                      | Kategorie                    | Lokalizacja danych            |
| ------------------------------------------ | --------------------------------------------------------- | ---------------------------- | ----------------------------- |
| Supabase Inc.                              | baza danych i kopie zapasowe                              | K1–K8, K10 (jeśli w bazie)   | [REGION SUPABASE] (UE)        |
| Vercel Inc.                                | hosting aplikacji, uruchamianie serwera, logi techniczne  | wszystkie przy przetwarzaniu | [REGION VERCEL]; spółka z USA |
| Google Ireland Ltd / Google LLC (Firebase) | dostarczanie powiadomień push na iPhone'a                 | K8 i treść push bez kwot     | UE i USA                      |
| [DOSTAWCA E-MAIL]                          | wysyłka e-maili transakcyjnych                            | K1 i treść e-maila           | [DO UZUPEŁNIENIA]             |
| Functional Software Inc. (Sentry)          | raporty błędów                                            | K3 (identyfikator), K9       | [REGION SENTRY]               |
| [OCHRONA ANTYBOTOWA]                       | ochrona formularza rejestracji przed botami               | K4                           | [DO UZUPEŁNIENIA]             |
| [DOSTAWCA CEN]                             | ceny instrumentów                                         | brak danych osobowych¹       | [DO UZUPEŁNIENIA]             |
| Google (logowanie przez Google)            | osobny administrator Twoich danych w Google               | dane z punktu 2              | zgodnie z polityką Google     |
| Apple Inc.                                 | osobny administrator: App Store, dostarczanie push (APNs) | zgodnie z polityką Apple     | zgodnie z polityką Apple      |
| organy publiczne                           | tylko gdy wymaga tego prawo                               | w zakresie żądania           | —                             |

¹ Do dostawcy cen wysyłamy wyłącznie symbole instrumentów i daty, bez identyfikatora użytkownika i bez ilości. Narodowy Bank Polski (kursy walut) też nie dostaje żadnych danych o Tobie.

Przy rejestracji i zmianie hasła możemy sprawdzić, czy hasło nie występuje w publicznych wyciekach (usługa Pwned Passwords). Wysyłamy tylko pierwsze 5 znaków skrótu SHA-1 hasła; ani hasło, ani e-mail nie opuszczają naszego serwera.

## 6. Przekazywanie danych poza Europejski Obszar Gospodarczy

Część dostawców (Vercel, Google/Firebase, Sentry, [DOSTAWCA E-MAIL]) to spółki z USA lub korzystają z podwykonawców poza EOG. Przekazanie odbywa się na podstawie:

- decyzji Komisji Europejskiej o odpowiednim stopniu ochrony dla USA (EU-US Data Privacy Framework), jeśli odbiorca jest w nim certyfikowany, albo
- standardowych klauzul umownych przyjętych przez Komisję Europejską (art. 46 ust. 2 lit. c RODO).

Kopię zabezpieczeń możesz otrzymać, pisząc na [E-MAIL DO SPRAW PRYWATNOŚCI].

## 7. Jak długo przechowujemy dane

| Dane                                                       | Okres                                                                                     |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Konto i dane z K1, K2, K3, K5, K6, K7                      | do usunięcia konta; po żądaniu usunięcia — 14 dni karencji, potem trwałe usunięcie z bazy |
| Kopie zapasowe bazy                                        | dane usunięte z bazy znikają z kopii najpóźniej po [OKRES KOPII ZAPASOWYCH]               |
| Sesje (K4)                                                 | do wylogowania albo 30 dni bezczynności w przeglądarce i 90 dni na iPhonie                |
| Log zdarzeń bezpieczeństwa (K4)                            | [OKRES LOGU ZDARZEŃ]                                                                      |
| Linki weryfikacji e-mail i resetu hasła                    | 24 godziny (weryfikacja), 1 godzina (reset); jednorazowe                                  |
| Token push (K8)                                            | do wyłączenia push, wylogowania z iPhone'a lub usunięcia konta                            |
| Raporty błędów (K9)                                        | [OKRES RAPORTÓW BŁĘDÓW]                                                                   |
| Logi wysyłki e-mail u dostawcy                             | [OKRES LOGÓW E-MAIL]                                                                      |
| Korespondencja (K10)                                       | [OKRES KORESPONDENCJI]                                                                    |
| Potwierdzenie wykonania żądania z RODO lub usunięcia konta | [DO DECYZJI] — adres e-mail i data, wyłącznie do wykazania rozliczalności                 |

## 8. Twoje prawa

Masz prawo do:

- **dostępu** do danych i otrzymania ich kopii,
- **sprostowania** danych (większość zmienisz sam w aplikacji),
- **usunięcia** danych — w aplikacji: Ustawienia → Dane → Usuń konto (opis: strona „Jak usunąć konto”),
- **ograniczenia** przetwarzania,
- **przenoszenia** danych — w aplikacji: Ustawienia → Dane → Eksport (plik ZIP z JSON i CSV),
- **sprzeciwu** wobec przetwarzania opartego na prawnie uzasadnionym interesie (art. 6 ust. 1 lit. f RODO),
- **cofnięcia zgody** na powiadomienia push w ustawieniach iOS, w dowolnym momencie, bez wpływu na wcześniejsze przetwarzanie,
- **skargi** do Prezesa Urzędu Ochrony Danych Osobowych (uodo.gov.pl), jeśli uważasz, że przetwarzamy dane niezgodnie z prawem.

Żądania wysyłaj na [E-MAIL DO SPRAW PRYWATNOŚCI]. Odpowiadamy w ciągu miesiąca (w uzasadnionych przypadkach termin może się wydłużyć o dwa miesiące — poinformujemy o tym). Możemy poprosić o potwierdzenie tożsamości, np. wiadomością z adresu przypisanego do konta.

## 9. Bezpieczeństwo

Hasła przechowujemy jako skróty argon2id. Udostępniamy 2FA (aplikacja TOTP) i listę aktywnych sesji z możliwością wylogowania wszystkich. Połączenia są szyfrowane (HTTPS, HSTS). Wybrane pola (notatki, numery rachunków, sekret 2FA) szyfrujemy w bazie. Logi nie zawierają kwot ani danych osobowych poza skróconym adresem IP. Aplikacja nie zapisuje danych finansowych do pamięci offline urządzenia. Na iPhonie możesz włączyć blokadę Face ID / Touch ID i tryb prywatny ukrywający kwoty.

## 10. Wiek

Neto jest przeznaczone dla osób, które ukończyły [MINIMALNY WIEK] lat.

## 11. Ciasteczka

Używamy wyłącznie ciasteczek niezbędnych do działania aplikacji. Szczegóły: Polityka cookies.

## 12. Zmiany polityki

O istotnych zmianach poinformujemy w aplikacji i e-mailem z wyprzedzeniem co najmniej [LICZBA DNI] dni. Aktualna wersja i data obowiązywania są zawsze na tej stronie.

Data wejścia w życie: [DATA WEJŚCIA W ŻYCIE].
