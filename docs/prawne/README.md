# Dokumenty prawne i materiały do App Store (Etap 12)

> **SZKIC — do zatwierdzenia przez radcę.** Wersja robocza 0.1 z 02.11.2026. Wszystkie pliki w `docs/prawne/` i `docs/sklep/` to szkice robocze przygotowane przez Claude Code na podstawie `docs/SPEC.md`. Nie są poradą prawną. Przed publikacją każdy tekst zatwierdza radca, a właściciel uzupełnia pola w nawiasach kwadratowych.

**Miejsca do uzupełnienia w tym pliku:** brak własnych. Pola w nawiasach przywołane niżej (np. `[LICZBA DNI]`, `[WARUNKOWO: CENY AUTOMATYCZNE]`) pochodzą z dokumentów — lista jest na górze każdego z nich.

## Spis dokumentów

### `docs/prawne/` — teksty prawne

| Plik                                                                                  | Co to jest                                                           | Publiczny | Języki |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------- | ------ |
| [regulamin.md](regulamin.md), [regulamin.en.md](regulamin.en.md)                      | Regulamin usługi (art. 8 UŚUDE), z odesłaniem do informacji o ryzyku | tak       | PL, EN |
| [polityka-prywatnosci.md](polityka-prywatnosci.md), [.en](polityka-prywatnosci.en.md) | Polityka prywatności (RODO), kategorie danych K1–K10                 | tak       | PL, EN |
| [ryzyko-i-brak-doradztwa.md](ryzyko-i-brak-doradztwa.md)                              | Informacja o ryzyku: wersja krótka (ekrany) i pełna                  | tak       | PL     |
| [polityka-cookies.md](polityka-cookies.md)                                            | Polityka cookies (w 1.0 tylko niezbędne)                             | tak       | PL     |
| [usuniecie-konta.md](usuniecie-konta.md), [.en](usuniecie-konta.en.md)                | Publiczna strona „Jak usunąć konto” (web i iPhone, karencja 14 dni)  | tak       | PL, EN |
| [rejestr-czynnosci-przetwarzania.md](rejestr-czynnosci-przetwarzania.md)              | Szablon rejestru czynności przetwarzania (art. 30 RODO)              | nie       | PL     |
| [umowy-powierzenia.md](umowy-powierzenia.md)                                          | Lista umów powierzenia (DPA) i transferów do podpisania              | nie       | PL     |

### `docs/sklep/` — App Store

| Plik                                                            | Co to jest                                                                       |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [opis-app-store.md](../sklep/opis-app-store.md)                 | Nazwa, podtytuł, opis, tekst promocyjny, słowa kluczowe PL/EN, kategoria Finanse |
| [notatka-dla-recenzenta.md](../sklep/notatka-dla-recenzenta.md) | Pole „Notes” dla recenzenta: konto demo bez 2FA, usuwanie konta, brak zakupów    |
| [etykiety-prywatnosci.md](../sklep/etykiety-prywatnosci.md)     | Etykiety „App Privacy”: typ danych, cel, powiązanie — zgodne z polityką          |
| [szyfrowanie-eksportowe.md](../sklep/szyfrowanie-eksportowe.md) | Odpowiedzi „Export Compliance”                                                   |
| [zrzuty-ekranu.md](../sklep/zrzuty-ekranu.md)                   | Lista zrzutów 6,9" i 6,5" z napisami PL/EN                                       |
| [ryzyka-recenzji.md](../sklep/ryzyka-recenzji.md)               | Lista kontrolna: 4.8 (Sign in with Apple), 4.2, 3.1.1, 5.1.1(v) i inne           |

## Zasady spójności

- Kategorie danych **K1–K10** są zdefiniowane raz, w Polityce prywatności (pkt 3). Etykiety App Store, rejestr czynności i lista DPA odwołują się do nich tymi samymi nazwami. Zmiana w jednym miejscu = zmiana we wszystkich, w jednym commicie.
- Okresy przechowywania (pola `[OKRES …]`) są te same w polityce, rejestrze i na stronie usuwania konta.
- Krótkie teksty o braku porady są w słowniku `common` (`disclaimerResults`, `disclaimerSimulation`); dokument o ryzyku je cytuje, nie wymyśla nowych.
- Wersje EN to tłumaczenia; wiążąca jest wersja PL (do potwierdzenia przez radcę).

## Sprawdzenie spójności ze SPEC (02.11.2026)

