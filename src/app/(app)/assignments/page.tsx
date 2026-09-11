import Link from "next/link";
import { requireViewer } from "@/server/auth/session";
import { listAssignmentsForViewer } from "@/server/domain/assignments/service";
import { PageHeader, EmptyState } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { StatusBadge, ConfidentialityBadge, Badge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/lib/utils";
import { formatMoney } from "@/lib/money";

export default async function AssignmentsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const viewer = await requireViewer();
  const { view } = await searchParams;
  const { asCustomer, asProfessional } = await listAssignmentsForViewer(viewer);
  const showPro = view === "professional" && viewer.professionalProfileId;
  const items = showPro ? asProfessional : asCustomer;
  return (
    <div>
      <PageHeader title="Assignments" action={<LinkButton href="/assignments/new">New assignment</LinkButton>} />
      {viewer.professionalProfileId ? (
        <div className="mb-4 flex gap-2 text-sm">
          <Link href="/assignments" className={`rounded-full border px-3 py-1 ${!showPro ? "border-accent bg-accent-soft text-accent" : "border-line"}`}>As customer ({asCustomer.length})</Link>
          <Link href="/assignments?view=professional" className={`rounded-full border px-3 py-1 ${showPro ? "border-accent bg-accent-soft text-accent" : "border-line"}`}>As professional ({asProfessional.length})</Link>
        </div>
      ) : null}
      {items.length ? (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-3">
              <tr>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">{showPro ? "Customer" : "Professional"}</th>
                <th className="px-4 py-2 font-medium">Deadline</th>
                <th className="px-4 py-2 font-medium">Price</th>
                <th className="px-4 py-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((a) => (
                <tr key={a.id} className="hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link href={`/assignments/${a.publicId}`} className="font-medium hover:underline">{a.title}</Link>
                    <div className="mt-1 flex flex-wrap gap-1"><ConfidentialityBadge level={a.confidentiality} /><Badge>{humanize(a.template)}</Badge>{a.languageCode ? <Badge>{a.languageCode.toUpperCase()}</Badge> : null}</div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3 text-ink-2">{showPro ? (a.organizationName ?? a.counterpartName ?? "—") : (a.counterpartName ?? "—")}</td>
                  <td className="px-4 py-3 text-ink-2">{formatDate(a.deadline)}</td>
                  <td className="px-4 py-3 text-ink-2">{a.agreedPriceMinor != null ? formatMoney(a.agreedPriceMinor, a.currency) : "—"}</td>
                  <td className="px-4 py-3 text-ink-3">{formatDate(a.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Nothing here yet" description={showPro ? "Accepted assignments will appear here." : "Create an assignment to get started."} action={showPro ? <LinkButton href="/marketplace" size="sm" variant="outline">Browse the marketplace</LinkButton> : <LinkButton href="/assignments/new" size="sm">New assignment</LinkButton>} />
      )}
    </div>
  );
}
