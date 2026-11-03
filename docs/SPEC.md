# Neto — specyfikacja wersji 1.0

Status: **szkic do akceptacji (Etap 1)**, 02.11.2026. Po akceptacji lista funkcji MVP jest zamrożona; każda zmiana zakresu trafia tu jako wpis w sekcji 19 „Dziennik zmian”.

Źródła prawdy: ten plik i strona Notion „Plan: aplikacja typu BeWealthy (iOS + przeglądarka) — kroki dla Claude Code”. Makiety: [`docs/mockups/`](mockups/index.html), zrzuty w [`docs/mockups/zrzuty/`](mockups/zrzuty/).

---

## 1. Decyzje przyjęte przed specyfikacją

| Decyzja | Ustalenie | Kto, kiedy |
| --- | --- | --- |
| Produkt | Tracker majątku jako rdzeń; prosty budżet dochodów i wydatków **po 1.0** | właściciel, 02.11.2026 |
| Model biznesowy | 1.0 darmowa, bez cen i zakupów w web i iOS; decyzja o płatnościach później | właściciel, 02.11.2026 |
| Waluty | Waluta bazowa PLN; aktywa i zobowiązania w dowolnych walutach, przeliczane po kursach; model danych gotowy na zmianę waluty bazowej | właściciel, 02.11.2026 |
| Nazwa robocza | **Neto** (ostateczna marka przed Etapem 11) | właściciel, 02.11.2026 |
| Powłoka iOS | Capacitor (WebView + natywne pluginy) | właściciel, 02.11.2026 |
| Logowanie | E-mail + hasło + 2FA (TOTP) oraz Google. Sign in with Apple odłożone; **przed wysyłką do App Store sprawdzić wymóg Apple 4.8** | właściciel, 02.11.2026 |
| iPad w 1.0 | Nie (domyślne z planu) | do potwierdzenia przy akceptacji |
| Agregacja bankowa (PSD2) | Nie w 1.0 (domyślne z planu) | do potwierdzenia przy akceptacji |
| Dostawca cen rynkowych | Otwarte; porównanie w sekcji 14, decyzja przed Etapem 6 | właściciel |

## 2. Produkt w jednym akapicie

Neto zbiera w jednym miejscu wszystko, co użytkownik ma i co jest winien: konta, lokaty, akcje i ETF-y, fundusze, obligacje skarbowe, krypto, nieruchomości, kredyty. Raz dziennie wycenia całość w złotówkach i pokazuje wartość netto w czasie, jej skład i tempo zmian. Pozwala ustawić cele i policzyć, kiedy majątek wystarczy na emeryturę. Dane wpisuje się ręcznie albo importuje z CSV. Aplikacja **pokazuje dane, nie doradza**: nie poleca instrumentów, nie składa zleceń, nie przechowuje pieniędzy.

Kanały: przeglądarka (responsywna, instalowalna jako PWA) i iPhone (Capacitor). Jedno konto, wspólny backend, wspólny kod interfejsu.

## 3. Analiza konkurencji

Stan wiedzy na 02.11.2026, na podstawie stron sklepów i stron producentów. Pola „b.d.” oznaczają, że nie sprawdzono; nie zgadujemy.

**Wzorzec funkcjonalny: BeWealthy – Net Worth Tracker** (Jakub Klamka, iOS 17+, PL/EN, wersja 6.4). Najważniejsze obserwacje:

- Model local-first: dane zaszyfrowane na telefonie, opcjonalna kopia w chmurze (Supabase, UE). Logowanie Apple/Google tylko do kopii. **Neto jest inne z założenia**: dane na serwerze, bo mają być te same w przeglądarce i na iPhonie.
- Bardzo szybki rytm wydań (od 1.0 w lipcu do 6.4 w październiku 2026), mocny nacisk na budżet i grywalizację (Wealth Score, serie dni, kamienie milowe).
- Ceny: Yahoo Finance, CoinGecko, Frankfurter, dla GPW Stooq. Freemium: Free do 2–3 kont, Pro z subskrypcją lub dożywotnio.
- Rozbieżności w samym sklepie (np. CSV raz w Free, raz w Pro; „bez reklam” przy etykietach prywatności z reklamą) — czytamy to jako ostrzeżenie: nasze opisy w sklepie i etykiety muszą się zgadzać co do słowa (Etap 12).

| Funkcja | BeWealthy | getquin | Finary | myfund.pl | **Neto** |
| --- | --- | --- | --- | --- | --- |
| Wartość netto (aktywa − zobowiązania) z historią | tak | częściowo (portfel) | tak | portfel | **1.0** |
| Kanał web | nie | tak | tak | tak | **1.0** |
| iPhone | tak | tak | tak | b.d. | **1.0** |
| Android | nie | tak | tak | b.d. | później |
| Ręczne aktywa (nieruchomość, auto, inne) | tak | tak | tak | b.d. | **1.0** |
| Lokaty z oprocentowaniem i kapitalizacją | tak (6.3) | b.d. | b.d. | b.d. | **1.0** |
| Detaliczne obligacje skarbowe (EDO, COI, ROD…) | „obligacje” bez szczegółów | b.d. | b.d. | tak (obligacje) | **1.0** (wzór wyceny, sekcja 7.5) |
| Akcje/ETF z GPW z automatyczną ceną | tak (Stooq) | b.d. | b.d. | tak | **1.0** (zależy od dostawcy) |
| Krypto | tak | tak | tak | b.d. | **1.0** |
| Wiele walut, efekt walutowy osobno | tak | b.d. | b.d. | b.d. | **1.0** |
| Stopa zwrotu portfela | XIRR | TWR | b.d. | tak | **1.0** (XIRR) |
| Dywidendy (zapis) | b.d. | tak, z kalendarzem | tak | b.d. | **1.0** zapis; kalendarz później |
| Import CSV/Excel | tak | tak | b.d. | b.d. | **1.0** (CSV) |
| Agregacja bankowa | nie | tak (brokerzy) | tak (10k+ instytucji) | b.d. | później (PSD2) |
| Cele finansowe | tak (tempo, serie) | b.d. | b.d. | b.d. | **1.0** |
| Kalkulator emerytury / wolności finansowej | cel „wolność” + prognozy | prognozy dywidend | prognozy (płatne) | b.d. | **1.0** (scenariusze) |
| Budżet miesięczny, kategorie | tak, rozbudowany | nie | tak (nazwa „Budget”) | nie | **po 1.0** |
| Wspólne wydatki / współwłasność | tak | nie | b.d. | nie | udział własności **1.0**; wspólne konta później |
| Alerty cenowe | tak | b.d. | b.d. | b.d. | później |
| Widżety ekranu głównego | tak | b.d. | b.d. | nie | później (natywne iOS) |
| Wskaźnik „zdrowia finansowego” | Wealth Score | nie | b.d. | nie | później (ryzyko „porady”, patrz 17) |
| Blokada Face ID, ukrywanie kwot | tak | b.d. | b.d. | nie | **1.0** |
| Eksport danych i usunięcie konta | eksport CSV | b.d. | b.d. | b.d. | **1.0** |
| 2FA | n/d (local-first) | b.d. | b.d. | b.d. | **1.0** |

