import Link from "next/link";
import { requireProfessional } from "@/server/auth/session";
import { getOwnProfile, publicRecordsForProfessional } from "@/server/domain/professionals/service";
import { reputationSummary } from "@/server/domain/reviews/service";
import { PageHeader, Card, CardHeader, CardBody, Alert } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VerificationBadge } from "@/components/ui/status-badge";
import { LinkButton } from "@/components/ui/button";
import { ProfileForm } from "@/components/professional/profile-form";
import { PortfolioManager } from "@/components/professional/portfolio-manager";
import { formatMonthYear, humanize } from "@/lib/utils";
import { db } from "@/server/db";
import { authorshipRecords } from "@/server/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getT } from "@/server/i18n";

export default async function ProfessionalProfilePage() {
  const viewer = await requireProfessional();
  const data = await getOwnProfile(viewer);
  if (!data) return null;
  const { profile } = data;
  const [{ t, locale }, rep, records, eligibleRecords] = await Promise.all([getT(), reputationSummary(viewer.userId), publicRecordsForProfessional(viewer.userId, 5), db.select({ id: authorshipRecords.id, workTitle: authorshipRecords.workTitle, publicId: authorshipRecords.publicId }).from(authorshipRecords).where(and(eq(authorshipRecords.professionalUserId, viewer.userId), inArray(authorshipRecords.visibility, ["PUBLIC", "ANONYMIZED"])))]);
  return (
    <div>
      <PageHeader title={t("pro.profile.title")} description={<span className="inline-flex flex-wrap items-center gap-2"><VerificationBadge status={profile.verificationStatus} />{profile.publishedAt ? <Badge tone="accent">{t("pro.profile.published")}</Badge> : <Badge>{t("pro.profile.notPublished")}</Badge>}{profile.publishedAt ? <Link href={`/professionals/${profile.slug}`} className="text-accent underline" target="_blank">{t("pro.profile.viewPublic")}</Link> : null}</span>} action={<><LinkButton href="/professional/credentials" variant="outline" size="sm">{t("pro.profile.compBtn")}</LinkButton><LinkButton href="/professional/services" variant="outline" size="sm">{t("pro.profile.servicesBtn")}</LinkButton><LinkButton href="/professional/earnings" variant="outline" size="sm">{t("pro.profile.earningsBtn")}</LinkButton></>} />
      {!profile.confidentialityAgreementVersion ? <div className="mb-6"><Alert tone="warn" title={t("pro.profile.agreementWarn.title")}>{t("pro.profile.agreementWarn.body")} <Link href="/professional/agreement" className="underline">{t("pro.profile.openAgreement")}</Link></Alert></div> : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader title={t("pro.profile.card.title")} description={t("pro.profile.card.desc")} />
          <CardBody>
            <ProfileForm mode="edit" initial={{ displayName: profile.displayName, title: profile.title, bio: profile.bio, country: profile.country ?? "", region: profile.region ?? "", yearsExperience: profile.yearsExperience?.toString() ?? "", availability: profile.availability, typicalTurnaroundDays: profile.typicalTurnaroundDays?.toString() ?? "", externalUrls: profile.externalUrls, photoAttachmentId: profile.photoAttachmentId, published: Boolean(profile.publishedAt) }} />
          </CardBody>
        </Card>
        <div className="space-y-6">
          {rep ? (
            <Card>
              <CardHeader title={t("pro.profile.reputation")} />
              <CardBody>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-ink-3">{t("pro.profile.completed")}</dt><dd>{rep.completedAssignments}</dd>
                  <dt className="text-ink-3">{t("pro.profile.signedWorks")}</dt><dd>{rep.signedWorks}</dd>
                  <dt className="text-ink-3">{t("pro.profile.rating")}</dt><dd>{rep.ratingCount ? `${rep.ratingAvg.toFixed(1)} (${rep.ratingCount})` : "—"}</dd>
                  <dt className="text-ink-3">{t("pro.profile.repeat")}</dt><dd>{rep.repeatCustomers}</dd>
                  <dt className="text-ink-3">{t("pro.profile.onTime")}</dt><dd>{rep.completedAssignments ? `${rep.onTimeRate.toFixed(0)}%` : "—"}</dd>
                  <dt className="text-ink-3">{t("pro.profile.disputes")}</dt><dd>{rep.disputeCount}</dd>
                </dl>
              </CardBody>
            </Card>
          ) : null}
          <Card>
            <CardHeader title={t("pro.profile.recentRecords")} description={t("pro.profile.recentRecords.desc")} />
            <CardBody>
              {records.length ? <ul className="space-y-1 text-sm">{records.map((r) => <li key={r.id}><Link href={`/record/${r.publicId}`} className="hover:underline">{r.visibility === "PUBLIC" && r.titlePublic ? r.workTitle : humanize(r.contributionRole)}</Link> <span className="text-xs text-ink-3">· {formatMonthYear(r.signedAt, locale === "sv" ? "sv-SE" : "en-GB")} · {r.visibility.toLowerCase()}</span></li>)}</ul> : <p className="text-sm text-ink-3">{t("pro.profile.noRecords")}</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("pro.profile.portfolio")} description={t("pro.profile.portfolio.desc")} />
            <CardBody><PortfolioManager items={data.portfolio.map((p) => ({ id: p.id, title: p.title, url: p.url }))} eligibleRecords={eligibleRecords} /></CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
