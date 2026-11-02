# Informacja o ryzyku i braku doradztwa

> **SZKIC — do zatwierdzenia przez radcę.** Wersja robocza 0.1 z 02.11.2026 (Etap 12). Nie publikować przed akceptacją.

**Miejsca do uzupełnienia:**

- [DOSTAWCA CEN] — nazwa źródła cen instrumentów i wymagana przez licencję atrybucja (albo „tylko ceny ręczne” w 1.0)
- [ATRYBUCJA NBP] — brzmienie wymagane przez warunki NBP, jeśli są (propozycja: „Źródło kursów walut: Narodowy Bank Polski”)
- [E-MAIL KONTAKTOWY]

---

## A. Wersja krótka (na ekranach)

Teksty są już w słowniku `common` (`src/i18n/dictionaries/{pl,en}/common.json`) i wyświetla je komponent `<Disclaimer>`. Zmiana brzmienia po akceptacji radcy: w obu językach naraz.

**Ekrany z wynikami** (Pulpit, Majątek, Szczegóły pozycji, Cele, Kalkulator) — klucz `disclaimerResults`:

> Dane mają charakter informacyjny i nie stanowią porady inwestycyjnej. Wyceny mogą być opóźnione.

**Kalkulator emerytury** (dodatkowo) — klucz `disclaimerSimulation`:

> To symulacja, nie gwarancja wyniku. Wyniki zależą od założeń, które możesz zmienić, i nie stanowią porady inwestycyjnej.

**Propozycje dodatkowych krótkich tekstów** (do akceptacji; po akceptacji dopisze je Etap 10 do słowników):

- Rejestracja, pod przyciskiem: „Neto to narzędzie informacyjne. Nie doradzamy, w co inwestować, i nie przechowujemy pieniędzy.”
- Lokata: „Z naliczonymi odsetkami (szacunek, przed podatkiem 19%).” (SPEC 7.4)
- Obligacje skarbowe: „Wartość przy trzymaniu do końca okresu, przed podatkiem.” (SPEC 7.5)
- Cel: „Potrzebna wpłata nie zakłada żadnej stopy zwrotu.” (SPEC 7.10)
- Stopka danych rynkowych: „Ceny: [DOSTAWCA CEN]. Kursy walut: [ATRYBUCJA NBP].”

## B. Wersja pełna

### 1. Neto to narzędzie informacyjne

Neto pokazuje dane, które wpisujesz lub importujesz, oraz wyliczenia na ich podstawie. Neto nie świadczy usług doradztwa inwestycyjnego ani innych usług inwestycyjnych w rozumieniu ustawy z dnia 29 lipca 2005 r. o obrocie instrumentami finansowymi, nie sporządza rekomendacji inwestycyjnych, nie udziela porad podatkowych ani prawnych, nie przyjmuje pieniędzy i nie składa zleceń.

Nic w Neto — wartość netto, wynik, udział w majątku, tempo celu, scenariusz emerytury, oznaczenie „W dobrym tempie” lub „Poniżej tempa” — nie jest wskazaniem, że należy kupić, sprzedać lub trzymać jakikolwiek instrument albo zmienić sposób oszczędzania. Neto nie ocenia Twojej sytuacji finansowej ani nie porównuje Cię z innymi.

### 2. Dane rynkowe mogą być opóźnione lub błędne

- Kursy walut pochodzą z tabel NBP (kurs średni z ostatniego dnia roboczego). W weekendy i święta używamy kursu z poprzedniego dnia roboczego.
- Ceny instrumentów pochodzą od [DOSTAWCA CEN] albo od Ciebie (cena ręczna). Wycena dzienna odbywa się raz dziennie wieczorem; w ciągu dnia cena nie jest aktualizowana na bieżąco.
- Przy każdej wycenie podajemy datę ceny. Cena starsza niż 3 dni robocze i wycena aktywa nieaktualizowana od 90 dni są oznaczane.
- Źródło danych może popełnić błąd lub chwilowo nie działać. Nie gwarantujemy poprawności, kompletności ani aktualności danych rynkowych.

### 3. Wyliczenia są szacunkami

- **Lokaty**: wartość z naliczonymi odsetkami według podanego oprocentowania i kapitalizacji, przed podatkiem.
- **Detaliczne obligacje skarbowe**: wartość według wzoru dla danego typu i oprocentowania, które wpisujesz dla kolejnych okresów; bez opłaty za przedterminowy wykup i bez podatku.
- **Koszt nabycia i wynik**: metoda FIFO; wynik w złotych rozdzielony na wynik instrumentu i efekt walutowy. Neto nie liczy podatku i wynik może się różnić od rozliczenia u brokera lub w zeznaniu podatkowym.
- **Stopa zwrotu (XIRR)**: zależy od kompletności zapisanych wpłat i wypłat; gdy obliczenie nie jest możliwe, pokazujemy „—”.
- **Udział własności**: wartości w złotych są mnożone przez udział, który ustawisz; nie jest to ustalenie prawne współwłasności.

### 4. Kalkulator emerytury to symulacja

Kalkulator liczy w dzisiejszych złotych, na podstawie założeń, które widzisz i możesz zmienić (m.in. realna stopa zwrotu w trzech scenariuszach, stopa wypłaty, wpłaty, wydatki, spodziewana emerytura z ZUS). Rzeczywiste stopy zwrotu, inflacja, podatki i przepisy emerytalne mogą być inne niż założenia. Wyniki z przeszłości nie gwarantują wyników w przyszłości. Wynik kalkulatora nie jest prognozą ani obietnicą.

### 5. Ryzyko inwestowania

Wartość instrumentów finansowych, kryptowalut, nieruchomości i walut może spadać i rosnąć; możesz stracić część lub całość zainwestowanych środków. Zmiany kursów walut wpływają na wartość aktywów w walutach obcych. Neto pokazuje te zmiany, ale nie chroni przed nimi.

### 6. Twoje decyzje

Decyzje finansowe podejmujesz samodzielnie. Jeśli potrzebujesz porady dopasowanej do Twojej sytuacji, skorzystaj z usług licencjonowanego doradcy inwestycyjnego, doradcy podatkowego lub innego uprawnionego specjalisty.

### 7. Źródła danych

- Kursy walut: [ATRYBUCJA NBP].
- Ceny instrumentów: [DOSTAWCA CEN].

Pytania: [E-MAIL KONTAKTOWY].
