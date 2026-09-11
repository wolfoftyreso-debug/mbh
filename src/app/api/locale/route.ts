import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n";
import { getViewer } from "@/server/auth/session";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

/** Sets the UI language (cookie, and the account setting when signed in) and redirects back. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const locale = url.searchParams.get("l");
  const next = url.searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const res = NextResponse.redirect(new URL(safeNext, url.origin), 303);
  if (!isLocale(locale)) return res;
  res.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: false });
  const viewer = await getViewer();
  if (viewer) await db.update(users).set({ locale }).where(eq(users.id, viewer.userId));
  return res;
}