Czego nie sprawdziłem: aplikacji typu „Finanso” wymienionych w planie (nie znalazłem źródeł), szczegółów Kubera/Empower (rynek USA, opisy z recenzji: Kubera — ręczne i nietypowe aktywa za ok. 200–250 USD rocznie; Empower — darmowa agregacja w USA). Nic z powyższego nie było testowane w samych aplikacjach.

**Czym Neto ma się wyróżnić w 1.0** (wynik analizy, a nie marketing):

1. Web i iPhone na jednym koncie — BeWealthy nie ma przeglądarki.
2. Polskie instrumenty traktowane poważnie: detaliczne obligacje skarbowe liczone wzorem, IKE/IKZE/PPK jako „opakowanie” konta, kursy NBP.
3. Uczciwość danych: każda wartość ma datę ceny; nieaktualne wyceny są oznaczone, a nie ciche.
4. Bezpieczeństwo konta na poziomie aplikacji finansowej: 2FA, sesje, audyt, szyfrowanie wrażliwych pól.

## 4. Persony

**Kasia, 31 lat, specjalistka IT, Kraków.** Ma konto w banku, IKE z ETF-ami u brokera, EDO kupowane co miesiąc, trochę krypto i kredyt hipoteczny. Dziś trzyma to w arkuszu, który aktualizuje raz w miesiącu i ma go dość. Chce jednej liczby i wykresu, który rośnie. Korzysta głównie z telefonu, dane wprowadza wieczorem na laptopie.

**Tomasz, 46 lat, przedsiębiorca, Poznań.** Mieszkanie na wynajem, lokaty w dwóch bankach, fundusze, akcje na GPW i w USD, leasing samochodu. Pyta „ile mam naprawdę po odjęciu długów” i „czy zdążę przejść na emeryturę w 60”. Ceni przegląd na dużym ekranie i eksport danych.

**Ania i Piotr, 28 i 30 lat, para.** Wspólne mieszkanie na kredyt (po połowie), osobne oszczędności. Chcą zobaczyć swoją część wspólnego majątku. W 1.0 dostają udział procentowy w koncie; wspólny widok dla dwóch osób jest po 1.0.

## 5. Historie użytkownika (MVP)

Format: „Jako … chcę … aby …”, z kryteriami akceptacji (KA). Numeracja HU-x.y służy do odwołań w testach i commitach.

### 5.1 Konto i bezpieczeństwo (Etap 4)

- **HU-1.1** Jako nowy użytkownik chcę założyć konto e-mailem i hasłem, aby moje dane były dostępne z telefonu i komputera.
  KA: hasło min. 12 znaków, sprawdzenie w słowniku wycieków (k-anonimowość, wyłączone flagą bez dostępu do sieci); e-mail weryfikacyjny ważny 24 h; bez weryfikacji można się zalogować, ale nie można włączyć powiadomień e-mail; ochrona antybotowa przy rejestracji (flaga).
- **HU-1.2** Jako użytkownik chcę zalogować się przez Google, aby nie pamiętać kolejnego hasła.
  KA: konto Google z tym samym zweryfikowanym e-mailem łączy się z istniejącym kontem tylko po potwierdzeniu hasłem; bez kluczy Google przycisk jest ukryty (flaga).
- **HU-1.3** Jako użytkownik chcę włączyć 2FA (aplikacja TOTP) i dostać 10 kodów zapasowych, aby nikt z samym hasłem nie wszedł na moje konto.
  KA: kod QR + klucz tekstowy; aktywacja dopiero po poprawnym kodzie; kody zapasowe jednorazowe, pokazane raz; 2FA wymagane też przy logowaniu Google, jeśli włączone.
- **HU-1.4** Jako użytkownik chcę zresetować hasło, aby odzyskać dostęp.
  KA: link ważny 1 h, jednorazowy; po resecie wylogowanie wszystkich sesji; komunikat nie zdradza, czy e-mail istnieje.
- **HU-1.5** Jako użytkownik chcę widzieć aktywne sesje i urządzenia oraz wylogować wszystkie, aby zareagować na zgubiony telefon.
- **HU-1.6** Jako użytkownik chcę usunąć konto z poziomu web i aplikacji iOS, aby moje dane zniknęły (RODO, wymóg Apple 5.1.1(v)).
  KA: potwierdzenie hasłem lub 2FA; okres karencji 14 dni z możliwością anulowania przez zalogowanie; po karencji twarde usunięcie danych finansowych; e-mail z potwierdzeniem.
- **HU-1.7** Jako użytkownik chcę pobrać wszystkie swoje dane (JSON + CSV w ZIP), aby je mieć lub przenieść.
- **HU-1.8** Jako użytkownik chcę dostać e-mail o logowaniu z nowego urządzenia i o zmianie 2FA lub hasła.

### 5.2 Konta, aktywa, pozycje (Etap 5)

- **HU-2.1** Jako użytkownik chcę dodać konto (bankowe, oszczędnościowe, lokatę, maklerskie, emerytalne, krypto, obligacje, nieruchomość, pojazd, inne aktywo, kredyt, kartę, inne zobowiązanie), aby odtworzyć swój majątek.
  KA: nazwa, typ, waluta, instytucja (opcjonalnie), opakowanie podatkowe (brak / IKE / IKZE / PPK / OIPE), udział własności 1–100% (domyślnie 100%), notatka (szyfrowana).
- **HU-2.2** Jako użytkownik chcę wyszukać instrument po nazwie, tickerze lub ISIN, aby dodać pozycję bez przepisywania danych.
  KA: najpierw katalog własny (seed popularnych instrumentów GPW i ETF-ów UCITS), potem dostawca (gdy włączony); brak wyników → „Dodaj instrument ręcznie” z ręczną ceną.
