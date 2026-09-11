import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight edge gate: redirects unauthenticated visitors away from app
 * routes based on the presence of the session cookie. Real authorization is
 * always performed server-side in pages, actions and route handlers.
 */
const PROTECTED_PREFIXES = ["/dashboard", "/assignments", "/marketplace", "/professional", "/organizations", "/settings", "/notifications", "/admin"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  const hasSession = req.cookies.getAll().some((c) => c.name.includes("session_token"));
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|embed).*)"],
};
