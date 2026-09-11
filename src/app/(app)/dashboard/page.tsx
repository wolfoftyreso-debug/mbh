import Link from "next/link";
import { requireViewer } from "@/server/auth/session";
import { listAssignmentsForViewer } from "@/server/domain/assignments/service";
import { PageHeader, Card, CardHeader, CardBody, EmptyState } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { StatusBadge, ConfidentialityBadge, VerificationBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { balancesByCurrency } from "@/server/finance/ledger";
import { formatMoney } from "@/lib/money";

export default async function DashboardPage() {
  const viewer = await requireViewer();
  const { asCustomer, asProfessional, invitations } = await listAssignmentsForViewer(viewer);
  const active = (s: string) => !["COMPLETED", "CANCELLED"].includes(s);
  const balances = viewer.professionalProfileId ? await balancesByCurrency("PROFESSIONAL", viewer.userId) : [];
  return (
    <div>
      <PageHeader title={`Hello, ${viewer.name.split(" ")[0]}`} description="Your assignments, invitations and professional activity." action={<LinkButton href="/assignments/new">New assignment</LinkButton>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="As customer" description={`${asCustomer.filter((a) => active(a.status)).length} active`} action={<Link href="/assignments" className="text-sm text-accent hover:underline">All</Link>} />
          <CardBody className="p-0">
            {asCustomer.length ? (
              <ul className="divide-y divide-line">
                {asCustomer.slice(0, 6).map((a) => (
                  <li key={a.id}>
                    <Link href={`/assignments/${a.publicId}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{a.title}</p>
                        <p className="text-xs text-ink-3">{a.counterpartName ?? "No professional yet"}{a.deadline ? ` · due ${formatDate(a.deadline)}` : ""}</p>
                      </div>
                      <StatusBadge status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-5"><EmptyState title="No assignments yet" description="Describe what you need and find a verified professional." action={<LinkButton href="/assignments/new" size="sm">Create your first assignment</LinkButton>} /></div>
            )}
          </CardBody>
        </Card>

        {viewer.professionalProfileId ? (
          <Card>
            <CardHeader title="As professional" description={<span className="inline-flex items-center gap-2">{viewer.professionalVerificationStatus ? <VerificationBadge status={viewer.professionalVerificationStatus} /> : null}{balances.map((b) => <span key={b.currency}>Balance {formatMoney(b.amountMinor, b.currency)}</span>)}</span>} action={<Link href="/marketplace" className="text-sm text-accent hover:underline">Marketplace</Link>} />
            <CardBody className="p-0">
              {invitations.length ? (
                <div className="border-b border-line bg-accent-soft/40 px-5 py-3 text-sm">
                  <p className="font-medium">{invitations.length} open invitation{invitations.length > 1 ? "s" : ""}</p>
                  <ul className="mt-1 space-y-1">
                    {invitations.map((i) => (
                      <li key={i.id}><Link href={`/assignments/${i.publicId}`} className="text-accent hover:underline">{i.title}</Link> <ConfidentialityBadge level={i.confidentiality} /></li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {asProfessional.length ? (
                <ul className="divide-y divide-line">
                  {asProfessional.slice(0, 6).map((a) => (
                    <li key={a.id}>
                      <Link href={`/assignments/${a.publicId}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{a.title}</p>
                          <p className="text-xs text-ink-3">{a.organizationName ?? a.counterpartName}{a.deadline ? ` · due ${formatDate(a.deadline)}` : ""}</p>
                        </div>
                        <StatusBadge status={a.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-5"><EmptyState title="No professional work yet" description="Browse open assignments or complete your profile to get invited." action={<LinkButton href="/marketplace" size="sm" variant="outline">Open marketplace</LinkButton>} /></div>
              )}
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader title="Offer your expertise" description="Editors, translators, technicians, accountants, engineers, lawyers, teachers." />
            <CardBody>
              <p className="text-sm text-ink-2">Create a professional profile, declare your languages and domain expertise, and get verified. Verified professionals rank higher and can sign work.</p>
              <LinkButton href="/professional/onboarding" variant="outline" size="sm" className="mt-4">Create a professional profile</LinkButton>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