- **HU-2.3** Jako użytkownik chcę zapisać transakcję (kupno, sprzedaż, wpłata, wypłata, dywidenda, odsetki, opłata, podatek, przelew między kontami, aktualizacja wyceny, korekta salda), aby pozycje i salda liczyły się same.
  KA: data nie z przyszłości; sprzedaż ponad posiadaną ilość → błąd z podaną dostępną ilością; transakcja z datą wsteczną przelicza historię od tej daty (sekcja 7.7).
- **HU-2.4** Jako użytkownik chcę zaimportować CSV z banku lub brokera, aby nie wpisywać setek transakcji.
  KA: kroki plik → mapowanie kolumn → podgląd z błędami w wierszach → import; rozpoznawanie separatora, kodowania (UTF-8, Windows-1250) i formatu liczb (1 234,56 i 1,234.56); zapamiętane mapowania per źródło; duplikaty (ten sam odcisk wiersza) pomijane i pokazane; limit 5 MB / 20 000 wierszy; import cofany jednym przyciskiem w ciągu 24 h.
- **HU-2.5** Jako użytkownik chcę dodać aktywo ręczne (np. mieszkanie) z wyceną i datą, a potem ją aktualizować, aby wartość netto obejmowała wszystko.
  KA: każda aktualizacja to wpis historii; po 90 dniach bez aktualizacji przypomnienie.
- **HU-2.6** Jako użytkownik chcę dodać lokatę (kwota, oprocentowanie, okres, kapitalizacja) i obligacje skarbowe (seria, liczba, data zakupu, oprocentowanie), aby ich wartość rosła sama.
- **HU-2.7** Jako użytkownik chcę dodać kredyt z saldem i opcjonalnie oprocentowaniem, ratą i datą końca, aby długi pomniejszały wartość netto.
  KA: w 1.0 saldo aktualizowane ręcznie (z przypomnieniem co miesiąc); automatyczny harmonogram spłat po 1.0.
- **HU-2.8** Jako użytkownik chcę zarchiwizować konto zamknięte, aby zniknęło z bieżącego widoku, ale zostało w historii.

### 5.3 Wycena (Etap 6)

- **HU-3.1** Jako użytkownik chcę, żeby majątek był wyceniany codziennie bez mojego udziału.
- **HU-3.2** Jako użytkownik chcę widzieć przy każdej pozycji datę ceny i oznaczenie, gdy cena jest nieaktualna, aby wiedzieć, na ile ufać liczbie.
- **HU-3.3** Jako użytkownik po dodaniu pozycji kupionej rok temu chcę zobaczyć poprawną historię wstecz.
- **HU-3.4** Jako użytkownik chcę odświeżyć ceny ręcznie (przeciągnięcie w dół / przycisk), z limitem raz na 15 minut.

### 5.4 Pulpit i analiza (Etap 7)

- **HU-4.1** Jako użytkownik chcę zobaczyć wartość netto, a pod nią aktywa i zobowiązania, ze zmianą dzienną, miesięczną i roczną.
- **HU-4.2** Jako użytkownik chcę wykres historii (1M, 6M, 1R, 5L, Wszystko), na którym widać aktywa nad linią zera, zobowiązania pod nią i linię wartości netto.
- **HU-4.3** Jako użytkownik chcę zobaczyć alokację według klasy aktywów, waluty i konta.
- **HU-4.4** Jako użytkownik chcę listę pozycji z wartością, wynikiem (kwotowo i procentowo, z efektem walutowym osobno) i udziałem w majątku.
- **HU-4.5** Jako użytkownik chcę ukryć kwoty jednym dotknięciem (tryb prywatny), np. w tramwaju.
- **HU-4.6** Jako użytkownik chcę zobaczyć stopę zwrotu portfela inwestycyjnego (XIRR) od początku i za ostatni rok.

### 5.5 Cele i emerytura (Etap 8)

- **HU-5.1** Jako użytkownik chcę ustawić cel (kwota, termin, powiązane konta lub cała wartość netto), aby widzieć postęp i potrzebną miesięczną wpłatę.
- **HU-5.2** Jako użytkownik chcę oznaczyć jeden cel jako główny, aby był na pulpicie.
- **HU-5.3** Jako użytkownik chcę policzyć, w jakim wieku mój majątek pozwoli przejść na emeryturę, przy trzech scenariuszach, ze wszystkimi założeniami widocznymi i edytowalnymi.

### 5.6 Powiadomienia i ustawienia (Etap 9)

- **HU-6.1** Jako użytkownik chcę tygodniowe podsumowanie (w aplikacji, e-mail, push), bez kwot w treści push.
- **HU-6.2** Jako użytkownik chcę wiadomość, gdy osiągnę cel albo wycena się zestarzeje.
- **HU-6.3** Jako użytkownik chcę wyłączać każdy typ powiadomień osobno dla każdego kanału.
- **HU-6.4** Jako użytkownik chcę zmienić język (PL/EN), motyw (jasny/ciemny/systemowy) i format liczb. Waluta bazowa: w 1.0 tylko PLN (pole widoczne, nieedytowalne z dopiskiem „wkrótce”).

### 5.7 iPhone (Etap 11)

- **HU-7.1** Jako użytkownik iPhone'a chcę blokady Face ID / Touch ID po powrocie z tła (po 1 min lub od razu — ustawienie) i zasłonięcia podglądu w przełączniku aplikacji.
- **HU-7.2** Jako użytkownik iPhone'a chcę udostępnić eksport CSV przez arkusz systemowy.
- **HU-7.3** Jako użytkownik iPhone'a chcę ekranu „Brak połączenia” zamiast białej strony.

## 6. Ekrany i nawigacja

Nawigacja główna (te same pozycje w obu kanałach):

| Pozycja | Telefon | Desktop (≥ 1024 px) |
| --- | --- | --- |
| Pulpit | dolny pasek | pasek boczny |
| Majątek | dolny pasek | pasek boczny |
| Dodaj (transakcja / konto / import) | środkowy przycisk w dolnym pasku | przycisk w pasku bocznym |
| Cele | dolny pasek | pasek boczny |
| Więcej (powiadomienia, ustawienia, eksport, pomoc) | dolny pasek | pasek boczny + ikona dzwonka |

Tablet (768–1023 px): pasek boczny zwinięty do ikon.

Lista ekranów 1.0 (pogrubione mają makietę w Etapie 1):

