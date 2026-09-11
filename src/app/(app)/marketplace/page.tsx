import Link from "next/link";
import { redirect } from "next/navigation";
import { requireViewer } from "@/server/auth/session";
import { listAssignmentsForViewer, listOpenAssignments } from "@/server/domain/assignments/service";
import { PageHeader, EmptyState, Alert } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, ConfidentialityBadge } from "@/components/ui/status-badge";
import { formatDate, humanize } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { hasAcceptedAgreement } from "@/server/domain/professionals/service";
import { LinkButton } from "@/components/ui/button";

export default async function MarketplacePage() {
  const viewer = await requireViewer();
  if (!viewer.professionalProfileId) redirect("/professional/onboarding");
  const [{ invitations }, open, agreement] = await Promise.all([listAssignmentsForViewer(viewer), listOpenAssignments(viewer), hasAcceptedAgreement(viewer.userId, "PROFESSIONAL_CONFIDENTIALITY")]);
  const Row = ({ a }: { a: (typeof open)[number] }) => (
    <li>
      <Link href={`/assignments/${a.publicId}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{a.title}</p>
          <p className="text-xs text-ink-3">{a.counterpartName}{a.deadline ? ` · due ${formatDate(a.deadline)}` : ""}{a.agreedPriceMinor ? ` · budget ${formatMoney(a.agreedPriceMinor, a.currency)}` : ""}</p>
          <div className="mt-1 flex flex-wrap gap-1"><Badge>{humanize(a.template)}</Badge>{a.languageCode ? <Badge>{a.languageCode.toUpperCase()}</Badge> : null}<ConfidentialityBadge level={a.confidentiality} /></div>
        </div>
        <StatusBadge status={a.status} />
      </Link>
    </li>
  );
  return (
    <div>
      <PageHeader title="Marketplace" description="Open assignments and invitations. Briefs are visible; source material becomes visible once your offer is accepted." />
      {!agreement ? <div className="mb-6"><Alert tone="warn" title="Accept the confidentiality agreement to make offers"><LinkButton href="/professional/agreement" size="sm" variant="outline" className="mt-2">Review agreement</LinkButton></Alert></div> : null}
      {invitations.length ? (
        <section className="mb-8">
          <h2 className="text-lg font-semibold">Invitations for you</h2>
          <ul className="mt-3 divide-y divide-line rounded-lg border border-accent/40 bg-surface">{invitations.map((a) => <Row key={a.id} a={a} />)}</ul>
        </section>
      ) : null}
      <section>
        <h2 className="text-lg font-semibold">Open assignments</h2>
        {open.length ? <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">{open.map((a) => <Row key={a.id} a={a} />)}</ul> : <div className="mt-3"><EmptyState title="No open assignments right now" description="Complete your profile and get verified to be invited directly." /></div>}
      </section>
    </div>
  );
}
