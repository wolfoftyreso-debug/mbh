import { en, type Dictionary, type DictionaryKey } from "./en";
import { sv } from "./sv";

export type Locale = "en" | "sv";
export const LOCALES: Locale[] = ["en", "sv"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "ha_locale";

const dictionaries: Record<Locale, Dictionary> = { en, sv };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as string[]).includes(value);
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? en;
}

export function interpolate(template: string, vars?: Record<string, string | number | null | undefined>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] === undefined || vars[k] === null ? "" : String(vars[k])));
}

export type Translator = (key: DictionaryKey, vars?: Record<string, string | number | null | undefined>) => string;

export function makeTranslator(locale: Locale): Translator {
  const dict = getDictionary(locale);
  return (key, vars) => interpolate(dict[key] ?? en[key] ?? key, vars);
}

/** Maps Accept-Language to a supported locale. */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const first = acceptLanguage.split(",").map((p) => p.trim().split(";")[0].toLowerCase());
  for (const tag of first) {
    if (tag.startsWith("sv")) return "sv";
    if (tag.startsWith("en")) return "en";
  }
  return DEFAULT_LOCALE;
}

export type { Dictionary, DictionaryKey };