- Publiczne: strona główna (marketing, Etap 10), logowanie, rejestracja, weryfikacja e-mail, reset hasła, kod 2FA, regulamin, polityka prywatności, publiczna strona „Jak usunąć konto”.
- Pierwsze uruchomienie: język i motyw → pierwsze konto **albo** „Zobacz na danych przykładowych” (tryb demo, dane tylko do odczytu, wyraźny pasek „Dane przykładowe”).
- **Pulpit**.
- **Majątek** (lista kont i pozycji; przełącznik grupowania: konto / klasa aktywów).
- Szczegóły konta (saldo, pozycje, transakcje, edycja, archiwizacja).
- **Szczegóły pozycji / aktywa** (wartość, wykres ceny i wartości, wynik, transakcje, data ceny).
- Formularze: dodaj/edytuj konto, dodaj transakcję, dodaj instrument ręcznie, aktualizacja wyceny.
- Import CSV (trzy kroki).
- **Cele** (lista, cel główny, kalkulator emerytury jako osobna karta na tym ekranie).
- Szczegóły celu, formularz celu.
- Kalkulator emerytury (pełny widok z założeniami).
- Powiadomienia.
- **Ustawienia**: profil; bezpieczeństwo (hasło, 2FA, kody zapasowe, sesje); powiadomienia; wygląd i język; prywatność (tryb prywatny, blokada biometryczna — tylko iOS); dane (eksport, usunięcie konta); informacje prawne i wersja.
- Ekrany systemowe: pusty stan dla każdej listy, ładowanie (szkielety), błąd z akcją „Spróbuj ponownie”, 404, brak połączenia (iOS i PWA).

Stały dopisek na ekranach z wynikami (Pulpit, Majątek, Szczegóły pozycji, Cele, Kalkulator): *„Dane mają charakter informacyjny i nie stanowią porady inwestycyjnej. Wyceny mogą być opóźnione.”* Na kalkulatorze dodatkowo: *„To symulacja, nie gwarancja wyniku.”*

## 7. Reguły wyceny i obliczeń

### 7.1 Liczby, waluty, czas

- Kwoty: `Decimal` (Prisma `Decimal(20,4)` dla kwot, `Decimal(28,10)` dla ilości i kursów). Nigdy `float` w logice; w JS biblioteka dziesiętna (np. `decimal.js`), konwersja do `number` tylko do rysowania wykresów.
- Każda kwota ma walutę (ISO 4217). Kryptowaluty jako „waluta instrumentu” nie występują: instrument krypto ma cenę w USD lub PLN.
- Zaokrąglenie wyłącznie przy wyświetlaniu: kwoty 2 miejsca (bankierskie zaokrąglenie nie jest potrzebne, bo nic nie księgujemy), procenty 1–2 miejsca.
- Dzień wyceny to data w strefie **Europe/Warsaw**. Wszystkie znaczniki czasu w bazie w UTC.

### 7.2 Kursy walut

- Źródło: tabela A NBP (kurs średni), dzień roboczy. Dla walut spoza tabeli A — tabela B lub dostawca cen (decyzja w sekcji 14).
- Kurs na dzień D = ostatni opublikowany kurs z datą ≤ D (weekendy i święta przenoszą kurs z poprzedniego dnia roboczego).
- Użytkownik może nadpisać kurs dla transakcji (np. faktyczny kurs brokera); wtedy koszt nabycia w PLN liczy się z kursu z transakcji.

### 7.3 Wartość pozycji na dzień D

| Rodzaj | Wartość w walucie pozycji |
| --- | --- |
| Instrument rynkowy (akcja, ETF, fundusz, krypto, obligacje notowane) | ilość × cena zamknięcia z ostatniego dnia ≤ D |
| Gotówka, rachunek, konto oszczędnościowe | suma przepływów gotówkowych ≤ D (wpłaty, wypłaty, odsetki, opłaty, rozliczenia kupna/sprzedaży, korekty salda) |
| Lokata | sekcja 7.4 |
| Detaliczne obligacje skarbowe | sekcja 7.5 |
| Aktywo ręczne (nieruchomość, pojazd, inne) | ostatnia aktualizacja wyceny ≤ D (funkcja schodkowa, bez interpolacji) |
| Zobowiązanie | ostatnie saldo ≤ D (dodatnia liczba, odejmowana od wartości netto) |

Wartość w PLN = wartość w walucie × kurs z dnia D × udział własności konta.

**Wartość netto(D)** = Σ aktywa(D) − Σ zobowiązania(D), tylko konta z „wliczaj do wartości netto” = tak.

### 7.4 Lokata

Wejście: kwota, oprocentowanie roczne nominalne r, data założenia, okres, kapitalizacja (na koniec okresu / miesięczna / kwartalna / roczna), odnawialność.

- Wartość brutto w dniu D (od założenia t dni): przy kapitalizacji co *k* miesięcy — liczba pełnych okresów kapitalizacji *n*, odsetki narosłe za bieżący niepełny okres liczone liniowo: `K × (1 + r·k/12)^n × (1 + r × dni_w_bieżącym_okresie / 365)`.
- Pokazujemy wartość brutto z dopiskiem „z naliczonymi odsetkami (szacunek, przed podatkiem 19%)”. Wartość netto po podatku — przełącznik po 1.0.
- Po terminie: bez odnawiania → środki przechodzą na saldo wskazanego konta jako transakcja „zakończenie lokaty”; z odnawianiem → nowy okres z tym samym oprocentowaniem i oznaczeniem „sprawdź nowe oprocentowanie”.

### 7.5 Detaliczne obligacje skarbowe

Wejście: seria (np. EDO1126), typ (OTS, ROR, DOR, TOS, COI, EDO, ROS, ROD), liczba sztuk (nominał 100 zł), data zakupu, oprocentowanie w pierwszym okresie; dla kolejnych okresów użytkownik wpisuje oprocentowanie (w 1.0 ręcznie; automatyczne pobieranie inflacji GUS po 1.0).

- Typy kapitalizujące (TOS, EDO, ROS, ROD): wartość = 100 × Π(1 + r_i) za pełne lata × (1 + r_bieżące × dni / dni_w_roku_obligacji) × liczba sztuk.
- OTS (3-miesięczne, odsetki przy wykupie): wartość = 100 × (1 + r × dni / 365) × liczba sztuk.
- Typy kuponowe (ROR i DOR — kupon miesięczny, COI — roczny): wartość = 100 × liczba sztuk + kupon narosły w bieżącym okresie; wypłacone kupony zapisują się jako transakcje „odsetki” na wskazanym koncie.
- Bez potrącenia opłaty za przedterminowy wykup i podatku; dopisek „wartość przy trzymaniu do końca okresu, przed podatkiem”.
- Testy referencyjne: co najmniej po jednym przykładzie dla każdego typu, porównane z kalkulatorem na stronie obligacjeskarbowe.pl (do sprawdzenia w Etapie 5).

