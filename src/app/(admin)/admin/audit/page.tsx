import { requireAdmin } from "@/server/auth/session";
import { listAuditEvents } from "@/server/domain/admin/service";
import { PageHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string; entityId?: string; page?: string }> }) {
  const viewer = await requireAdmin();
  const sp = await searchParams;
  const rows = await listAuditEvents(viewer, { action: sp.action || undefined, entityId: sp.entityId || undefined, page: Number(sp.page ?? 1) });
  return (
    <div>
      <PageHeader title="Audit log" description="Append-only. Metadata never contains secrets or content." />
      <form className="mb-4 flex flex-wrap gap-2"><Input name="action" defaultValue={sp.action ?? ""} placeholder="Action (e.g. VERSION_SIGNED)" className="max-w-xs" /><Input name="entityId" defaultValue={sp.entityId ?? ""} placeholder="Entity id" className="max-w-xs" /><Button type="submit" variant="outline">Filter</Button></form>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-xs"><thead className="bg-surface-2 text-left uppercase text-ink-3"><tr><th className="px-4 py-2">Time</th><th className="px-4 py-2">Actor</th><th className="px-4 py-2">Action</th><th className="px-4 py-2">Entity</th><th className="px-4 py-2">Metadata</th></tr></thead><tbody className="divide-y divide-line">{rows.map((r) => <tr key={r.e.id}><td className="px-4 py-2 text-ink-3">{formatDateTime(r.e.createdAt)}</td><td className="px-4 py-2">{r.actorName ?? r.e.actorType}</td><td className="px-4 py-2 font-medium">{r.e.action}</td><td className="px-4 py-2">{r.e.entityType} <span className="mono text-ink-3">{r.e.entityId.slice(0, 14)}</span></td><td className="max-w-md truncate px-4 py-2 text-ink-3">{JSON.stringify(r.e.metadata)}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
