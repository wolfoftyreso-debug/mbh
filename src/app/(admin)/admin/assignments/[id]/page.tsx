import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, gt } from "drizzle-orm";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db";
import { adminActions, assignments, authorshipRecords, disputes, payments, users } from "@/server/db/schema";
import { listAuditEvents } from "@/server/domain/admin/service";
import { PageHeader, Card, CardHeader, CardBody, DescriptionList } from "@/components/ui/card";
import { StatusBadge, ConfidentialityBadge, Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ContentAccessForm, RefundForm, RevokeRecordButton } from "@/components/admin/forms";
import { formatDateTime, humanize } from "@/lib/utils";
import { formatMoney } from "@/lib/money";

export default async function AdminAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireAdmin();
  const [a] = await db.select().from(assignments).where(eq(assignments.id, id)).limit(1);
  if (!a) notFound();
  const [[customer], [grant], pays, records, disp, audit] = await Promise.all([
    db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, a.customerUserId)).limit(1),
    db.select().from(adminActions).where(and(eq(adminActions.adminUserId, viewer.userId), eq(adminActions.action, "ADMIN_CONTENT_ACCESS"), eq(adminActions.assignmentId, id), gt(adminActions.expiresAt, new Date()))).limit(1),
    db.select().from(payments).where(eq(payments.assignmentId, id)).orderBy(desc(payments.createdAt)),
    db.select().from(authorshipRecords).where(eq(authorshipRecords.assignmentId, id)),
    db.select().from(disputes).where(eq(disputes.assignmentId, id)).orderBy(desc(disputes.createdAt)),
    listAuditEvents(viewer, { assignmentId: id }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title={a.title} description={<span className="inline-flex flex-wrap items-center gap-2"><StatusBadge status={a.status} /><ConfidentialityBadge level={a.confidentiality} /><span className="mono text-xs">{a.publicId}</span></span>} action={grant ? <LinkButton href={`/assignments/${a.publicId}`} size="sm">Open workspace (access granted)</LinkButton> : null} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Metadata" /><CardBody><DescriptionList items={[{ label: "Customer", value: `${customer?.name} (${customer?.email})` }, { label: "Template", value: humanize(a.template) }, { label: "Language", value: a.languageCode?.toUpperCase() }, { label: "AI policy", value: humanize(a.aiPolicy) }, { label: "Agreed price", value: a.agreedPriceMinor != null ? formatMoney(a.agreedPriceMinor, a.currency) : "—" }, { label: "Created", value: formatDateTime(a.createdAt) }, { label: "Completed", value: a.completedAt ? formatDateTime(a.completedAt) : "—" }]} /></CardBody></Card>
        <Card><CardHeader title="Content access" description="Not granted by default. A grant is time-limited, audited and shown to the participants." /><CardBody>{grant ? <p className="text-sm text-accent">Active grant until {formatDateTime(grant.expiresAt)}. Reason: {grant.reason}</p> : <ContentAccessForm assignmentId={id} />}</CardBody></Card>
      </div>
      <Card><CardHeader title="Payments" /><CardBody className="p-0">{pays.length ? <table className="w-full text-sm"><tbody className="divide-y divide-line">{pays.map((p) => <tr key={p.id}><td className="px-5 py-2">{formatDateTime(p.createdAt)}</td><td className="px-5 py-2">{formatMoney(p.amountMinor, p.currency)} · fee {formatMoney(p.platformFeeMinor, p.currency)} · {p.provider}</td><td className="px-5 py-2"><Badge>{p.status}</Badge>{p.refundedMinor ? ` refunded ${formatMoney(p.refundedMinor, p.currency)}` : ""}</td><td className="px-5 py-2">{p.status === "CAPTURED" || p.status === "PARTIALLY_REFUNDED" ? <RefundForm paymentId={p.id} maxMinor={p.amountMinor - p.refundedMinor} currency={p.currency} /> : null}</td></tr>)}</tbody></table> : <p className="px-5 py-4 text-sm text-ink-3">No payments.</p>}</CardBody></Card>
      <Card><CardHeader title="Records" /><CardBody className="p-0">{records.length ? <ul className="divide-y divide-line text-sm">{records.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2"><span><Link href={`/record/${r.publicId}`} className="mono hover:underline">{r.publicId}</Link> · {r.professionalPublicName} · V{r.versionNumber} · <Badge tone={r.status === "VALID" ? "accent" : "danger"}>{r.status}</Badge> · {r.visibility.toLowerCase()}</span>{r.status === "VALID" ? <RevokeRecordButton publicId={r.publicId} /> : null}</li>)}</ul> : <p className="px-5 py-4 text-sm text-ink-3">No records.</p>}</CardBody></Card>
      {disp.length ? <Card><CardHeader title="Disputes" /><CardBody className="p-0"><ul className="divide-y divide-line text-sm">{disp.map((d) => <li key={d.id} className="px-5 py-2"><Badge>{humanize(d.status)}</Badge> {d.reason}<p className="text-xs text-ink-3">{formatDateTime(d.createdAt)} · <Link href="/admin/disputes" className="underline">manage</Link></p></li>)}</ul></CardBody></Card> : null}
      <Card><CardHeader title="Audit trail" /><CardBody className="p-0"><ul className="divide-y divide-line text-xs">{audit.map((e) => <li key={e.e.id} className="flex flex-wrap justify-between gap-2 px-5 py-2"><span><span className="font-medium">{e.e.action}</span> · {e.e.entityType} <span className="mono text-ink-3">{e.e.entityId.slice(0, 12)}</span> {Object.keys(e.e.metadata).length ? <span className="text-ink-3">{JSON.stringify(e.e.metadata)}</span> : null}</span><span className="text-ink-3">{e.actorName ?? e.e.actorType} · {formatDateTime(e.e.createdAt)}</span></li>)}</ul></CardBody></Card>
    </div>
  );
}