### 7.6 Koszt nabycia, wynik, efekt walutowy

- Metoda kosztu: **FIFO** (zgodna z polską praktyką podatkową; Neto nie liczy podatku w 1.0).
- Dla pozycji w obcej walucie: `V_w` = ilość × cena (waluta instrumentu), `K_w` = koszt pozostałych partii w walucie instrumentu, `K_pln` = koszt w PLN po kursach z dat zakupu, `kurs` = kurs dnia.
  - Wynik całkowity = `V_w × kurs − K_pln`
  - w tym wynik instrumentu = `(V_w − K_w) × kurs`
  - w tym efekt walutowy = `K_w × kurs − K_pln`
  - (suma dwóch składników = wynik całkowity; test jednostkowy to sprawdza)
- Wynik zrealizowany (po sprzedaży) zapisywany przy transakcji sprzedaży.
- Dywidendy i odsetki: przychód osobno, nie zmieniają kosztu nabycia.
- **XIRR** portfela inwestycyjnego (konta typu maklerskie, emerytalne, krypto, obligacje): przepływy = wpłaty i wypłaty z/do tych kont + wartość końcowa. Metoda Newtona z zabezpieczeniem bisekcją; brak zbieżności → „—” zamiast liczby. Okresy: od początku, ostatnie 12 miesięcy (wartość początkowa jako przepływ ujemny).

### 7.7 Dzienna migawka i przeliczenia wstecz

- Cron codziennie o **22:30 Europe/Warsaw** (po zamknięciu GPW i publikacji kursów NBP): 1) pobranie cen i kursów, zapis `PriceSnapshot` i `FxRate`; 2) dla każdego użytkownika upsert `PortfolioSnapshot(userId, data)`.
- Idempotentnie: klucz unikalny `(userId, date)`; drugi przebieg nadpisuje te same wiersze, nic nie dubluje. Przetwarzanie partiami (np. 500 użytkowników), każdy w osobnej transakcji bazy, błąd jednego nie zatrzymuje reszty; błędy do Sentry.
- Zmiana danych z datą wsteczną (transakcja, aktualizacja wyceny, import) → zadanie „przelicz od D” dla tego użytkownika (kolejka w bazie, obsługiwana przez cron co 5 minut i od razu po zapisie, jeśli zakres < 400 dni).
- Historia cen wstecz: przy dodaniu instrumentu z datą zakupu w przeszłości pobieramy historię cen od tej daty (jeśli dostawca to umożliwia), inaczej wartość jest liczona od pierwszej znanej ceny z oznaczeniem.

### 7.8 Nieaktualne wyceny

| Sytuacja | Próg | Pokazujemy |
| --- | --- | --- |
| Cena instrumentu rynkowego | starsza niż 3 dni robocze względem D | „Cena z dnia 28.10.2026” w kolorze ostrzeżenia |
| Kurs waluty | starszy niż 3 dni robocze | jak wyżej, przy kwocie w PLN |
| Aktywo ręczne | brak aktualizacji przez 90 dni | „Wycena z 12.06.2026 — zaktualizuj” + powiadomienie |
| Saldo zobowiązania | brak aktualizacji przez 35 dni | przypomnienie |

Pulpit pokazuje licznik „N pozycji z nieaktualną wyceną” z przejściem do listy.

### 7.9 Zmiany na pulpicie

- Dzienna: NW(D) − NW(poprzedni dzień z migawką).
- Miesięczna: NW(D) − NW(ten sam dzień miesiąc wcześniej; jeśli nie istnieje — ostatni dzień tamtego miesiąca).
- Roczna: analogicznie rok wcześniej.
- Procent liczony od wartości bezwzględnej punktu odniesienia; przy wartości odniesienia ≤ 0 procent się nie wyświetla.

### 7.10 Cele

- Postęp = bieżąca wartość powiązanych kont (lub wartość netto) ÷ kwota celu.
- Potrzebna wpłata miesięczna = (cel − bieżąca wartość) ÷ liczba pełnych miesięcy do terminu (bez założonej stopy zwrotu; dopisek o tym).
- Plan oszczędzania: brakująca kwota ÷ dni do terminu (dziennie), × 7 (tygodniowo) i ÷ pełne miesiące (miesięcznie; przy mniej niż miesiącu brak). Bez stopy zwrotu.
- Źródło bieżącej wartości: wybrane konta (aktywa, bez zobowiązań), cała wartość netto albo kwota wpisywana ręcznie (cel „od zera”, pole `Goal.savedAmount`, szybkie „Odłożone teraz” na karcie).
- Tempo: średni miesięczny przyrost z 3 ostatnich miesięcy ≥ potrzebna wpłata → „W dobrym tempie”, inaczej „Poniżej tempa o X zł/mies.” Bez słów ocennych typu „źle”.

### 7.11 Kalkulator emerytury

Wejście (wszystko widoczne i edytowalne, z wartościami domyślnymi):

| Założenie | Domyślnie |
| --- | --- |
| Wiek obecny | z profilu (rok urodzenia), inaczej puste |
| Planowany wiek przejścia na emeryturę | 65 |
| Majątek startowy | bieżąca wartość kont inwestycyjnych i oszczędnościowych (bez nieruchomości mieszkalnej; przełącznik) |
| Miesięczna wpłata | średnia wpłat z 6 miesięcy lub 0 |
| Wydatki miesięczne na emeryturze (w dzisiejszych złotych) | brak — użytkownik wpisuje |
| Spodziewana emerytura z ZUS (dzisiejsze zł, opcjonalnie) | 0 |
| Stopa wypłaty | 4% rocznie |
| Realna stopa zwrotu (po inflacji): ostrożny / bazowy / optymistyczny | 1% / 3% / 5% |
| Inflacja (tylko do pokazania kwot nominalnych) | 3% |

Obliczenia w wartościach realnych (dzisiejsze złote), miesięczna kapitalizacja: `r_m = (1 + r)^(1/12) − 1`; `FV(n) = PV × (1 + r_m)^n + PMT × ((1 + r_m)^n − 1) / r_m` (dla r = 0: `PV + PMT × n`).
Potrzebny kapitał = 12 × max(0, wydatki − ZUS) ÷ stopa wypłaty.
Wynik dla każdego scenariusza: kapitał w wieku emerytalnym, czy wystarcza, oraz najwcześniejszy wiek (do 80), w którym FV ≥ potrzebny kapitał, albo „nie w tym horyzoncie”. Wykres: trzy linie kapitału w czasie i pozioma linia potrzebnego kapitału.
Testy: zestaw referencyjny `docs/referencje/emerytura.csv` (11 przypadków), liczony niezależną pętlą miesięczną w `scripts/emerytura-referencja.mjs`; test porównuje z nim funkcje z tolerancją 0,01 zł (opis w `docs/referencje/README.md`). Zastępuje planowany arkusz `.xlsx`.

