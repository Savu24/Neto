# Umowy powierzenia i transfery — lista do podpisania

> **SZKIC — do zatwierdzenia przez radcę.** Wersja robocza 0.1 z 02.11.2026 (Etap 12). Dokument wewnętrzny. Warunki dostawców **nie zostały sprawdzone** w tej sesji — każdą pozycję trzeba zweryfikować na stronie dostawcy w dniu podpisania i zapisać datę oraz wersję dokumentu.

**Miejsca do uzupełnienia:** [DOSTAWCA E-MAIL], [OCHRONA ANTYBOTOWA], [DOSTAWCA CEN], [DOSTAWCA SKRZYNKI E-MAIL], [REGION SUPABASE], [REGION VERCEL], [REGION SENTRY], [DO UZUPEŁNIENIA] (pola otwarte w tabeli), kolumna „Status”.

---

## Jak czytać tabelę

- **DPA** — umowa powierzenia przetwarzania (art. 28 RODO). U większości dostawców chmurowych jest częścią warunków albo akceptuje się ją w panelu; trzeba ją świadomie zaakceptować na koncie firmowym administratora i zachować kopię.
- **Transfer** — podstawa przekazania poza EOG: certyfikacja EU-US Data Privacy Framework (DPF) albo standardowe klauzule umowne (SCC). Przy DPF sprawdzić wpis na dataprivacyframework.gov.
- **Status** — wypełnia właściciel: „do zrobienia” / „zaakceptowano DD.MM.RRRR, wersja …”.

## Podmioty przetwarzające (wymagają DPA)

| Dostawca                          | Do czego                               | Dane                                                  | Region do ustawienia                     | DPA — co zrobić                                                              | Transfer           | Status       |
| --------------------------------- | -------------------------------------- | ----------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------- | ------------------ | ------------ |
| Supabase                          | baza danych, kopie zapasowe            | K1–K8, K10                                            | projekt w regionie UE: [REGION SUPABASE] | zaakceptować DPA Supabase na koncie organizacji                              | SCC (podwykonawcy) | do zrobienia |
| Vercel                            | hosting, funkcje serwerowe, cron, logi | wszystkie podczas przetwarzania                       | funkcje w regionie UE: [REGION VERCEL]   | DPA Vercel (część warunków planu) — sprawdzić, czy wymaga osobnej akceptacji | DPF lub SCC        | do zrobienia |
| Google (Firebase Cloud Messaging) | powiadomienia push                     | K8, treść push bez kwot                               | brak wyboru regionu dla FCM              | zaakceptować „Firebase Data Processing and Security Terms” w konsoli         | DPF lub SCC        | do zrobienia |
| [DOSTAWCA E-MAIL]                 | e-maile transakcyjne i bezpieczeństwa  | K1, treść e-maili (z kwotami w podsumowaniu tygodnia) | preferowany region UE                    | DPA dostawcy                                                                 | [DO UZUPEŁNIENIA]  | do zrobienia |
| Sentry                            | raporty błędów                         | K3 (identyfikator), K9                                | rozważyć region UE: [REGION SENTRY]      | DPA Sentry (w ustawieniach organizacji)                                      | DPF lub SCC        | do zrobienia |
| [OCHRONA ANTYBOTOWA]              | ochrona rejestracji                    | K4                                                    | [DO UZUPEŁNIENIA]                        | DPA dostawcy                                                                 | [DO UZUPEŁNIENIA]  | do zrobienia |
| [DOSTAWCA SKRZYNKI E-MAIL]        | skrzynka kontaktowa i do spraw RODO    | K1, K10                                               | [DO UZUPEŁNIENIA]                        | DPA dostawcy                                                                 | [DO UZUPEŁNIENIA]  | do zrobienia |

## Podmioty, które prawdopodobnie nie wymagają DPA (do potwierdzenia przez radcę)

| Podmiot                         | Dlaczego                                                                  | Co mimo to zrobić                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [DOSTAWCA CEN]                  | dostaje tylko symbole instrumentów i daty, bez identyfikatora użytkownika | licencja na wyświetlanie danych użytkownikom końcowym i atrybucja (SPEC 14)                          |
| NBP (API kursów)                | publiczne API, nie dostaje danych osobowych                               | sprawdzić warunki ponownego wykorzystania i wymaganą atrybucję (SPEC 12 pkt 7)                       |
| Pwned Passwords (HIBP)          | k-anonimowość: 5 znaków skrótu SHA-1, bez e-maila                         | potwierdzić warunki użycia API                                                                       |
| Google (logowanie przez Google) | osobny administrator danych konta Google                                  | weryfikacja aplikacji OAuth w Google Cloud, link do polityki na ekranie zgody                        |
| Apple (App Store, APNs)         | osobny administrator; dystrybucja aplikacji i dostarczanie push           | Apple Developer Program License Agreement; konto organizacji (patrz `docs/sklep/ryzyka-recenzji.md`) |
| Codemagic                       | buduje aplikację iOS; nie dostaje danych użytkowników                     | nie wgrywać danych produkcyjnych ani zrzutów z danymi do buildów                                     |
| GitHub                          | repozytorium kodu; bez danych użytkowników                                | nie commitować danych produkcyjnych ani `.env`                                                       |

## Przed startem

1. Wybrać dostawcę e-mail, ochrony antybotowej i cen (SPEC 14, 15) i uzupełnić tabelę.
2. Ustawić regiony UE tam, gdzie się da (Supabase, Vercel, Sentry, dostawca e-mail).
3. Zaakceptować DPA na kontach firmowych (nie prywatnych) administratora; zapisać daty i wersje.
4. Pobrać listy podwykonawców (sub-processors) i włączyć powiadomienia o ich zmianach, jeśli dostawca je oferuje.
5. Przenieść nazwy i regiony do Polityki prywatności (pkt 5–6) i Rejestru czynności przetwarzania.
