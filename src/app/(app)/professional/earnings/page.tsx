import { desc, eq } from "drizzle-orm";
import { requireProfessional } from "@/server/auth/session";
import { db } from "@/server/db";
import { ledgerEntries, payouts } from "@/server/db/schema";
import { balancesByCurrency } from "@/server/finance/ledger";
import { PageHeader, Card, CardHeader, CardBody } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { formatDateTime, humanize } from "@/lib/utils";
import { PayoutButton } from "@/components/professional/payout-button";

export default async function EarningsPage() {
  const viewer = await requireProfessional();
  const [balances, entries, payoutRows] = await Promise.all([
    balancesByCurrency("PROFESSIONAL", viewer.userId),
    db.select().from(ledgerEntries).where(eq(ledgerEntries.accountRef, viewer.userId)).orderBy(desc(ledgerEntries.createdAt)).limit(100),
    db.select().from(payouts).where(eq(payouts.professionalUserId, viewer.userId)).orderBy(desc(payouts.createdAt)).limit(50),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Earnings" description="Earnings are credited when an assignment is completed. Balances are derived from the append-only ledger." />
      <div className="grid gap-4 sm:grid-cols-2">
        {balances.length ? balances.map((b) => (
          <Card key={b.currency}><CardBody><p className="text-xs uppercase tracking-wider text-ink-3">Available balance</p><p className="mt-1 text-2xl font-semibold">{formatMoney(b.amountMinor, b.currency)}</p>{b.amountMinor > 0 ? <div className="mt-3"><PayoutButton currency={b.currency} /></div> : null}</CardBody></Card>
        )) : <Card><CardBody><p className="text-sm text-ink-3">No earnings yet.</p></CardBody></Card>}
      </div>
      <Card>
        <CardHeader title="Ledger" />
        <CardBody className="p-0">
          {entries.length ? <table className="w-full text-sm"><tbody className="divide-y divide-line">{entries.map((e) => <tr key={e.id}><td className="px-5 py-2 text-ink-2">{formatDateTime(e.createdAt)}</td><td className="px-5 py-2">{humanize(e.type)} <span className="text-ink-3">· {e.description}</span></td><td className={`px-5 py-2 text-right ${e.amountMinor < 0 ? "text-danger" : "text-accent"}`}>{formatMoney(e.amountMinor, e.currency)}</td></tr>)}</tbody></table> : <p className="px-5 py-4 text-sm text-ink-3">No entries.</p>}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Payouts" />
        <CardBody className="p-0">
          {payoutRows.length ? <table className="w-full text-sm"><tbody className="divide-y divide-line">{payoutRows.map((p) => <tr key={p.id}><td className="px-5 py-2 text-ink-2">{formatDateTime(p.createdAt)}</td><td className="px-5 py-2">{humanize(p.status)}</td><td className="px-5 py-2 text-right">{formatMoney(p.amountMinor, p.currency)}</td></tr>)}</tbody></table> : <p className="px-5 py-4 text-sm text-ink-3">No payouts yet.</p>}
        </CardBody>
      </Card>
    </div>
  );
}
