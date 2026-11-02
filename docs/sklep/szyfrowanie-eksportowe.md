# Szyfrowanie a przepisy eksportowe (App Store Connect)

> **SZKIC — do zatwierdzenia przez radcę.** Wersja robocza 0.1 z 02.11.2026 (Etap 12). Odpowiedzi na pytania „Export Compliance” w App Store Connect.

**Miejsca do uzupełnienia:**

- [WYNIK PRZEGLĄDU ZALEŻNOŚCI] — po Etapie 11: lista pluginów Capacitora i bibliotek natywnych z potwierdzeniem, że żadna nie zawiera własnej kryptografii

## Stan faktyczny (na podstawie SPEC i planu Etapu 11)

| Gdzie                             | Szyfrowanie                                                       | Czy w aplikacji iOS          |
| --------------------------------- | ----------------------------------------------------------------- | ---------------------------- |
| Połączenia aplikacja ↔ serwer     | HTTPS/TLS przez WebView (WKWebView) i systemowe API sieciowe iOS  | tak, ale szyfrowanie systemu |
| Pola `*Enc` w bazie (AES-256-GCM) | na serwerze (Vercel), nie w aplikacji                             | nie                          |
| Hasła (argon2id), TOTP            | na serwerze                                                       | nie                          |
| Face ID / Touch ID                | API systemowe (LocalAuthentication)                               | tak, systemowe               |
| Przechowywanie tokenu sesji       | ciasteczko WebView lub pęk kluczy iOS (Keychain) — ustali Etap 11 | tak, systemowe               |
| Powiadomienia push                | Firebase SDK / APNs po TLS systemu                                | tak, systemowe               |

Aplikacja **nie implementuje** własnych algorytmów i nie dołącza bibliotek kryptograficznych — korzysta wyłącznie z szyfrowania wbudowanego w iOS. Do potwierdzenia: [WYNIK PRZEGLĄDU ZALEŻNOŚCI].

## Odpowiedzi

| Pytanie                                                                                            | Odpowiedź                                                                                                                                 |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Does your app use encryption? (lub: „What type of encryption algorithms does your app implement?”) | Tak, ale wyłącznie szyfrowanie systemu operacyjnego Apple. W formularzu z typami algorytmów: **„None of the algorithms mentioned above”** |
| Is your app going to be available on the French App Store?                                         | Tak (dostępność w UE). Przy samym szyfrowaniu systemowym deklaracja francuska nie jest wymagana — do potwierdzenia w aktualnym formularzu |
| Dokumentacja (CCATS, rejestracja)                                                                  | niepotrzebna przy powyższej odpowiedzi                                                                                                    |

## Do zrobienia w Etapie 11 (nie w tej sesji)

W `mobile/ios/App/App/Info.plist` dodać:

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

Wtedy App Store Connect nie zadaje pytań przy każdym buildzie. Jeśli kiedykolwiek dojdzie własna kryptografia w aplikacji (np. szyfrowanie lokalnej kopii danych), wartość i odpowiedzi trzeba zmienić przed wysyłką.

Formularz Apple zmienia brzmienie pytań — przed wysyłką porównać z aktualnym App Store Connect i dokumentacją „Complying with Encryption Export Regulations”.
