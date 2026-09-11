import type { Locale } from "@/lib/i18n";

export function LanguageSwitch({ locale, next = "/", className = "" }: { locale: Locale; next?: string; className?: string }) {
  const other: Locale = locale === "sv" ? "en" : "sv";
  return (
    <a href={`/api/locale?l=${other}&next=${encodeURIComponent(next)}`} className={`text-xs text-ink-3 hover:text-ink ${className}`} hrefLang={other} lang={other}>
      {other === "sv" ? "Svenska" : "English"}
    </a>
  );
}
