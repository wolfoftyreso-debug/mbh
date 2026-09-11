import Link from "next/link";
import { requireAdmin } from "@/server/auth/session";
import { dashboardStats } from "@/server/domain/admin/service";
import { PageHeader } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";

export default async function AdminHome() {
  const viewer = await requireAdmin();
  const s = await dashboardStats(viewer);
  const tiles: [string, string | number, string][] = [
    ["Users", s.users, "/admin/users"],
    ["Professionals", s.professionals, "/admin/users"],
    ["Assignments", s.assignments, "/admin/assignments"],
    ["Pending credentials", s.pendingCredentials, "/admin/verification"],
    ["Pending expertise", s.pendingExpertise, "/admin/verification"],
    ["Pending identity", s.pendingIdentity, "/admin/verification"],
    ["Open disputes", s.openDisputes, "/admin/disputes"],
    ["Fees captured", s.feesCaptured ? formatMoney(s.feesCaptured.amountMinor, s.feesCaptured.currency) : "—", "/admin/finance"],
  ];
  return (
    <div>
      <PageHeader title="Platform administration" description="Administration is separate from content access. Assignment content requires an explicit, audited, time-limited grant." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, value, href]) => (
          <Link key={label} href={href} className="rounded-lg border border-line bg-surface p-5 hover:border-line-strong"><p className="text-xs uppercase tracking-wider text-ink-3">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></Link>
        ))}
      </div>
    </div>
  );
}
