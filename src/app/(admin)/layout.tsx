import Link from "next/link";
import { requireAdmin } from "@/server/auth/session";
import { NavLink } from "@/components/layout/nav-link";
import { Mark } from "@/components/layout/public-chrome";
import { brand } from "@/lib/config/brand";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const nav = [
    ["/admin", "Overview"],
    ["/admin/verification", "Verification queue"],
    ["/admin/users", "Users"],
    ["/admin/assignments", "Assignments"],
    ["/admin/disputes", "Disputes"],
    ["/admin/finance", "Finance"],
    ["/admin/taxonomy", "Categories & domains"],
    ["/admin/settings", "Settings"],
    ["/admin/audit", "Audit log"],
  ];
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-surface md:border-b-0 md:border-r">
        <div className="flex h-16 items-center gap-2 px-5 font-semibold tracking-tight">
          <Mark /> <Link href="/dashboard">{brand.name}</Link>
          <span className="ml-1 rounded bg-danger-soft px-1.5 text-[10px] font-semibold uppercase text-danger">Admin</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 hide-scrollbar md:flex-col md:pb-0">
          {nav.map(([href, label]) => (
            <NavLink key={href} href={href}>
              {label}
            </NavLink>
          ))}
          <NavLink href="/dashboard">← Back to app</NavLink>
        </nav>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">{children}</main>
    </div>
  );
}
