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

export default async function ProfessionalProfilePage() {
  const viewer = await requireProfessional();
  const data = await getOwnProfile(viewer);
  if (!data) return null;
  const { profile } = data;
  const [rep, records, eligibleRecords] = await Promise.all([reputationSummary(viewer.userId), publicRecordsForProfessional(viewer.userId, 5), db.select({ id: authorshipRecords.id, workTitle: authorshipRecords.workTitle, publicId: authorshipRecords.publicId }).from(authorshipRecords).where(and(eq(authorshipRecords.professionalUserId, viewer.userId), inArray(authorshipRecords.visibility, ["PUBLIC", "ANONYMIZED"])))]);
  return (
    <div>
      <PageHeader title="My professional profile" description={<span className="inline-flex flex-wrap items-center gap-2"><VerificationBadge status={profile.verificationStatus} />{profile.publishedAt ? <Badge tone="accent">Published</Badge> : <Badge>Not published</Badge>}{profile.publishedAt ? <Link href={`/professionals/${profile.slug}`} className="text-accent underline" target="_blank">View public page</Link> : null}</span>} action={<><LinkButton href="/professional/credentials" variant="outline" size="sm">Languages, expertise & credentials</LinkButton><LinkButton href="/professional/services" variant="outline" size="sm">Services</LinkButton><LinkButton href="/professional/earnings" variant="outline" size="sm">Earnings</LinkButton></>} />
      {!profile.confidentialityAgreementVersion ? <div className="mb-6"><Alert tone="warn" title="Confidentiality agreement not accepted">You need to accept the professional confidentiality agreement before publishing your profile or making offers. <Link href="/professional/agreement" className="underline">Open agreement</Link></Alert></div> : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader title="Profile" description="Self-declared information. Verified items are marked separately." />
          <CardBody>
            <ProfileForm mode="edit" initial={{ displayName: profile.displayName, title: profile.title, bio: profile.bio, country: profile.country ?? "", region: profile.region ?? "", yearsExperience: profile.yearsExperience?.toString() ?? "", availability: profile.availability, typicalTurnaroundDays: profile.typicalTurnaroundDays?.toString() ?? "", externalUrls: profile.externalUrls, photoAttachmentId: profile.photoAttachmentId, published: Boolean(profile.publishedAt) }} />
          </CardBody>
        </Card>
        <div className="space-y-6">
          {rep ? (
            <Card>
              <CardHeader title="Reputation" />
              <CardBody>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-ink-3">Completed</dt><dd>{rep.completedAssignments}</dd>
                  <dt className="text-ink-3">Signed works</dt><dd>{rep.signedWorks}</dd>
                  <dt className="text-ink-3">Rating</dt><dd>{rep.ratingCount ? `${rep.ratingAvg.toFixed(1)} (${rep.ratingCount})` : "—"}</dd>
                  <dt className="text-ink-3">Repeat customers</dt><dd>{rep.repeatCustomers}</dd>
                  <dt className="text-ink-3">On time</dt><dd>{rep.completedAssignments ? `${rep.onTimeRate.toFixed(0)}%` : "—"}</dd>
                  <dt className="text-ink-3">Disputes</dt><dd>{rep.disputeCount}</dd>
                </dl>
              </CardBody>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Recent records" description="Only records the customer made public or anonymized." />
            <CardBody>
              {records.length ? <ul className="space-y-1 text-sm">{records.map((r) => <li key={r.id}><Link href={`/record/${r.publicId}`} className="hover:underline">{r.visibility === "PUBLIC" && r.titlePublic ? r.workTitle : humanize(r.contributionRole)}</Link> <span className="text-xs text-ink-3">· {formatMonthYear(r.signedAt)} · {r.visibility.toLowerCase()}</span></li>)}</ul> : <p className="text-sm text-ink-3">No public records yet.</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Portfolio" description="Platform work can be added only when the customer permitted attribution." />
            <CardBody><PortfolioManager items={data.portfolio.map((p) => ({ id: p.id, title: p.title, url: p.url }))} eligibleRecords={eligibleRecords} /></CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
