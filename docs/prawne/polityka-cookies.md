# Polityka cookies Neto

> **SZKIC — do zatwierdzenia przez radcę.** Wersja robocza 0.1 z 02.11.2026 (Etap 12). Nie publikować przed akceptacją.

**Miejsca do uzupełnienia:**

- [NAZWA ADMINISTRATORA], [E-MAIL DO SPRAW PRYWATNOŚCI]
- [OCHRONA ANTYBOTOWA], [CIASTECZKA OCHRONY ANTYBOTOWEJ] — nazwa dostawcy i jego ciasteczka (albo usunąć wiersz)
- [DO UZUPEŁNIENIA] — okres przechowywania tych ciasteczek
- [DATA WEJŚCIA W ŻYCIE]

**Do potwierdzenia po Etapie 4:** nazwy ciasteczek Auth.js poniżej to wartości domyślne biblioteki. Przed publikacją porównać z faktycznymi ciasteczkami w przeglądarce (narzędzia deweloperskie → Application → Cookies) na wersji produkcyjnej.

---

## 1. Co to są ciasteczka

Ciasteczka (cookies) to małe pliki zapisywane przez stronę w Twojej przeglądarce lub w aplikacji. Podobnie działa pamięć lokalna przeglądarki (local storage) i pamięć podręczna aplikacji PWA (service worker); poniższe zasady dotyczą wszystkich tych technologii.

## 2. Jakich ciasteczek używamy

W wersji 1.0 Neto używa **wyłącznie ciasteczek niezbędnych** do działania usługi, o którą prosisz. Nie używamy ciasteczek analitycznych, reklamowych ani śledzących, także od podmiotów trzecich.

| Nazwa                                                                 | Do czego służy                                             | Kto ustawia          | Jak długo                                                  |
| --------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------- | ---------------------------------------------------------- |
| `authjs.session-token` (na produkcji `__Secure-authjs.session-token`) | utrzymanie zalogowania                                     | Neto                 | do wylogowania; 30 dni bezczynności (web), 90 dni (iPhone) |
| `authjs.csrf-token` (na produkcji `__Host-authjs.csrf-token`)         | ochrona formularzy logowania przed atakiem CSRF            | Neto                 | do zamknięcia przeglądarki                                 |
| `authjs.callback-url` (na produkcji `__Secure-authjs.callback-url`)   | powrót na właściwą stronę po logowaniu, także przez Google | Neto                 | do zamknięcia przeglądarki                                 |
| `neto-locale`                                                         | zapamiętanie wybranego języka (PL/EN)                      | Neto                 | 1 rok                                                      |
| `neto-theme`                                                          | zapamiętanie wybranego motywu (jasny/ciemny/systemowy)     | Neto                 | 1 rok                                                      |
| [CIASTECZKA OCHRONY ANTYBOTOWEJ]                                      | odróżnienie człowieka od bota przy rejestracji             | [OCHRONA ANTYBOTOWA] | [DO UZUPEŁNIENIA]                                          |

Pamięć podręczna aplikacji (service worker) przechowuje tylko powłokę aplikacji i stronę „Brak połączenia”, **bez Twoich danych finansowych**.

Przy logowaniu przez Google przechodzisz na stronę Google, która stosuje własne ciasteczka zgodnie z polityką Google.

## 3. Podstawa i zgoda

Ciasteczka niezbędne nie wymagają zgody, bo służą wyłącznie do świadczenia usługi, o którą prosisz (art. 399 ust. 3 ustawy Prawo komunikacji elektronicznej — numer przepisu do potwierdzenia przez radcę). Dlatego w wersji 1.0 pokazujemy tylko baner informacyjny z odnośnikiem do tej polityki, bez przycisków zgody.

Jeśli w przyszłości dodamy ciasteczka analityczne lub inne, które nie są niezbędne, zapytamy o zgodę przed ich zapisaniem, a zgodę będzie można w każdej chwili wycofać. Zmienimy też tę politykę.

## 4. Jak zarządzać ciasteczkami

Możesz usunąć lub zablokować ciasteczka w ustawieniach przeglądarki. Zablokowanie ciasteczek niezbędnych uniemożliwi zalogowanie; zablokowanie `neto-locale` lub `neto-theme` sprawi, że język i motyw wrócą do ustawień domyślnych.

## 5. Kontakt

Administrator: [NAZWA ADMINISTRATORA]. Pytania: [E-MAIL DO SPRAW PRYWATNOŚCI]. Więcej o przetwarzaniu danych: Polityka prywatności.

Data wejścia w życie: [DATA WEJŚCIA W ŻYCIE].
