# Notatka dla recenzenta App Store (App Review Information)

> **SZKIC — do zatwierdzenia przez radcę.** Wersja robocza 0.1 z 02.11.2026 (Etap 12). Treść pola „Notes” w App Store Connect, po angielsku (recenzenci Apple). Polska wersja poniżej służy właścicielowi do kontroli.

**Miejsca do uzupełnienia:**

- [E-MAIL KONTA DEMO], [HASŁO KONTA DEMO] — **wpisać tylko w App Store Connect** (pola „Sign-in required”), nigdy w repo ani w czacie
- [IMIĘ I NAZWISKO KONTAKTU], [TELEFON KONTAKTU], [E-MAIL KONTAKTU] — pola „Contact Information”
- [ADRES STRONY] — adres strony „Jak usunąć konto”
- [WARUNKOWO: CENY AUTOMATYCZNE] — zdanie o źródle cen zostaje, tylko jeśli działa dostawca cen
- [DOSTAWCA CEN] — nazwa dostawcy cen rynkowych (SPEC 14)

## Konto demo — wymagania

- Osobne konto, **bez 2FA**, z potwierdzonym e-mailem, na produkcji (recenzent nie może dostać się do bazy testowej).
- Wypełnione danymi przykładowymi: co najmniej konto bankowe, rachunek maklerski z ETF-em, obligacje EDO, lokata, mieszkanie, kredyt hipoteczny, jeden cel i ustawiony kalkulator emerytury. Historia co najmniej 6 miesięcy (żeby wykresy nie były puste).
- Bez prawdziwych danych osobowych i finansowych.
- **Nie usuwać i nie zmieniać hasła** w trakcie recenzji. Po każdej recenzji sprawdzić, czy recenzent nie zainicjował usunięcia konta (karencja 14 dni) — jeśli tak, anulować przez zalogowanie przed kolejną wersją.

## Notes (EN — do wklejenia)

```text
Neto is a free personal net worth tracker. Users enter their own accounts, assets and debts manually or import a CSV file; the app values them daily in Polish złoty and shows net worth over time, asset mix, goals and a retirement scenario calculator.

DEMO ACCOUNT
The sign-in credentials are in the "Sign-in required" fields. The demo account has sample data and two-step verification disabled, so no code is needed. Please do not delete it.

SIGN-IN OPTIONS
E-mail + password (with optional TOTP two-step verification) and Sign in with Google.

ACCOUNT DELETION (Guideline 5.1.1(v))
In the app: More → Settings → Data → Delete account. The user confirms with a password or 2FA code. The account is scheduled for deletion and permanently deleted after a 14-day grace period, which is stated on the confirmation screen; signing in during that period cancels the deletion. Public instructions: [ADRES STRONY]/delete-account

NO PURCHASES
The app has no in-app purchases, subscriptions, prices or links to external payment. The web version is also free.

NO TRADING, NO MONEY HANDLING
Neto does not connect to banks or brokers, does not place orders, does not hold or move money, and does not tell users what to buy or sell. Screens with results show a notice that the data is for information only. [WARUNKOWO: CENY AUTOMATYCZNE] Market prices come from [DOSTAWCA CEN]; exchange rates from the National Bank of Poland.

NATIVE FEATURES
Face ID / Touch ID lock with a privacy screen in the app switcher (Settings → Privacy), optional push notifications (no amounts are ever included), CSV export via the system share sheet, and an offline screen when there is no connection.

PERMISSIONS
Notifications: requested only when the user turns on push in Settings → Notifications. Face ID: requested only when the user turns on the biometric lock.
```

## Notatka (PL — kontrola treści)

Neto to bezpłatny tracker majątku. Użytkownik wpisuje swoje konta, aktywa i długi ręcznie albo importuje CSV; aplikacja codziennie wycenia je w złotych i pokazuje wartość netto w czasie, skład majątku, cele i kalkulator scenariuszy emerytury.

- **Konto demo:** dane w polach „Sign-in required”; dane przykładowe, bez 2FA. Prośba o nieusuwanie.
- **Logowanie:** e-mail + hasło (opcjonalnie 2FA TOTP) oraz Google.
- **Usuwanie konta (5.1.1(v)):** Więcej → Ustawienia → Dane → Usuń konto; potwierdzenie hasłem lub kodem 2FA; trwałe usunięcie po 14 dniach karencji, informacja o tym na ekranie potwierdzenia; zalogowanie w tym czasie anuluje usunięcie. Publiczna instrukcja: [ADRES STRONY]/delete-account.
- **Brak zakupów:** żadnych zakupów, subskrypcji, cen ani linków do płatności; wersja web też bezpłatna.
- **Brak handlu i obsługi pieniędzy:** brak połączenia z bankami i brokerami, brak zleceń, brak przechowywania pieniędzy, brak wskazań co kupić lub sprzedać; dopisek informacyjny na ekranach z wynikami.
- **Funkcje natywne:** blokada Face ID / Touch ID z zasłoną w przełączniku, push (nigdy z kwotami), eksport CSV przez arkusz udostępniania, ekran „Brak połączenia”.
- **Uprawnienia:** push i Face ID — pytanie systemowe dopiero po włączeniu funkcji w ustawieniach.

**Do potwierdzenia przed wysyłką** (z Etapem 4, 9 i 11): ścieżki menu, nazwy przycisków, to, że ekran potwierdzenia usunięcia rzeczywiście mówi o 14 dniach, i to, że uprawnienia są pytane dopiero po włączeniu funkcji. Jeśli przed wysyłką zapadnie decyzja o Sign in with Apple albo o ukryciu Google w iOS (`ryzyka-recenzji.md`, 4.8), zmienić sekcję „SIGN-IN OPTIONS”.
