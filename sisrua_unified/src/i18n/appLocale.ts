import type { AppLocale } from "../types";

export const SUPPORTED_APP_LOCALES: AppLocale[] = ["pt-BR", "en-US", "es-ES"];

const PRIMARY_LANGUAGE_TO_LOCALE: Record<string, AppLocale> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
};

export function normalizeAppLocale(locale?: string | null): AppLocale {
  if (!locale) {
    return "pt-BR";
  }

  const normalized = locale.trim();
  const exactMatch = SUPPORTED_APP_LOCALES.find(
    (supportedLocale) => supportedLocale.toLowerCase() === normalized.toLowerCase(),
  );

  if (exactMatch) {
    return exactMatch;
  }

  const primaryLanguage = normalized.split(/[-_]/)[0]?.toLowerCase();
  if (primaryLanguage && primaryLanguage in PRIMARY_LANGUAGE_TO_LOCALE) {
    return PRIMARY_LANGUAGE_TO_LOCALE[primaryLanguage];
  }

  return "pt-BR";
}

export function getAppLocaleLabel(locale: AppLocale): string {
  switch (locale) {
    case "en-US":
      return "English (US)";
    case "es-ES":
      return "Español";
    case "pt-BR":
    default:
      return "Português (Brasil)";
  }
}