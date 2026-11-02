# Zrzuty ekranu do App Store — lista do zrobienia

> **SZKIC — do zatwierdzenia przez radcę.** Wersja robocza 0.1 z 02.11.2026 (Etap 12). Zrzuty robi Etap 11 lub 13 na gotowej aplikacji.

**Miejsca do uzupełnienia:**

- [MARKA] — ostateczna nazwa i logo
- [WARUNKOWO: CENY AUTOMATYCZNE] — zrzut 4 pokazuje cenę z datą ze źródła automatycznego tylko, jeśli działa dostawca cen; inaczej cenę ręczną z datą

## Rozmiary

| Wyświetlacz | Urządzenie (przykład)          | Rozdzielczość pionowo          | Wymagane                                                                        |
| ----------- | ------------------------------ | ------------------------------ | ------------------------------------------------------------------------------- |
| 6,9"        | iPhone 16 Pro Max / 17 Pro Max | 1320 × 2868 (albo 1290 × 2796) | tak                                                                             |
| 6,5"        | iPhone 11 Pro Max / XS Max     | 1284 × 2778 (albo 1242 × 2688) | tak (wg zlecenia; Apple może go skalować z 6,9" — sprawdzić aktualne wymagania) |

Po 3–10 zrzutów na rozmiar i język. Format PNG lub JPEG, bez przezroczystości. iPad nie jest w 1.0 (SPEC 1), więc bez zrzutów iPada.

## Zasady

- Konto demo z danymi przykładowymi; **żadnych prawdziwych danych** osobowych ani finansowych.
- Pasek stanu czysty (pełna bateria, 9:41, bez operatora — tryb demo w symulatorze: `xcrun simctl status_bar … override`).
- Bez cen, planów, „Pro”, odznak „za darmo” i elementów zakupu (Apple 3.1.1).
- Napisy na zrzutach opisują, co widać, bez obietnic zysku i bez słów: doradztwo, rekomendacje, porada (te same zasady co w `opis-app-store.md`).
- Zrzut pokazuje prawdziwą aplikację (Apple 2.3.3) — bez dorysowanych funkcji.
- Dopisek „Dane mają charakter informacyjny…” może być widoczny — nie zasłaniać go ramką.
- Dwa komplety: PL i EN (zrzuty z aplikacji w danym języku). Motyw: jasny w zestawie głównym; jeden zrzut w ciemnym (nr 6).

## Lista zrzutów

| Nr  | Ekran                                      | Co musi być widać                                                          | Napis PL                                     | Napis EN                                   |
| --- | ------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------ |
| 1   | Pulpit                                     | wartość netto, zmiany, wykres historii z linią zera (motyw linii bilansu)  | Cały majątek w jednej liczbie                | All your wealth in one number              |
| 2   | Majątek (grupowanie po klasie aktywów)     | lista kont i pozycji, alokacja                                             | Konta, lokaty, ETF-y, krypto i nieruchomości | Accounts, deposits, ETFs, crypto, property |
| 3   | Szczegóły obligacji EDO                    | wartość z odsetkami, dopisek „przed podatkiem”                             | Obligacje skarbowe liczone same              | Treasury bonds valued automatically        |
| 4   | Szczegóły pozycji ETF w USD                | wynik z efektem walutowym osobno, data ceny [WARUNKOWO: CENY AUTOMATYCZNE] | Wynik i efekt walutowy osobno                | Result and currency effect, side by side   |
| 5   | Cele z kartą kalkulatora emerytury         | cel główny z postępem, trzy scenariusze; dopisek „To symulacja…” widoczny  | Cele i scenariusze emerytury                 | Goals and retirement scenarios             |
| 6   | Pulpit w trybie ciemnym z trybem prywatnym | kwoty zastąpione „••••”                                                    | Ukryj kwoty jednym dotknięciem               | Hide amounts with one tap                  |
| 7   | Import CSV, krok podglądu                  | mapowanie kolumn, podgląd wierszy                                          | Import z pliku CSV                           | Import from CSV                            |
| 8   | Ustawienia → Bezpieczeństwo                | 2FA, sesje, Face ID                                                        | 2FA, sesje i Face ID                         | 2FA, sessions and Face ID                  |

Napisy do akceptacji razem z opisem sklepu. Nazwy plików: `appstore-<rozmiar>-<język>-<nr>.png`, np. `appstore-6.9-pl-01.png`; trzymać poza repo albo w `docs/sklep/zrzuty/` (decyzja właściciela — pliki są duże).
