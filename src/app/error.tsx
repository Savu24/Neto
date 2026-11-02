"use client";

// Granica błędów działa po stronie klienta bez słowników serwera, więc tekst jest w obu językach.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-[640px] px-4 py-20">
      <h1 className="text-2xl font-semibold">Nie udało się wczytać strony</h1>
      <p className="mt-2 text-ink-2">Coś poszło nie tak po naszej stronie. Spróbuj ponownie za chwilę.</p>
      <p className="mt-1 text-sm text-ink-3" lang="en">
        The page did not load. Try again in a moment.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-[10px] bg-brand px-4 py-2.5 font-semibold text-on-brand"
      >
        Spróbuj ponownie
      </button>
    </main>
  );
}
