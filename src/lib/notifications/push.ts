/**
 * Push (iOS, Etap 11). Dziś tylko ścieżka „wyłączona flagą”: bez klucza FCM (`features().push` = false)
 * serwis nie szuka urządzeń i nic nie wysyła. Wysyłka przez FCM dojdzie razem z aplikacją na iPhone'a,
 * bez zmiany serwisu: wystarczy podać implementację `PushSender` w zależnościach.
 */

export type PushMessage = { readonly title: string; readonly body: string };

/** Wysyła wiadomość na podane tokeny; zwraca liczbę doręczonych. */
export type PushSender = (tokens: readonly string[], message: PushMessage) => Promise<number>;

/** Zastępca na czas, gdy klucz FCM jest ustawiony, a wysyłki jeszcze nie ma: nic nie wysyła. */
export const pushNotImplemented: PushSender = async () => {
  console.warn("[push] FCM_SERVICE_ACCOUNT ustawiony, ale wysyłka push nie jest jeszcze zaimplementowana");
  return 0;
};
