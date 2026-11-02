# Lista kontrolna ryzyk recenzji App Store

> **SZKIC — do zatwierdzenia przez radcę.** Wersja robocza 0.1 z 02.11.2026 (Etap 12). Przejść całą listę przed każdą wysyłką do recenzji. Wytyczne Apple zmieniają się — numery i brzmienie porównać z aktualnymi „App Review Guidelines” w dniu wysyłki.

**Miejsca do uzupełnienia:** [DECYZJA 4.8], [TYP KONTA DEWELOPERA], [DATA SPRAWDZENIA WYTYCZNYCH].

---

## ⚠️ 4.8 Login Services — Sign in with Apple — PRZYPOMNIEĆ WŁAŚCICIELOWI PRZED WYSYŁKĄ

**Stan:** aplikacja iOS ma logowanie Google; Sign in with Apple jest odłożone (decyzja właściciela z 02.11.2026, SPEC 1 i 11).

**Ryzyko: wysokie.** Wytyczna 4.8 wymaga, by aplikacja, która używa zewnętrznej usługi logowania (np. Google) do konta głównego, oferowała też równoważną usługę logowania, która: ogranicza zbierane dane do imienia i e-maila, pozwala ukryć adres e-mail i nie śledzi interakcji do reklam bez zgody. Sign in with Apple spełnia te warunki. Własne logowanie e-mail + hasło **raczej nie** spełnia warunku ukrycia adresu e-mail, więc prawdopodobnie nie wystarczy.

**Opcje dla właściciela** (decyzja: [DECYZJA 4.8]):

1. Dodać Sign in with Apple przed wysyłką (wtedy: zmiana etykiet prywatności — K3, Polityki prywatności — odbiorca Apple, notatki dla recenzenta, przy usuwaniu konta unieważnienie tokenu Apple przez REST API).
2. Ukryć logowanie Google w aplikacji iOS i zostawić tylko e-mail + hasło (wyjątek: aplikacja korzysta wyłącznie z własnego systemu kont). Konto założone przez Google w przeglądarce musi wtedy mieć sposób na zalogowanie w iOS (np. ustawienie hasła) — do zaprojektowania w Etapie 4/11.
3. Wysłać bez zmian i liczyć się z odrzuceniem — **niezalecane**.

- [ ] Właściciel podjął decyzję i wpisał ją wyżej.
- [ ] Decyzja wdrożona i przetestowana na urządzeniu.

## 4.2 Minimum Functionality (aplikacja na WebView)

**Ryzyko: średnie.** Capacitor to WebView; Apple odrzuca aplikacje, które są „opakowaną stroną WWW”.

- [ ] Aplikacja startuje od logowania lub pulpitu, bez strony marketingowej (SPEC 11).
- [ ] Działają funkcje natywne: Face ID / Touch ID z zasłoną w przełączniku, push, arkusz udostępniania przy eksporcie, natywne logowanie Google (jeśli zostaje), ekran „Brak połączenia” zamiast białej strony.
- [ ] Nawigacja jak w aplikacji (dolny pasek), bez pasków przeglądarki, bez linków otwierających stronę WWW w WebView; linki zewnętrzne i dokumenty prawne w przeglądarce systemowej.
- [ ] Brak widocznych opóźnień przy przejściach i brak przewijania w poziomie.
- [ ] Notatka dla recenzenta wymienia funkcje natywne.

## 3.1.1 In-App Purchase (i 3.1.3)

**Ryzyko: niskie, jeśli zasada „zero cen” jest przestrzegana.**

- [ ] W iOS nie ma cen, planów, „Pro”, „premium”, przycisków zakupu ani wzmianek o płatnej wersji.
- [ ] Żaden link w aplikacji nie prowadzi do strony z cenami lub zakupem (także stopka, pomoc, e-maile otwierane z aplikacji).
- [ ] Opis w sklepie i zrzuty bez cen (`opis-app-store.md`, `zrzuty-ekranu.md`).
- [ ] W App Store Connect: cena „Free”, brak produktów In-App Purchase.

## 5.1.1(v) Account Deletion

**Ryzyko: niskie, jeśli wdrożone jak w SPEC (HU-1.6).**

- [ ] Usunięcie konta dostępne w aplikacji iOS (Więcej → Ustawienia → Dane → Usuń konto), nie tylko w przeglądarce i nie tylko e-mailem.
- [ ] To jest usunięcie, nie dezaktywacja: po 14 dniach dane są trwale usuwane.
- [ ] Ekran potwierdzenia jasno mówi o 14 dniach karencji i o tym, jak anulować.
- [ ] Publiczna strona „Jak usunąć konto” działa bez logowania; jej adres w App Store Connect.
- [ ] Konto demo nie zostało usunięte przez poprzedniego recenzenta.

## Inne wytyczne warte sprawdzenia

| Wytyczna                                    | Ryzyko  | Co sprawdzić                                                                                                                                                                                                                                                        |
| ------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1.1(ix) usługi w regulowanych dziedzinach | średnie | Aplikacje z obszaru usług finansowych powinien wysyłać podmiot prawny, nie osoba prywatna. Konto deweloperskie: [TYP KONTA DEWELOPERA] — zalecane konto organizacji (wymaga numeru D-U-N-S). Neto nie świadczy usług finansowych, ale recenzent może tak to ocenić. |
| 3.2.1(viii) handel, inwestowanie            | niskie  | Neto nie handluje i nie zarządza pieniędzmi — powiedzieć to wprost w notatce dla recenzenta (jest).                                                                                                                                                                 |
| 2.1 kompletność                             | średnie | Konto demo działa na produkcji; backend dostępny; brak ekranów „wkrótce” poza opisanym polem waluty bazowej (SPEC HU-6.4 — rozważyć ukrycie w iOS).                                                                                                                 |
| 2.3 metadane                                | niskie  | Opis i zrzuty zgodne z funkcjami wysyłanej wersji; ceny automatyczne tylko, jeśli działa dostawca.                                                                                                                                                                  |
| 5.1.1(i), 5.1.2 polityka i etykiety         | średnie | Link do Polityki prywatności w App Store Connect i w aplikacji; etykiety zgodne z polityką co do słowa (`etykiety-prywatnosci.md`).                                                                                                                                 |
| 5.1.1(iv) uprawnienia                       | niskie  | Pytanie o push i Face ID dopiero po włączeniu funkcji; teksty `NSFaceIDUsageDescription` po polsku i angielsku, opisują cel.                                                                                                                                        |
| 4.0 / 4.1 design, kopie                     | niskie  | Brak elementów udających inne aplikacje; nazwa i ikona własne.                                                                                                                                                                                                      |
| 1.1.6 / 3.2.2 wprowadzające w błąd treści   | niskie  | Brak obietnic zysku; dopiski „informacyjne” i „symulacja” widoczne.                                                                                                                                                                                                 |

## Przed kliknięciem „Submit for Review”

- [ ] Sekcja 4.8 zamknięta (decyzja właściciela).
- [ ] Teksty prawne zatwierdzone przez radcę i opublikowane pod adresami z App Store Connect.
- [ ] Wytyczne sprawdzone w dniu: [DATA SPRAWDZENIA WYTYCZNYCH].
