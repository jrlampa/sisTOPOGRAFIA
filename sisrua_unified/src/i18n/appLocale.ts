import type { AppLocale } from "../types";

export const SUPPORTED_APP_LOCALES: AppLocale[] = ["pt-BR", "en-US", "es-ES"];

const LOCALE_LABELS: Record<AppLocale, Record<AppLocale, string>> = {
  "pt-BR": {
    "pt-BR": "Português (Brasil)",
    "en-US": "Inglês (Estados Unidos)",
    "es-ES": "Espanhol (Espanha)",
  },
  "en-US": {
    "pt-BR": "Portuguese (Brazil)",
    "en-US": "English (United States)",
    "es-ES": "Spanish (Spain)",
  },
  "es-ES": {
    "pt-BR": "Portugués (Brasil)",
    "en-US": "Inglés (Estados Unidos)",
    "es-ES": "Español (España)",
  },
};

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

export function getAppLocaleLabel(
  locale: AppLocale,
  displayLocale: AppLocale = locale,
): string {
  return LOCALE_LABELS[displayLocale]?.[locale] ?? LOCALE_LABELS["pt-BR"][locale];
}