| Element SPEC                                                         | Gdzie w dokumentach                              | Uwagi                                                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Odbiorcy z SPEC 12: Vercel, Supabase, Firebase, e-mail, ceny, Sentry | polityka pkt 5, rejestr, umowy-powierzenia       | wszyscy są; dodani też: ochrona antybotowa (SPEC 15), Pwned Passwords (SPEC 5.1/15), Google i Apple jako osobni administratorzy |
| Karencja 14 dni, potwierdzenie hasłem lub 2FA, e-mail (HU-1.6)       | regulamin § 4, polityka pkt 7, usuniecie-konta   | wylogowanie wszystkich sesji przy żądaniu — propozycja, nie w SPEC                                                              |
| Eksport JSON + CSV w ZIP (HU-1.7)                                    | polityka pkt 8, usuniecie-konta                  | —                                                                                                                               |
| Sesje 30 dni (web) / 90 dni (iOS) (SPEC 10)                          | polityka pkt 7, cookies                          | —                                                                                                                               |
| Link weryfikacyjny 24 h, reset 1 h (HU-1.1, HU-1.4)                  | polityka pkt 7                                   | —                                                                                                                               |
| Push bez kwot (SPEC 9), e-maile bezpieczeństwa nie do wyłączenia     | polityka pkt 4, rejestr C3–C4                    | podstawa e-maili bezpieczeństwa: art. 6 ust. 1 lit. f — do oceny radcy                                                          |
| Szyfrowanie pól `*Enc`, argon2id, logi bez kwot (SPEC 8, 10)         | polityka pkt 3 i 9, rejestr                      | —                                                                                                                               |
| Dane finansowe nie są cache'owane offline (SPEC 10)                  | polityka pkt 9, cookies pkt 2                    | —                                                                                                                               |
| Tylko niezbędne ciasteczka, baner informacyjny (SPEC 12 pkt 6)       | polityka-cookies                                 | nazwy ciasteczek Auth.js domyślne — sprawdzić po Etapie 4                                                                       |
| Atrybucje dostawców danych (SPEC 12 pkt 7)                           | ryzyko-i-brak-doradztwa pkt 7, umowy-powierzenia | brzmienie zależy od licencji (SPEC 14)                                                                                          |
| Dopiski na ekranach (SPEC 6)                                         | ryzyko-i-brak-doradztwa cz. A                    | identyczne z `common.json`                                                                                                      |
| Zero cen i zakupów w iOS (SPEC 11), Apple 4.8 (SPEC 1)               | opis-app-store, notatka, ryzyka-recenzji         | —                                                                                                                               |
| Funkcje po 1.0 (SPEC 16)                                             | nie opisane w sklepie                            | słowo „budżet” celowo pominięte w słowach kluczowych                                                                            |

**Rzeczy, których SPEC nie określa, a dokumenty potrzebują** (wpisane jako pola): okresy przechowywania poza karencją, minimalny wiek, regiony dostawców, dostawca e-mail i ochrony antybotowej, dane administratora, co zostaje po usunięciu konta.

## Pytania do właściciela

1. **Apple 4.8:** Sign in with Apple przed wysyłką, ukrycie Google w iOS, czy inne rozwiązanie? (`docs/sklep/ryzyka-recenzji.md`) — **decyzja przed wysyłką do App Store.**
2. **Podmiot:** kto jest administratorem i usługodawcą (firma, JDG)? Dane rejestrowe, adres, e-mail kontaktowy i do spraw prywatności.
3. **Konto deweloperskie Apple:** osoba czy organizacja? Wytyczna 5.1.1(ix) przemawia za organizacją (numer D-U-N-S).
4. **Dostawcy:** e-mail transakcyjny, ochrona antybotowa, dostawca cen (SPEC 14) — nazwy i regiony; czy 1.0 startuje z cenami automatycznymi (wtedy zostają zdania `[WARUNKOWO: CENY AUTOMATYCZNE]`).
5. **Regiony:** Supabase i funkcje Vercel w UE (który region?), Sentry w regionie UE?
6. **Sentry:** czy raporty mają zawierać wewnętrzny identyfikator użytkownika (wpływa na etykiety App Store)?
7. **Okresy przechowywania:** kopie zapasowe Supabase (zależnie od planu), log zdarzeń bezpieczeństwa (propozycja: 12 miesięcy), raporty błędów (propozycja: 90 dni), korespondencja.
8. **Po usunięciu konta:** co zostaje (propozycja: e-mail i data usunięcia, jako dowód wykonania) i jak długo? Czy log zdarzeń bezpieczeństwa też jest usuwany?
9. **Usuwanie konta bez hasła i bez 2FA** (samo logowanie Google): jak potwierdzić? Propozycja: ponowne logowanie Google przed potwierdzeniem. Do ustalenia z Etapem 4.
10. **Wylogowanie przy żądaniu usunięcia:** czy wylogować wszystkie sesje od razu (propozycja w `usuniecie-konta.md`)?
11. **Marka i domena:** ostateczna nazwa (SPEC 1) i adres strony — od tego zależą nazwa w sklepie, słowa kluczowe i adresy URL.
12. **Zrzuty ekranu:** w repo (`docs/sklep/zrzuty/`) czy poza nim?

## Pytania do radcy

