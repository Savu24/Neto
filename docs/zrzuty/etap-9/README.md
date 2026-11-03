# Etap 9: powiadomienia (zrzuty)

Nowe ekrany, telefon 390×844 (iPhone 13) i desktop 1440×900, jasny motyw. Wykonane w e2e:
`ZRZUTY=1 PW_CHANNEL=msedge npx playwright test e2e/notifications.spec.ts`.

| Plik                        | Ekran                                                                          |
| --------------------------- | ------------------------------------------------------------------------------ |
| `powiadomienia-pusto-*.png` | `/notifications` bez wpisów                                                    |
| `powiadomienia-*.png`       | `/notifications` z dwoma nieprzeczytanymi (osiągnięte cele)                    |
| `ustawienia-*.png`          | `/settings` z pozycjami „Powiadomienia” (licznik) i „Ustawienia powiadomień”   |
| `preferencje-*.png`         | `/settings/notifications`, konto bez potwierdzonego adresu (e-mail nieaktywny) |

Na zrzutach całej strony z telefonu dolny pasek nawigacji jest przyklejony w połowie (artefakt `fullPage` przy elemencie `fixed`). Nowe ekrany, więc bez zrzutów „przed”; ekran Ustawień zmienił się tylko o dwie pozycje listy.
