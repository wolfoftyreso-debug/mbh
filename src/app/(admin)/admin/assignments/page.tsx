import Link from "next/link";
import { requireAdmin } from "@/server/auth/session";
import { listAssignmentsAdmin } from "@/server/domain/admin/service";
import { PageHeader } from "@/components/ui/card";
import { StatusBadge, ConfidentialityBadge } from "@/components/ui/status-badge";
import { Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { ASSIGNMENT_STATUSES } from "@/server/domain/assignments/state-machine";
import { formatDate } from "@/lib/utils";

export default async function AdminAssignmentsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const viewer = await requireAdmin();
  const sp = await searchParams;
  const rows = await listAssignmentsAdmin(viewer, { q: sp.q, status: sp.status, page: Number(sp.page ?? 1) });
  return (
    <div>
      <PageHeader title="Assignments" description="Metadata only. Content requires a grant." />
      <form className="mb-4 flex flex-wrap gap-2"><Input name="q" defaultValue={sp.q ?? ""} placeholder="Title or public id" className="max-w-xs" /><Select name="status" defaultValue={sp.status ?? ""} className="w-48"><option value="">Any status</option>{ASSIGNMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select><Button type="submit" variant="outline">Filter</Button></form>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase text-ink-3"><tr><th className="px-4 py-2">Assignment</th><th className="px-4 py-2">Customer</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Confidentiality</th><th className="px-4 py-2">Updated</th></tr></thead>
          <tbody className="divide-y divide-line">{rows.map((r) => <tr key={r.a.id}><td className="px-4 py-3"><Link href={`/admin/assignments/${r.a.id}`} className="font-medium hover:underline">{r.a.title}</Link><p className="mono text-xs text-ink-3">{r.a.publicId}</p></td><td className="px-4 py-3">{r.orgName ?? r.customerName}</td><td className="px-4 py-3"><StatusBadge status={r.a.status} /></td><td className="px-4 py-3"><ConfidentialityBadge level={r.a.confidentiality} /></td><td className="px-4 py-3 text-ink-3">{formatDate(r.a.updatedAt)}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
