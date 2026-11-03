"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useT } from "@/i18n/client";
import { EyeIcon, EyeOffIcon } from "./icons";

const KEY = "neto-private";
const EVENT = "neto-private-change";

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    // Brak dostępu do pamięci przeglądarki: tryb prywatny wyłączony.
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Tryb prywatny (HU-4.5): jedno dotknięcie rozmywa wszystkie kwoty oznaczone `data-amt`.
 * Ustawienie zostaje w tej przeglądarce (localStorage); dane nie wychodzą z urządzenia.
 */
export function PrivacyToggle() {
  const t = useT("common");
  const on = useSyncExternalStore(subscribe, read, () => false);

  useEffect(() => {
    if (on) document.documentElement.dataset.private = "";
    else delete document.documentElement.dataset.private;
  }, [on]);

  const toggle = () => {
    try {
      localStorage.setItem(KEY, on ? "0" : "1");
    } catch {
      // jw.: bez pamięci przeglądarki przełącznik nie zadziała.
    }
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? t("showAmounts") : t("hideAmounts")}
      title={on ? t("showAmounts") : t("hideAmounts")}
      className="grid size-10 place-items-center rounded-[10px] text-ink-2 transition-colors hover:bg-surface hover:text-ink"
    >
      {on ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );
}
