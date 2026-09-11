import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getViewer } from "@/server/auth/session";
import { DEFAULT_LOCALE, LOCALE_COOKIE, getDictionary, isLocale, makeTranslator, negotiateLocale, type Locale, type Translator } from "@/lib/i18n";

/** Locale resolution: signed-in user setting → cookie → Accept-Language → default. */
export const getLocale = cache(async (): Promise<Locale> => {
  try {
    const viewer = await getViewer();
    if (viewer) {
      const { db } = await import("@/server/db");
      const { users } = await import("@/server/db/schema");
      const { eq } = await import("drizzle-orm");
      const [u] = await db.select({ locale: users.locale }).from(users).where(eq(users.id, viewer.userId)).limit(1);
      if (u && isLocale(u.locale)) return u.locale;
    }
  } catch {
    /* unauthenticated or outside request scope */
  }
  try {
    const c = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (isLocale(c)) return c;
    return negotiateLocale((await headers()).get("accept-language"));
  } catch {
    return DEFAULT_LOCALE;
  }
});

export async function getT(): Promise<{ t: Translator; locale: Locale }> {
  const locale = await getLocale();
  return { t: makeTranslator(locale), locale };
}

export async function getDict() {
  const locale = await getLocale();
  return { locale, dict: getDictionary(locale) };
}
