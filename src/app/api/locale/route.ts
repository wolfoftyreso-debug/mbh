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
  // Redirect on the origin the browser actually used (behind proxies the parsed URL may differ).
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const res = NextResponse.redirect(new URL(safeNext, `${proto}://${host}`), 303);
  if (!isLocale(locale)) return res;
  res.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: false });
  const viewer = await getViewer();
  if (viewer) await db.update(users).set({ locale }).where(eq(users.id, viewer.userId));
  return res;
}
