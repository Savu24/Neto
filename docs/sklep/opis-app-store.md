# Opis w App Store (PL i EN)

> **SZKIC — do zatwierdzenia przez radcę.** Wersja robocza 0.1 z 02.11.2026 (Etap 12). Teksty do wklejenia w App Store Connect.

**Miejsca do uzupełnienia:**

- [MARKA] — ostateczna nazwa przed Etapem 11 (robocza: Neto); jeśli się zmieni, sprawdzić limity znaków
- [ADRES STRONY] — URL wsparcia, polityki prywatności i strony „Jak usunąć konto”
- [WARUNKOWO: CENY AUTOMATYCZNE] — zdania oznaczone tym znacznikiem zostają tylko, jeśli w 1.0 działa dostawca cen rynkowych (SPEC 14); bez niego usunąć
- [PRAWA AUTORSKIE] — pole „Copyright”, np. „2026 [NAZWA USŁUGODAWCY]”
- [ŚCIEŻKA WSPARCIA] — strona pomocy lub kontaktu (Etap 10)
- [MINIMALNY WIEK] — z regulaminu; ocena wiekowa w App Store jest od niego niezależna

## Zasady dla tekstów (sprawdzić przed każdą zmianą)

- Bez cen, planów, „Pro”, „premium”, „darmowy okres próbny”, odnośników do zakupów (Apple 3.1.1; w iOS zero cen i zakupów).
- Bez obietnic zysku i wyników („pomnożysz”, „zarobisz”, „osiągniesz wolność finansową”).
- Bez słów: doradztwo, doradca, rekomendacje, porada; po angielsku: advice, adviser/advisor, recommendations. Zamiast tego opisujemy, co aplikacja pokazuje.
- Bez superlatywów nie do udowodnienia („najlepsza”, „najbezpieczniejsza”, „bankowe bezpieczeństwo”).
- Bez nazw konkurentów i znaków towarowych osób trzecich w nazwie, podtytule i słowach kluczowych.
- Tylko funkcje, które są w wersji wysyłanej do recenzji (Apple 2.3.1). Funkcje „po 1.0” (SPEC 16) się nie pojawiają.
- Opis zgodny z etykietami prywatności (`etykiety-prywatnosci.md`) i z Polityką prywatności.

## Pola sklepu

| Pole                     | Limit     | PL                                                                                          | EN                                |
| ------------------------ | --------- | ------------------------------------------------------------------------------------------- | --------------------------------- |
| Nazwa                    | 30 znaków | Neto – wartość netto (20)                                                                   | Neto – Net Worth Tracker (24)     |
| Podtytuł                 | 30 znaków | Cały majątek w jednym miejscu (29)                                                          | All your wealth in one place (28) |
| Kategoria główna         | —         | Finanse                                                                                     | Finance                           |
| Kategoria dodatkowa      | —         | brak (propozycja: nie ustawiać)                                                             | none                              |
| Ocena wiekowa            | —         | 4+ (kwestionariusz bez treści ograniczonych); niezależnie od [MINIMALNY WIEK] w regulaminie | 4+                                |
| Cena                     | —         | Bezpłatna                                                                                   | Free                              |
| Zakupy w aplikacji       | —         | brak                                                                                        | none                              |
| URL wsparcia             | —         | [ADRES STRONY]/[ŚCIEŻKA WSPARCIA]                                                           | to samo                           |
| URL polityki prywatności | —         | [ADRES STRONY]/privacy                                                                      | to samo                           |
| Copyright                | —         | [PRAWA AUTORSKIE]                                                                           | to samo                           |

Ścieżki URL to propozycje dla Etapu 10 (lista w `docs/prawne/README.md`).

## Tekst promocyjny (do 170 znaków, można zmieniać bez recenzji)

**PL:**

> Aktywa, długi i wartość netto w jednym widoku, w przeglądarce i na iPhonie. Obligacje skarbowe, lokaty, ETF-y, krypto i nieruchomości w złotych.

**EN:**

> Assets, debts and net worth in one view, on the web and on iPhone. Polish treasury bonds, deposits, ETFs, crypto and property, all in złoty.

## Opis (do 4000 znaków)

**PL:**

