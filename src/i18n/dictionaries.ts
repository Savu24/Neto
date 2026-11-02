// Plik generowany ręcznie, jeden import na zakres i język. Nowy zakres: dodaj pliki JSON w obu językach i wpis tutaj.
import plCommon from "./dictionaries/pl/common.json";
import enCommon from "./dictionaries/en/common.json";
import plNav from "./dictionaries/pl/nav.json";
import enNav from "./dictionaries/en/nav.json";
import plDashboard from "./dictionaries/pl/dashboard.json";
import enDashboard from "./dictionaries/en/dashboard.json";
import plAssets from "./dictionaries/pl/assets.json";
import enAssets from "./dictionaries/en/assets.json";
import plTransactions from "./dictionaries/pl/transactions.json";
import enTransactions from "./dictionaries/en/transactions.json";
import plImport from "./dictionaries/pl/import.json";
import enImport from "./dictionaries/en/import.json";
import plGoals from "./dictionaries/pl/goals.json";
import enGoals from "./dictionaries/en/goals.json";
import plRetirement from "./dictionaries/pl/retirement.json";
import enRetirement from "./dictionaries/en/retirement.json";
import plNotifications from "./dictionaries/pl/notifications.json";
import enNotifications from "./dictionaries/en/notifications.json";
import plSettings from "./dictionaries/pl/settings.json";
import enSettings from "./dictionaries/en/settings.json";
import plAuth from "./dictionaries/pl/auth.json";
import enAuth from "./dictionaries/en/auth.json";
import plMarketing from "./dictionaries/pl/marketing.json";
import enMarketing from "./dictionaries/en/marketing.json";
import plLegal from "./dictionaries/pl/legal.json";
import enLegal from "./dictionaries/en/legal.json";
import plErrors from "./dictionaries/pl/errors.json";
import enErrors from "./dictionaries/en/errors.json";
import plMobile from "./dictionaries/pl/mobile.json";
import enMobile from "./dictionaries/en/mobile.json";

export const pl = {
  common: plCommon,
  nav: plNav,
  dashboard: plDashboard,
  assets: plAssets,
  transactions: plTransactions,
  import: plImport,
  goals: plGoals,
  retirement: plRetirement,
  notifications: plNotifications,
  settings: plSettings,
  auth: plAuth,
  marketing: plMarketing,
  legal: plLegal,
  errors: plErrors,
  mobile: plMobile,
};

type Shape<T> = { [K in keyof T]: Record<keyof T[K], string> };

// satisfies: angielski słownik musi mieć dokładnie te same klucze co polski (błąd kompilacji, gdy brakuje).
export const en = {
  common: enCommon,
  nav: enNav,
  dashboard: enDashboard,
  assets: enAssets,
  transactions: enTransactions,
  import: enImport,
  goals: enGoals,
  retirement: enRetirement,
  notifications: enNotifications,
  settings: enSettings,
  auth: enAuth,
  marketing: enMarketing,
  legal: enLegal,
  errors: enErrors,
  mobile: enMobile,
} satisfies Shape<typeof pl>;
