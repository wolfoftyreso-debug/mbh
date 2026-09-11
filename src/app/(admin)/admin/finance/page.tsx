import { desc, eq, sql } from "drizzle-orm";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db";
import { ledgerEntries, payouts, users } from "@/server/db/schema";
import { PageHeader, Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreatePayoutButton, PayoutControls } from "@/components/admin/forms";
import { formatMoney } from "@/lib/money";
import { formatDateTime, humanize } from "@/lib/utils";

export default async function AdminFinancePage() {
  await requireAdmin();
  const [accounts, balances, recentPayouts, recent] = await Promise.all([
    db.select({ account: ledgerEntries.account, currency: ledgerEntries.currency, total: sql<string>`sum(${ledgerEntries.amountMinor})` }).from(ledgerEntries).groupBy(ledgerEntries.account, ledgerEntries.currency),
    db.select({ userId: ledgerEntries.accountRef, name: users.name, currency: ledgerEntries.currency, total: sql<string>`sum(${ledgerEntries.amountMinor})` }).from(ledgerEntries).innerJoin(users, eq(users.id, ledgerEntries.accountRef)).where(eq(ledgerEntries.account, "PROFESSIONAL")).groupBy(ledgerEntries.accountRef, users.name, ledgerEntries.currency),
    db.select({ p: payouts, name: users.name }).from(payouts).innerJoin(users, eq(users.id, payouts.professionalUserId)).orderBy(desc(payouts.createdAt)).limit(50),
    db.select().from(ledgerEntries).orderBy(desc(ledgerEntries.createdAt)).limit(100),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Finance" description="All figures are derived from the append-only ledger in integer minor units." />
      <div className="grid gap-4 sm:grid-cols-3">{accounts.map((a) => <Card key={`${a.account}${a.currency}`}><CardBody><p className="text-xs uppercase tracking-wider text-ink-3">{humanize(a.account)}</p><p className="mt-1 text-xl font-semibold">{formatMoney(Number(a.total), a.currency)}</p></CardBody></Card>)}</div>
      <Card><CardHeader title="Professional balances" /><CardBody className="p-0"><table className="w-full text-sm"><tbody className="divide-y divide-line">{balances.map((b) => <tr key={`${b.userId}${b.currency}`}><td className="px-5 py-2">{b.name}</td><td className="px-5 py-2">{formatMoney(Number(b.total), b.currency)}</td><td className="px-5 py-2 text-right">{Number(b.total) > 0 ? <CreatePayoutButton userId={b.userId} currency={b.currency} /> : null}</td></tr>)}</tbody></table></CardBody></Card>
      <Card><CardHeader title="Payouts" /><CardBody className="p-0"><table className="w-full text-sm"><tbody className="divide-y divide-line">{recentPayouts.map((r) => <tr key={r.p.id}><td className="px-5 py-2">{formatDateTime(r.p.createdAt)}</td><td className="px-5 py-2">{r.name}</td><td className="px-5 py-2">{formatMoney(r.p.amountMinor, r.p.currency)}</td><td className="px-5 py-2"><Badge>{r.p.status}</Badge></td><td className="px-5 py-2 text-right"><PayoutControls payoutId={r.p.id} status={r.p.status} /></td></tr>)}</tbody></table></CardBody></Card>
      <Card><CardHeader title="Recent ledger entries" /><CardBody className="p-0"><table className="w-full text-xs"><tbody className="divide-y divide-line">{recent.map((e) => <tr key={e.id}><td className="px-5 py-1.5 text-ink-3">{formatDateTime(e.createdAt)}</td><td className="px-5 py-1.5">{e.type}</td><td className="px-5 py-1.5">{e.account} <span className="mono text-ink-3">{e.accountRef.slice(0, 10)}</span></td><td className="px-5 py-1.5">{e.description}</td><td className={`px-5 py-1.5 text-right ${e.amountMinor < 0 ? "text-danger" : "text-accent"}`}>{formatMoney(e.amountMinor, e.currency)}</td></tr>)}</tbody></table></CardBody></Card>
    </div>
  );
}