## 8. Model danych (Prisma, szkic)

Nazwy modeli po angielsku, w interfejsie po polsku. **Zmiana względem planu:** model konta finansowego nazywa się `FinancialAccount`, bo nazwa `Account` jest zajęta przez adapter Auth.js (konta OAuth). Zobowiązania to konta rodzaju `LIABILITY` z tabelą szczegółów `Liability` (plan wymienia `Liability` jako osobny model — zostaje, jako rozszerzenie konta).

```
User                 id, email (unikalny), emailVerified, passwordHash?, name?, birthYear?,
                     locale (pl|en), baseCurrency (PLN), timezone (Europe/Warsaw), theme,
                     privacyMode, totpSecretEnc?, totpEnabledAt?, deletionRequestedAt?, createdAt
Account              (Auth.js) konta OAuth — Google
Session              (Auth.js) + userAgent, ip (skrócony), lastSeenAt, platform (web|ios)
VerificationToken    (Auth.js)
BackupCode           userId, codeHash, usedAt?
AuditLog             userId?, event, ip (skrócony), userAgent, createdAt, meta JSON

FinancialAccount     id, userId, name, kind (ASSET|LIABILITY), type, currency, institution?,
                     taxWrapper (NONE|IKE|IKZE|PPK|OIPE), ownershipShare Decimal(5,4) = 1,
                     includeInNetWorth = true, notesEnc?, accountNumberEnc?, sortOrder,
                     archivedAt?, createdAt
                     type: CASH, CHECKING, SAVINGS, DEPOSIT, BROKERAGE, RETIREMENT, CRYPTO,
                           RETAIL_BONDS, REAL_ESTATE, VEHICLE, OTHER_ASSET,
                           MORTGAGE, LOAN, LEASE, CREDIT_CARD, OTHER_LIABILITY
Liability            accountId (1:1), interestRate?, monthlyPayment?, endDate?, originalAmount?
Deposit              accountId (1:1), principal, rate, startDate, termMonths,
                     capitalization (END|MONTHLY|QUARTERLY|ANNUAL), autoRenew, payoutAccountId?
Asset                id, userId? (null = katalog wspólny), name, symbol?, isin?, exchange (MIC)?,
                     assetClass (EQUITY|ETF|FUND|BOND|RETAIL_BOND|CRYPTO|COMMODITY|OTHER),
                     currency, priceSource (PROVIDER|MANUAL), providerRef?, active
RetailBondSeries     assetId (1:1), bondType (OTS|ROR|DOR|TOS|COI|EDO|ROS|ROD), issueMonth,
                     periodRates JSON [{od, stopa}]
Holding              accountId, assetId, quantity, costBasis (waluta instrumentu), costBasisBase,
                     updatedAt — pamięć podręczna przeliczana z transakcji (źródłem są transakcje)
Lot                  holdingId, openedAt, quantity, remaining, unitCost, fxRate — partie dla FIFO
Transaction          id, accountId, assetId?, type, date (Date), quantity?, price?, amount,
                     currency, fxRate?, fee?, note?, transferGroupId?, importBatchId?,
                     fingerprint (do duplikatów), createdAt
                     type: BUY, SELL, DEPOSIT, WITHDRAWAL, DIVIDEND, INTEREST, FEE, TAX,
                           TRANSFER_IN, TRANSFER_OUT, VALUATION, BALANCE_SET
ImportBatch          id, userId, fileName, source?, mapping JSON, rows, imported, skipped,
                     status, createdAt, revertedAt?
ImportMapping        userId, source, mapping JSON — zapamiętane mapowania
PriceSnapshot        assetId, date, close, currency, source, fetchedAt  — unikalne (assetId, date)
FxRate               date, currency, ratePln, table (A|B|MANUAL), source — unikalne (date, currency)
PortfolioSnapshot    userId, date, assets, liabilities, netWorth (PLN), byClass JSON,
                     byCurrency JSON, byAccount JSON, staleCount, computedAt — unikalne (userId, date)
RecalcJob            userId, fromDate, status, attempts, createdAt — kolejka przeliczeń
Goal                 id, userId, name, kind (SAVINGS|NET_WORTH|RETIREMENT), targetAmount, currency,
                     targetDate?, isMain, achievedAt?, createdAt
GoalAccount          goalId, accountId
RetirementPlan       userId (1:1), retireAge, monthlyContribution, monthlySpending, zusMonthly,
                     withdrawalRate, returnLow, returnBase, returnHigh, inflation, includeHome
Notification         id, userId, type, title, body, data JSON, readAt?, createdAt
NotificationPref     userId, type, channel (IN_APP|EMAIL|PUSH), enabled — unikalne (userId, type, channel)
PushDevice           id, userId, token (unikalny), platform (ios), appVersion, lastSeenAt
```

Indeksy pod zapytania: `Transaction(accountId, date)`, `PortfolioSnapshot(userId, date DESC)`, `PriceSnapshot(assetId, date DESC)`, `FxRate(currency, date DESC)`, `Asset(symbol)`, `Asset(isin)`, `FinancialAccount(userId, archivedAt)`.

Reguły dostępu: każdy odczyt i zapis przechodzi przez warstwę `src/lib/db/scoped.ts`, która wymusza `userId` z sesji; testy integracyjne próbują odczytać i zmienić dane drugiego użytkownika przez każdy endpoint i oczekują 404. Szyfrowanie pól `*Enc`: AES-256-GCM, klucz z `FIELD_ENCRYPTION_KEY` (bez klucza w trybie deweloperskim: klucz testowy z ostrzeżeniem w logach; na produkcji start aplikacji się nie udaje).

Budżet (po 1.0): planowane modele `Category`, `Budget`, `RecurringRule`; transakcje gotówkowe dostaną opcjonalne `categoryId`. W 1.0 nie tworzymy tych tabel, żeby nie zamrażać schematu za wcześnie.

## 9. Powiadomienia

