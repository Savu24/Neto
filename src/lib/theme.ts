export const themes = ["system", "light", "dark"] as const;
export type Theme = (typeof themes)[number];
export const THEME_COOKIE = "neto-theme";

export function parseTheme(value: string | undefined): Theme {
  return (themes as readonly string[]).includes(value ?? "") ? (value as Theme) : "system";
}

/** Atrybut data-theme na <html>: brak dla „system”, wtedy decyduje prefers-color-scheme. */
export function themeAttribute(theme: Theme): "light" | "dark" | undefined {
  return theme === "system" ? undefined : theme;
}
