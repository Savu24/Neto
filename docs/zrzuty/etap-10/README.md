# Etap 10: strona główna, dokumenty prawne, PWA — zrzuty

Zrobione na zbudowanej aplikacji (`next start` z `scripts/e2e-server.ts`), Edge przez Playwright, 390 × 844 (skala 2) i 1440 × 900, pełna długość strony, język PL.

| Plik                                  | Co pokazuje                                                              |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `przed-start-*.png`                   | tymczasowa strona startowa z Etapu 2                                     |
| `przed-legal-terms-*.png`             | tymczasowa strona regulaminu (sam tytuł i zdanie „w przygotowaniu”)      |
| `po-start-*.png`, `po-start-*-ciemny` | nowa strona główna: opis, funkcje, czego Neto nie robi, FAQ, dopisek     |
| `po-legal-terms-*.png`, `*-ciemny`    | regulamin z `docs/prawne/regulamin.md`, oznaczenie szkicu, spis treści   |
| `po-legal-risk-*.png`                 | informacja o ryzyku (część B dokumentu)                                  |
| `po-delete-account-*.png`             | publiczna strona „Jak usunąć konto” pod stałym adresem `/delete-account` |
| `po-offline-*.png`                    | strona „Brak połączenia”, którą service worker pokazuje bez sieci        |

Uwagi:

- Ilustracja „linii bilansu” na stronie głównej jest poglądowa: bez kwot, bez osi i z podpisem „Przykład poglądowy, bez prawdziwych danych”, żeby nie sugerowała wyników.
- Kolory tylko z tokenów (`fill-brand-soft`, `fill-down-soft`, `stroke-brand`), więc tryb ciemny działa bez osobnych reguł.
- Dokumenty prawne pokazują tylko część publiczną pliku (między pierwszą a drugą linią `---`); pola do uzupełnienia i uwagi dla radcy zostają w repozytorium.