> Neto zbiera w jednym miejscu wszystko, co masz i co jesteś winien: konta, lokaty, akcje i ETF-y, fundusze, obligacje skarbowe, kryptowaluty, nieruchomości, samochód i kredyty. Raz dziennie wycenia całość w złotych i pokazuje wartość netto w czasie.
>
> CO ZOBACZYSZ
> • Wartość netto, aktywa i zobowiązania ze zmianą dzienną, miesięczną i roczną.
> • Wykres historii: aktywa nad linią zera, długi pod nią, wartość netto pośrodku.
> • Skład majątku według klasy aktywów, waluty i konta.
> • Wynik każdej pozycji, z efektem walutowym pokazanym osobno, i stopę zwrotu portfela (XIRR).
> • Datę ceny przy każdej wycenie. Nieaktualne wyceny są wyraźnie oznaczone.
>
> POLSKIE INSTRUMENTY
> • Detaliczne obligacje skarbowe (OTS, ROR, DOR, TOS, COI, EDO, ROS, ROD) liczone według wzoru dla każdego typu.
> • Lokaty z oprocentowaniem i kapitalizacją.
> • IKE, IKZE, PPK i OIPE jako oznaczenie konta.
> • Kursy walut z tabel NBP.
> • [WARUNKOWO: CENY AUTOMATYCZNE] Automatyczne ceny akcji i ETF-ów.
>
> TWOJE DANE, TWOJE TEMPO
> • Dodawaj konta i transakcje ręcznie albo importuj plik CSV z banku lub od brokera.
> • Udział własności dla majątku wspólnego, np. mieszkania na pół.
> • Cele z postępem i potrzebną miesięczną wpłatą.
> • Kalkulator emerytury z trzema scenariuszami i wszystkimi założeniami do edycji. To symulacja, nie gwarancja wyniku.
> • Eksport wszystkich danych (JSON i CSV) i usunięcie konta w aplikacji.
>
> PRYWATNOŚĆ I BEZPIECZEŃSTWO
> • Logowanie dwuetapowe (aplikacja TOTP) i lista aktywnych sesji.
> • Blokada Face ID lub Touch ID i zasłonięty podgląd w przełączniku aplikacji.
> • Tryb prywatny ukrywa kwoty jednym dotknięciem.
> • Bez reklam i bez śledzenia. Neto nie łączy się z Twoim bankiem.
>
> JEDNO KONTO, DWA EKRANY
> Te same dane w przeglądarce na komputerze i na iPhonie. Dane wprowadzasz wieczorem na laptopie, sprawdzasz w telefonie.
>
> Neto to narzędzie informacyjne: pokazuje Twoje dane, nie mówi, co kupić ani sprzedać, nie składa zleceń i nie przechowuje pieniędzy. Wyceny mogą być opóźnione.
>
> Po polsku i po angielsku, w jasnym i ciemnym motywie.

**EN:**

> Neto brings together everything you own and owe: bank accounts, deposits, stocks and ETFs, funds, Polish treasury bonds, crypto, property, your car and loans. Once a day it values everything in Polish złoty and shows your net worth over time.
>
> WHAT YOU SEE
> • Net worth, assets and liabilities with daily, monthly and yearly change.
> • History chart: assets above the zero line, debts below it, net worth in between.
> • Your mix by asset class, currency and account.
> • Each holding's result, with the currency effect shown separately, and your portfolio's return (XIRR).
> • The price date next to every valuation. Stale valuations are clearly marked.
>
> POLISH INSTRUMENTS
> • Polish retail treasury bonds (OTS, ROR, DOR, TOS, COI, EDO, ROS, ROD) calculated with each type's formula.
> • Deposits with interest rate and compounding.
> • IKE, IKZE, PPK and OIPE as account labels.
> • Exchange rates from the National Bank of Poland (NBP).
> • [WARUNKOWO: CENY AUTOMATYCZNE] Automatic prices for stocks and ETFs.
>
> YOUR DATA, YOUR PACE
> • Add accounts and transactions by hand or import a CSV file from your bank or broker.
> • Ownership share for jointly owned assets, such as a flat split 50/50.
> • Goals with progress and the monthly amount needed.
> • Retirement calculator with three scenarios and every assumption editable. It is a simulation, not a guaranteed result.
> • Export all your data (JSON and CSV) and delete your account in the app.
>
> PRIVACY AND SECURITY
> • Two-step sign-in (TOTP app) and a list of active sessions.
> • Face ID or Touch ID lock and a hidden preview in the app switcher.
> • Privacy mode hides amounts with one tap.
> • No ads and no tracking. Neto does not connect to your bank.
>
> ONE ACCOUNT, TWO SCREENS
> The same data in your desktop browser and on your iPhone. Enter data on your laptop in the evening, check it on your phone.
>
> Neto is an information tool: it shows your data, it does not tell you what to buy or sell, it does not place orders and it does not hold money. Valuations may be delayed.
>
> In Polish and English, in light and dark themes.

## Słowa kluczowe (do 100 znaków, przecinki bez spacji)

Nie powtarzamy słów z nazwy i podtytułu (Apple i tak je indeksuje). Bez nazw konkurentów.

**PL** (96 znaków):

```
aktywa,portfel,oszczędności,obligacje,EDO,ETF,akcje,krypto,emerytura,IKE,IKZE,lokata,kredyt,cele
```

**EN** (99 znaków):

```
assets,portfolio,savings,bonds,ETF,stocks,crypto,retirement,debt,loans,goals,investments,FIRE,money
```

Celowo bez „budżet”/„budget”: budżetu miesięcznego nie ma w 1.0 (SPEC 16), a słowo kluczowe nie może sugerować funkcji, której nie ma (Apple 2.3.7). Liczby znaków policzone skryptem; App Store Connect i tak je sprawdzi.

## Co nowego (pierwsza wersja)

- **PL:** Pierwsza wersja Neto.
- **EN:** First release of Neto.
