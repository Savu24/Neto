# Zestawy referencyjne

## `emerytura.csv` — kalkulator emerytury (SPEC 7.11)

Przypadki wzorcowe dla `src/lib/portfolio/retirement.ts`. Test `src/lib/portfolio/retirement.test.ts` czyta ten plik i porównuje potrzebny kapitał, kapitał w wieku emerytalnym i kapitał w wieku 80 lat z tolerancją 0,01 zł, a „czy wystarcza” i najwcześniejszy wiek dokładnie.

### Jak powstał

Plik generuje skrypt `scripts/emerytura-referencja.mjs`:

```bash
node scripts/emerytura-referencja.mjs
```

Skrypt liczy **inną metodą niż aplikacja**: zamiast wzoru zamkniętego na FV przechodzi pętlą miesiąc po miesiącu (`kapitał = kapitał × (1 + r_m) + wpłata`, wpłata na koniec miesiąca) na zwykłych liczbach JS, bez `decimal.js`. Wspólne z aplikacją są tylko definicje ze SPEC: `r_m = (1 + r)^(1/12) − 1`, potrzebny kapitał `12 × max(0, wydatki − ZUS) ÷ stopa wypłaty` i horyzont do 80 lat. Najwcześniejszy wiek to pierwsze urodziny (pełne lata), w których kapitał ≥ potrzebny kapitał.

Zgodność wzoru zamkniętego z pętlą sprawdza, że wzór i jego implementacja w Decimal nie mają błędu (np. w kolejności wpłaty i kapitalizacji). Błąd zaokrągleń liczb zmiennoprzecinkowych w pętli jest rzędu 10⁻⁶ zł, dużo poniżej tolerancji.

Trzy pierwsze przypadki to przykład z makiety `docs/mockups/cele.html` (wynik: 63, 55 i 51 lat — tak jak na zrzucie makiety).

### Kolumny

| Kolumna                                                       | Znaczenie                                       |
| ------------------------------------------------------------- | ----------------------------------------------- |
| `wiek`, `wiek_emerytalny`                                     | wiek obecny i planowany                         |
| `majatek_startowy`, `wplata_mies`, `wydatki_mies`, `zus_mies` | kwoty w dzisiejszych złotych                    |
| `stopa_wyplaty`, `stopa_zwrotu`                               | ułamki rocznie (0.04 = 4%); stopa zwrotu realna |
| `potrzebny_kapital`                                           | wynik, 4 miejsca po przecinku                   |
| `kapital_w_wieku_emerytalnym`, `kapital_w_80`                 | wynik pętli                                     |
| `wystarcza`                                                   | `tak` / `nie` w wieku emerytalnym               |
| `najwczesniejszy_wiek`                                        | puste = „nie w tym horyzoncie”                  |

### Pokryte przypadki

Stopy 1%, 3%, 4%, 5%, 7%, ujemna (−1%) i zero; ZUS ≥ wydatki (potrzebny kapitał 0); majątek już ponad potrzebny kapitał; brak osiągnięcia do 80 lat; stopa wypłaty 3,5%; wiek emerytalny równy obecnemu; start od zera.

### Zmiana zestawu

Dodaj przypadek w tablicy `cases` w skrypcie, uruchom skrypt i zacommituj skrypt razem z CSV. Nie edytuj CSV ręcznie.

SPEC 7.11 wspominał arkusz `.xlsx`; zastąpił go ten plik CSV ze skryptem (arkusz nie jest wymagany).
