import Link from "next/link";
import { requireAdmin } from "@/server/auth/session";
import { listDisputes } from "@/server/domain/admin/service";
import { PageHeader, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DisputeResolver } from "@/components/admin/forms";
import { formatDateTime, humanize } from "@/lib/utils";

export default async function AdminDisputesPage() {
  const viewer = await requireAdmin();
  const rows = await listDisputes(viewer);
  return (
    <div>
      <PageHeader title="Disputes" />
      {rows.length ? <ul className="space-y-3">{rows.map((r) => <li key={r.d.id} className="rounded-lg border border-line bg-surface p-4 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><p><Link href={`/admin/assignments/${r.d.assignmentId}`} className="font-medium hover:underline">{r.title}</Link> <span className="text-ink-3">· opened by {r.openerName} · {formatDateTime(r.d.createdAt)}</span></p><Badge tone={r.d.status === "OPEN" ? "danger" : r.d.status === "UNDER_REVIEW" ? "warn" : "neutral"}>{humanize(r.d.status)}</Badge></div><p className="prose-plain mt-2 text-ink-2">{r.d.reason}</p>{r.d.resolutionNotes ? <p className="mt-2 text-xs text-ink-3">Resolution: {r.d.resolutionNotes}</p> : null}{r.d.status === "OPEN" || r.d.status === "UNDER_REVIEW" ? <div className="mt-3"><DisputeResolver disputeId={r.d.id} /></div> : null}</li>)}</ul> : <EmptyState title="No disputes" />}
    </div>
  );
}