1. Czy opis usługi jako „narzędzia informacyjnego” i dopiski na ekranach wystarczą, by Neto nie było doradztwem inwestycyjnym (ustawa o obrocie instrumentami finansowymi) ani rekomendacją (MAR 596/2014)? Czy etykiety „W dobrym tempie / Poniżej tempa” przy celach są bezpieczne?
2. Minimalny wiek użytkownika (16 czy 18 lat) przy usłudze opartej na umowie (art. 6 ust. 1 lit. b), z danymi finansowymi.
3. Czy do bezpłatnej usługi stosuje się rozdział 5b ustawy o prawach konsumenta (usługi cyfrowe „za dane”) i czego wymaga to w regulaminie?
4. Prawo odstąpienia od umowy (14 dni) — czy i jak o nim informować przy usłudze bezpłatnej z możliwością usunięcia konta w każdej chwili?
5. Dopuszczalny zakres wyłączeń odpowiedzialności wobec konsumentów (regulamin § 8).
6. Podstawa e-maili bezpieczeństwa (nie do wyłączenia): art. 6 ust. 1 lit. b czy f? Testy równowagi interesów dla C4 i C5 w rejestrze.
7. Ciasteczka `neto-locale` i `neto-theme` jako niezbędne (zapamiętanie wyboru użytkownika) — czy zwolnione ze zgody; właściwy przepis Prawa komunikacji elektronicznej.
8. Czy dostawcę cen, który dostaje tylko symbole instrumentów, wymieniać jako odbiorcę danych (SPEC 12 go wymienia)?
9. Czy rejestr czynności jest obowiązkowy (art. 30 ust. 5 RODO) — zakładamy, że tak.
10. Czy potrzebna jest ocena skutków (DPIA, art. 35 RODO) — dane finansowe na dużą skalę, ale bez profilowania i bez decyzji automatycznych.
11. Wersja wiążąca (PL) i forma akceptacji regulaminu przy rejestracji (checkbox, zapis wersji).
12. Okres wyprzedzenia przy zmianach regulaminu i polityki (pole `[LICZBA DNI]`).

## Co trzeba pokazać w aplikacji (dla Etapu 10 i 11)

Ścieżki to propozycje (SPEC: ścieżki po angielsku); Etap 10 je potwierdza.

| Element                                  | Gdzie                                                                                                                                                            | Źródło treści                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Regulamin                                | `/terms`, publiczna; link w stopce, przy rejestracji, w Ustawienia → Informacje prawne                                                                           | `regulamin.md` / `.en.md`                       |
| Polityka prywatności                     | `/privacy`, publiczna; te same miejsca; adres do App Store Connect                                                                                               | `polityka-prywatnosci.md` / `.en.md`            |
| Polityka cookies                         | `/cookies`, publiczna; link z banera                                                                                                                             | `polityka-cookies.md`                           |
| Informacja o ryzyku                      | `/risk`, publiczna; link z dopisków `<Disclaimer>` i z regulaminu                                                                                                | `ryzyko-i-brak-doradztwa.md` cz. B              |
| Jak usunąć konto                         | `/delete-account`, publiczna, bez logowania; adres do App Store Connect                                                                                          | `usuniecie-konta.md` / `.en.md`                 |
| Baner cookies                            | informacyjny, bez przycisków zgody, jednorazowo zamykany                                                                                                         | polityka-cookies pkt 3                          |
| Akceptacja regulaminu przy rejestracji   | checkbox „Akceptuję regulamin” + zdanie z linkiem do polityki prywatności                                                                                        | regulamin § 4 ust. 1                            |
| Zapis zaakceptowanej wersji              | wersja i data akceptacji regulaminu przy użytkowniku — **wymaga zmiany `prisma/schema.prisma` (plik wspólny)**; opisać w raporcie Etapu 10, nie robić równolegle | pytanie do radcy nr 11                          |
| Dopiski na ekranach                      | już są w `common.json`; ewentualne nowe z cz. A dokumentu o ryzyku                                                                                               | ryzyko-i-brak-doradztwa cz. A                   |
| Atrybucja źródeł danych                  | stopka ekranów z wycenami lub Ustawienia → Informacje prawne: NBP, dostawca cen                                                                                  | ryzyko-i-brak-doradztwa pkt 7                   |
| Ustawienia → Informacje prawne i wersja  | linki do wszystkich dokumentów, wersja aplikacji (SPEC 6)                                                                                                        | —                                               |
| iOS: dokumenty w przeglądarce systemowej | wszystkie linki prawne otwierane poza WebView (SPEC 11)                                                                                                          | Etap 11                                         |
| iOS: `ITSAppUsesNonExemptEncryption`     | `Info.plist` = `false`                                                                                                                                           | `docs/sklep/szyfrowanie-eksportowe.md`, Etap 11 |
| Ekran potwierdzenia usunięcia konta      | jasna informacja o 14 dniach i o anulowaniu przez logowanie                                                                                                      | usuniecie-konta, ryzyka-recenzji 5.1.1(v)       |

Słowniki: teksty stron prawnych są długie — Etap 10 zdecyduje, czy trzymać je w zakresie `legal` (`src/i18n/dictionaries/{pl,en}/legal.json`), czy jako pliki MDX/Markdown renderowane na serwerze. Ta sesja nie zmienia słowników.