| Typ | Kiedy | W aplikacji | E-mail | Push (iOS) |
| --- | --- | --- | --- | --- |
| Podsumowanie tygodnia | poniedziałek 8:00 | tak | tak (kwoty) | „Masz nowe podsumowanie tygodnia” |
| Cel osiągnięty | przy migawce | tak | tak | „Osiągnięto cel: {nazwa celu}” |
| Wycena do aktualizacji | aktywo ręczne > 90 dni, zobowiązanie > 35 dni | tak | tak | „Część wycen wymaga aktualizacji” |
| Bezpieczeństwo (nowe urządzenie, zmiana hasła/2FA) | od razu | tak | zawsze, nie do wyłączenia | nie |

Push nigdy nie zawiera kwot ani nazw instrumentów. Wysyłka push wyłączona flagą bez klucza FCM; e-mail wyłączony bez klucza dostawcy poczty (w trybie deweloperskim zapis do logu).

## 10. Bezpieczeństwo i prywatność (wymagania)

- Hasła: argon2id. Limity: 5 nieudanych logowań na konto / 15 min, 20 na IP / 15 min; rosnące opóźnienie.
- Sesje: ciasteczka `HttpOnly`, `Secure`, `SameSite=Lax`; wygaśnięcie po 30 dniach bezczynności (web) i 90 dniach (iOS, z blokadą biometryczną).
- Nagłówki: CSP z nonce, HSTS, `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`. CSP musi dopuszczać mostek Capacitora (pułapka opisana w planie mobilnym RentixON).
- Dane finansowe nie są cache'owane offline (service worker trzyma tylko powłokę i stronę błędu).
- Logi bez kwot i danych osobowych poza skróconym IP.
- Tryb prywatny: wszystkie kwoty zastąpione „••••”, procenty widoczne.

## 11. Kanały: różnice web / iOS

| Obszar | Web / PWA | iOS (Capacitor) |
| --- | --- | --- |
| Logowanie | e-mail + hasło + 2FA, Google (przekierowanie) | to samo; Google natywnie (token → Auth.js); Apple — patrz bramka 4.8 |
| Ceny, plany, zakupy | brak w 1.0 | **brak** — żadnych cen ani odnośników do zakupów (Apple 3.1.1 / 3.1.3) |
| Strona marketingowa | tak | nie — aplikacja startuje od logowania lub pulpitu |
| Linki zewnętrzne, regulamin, polityka | w tej samej karcie | przeglądarka systemowa |
| Eksport | pobranie pliku | arkusz udostępniania |
| Blokada | brak (wylogowanie po bezczynności) | Face ID / Touch ID, zasłona w przełączniku |
| Powiadomienia | w aplikacji + e-mail | + push |
| Usunięcie konta | Ustawienia → Dane | to samo, w aplikacji (wymóg Apple) |

## 12. Teksty prawne do przygotowania (Etap 12, z radcą)

1. Regulamin (w tym: narzędzie informacyjne, brak doradztwa inwestycyjnego, brak gwarancji poprawności danych rynkowych, odpowiedzialność).
2. Polityka prywatności (RODO: administrator, cele, podstawy, odbiorcy — Vercel, Supabase, Firebase, dostawca e-mail, dostawca cen, Sentry; okresy przechowywania; prawa).
3. Informacja o ryzyku i braku porad (krótka wersja na ekranach, pełna w regulaminie).
4. Rejestr czynności przetwarzania i umowy powierzenia.
5. Publiczna strona „Jak usunąć konto”.
6. Polityka cookies (tylko niezbędne ciasteczka w 1.0 → baner informacyjny bez zgód; analityka po 1.0 wymaga zgody).
7. Atrybucje dostawców danych (jeśli licencja ich wymaga, np. NBP — źródło kursów).

## 13. Wymagania niefunkcjonalne

- Wydajność: pulpit < 2 s do interakcji na średnim telefonie (Moto G klasy średniej, 4G) przy 50 pozycjach i 3 latach historii; zapytania pulpitu czytają wyłącznie `PortfolioSnapshot` + bieżące pozycje.
- Responsywność: od 360 px do 1920 px; brak poziomego przewijania.
- Dostępność: WCAG 2.2 AA — kontrast, focus widoczny, wykresy z tabelą alternatywną, kolory zysku/straty zawsze z dodatkowym znakiem (+/−, strzałka).
- i18n: PL domyślnie, EN od Etapu 2; formaty liczb, dat i walut przez `Intl`.
- Lighthouse ≥ 90 w czterech kategoriach dla stron publicznych i pulpitu (Etap 10).
- Testy: logika finansowa (sekcja 7) pokryta testami jednostkowymi z przypadkami brzegowymi; ścieżki e2e z sekcji 5 w Playwright.

## 14. Dostawcy danych rynkowych — kandydaci (decyzja przed Etapem 6)

Licencje nie są sprawdzone; to lista do weryfikacji, nie rekomendacja zakupu.

| Źródło | Zakres | Co trzeba sprawdzić |
| --- | --- | --- |
| NBP API (tabele A/B) | kursy walut | oficjalne, publiczne API; potwierdzić warunki ponownego wykorzystania i wymaganą atrybucję |
| Frankfurter (kursy EBC) | kursy walut, zapas dla NBP | warunki użycia komercyjnego |
| EODHD | GPW, giełdy UE/USA, ETF, fundusze, krypto; koniec dnia | strony planów mówią „Personal use” — potrzebna licencja komercyjna i warunki wyświetlania danych użytkownikom |
| Twelve Data / Financial Modeling Prep / podobni | akcje, ETF, FX, krypto | pokrycie GPW, licencja na wyświetlanie użytkownikom końcowym |
| CoinGecko | krypto | plan komercyjny i wymóg atrybucji |
| Stooq | GPW (używa go BeWealthy) | brak udokumentowanego API i licencji — bez pisemnej zgody **nie** używamy |
| Yahoo Finance | wszystko | brak oficjalnego API, warunki zabraniają użycia komercyjnego — **odrzucone** |
| Dane GPW bezpośrednio (licencja dystrybutora) | GPW | koszt opłat giełdowych za wyświetlanie; prawdopodobnie za drogie na start |
| Fundusze inwestycyjne PL (wyceny TFI) | fundusze | źródło i licencja do ustalenia; w 1.0 dopuszczalna wycena ręczna |

Moduł `pricing` ma interfejs dostawcy, więc 1.0 może wystartować z NBP + ręcznymi cenami, a dostawca rynkowy dochodzi za flagą `PRICING_PROVIDER`.

## 15. Flagi funkcji i zmienne środowiskowe (bez wartości)

