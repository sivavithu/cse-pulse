export const THEME_VALUES = ["light", "dark", "system"] as const;

export type ThemeValue = (typeof THEME_VALUES)[number];

export function isThemeValue(value: unknown): value is ThemeValue {
  return typeof value === "string" && THEME_VALUES.includes(value as ThemeValue);
}

export function getThemeStorageKey(userEmail?: string | null): string {
  return `cse-pulse-theme:${encodeURIComponent(userEmail ?? "guest")}`;
}
