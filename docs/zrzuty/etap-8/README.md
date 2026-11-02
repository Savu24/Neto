# Etap 8: kalkulator emerytury, zrzuty

Zrobione na zbudowanej aplikacji (`next start`), Edge przez Playwright, 390 × 844 (skala 2) i 1440 × 900. Dane wpisane ręcznie z przykładu w makiecie `docs/mockups/cele.html`: 34 lata, emerytura w 60, majątek 422 870 zł, wpłata 3 500 zł, wydatki 9 000 zł, ZUS 2 500 zł.

| Plik                                             | Co pokazuje                                                    |
| ------------------------------------------------ | -------------------------------------------------------------- |
| `emerytura-telefon.png`, `emerytura-desktop.png` | wynik dla przykładu z makiety                                  |
| `emerytura-*-ciemny.png`                         | to samo w trybie ciemnym                                       |
| `emerytura-pusty-*.png`                          | pierwsze wejście: wartości domyślne z SPEC 7.11, prośba o wiek |
| `cele-telefon.png`, `cele-desktop.png`           | ekran Cele z kartą prowadzącą do kalkulatora                   |

## Porównanie z makietą (`docs/mockups/zrzuty/cele-*.png`)

Zgodne: wynik 63 / 55 / 51 lat, 1,79 / 2,55 / 3,70 mln zł w wieku 60, potrzebny kapitał 1 950 000 zł, wykres z trzema liniami, przerywaną linią potrzebnego kapitału i pionową linią wieku emerytalnego, legenda, kolory scenariuszy, dopisek symulacji pod wynikiem i dopisek informacyjny na dole.

Różnice, celowe:

- Kalkulator jest osobnym ekranem (`/goals/retirement`, SPEC 6: „Kalkulator emerytury (pełny widok z założeniami)”). Na desktopie założenia są w prawej kolumnie, na telefonie pod wynikiem z linkiem „Zmień założenia”.
- Założenia to pola formularza zamiast listy tylko do odczytu; każda stopa zwrotu ma osobne pole; doszła inflacja (SPEC 7.11).
- Na telefonie karty scenariuszy są jedna pod drugą (w makiecie trzy wąskie kolumny łamały tekst). Od 640 px są trzy kolumny jak w makiecie.
- Karta scenariusza ma dodatkowy wiersz „wystarcza” / „brakuje X”, żeby kolor nie był jedyną informacją (WCAG, SPEC 13).
- Zdanie o kwocie nominalnej przy inflacji 3% (SPEC 7.11: inflacja tylko do pokazania kwot nominalnych).
- Poprawna odmiana: „63 lata” zamiast „63 lat” z makiety.
- Etykieta osi potrzebnego kapitału „2 mln” zamiast „1,9 mln” (zaokrąglenie Intl, nie obcięcie).
- Pod wykresem rozwijana tabela z danymi wykresu (tabela alternatywna, SPEC 13).
- Ekran Cele nie ma jeszcze listy celów (baza w Etapach 3–5), więc obok pustego stanu jest karta z linkiem do kalkulatora zamiast wyniku z makiety.

Na zrzucie telefonu w pełnej długości dolny pasek nawigacji wypada w środku strony, bo jest przyklejony do dołu okna; na urządzeniu jest na dole.