| Zmienna | Bez niej |
| --- | --- |
| `DATABASE_URL` | aplikacja nie startuje (wymagana) |
| `AUTH_SECRET` | aplikacja nie startuje (wymagana) |
| `FIELD_ENCRYPTION_KEY` | dev: klucz testowy + ostrzeżenie; produkcja: start się nie udaje |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | logowanie Google ukryte |
| `EMAIL_PROVIDER_KEY`, `EMAIL_FROM` | e-maile do logu (dev) / funkcje e-mail wyłączone |
| `PRICING_PROVIDER`, `PRICING_API_KEY` | tylko NBP + ręczne ceny |
| `FCM_SERVICE_ACCOUNT` | push wyłączony |
| `CRON_SECRET` | endpointy cron zwracają 401 |
| `SENTRY_DSN` | monitoring wyłączony |
| `BOT_PROTECTION_SITE_KEY`, `BOT_PROTECTION_SECRET` | rejestracja bez ochrony antybotowej (tylko dev; produkcja: ostrzeżenie w panelu) |
| `PWNED_PASSWORDS_CHECK` | sprawdzanie haseł w słowniku wycieków wyłączone |

Wszystkie walidowane w jednym `src/env.ts` (zod); flagi wyliczane z obecności kluczy, nie z osobnych przełączników.

## 16. Poza 1.0

Budżet miesięczny i kategorie, cykliczne płatności, wspólne konta dla dwóch osób, agregacja bankowa (PSD2), Android, alerty cenowe, widżety iOS, kalendarz dywidend, raporty PDF, podatek Belki i PIT-38, harmonogram spłaty kredytu, zmiana waluty bazowej, subskrypcje (z In-App Purchase w iOS), Sign in with Apple (jeśli 4.8 nie wymusi go wcześniej), iPad.

## 17. Ryzyka zauważone przy specyfikacji

- **Wskaźniki oceniające** (typu Wealth Score u BeWealthy) łatwo przekraczają granicę „porady”. W 1.0 ich nie ma; jeśli wrócą, tylko po konsultacji z radcą.
- **Dane GPW**: koszt licencji może wymusić start z ręcznymi cenami dla akcji polskich. Wtedy wycena GPW jest „z dnia wprowadzenia” i oznaczona.
- **Obligacje skarbowe** wymagają co roku nowej stopy (inflacja + marża); w 1.0 ręcznie — ryzyko starych wartości, łagodzone przypomnieniem raz w roku na rocznicę zakupu.
- **Brak budżetu w 1.0** przy wzorcu, który ma go rozbudowany — świadoma decyzja; model danych zostawia miejsce (sekcja 8).

## 18. Do potwierdzenia przy akceptacji

1. iPad i PSD2 poza 1.0 (domyślne z planu).
2. Metoda kosztu FIFO.
3. XIRR jako jedyna stopa zwrotu w 1.0 (bez TWR).
4. Domyślne założenia kalkulatora emerytury (sekcja 7.11).
5. Okres karencji przy usuwaniu konta: 14 dni.
6. Kierunek wizualny z makiet (sekcja 20).

## 19. Dziennik zmian

| Data | Zmiana | Kto |
| --- | --- | --- |
| 02.11.2026 | Pierwsza wersja do akceptacji | Claude Code (Etap 1) |
| 02.11.2026 | Logowanie: własne sesje w bazie (wzorzec Lucia) zamiast Auth.js, Google przez arctic | Claude Code (Etap 4) |
| 03.11.2026 | Aplikacja do użytku własnego właściciela. iPhone przez PWA z ekranu głównego zamiast Capacitora: wypadają Etap 11 (powłoka iOS, Codemagic, TestFlight) i wysyłka do App Store (Etap 12 część sklepowa, Etap 14 recenzja). Rejestracja zostaje otwarta; szkice prawne i sklepowe zostają w repo bez dalszej pracy | właściciel |
| 03.11.2026 | Cele: tworzenie, edycja, usuwanie, cel główny, plan dziennie/tygodniowo/miesięcznie, cel „od zera” z ręczną kwotą. Nowa paleta „kobalt” zamiast szarozielonej | właściciel + Claude Code |
| 03.11.2026 | Tylko jasny motyw (tryb ciemny usunięty, decyzja właściciela) | właściciel |
| 03.11.2026 | Etap 7: pulpit (historia liczona na bieżąco z transakcji, alokacja, cel główny, tryb prywatny). Etap 6: nocny cron wyceny `/api/cron/valuation`, migawki, kolejka przeliczeń; na planie Vercel Hobby crony raz dziennie, więc przeliczenie po dacie wstecznej czeka do nocy. Etap 9: powiadomienia w aplikacji i e-mailem, preferencje, cron `/api/cron/notifications`; push wyłączony flagą. Kalkulator emerytury zapisuje założenia | Claude Code |

## 20. Makiety i kierunek wizualny

Makiety w `docs/mockups/` to statyczny HTML (ten sam plik działa na telefonie i desktopie, jak docelowa aplikacja). Zrzuty: 390 × 844 (iPhone) i 1440 × 900 (desktop).

Kierunek:

- **Jedna rzecz charakterystyczna: linia bilansu.** Na wykresie historii aktywa rosną nad poziomą linią zera, zobowiązania wiszą pod nią, a wartość netto to wyraźna linia między nimi. Ten sam motyw wraca w małym pasku bilansu pod główną kwotą. Wszystko wokół jest spokojne.
- Kolory (od 03.11.2026 „kobalt”, decyzja właściciela; wcześniej szarozielony granat): tło `#F5F7FF` (biel z nutą błękitu), powierzchnie `#FFFFFF`, tekst `#0F1638`, marka `#2F4FE0` (kobalt: przyciski, linia wartości netto), wzrost `#0A8A60` (mięta, w tekście ciemniejsza dla kontrastu), spadek `#C63B2E`, ostrzeżenie `#8A5F0C`, linie `#DCE2F7`. Tryb ciemny: tło `#0B1230` (nocny kobalt), powierzchnie `#141E4A`, tekst `#EEF2FF`, marka `#6E8BFF`, wzrost `#3DDC9F`. Źródło prawdy: tokeny w `src/app/globals.css`.
- Typografia: Schibsted Grotesk (pełne polskie znaki), cyfry tabelaryczne we wszystkich kwotach. Bez wersalików w etykietach.
- Układ: listy i sekcje oddzielone przestrzenią i cienką linią, bez siatki identycznych kart z cieniem. Kwoty wyrównane do prawej.
- Ostateczna paleta i fonty wchodzą do kodu w Etapie 2 jako tokeny; makiety nie są pikselowym wzorcem.
