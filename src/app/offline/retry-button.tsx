"use client";

/** Przeładowuje adres, pod którym worker pokazał stronę offline (nie /offline). */
export function RetryButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="mt-6 self-start rounded-[10px] bg-brand px-4 py-2.5 font-semibold text-on-brand"
    >
      {label}
    </button>
  );
}
