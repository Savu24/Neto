@AGENTS.md

# Neto: zasady pracy

Aplikacja do śledzenia majątku: web + PWA i iPhone (Capacitor). Źródło prawdy to `docs/SPEC.md` oraz strona Notion „Plan: aplikacja typu BeWealthy (iOS + przeglądarka) — kroki dla Claude Code”. Po każdym etapie aktualizuj oba i odhacz etap w Notion: data, commit, czego nie sprawdzono.

## Twarde zasady

- Etapy po kolei. **Pliki wspólne zmienia naraz tylko jedna sesja:** `src/env.ts`, `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/globals.css`, `prisma/schema.prisma`, `src/i18n/dictionaries.ts`, `package.json` / `package-lock.json`. Sesja równoległa, która potrzebuje zmiany w takim pliku, opisuje ją w swoim raporcie i jej nie robi.
- Słowniki: każda sesja zmienia tylko pliki JSON swoich zakresów (`src/i18n/dictionaries/{pl,en}/<zakres>.json`), zawsze w obu językach.
- Nic nie wypychasz (`git push`) i nie scalasz do `master` bez zgody właściciela w czacie. Commity po polsku, krótki tytuł w trybie dokonanym („Dodaj…”, „Popraw…”) albo „Etap N: …”.
- Baza tylko lokalna lub testowa. Nigdy nie testuj na bazie z produkcyjnego `.env`.
- Sekrety ustawia właściciel w Vercelu/Codemagic. Nie generuj ich w repo i nie proś o nie w czacie. Bez klucza funkcja jest wyłączona flagą (`features()` w `src/env.ts`), a kod i tak powstaje.
- Zero porad inwestycyjnych. Każdy ekran z wynikami ma `<Disclaimer>` (`src/components/page.tsx`); kalkulatory dodatkowo tekst `disclaimerSimulation`.
- iOS: żadnych cen ani zakupów, dopóki właściciel nie zdecyduje o In-App Purchase.
- Sign in with Apple jest odłożone. Nie dodawaj bez zgody; przed wysyłką do App Store przypomnij właścicielowi o wymogu Apple 4.8.
- Zmiany wyglądu małymi krokami, po jednym obszarze, ze zrzutami przed/po.

## Kontrola po każdej części

```bash
npm ci
npm run lint
npm run typecheck
npx vitest run
npx next build
PW_CHANNEL=msedge npx playwright test   # e2e na zbudowanej aplikacji; w CI chromium z Playwrighta
```

`npm run build` to samo `next build` i nie może robić migracji. Formatowanie: `npm run format` (Prettier sprawdzany w CI).

## Architektura

- Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind 4. **Bez `cacheComponents`**: prawie wszystko to dane zalogowanego użytkownika, więc renderujemy dynamicznie. Przed użyciem API Next sprawdź dokumentację w `node_modules/next/dist/docs/` (wersja 16 różni się od starszych: `proxy.ts` zamiast `middleware.ts`, asynchroniczne `cookies()`/`headers()`/`params`).
- `src/env.ts`: jedyne miejsce czytania `process.env` po stronie serwera (`env()`, `features()`), walidacja zod, leniwie.
- `src/i18n`: słowniki PL/EN w zakresach. Serwer: `getT("zakres")`; klient: `useT("zakres")` pod `I18nProvider` (layout `(app)` przekazuje tylko potrzebne zakresy przez `pickMessages`). Nowy zakres: pliki JSON w obu językach + wpis w `src/i18n/dictionaries.ts` (plik wspólny).
- `src/lib/format.ts`: kwoty, procenty, daty (Europe/Warsaw). Kwoty przekazuj jako string z Decimal, nie jako float.
- `src/lib/{auth,portfolio,pricing,native}`: moduły domenowe (opis w README w każdym katalogu).
- Kolory tylko przez tokeny z `globals.css` (`bg-surface`, `text-ink-2`, `text-up`, `text-down`…). Jeden motyw, jasny (tryb ciemny usunięty 03.11.2026 decyzją właściciela); nie dodawaj `prefers-color-scheme: dark`.
- Ścieżki aplikacji po angielsku (`/dashboard`, `/assets`, `/goals`, `/settings`), teksty po polsku i angielsku ze słowników.
- `mobile/`: powłoka Capacitor (Etap 11), własny `package.json`.
- Kwoty i ilości w logice: `D()` z `src/lib/money.ts` (decimal.js), nigdy `number`.

## Baza

- Prisma 7 (`prisma/schema.prisma`, klient generowany do `src/generated/prisma`, adapter `pg`). Postgres lokalnie bez Dockera:

  ```bash
  npm run db:start     # klaster w .local-db/, zapisuje DATABASE_URL do .env.local (zostaw uruchomione;
                       # na Windowsie zatrzymaj go przed `npm ci`, bo blokuje esbuild.exe)
  npm run db:migrate   # prisma migrate dev
  npm run db:seed      # dane demo z makiet; odmawia, gdy baza nie jest lokalna
  ```

- **Dostęp do danych użytkownika wyłącznie przez `scopedDb(db(), userId)`** z `src/lib/db/scoped.ts`. Surowy `db()` tylko w zadaniach systemowych (cron, logowanie) i testach. Zagnieżdżone zapisy relacji są blokowane: rekordy podrzędne twórz osobnym wywołaniem. Nowy model w schemacie wymaga reguły w `policies` (test to wymusza).
- Pola wrażliwe (`*Enc`) szyfruj przez `src/lib/crypto/fields.ts`.
- Testy z bazą: pliki `*.db.test.ts`. Vitest sam podnosi tymczasowy Postgres (albo używa `TEST_DATABASE_URL` w CI) i stosuje migracje; `resetDb()` z `tests/db.ts` czyści tabele. Nigdy nie wskazuj w testach bazy z `.env.local` ani produkcyjnej.

## Gałęzie

Każdy etap na własnej gałęzi `etap-N-…`, odgałęzionej od poprzedniego etapu. Sesje równoległe pracują we własnych worktree i gałęziach; scala je sesja koordynująca (nie do `master`).
