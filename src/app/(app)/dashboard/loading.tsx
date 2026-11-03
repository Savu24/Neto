/**
 * Ekran ładowania pulpitu (najcięższy ekran: wycena i historia): nawigacja reaguje od razu po kliknięciu,
 * a szkielet zajmuje miejsce treści, dopóki serwer nie policzy wycen. Bez tekstu i bez kwot.
 */
export default function Loading() {
  const block = "animate-pulse rounded-2xl border border-line bg-surface shadow-card";
  return (
    <div aria-busy="true" aria-live="polite" className="pt-5 lg:pt-8">
      <span className="sr-only">…</span>
      <div className="h-7 w-40 animate-pulse rounded-lg bg-line lg:h-8" />
      <div className="mt-2 h-4 w-56 animate-pulse rounded bg-line/70" />
      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
        <div className="grid gap-5">
          <div className={`${block} h-44`} />
          <div className={`${block} h-72`} />
        </div>
        <div className="mt-5 grid content-start gap-5 lg:mt-0">
          <div className={`${block} h-36`} />
          <div className={`${block} h-48`} />
        </div>
      </div>
    </div>
  );
}
