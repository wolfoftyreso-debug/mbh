import Link from "next/link";
import { brand } from "@/lib/config/brand";
import type { Viewer } from "@/server/auth/session";
import { Avatar } from "@/components/ui/avatar";
import { Mark } from "./public-chrome";
import { SignOutButton } from "./sign-out-button";
import { NavLink } from "./nav-link";
import { db } from "@/server/db";
import { notifications } from "@/server/db/schema";
import { and, count, eq, isNull } from "drizzle-orm";
import { getT } from "@/server/i18n";
import { LanguageSwitch } from "@/components/i18n/language-switch";

export async function AppShell({ viewer, children }: { viewer: Viewer; children: React.ReactNode }) {
  const [[unread], { t, locale }] = await Promise.all([db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, viewer.userId), eq(notifications.channel, "IN_APP"), isNull(notifications.readAt))), getT()]);
  const nav = [
    { href: "/dashboard", label: t("nav.dashboard") },
    { href: "/assignments", label: t("nav.assignments") },
    { href: "/professionals", label: t("nav.findProfessionals") },
    ...(viewer.professionalProfileId ? [{ href: "/marketplace", label: t("nav.marketplace") }, { href: "/professional/profile", label: t("nav.myProfile") }] : [{ href: "/professional/onboarding", label: t("nav.becomeProfessional") }]),
    { href: "/organizations", label: t("nav.organizations") },
    { href: "/notifications", label: `${t("nav.notifications")}${Number(unread.n) ? ` (${unread.n})` : ""}` },
    { href: "/settings", label: t("nav.settings") },
    ...(viewer.isAdmin ? [{ href: "/admin", label: t("nav.admin") }] : []),
  ];
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-surface md:border-b-0 md:border-r">
        <div className="flex h-16 items-center gap-2 px-5 font-semibold tracking-tight">
          <Mark /> <Link href="/">{brand.name}</Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 hide-scrollbar md:flex-col md:pb-0">
          {nav.map((n) => (
            <NavLink key={n.href} href={n.href}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto hidden border-t border-line p-4 md:block">
          <div className="flex items-center gap-3">
            <Avatar name={viewer.name} image={viewer.image} size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{viewer.name}</p>
              <p className="truncate text-xs text-ink-3">{viewer.email}</p>
            </div>
          </div>
          <SignOutButton label={t("nav.signOut")} />
          <p className="mt-2 text-center"><LanguageSwitch locale={locale} next="/dashboard" /></p>
        </div>
      </aside>
      <div className="min-w-0">
        <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
