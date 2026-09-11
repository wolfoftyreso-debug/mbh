import Link from "next/link";
import { requireViewer } from "@/server/auth/session";
import { listAssignmentsForViewer } from "@/server/domain/assignments/service";
import { PageHeader, Card, CardHeader, CardBody, EmptyState } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { StatusBadge, ConfidentialityBadge, VerificationBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils";
import { balancesByCurrency } from "@/server/finance/ledger";
import { formatMoney } from "@/lib/money";
import { getT } from "@/server/i18n";

export default async function DashboardPage() {
  const viewer = await requireViewer();
  const [{ t, locale }, { asCustomer, asProfessional, invitations }, balances] = await Promise.all([getT(), listAssignmentsForViewer(viewer), viewer.professionalProfileId ? balancesByCurrency("PROFESSIONAL", viewer.userId) : Promise.resolve([])]);
  const active = (s: string) => !["COMPLETED", "CANCELLED"].includes(s);
  const dateLocale = locale === "sv" ? "sv-SE" : "en-GB";
  return (
    <div>
      <PageHeader title={t("dash.hello", { name: viewer.name.split(" ")[0] })} description={t("dash.lead")} action={<LinkButton href="/assignments/new">{t("dash.newAssignment")}</LinkButton>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("dash.asCustomer")} description={t("dash.active", { n: asCustomer.filter((a) => active(a.status)).length })} action={<Link href="/assignments" className="text-sm text-accent hover:underline">{t("dash.all")}</Link>} />
          <CardBody className="p-0">
            {asCustomer.length ? (
              <ul className="divide-y divide-line">
                {asCustomer.slice(0, 6).map((a) => (
                  <li key={a.id}>
                    <Link href={`/assignments/${a.publicId}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{a.title}</p>
                        <p className="text-xs text-ink-3">{a.counterpartName ?? t("dash.noProfessionalYet")}{a.deadline ? ` · ${t("dash.due", { date: formatDate(a.deadline, dateLocale) })}` : ""}</p>
                      </div>
                      <StatusBadge status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-5"><EmptyState title={t("dash.emptyCustomer.title")} description={t("dash.emptyCustomer.body")} action={<LinkButton href="/assignments/new" size="sm">{t("dash.emptyCustomer.cta")}</LinkButton>} /></div>
            )}
          </CardBody>
        </Card>

        {viewer.professionalProfileId ? (
          <Card>
            <CardHeader title={t("dash.asProfessional")} description={<span className="inline-flex items-center gap-2">{viewer.professionalVerificationStatus ? <VerificationBadge status={viewer.professionalVerificationStatus} /> : null}{balances.map((b) => <span key={b.currency}>{t("dash.balance", { amount: formatMoney(b.amountMinor, b.currency) })}</span>)}</span>} action={<Link href="/marketplace" className="text-sm text-accent hover:underline">{t("dash.marketplace")}</Link>} />
            <CardBody className="p-0">
              {invitations.length ? (
                <div className="border-b border-line bg-accent-soft/40 px-5 py-3 text-sm">
                  <p className="font-medium">{t("dash.invitations", { n: invitations.length })}</p>
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
                          <p className="text-xs text-ink-3">{a.organizationName ?? a.counterpartName}{a.deadline ? ` · ${t("dash.due", { date: formatDate(a.deadline, dateLocale) })}` : ""}</p>
                        </div>
                        <StatusBadge status={a.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-5"><EmptyState title={t("dash.emptyPro.title")} description={t("dash.emptyPro.body")} action={<LinkButton href="/marketplace" size="sm" variant="outline">{t("dash.emptyPro.cta")}</LinkButton>} /></div>
              )}
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader title={t("dash.offer.title")} description={t("dash.offer.desc")} />
            <CardBody>
              <p className="text-sm text-ink-2">{t("dash.offer.body")}</p>
              <LinkButton href="/professional/onboarding" variant="outline" size="sm" className="mt-4">{t("dash.offer.cta")}</LinkButton>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
