import type { AppLocale } from "@/types/domain";

export const locales: readonly AppLocale[] = ["bg", "en"] as const;
export const defaultLocale: AppLocale = "bg";
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

export const localeLabels: Record<AppLocale, { short: string; native: string }> = {
  bg: {
    short: "БГ",
    native: "Български",
  },
  en: {
    short: "EN",
    native: "English",
  },
};

export function isValidLocale(value: string | undefined | null): value is AppLocale {
  return value === "bg" || value === "en";
}

