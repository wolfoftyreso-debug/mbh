"use client";
import { createContext, useContext, useMemo } from "react";
import { interpolate, type Dictionary, type DictionaryKey, type Locale } from "@/lib/i18n";

const Ctx = createContext<{ locale: Locale; dict: Dictionary } | null>(null);

export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dictionary; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, dict }), [locale, dict]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Client-side translator. Falls back to the key when used outside the provider. */
export function useT(): { t: (key: DictionaryKey, vars?: Record<string, string | number | null | undefined>) => string; locale: Locale } {
  const ctx = useContext(Ctx);
  return {
    locale: ctx?.locale ?? "en",
    t: (key, vars) => interpolate(ctx?.dict[key] ?? key, vars),
  };
}
