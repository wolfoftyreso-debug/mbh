import Link from "next/link";
import { requireViewer } from "@/server/auth/session";
import { listAssignmentsForViewer } from "@/server/domain/assignments/service";
import { PageHeader, EmptyState } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, ConfidentialityBadge } from "@/components/ui/status-badge";
import { formatDate, humanize } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { getT } from "@/server/i18n";

export default async function AssignmentsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const viewer = await requireViewer();
  const { view } = await searchParams;
  const [{ t, locale }, { asCustomer, asProfessional }] = await Promise.all([getT(), listAssignmentsForViewer(viewer)]);
  const showPro = view === "professional" && viewer.professionalProfileId;
  const items = showPro ? asProfessional : asCustomer;
  const dl = locale === "sv" ? "sv-SE" : "en-GB";
  return (
    <div>
      <PageHeader title={t("list.title")} action={<LinkButton href="/assignments/new">{t("dash.newAssignment")}</LinkButton>} />
      {viewer.professionalProfileId ? (
        <div className="mb-4 flex gap-2 text-sm">
          <Link href="/assignments" className={`rounded-full border px-3 py-1 ${!showPro ? "border-accent bg-accent-soft text-accent" : "border-line"}`}>{t("list.asCustomer", { n: asCustomer.length })}</Link>
          <Link href="/assignments?view=professional" className={`rounded-full border px-3 py-1 ${showPro ? "border-accent bg-accent-soft text-accent" : "border-line"}`}>{t("list.asProfessional", { n: asProfessional.length })}</Link>
        </div>
      ) : null}
      {items.length ? (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-3">
              <tr>
                <th className="px-4 py-2 font-medium">{t("list.col.title")}</th>
                <th className="px-4 py-2 font-medium">{t("list.col.status")}</th>
                <th className="px-4 py-2 font-medium">{showPro ? t("list.col.customer") : t("list.col.professional")}</th>
                <th className="px-4 py-2 font-medium">{t("list.col.deadline")}</th>
                <th className="px-4 py-2 font-medium">{t("list.col.price")}</th>
                <th className="px-4 py-2 font-medium">{t("list.col.updated")}</th>
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
                  <td className="px-4 py-3 text-ink-2">{formatDate(a.deadline, dl)}</td>
                  <td className="px-4 py-3 text-ink-2">{a.agreedPriceMinor != null ? formatMoney(a.agreedPriceMinor, a.currency) : "—"}</td>
                  <td className="px-4 py-3 text-ink-3">{formatDate(a.updatedAt, dl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={t("list.empty.title")} description={showPro ? t("list.empty.pro") : t("list.empty.customer")} action={showPro ? <LinkButton href="/marketplace" size="sm" variant="outline">{t("list.browse")}</LinkButton> : <LinkButton href="/assignments/new" size="sm">{t("dash.newAssignment")}</LinkButton>} />
      )}
    </div>
  );
}
