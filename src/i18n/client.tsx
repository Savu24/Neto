"use client";

import { createContext, use, type ReactNode } from "react";
import type { Locale, MessageKey, Messages, Scope } from "./config";
import { interpolate, type Params } from "./translate";

type ClientMessages = Partial<Messages>;

const I18nContext = createContext<{ locale: Locale; messages: ClientMessages } | null>(null);

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: ClientMessages;
  children: ReactNode;
}) {
  return <I18nContext value={{ locale, messages }}>{children}</I18nContext>;
}

export function useLocale(): Locale {
  const ctx = use(I18nContext);
  if (!ctx) throw new Error("useLocale wymaga I18nProvider");
  return ctx.locale;
}

export function useT<S extends Scope>(scope: S) {
  const ctx = use(I18nContext);
  if (!ctx) throw new Error("useT wymaga I18nProvider");
  const messages = ctx.messages[scope] as Record<string, string> | undefined;
  if (!messages) throw new Error(`Zakres „${scope}” nie został przekazany do I18nProvider`);
  return (key: MessageKey<S>, params?: Params) => interpolate(messages[key] ?? key, params);
}
