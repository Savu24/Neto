# Etap 5 — zrzuty przed/po

- `przed-*`: ekrany Majątek i Dodaj z Etapu 2 (puste szkielety), zrobione przed zmianami.
- `po-*`: ten sam układ po Etapie 5, z danymi zestawu referencyjnego (`docs/referencje/majatek.md`).
  Generuje je test e2e: `ZRZUTY=1 PW_CHANNEL=msedge npx playwright test e2e/assets.spec.ts -g "zestaw referencyjny"`
  (po `npx next build`). Pasek nawigacji na zrzutach telefonu w połowie strony to efekt zrzutu całej strony z przyklejonym dolnym paskiem.

| Plik                  | Ekran                                             |
| --------------------- | ------------------------------------------------- |
| `po-majatek-pusty-*`  | Majątek bez kont (pusty stan)                     |
| `po-dodaj-*`          | Dodaj: transakcja / konto / import                |
| `po-import-podglad-*` | Import CSV, krok 3 (podgląd)                      |
| `po-transakcja-*`     | Formularz kupna z instrumentem ręcznym            |
| `po-konto-ike-*`      | Szczegóły konta maklerskiego                      |
| `po-pozycja-*`        | Szczegóły pozycji: wynik FIFO, wykres, transakcje |
| `po-majatek-*`        | Majątek, grupowanie po kontach                    |
| `po-majatek-klasy-*`  | Majątek, grupowanie po klasach aktywów            |
