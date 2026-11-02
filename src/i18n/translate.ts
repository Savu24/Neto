import { dictionaries, type Locale, type MessageKey, type Scope } from "./config";

export type Params = Record<string, string | number>;

/** Wstawia parametry w miejsca {nazwa}. Brakujący parametr zostaje widoczny, żeby błąd był łatwy do zauważenia. */
export function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export type Translator<S extends Scope> = (key: MessageKey<S>, params?: Params) => string;

export function createTranslator<S extends Scope>(locale: Locale, scope: S): Translator<S> {
  const messages = dictionaries[locale][scope] as Record<string, string>;
  return (key, params) => interpolate(messages[key] ?? key, params);
}
