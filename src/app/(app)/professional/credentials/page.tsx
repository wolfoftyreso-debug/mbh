import { asc, eq } from "drizzle-orm";
import { requireProfessional } from "@/server/auth/session";
import { getOwnProfile } from "@/server/domain/professionals/service";
import { db } from "@/server/db";
import { domains, languages } from "@/server/db/schema";
import { PageHeader, Card, CardHeader, CardBody } from "@/components/ui/card";
import { ClaimBadge, VerificationBadge } from "@/components/ui/badge";
import { CredentialsManager, ExpertiseManager, IdentityForm, LanguagesManager } from "@/components/professional/competence-managers";
import { humanize, formatDate } from "@/lib/utils";

export default async function CredentialsPage() {
  const viewer = await requireProfessional();
  const data = await getOwnProfile(viewer);
  if (!data) return null;
  const [langs, doms] = await Promise.all([db.select().from(languages).where(eq(languages.active, true)).orderBy(asc(languages.name)), db.select().from(domains).where(eq(domains.active, true)).orderBy(asc(domains.path))]);
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title="Competence and verification" description={<span className="inline-flex items-center gap-2">Current status: <VerificationBadge status={data.profile.verificationStatus} /></span>} />
      <Card>
        <CardHeader title="Identity verification" description="Upload an identity document. Reviewed by platform staff, stored privately, deleted after 90 days." />
        <CardBody>
          {data.profile.identityVerifiedAt ? <p className="text-sm text-accent">Identity verified on {formatDate(data.profile.identityVerifiedAt)}.</p> : data.identity?.status === "PENDING_REVIEW" ? <p className="text-sm text-ink-2">Your identity document is under review.</p> : <IdentityForm rejectedNote={data.identity?.status === "REJECTED" ? data.identity.notes : null} />}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Languages" description="Speaking a language is not the same as being qualified to edit it professionally. Mark editorial capability only where you work as a professional editor." />
        <CardBody><LanguagesManager current={data.languages.map((l) => ({ code: l.pl.languageCode, name: l.name, level: l.pl.level, editorialCapable: l.pl.editorialCapable, status: l.pl.status }))} languages={langs.map((l) => ({ code: l.code, name: l.name }))} /></CardBody>
      </Card>
      <Card>
        <CardHeader title="Domain expertise" description="Claims are self-declared until the platform reviews evidence. Describe your evidence to request review." />
        <CardBody><ExpertiseManager current={data.expertise.map((e) => ({ id: e.claim.id, domainName: e.domainName, years: e.claim.yearsExperience, status: e.claim.status, description: e.claim.description }))} domains={doms.map((d) => ({ id: d.id, name: d.name, depth: d.depth }))} /></CardBody>
      </Card>
      <Card>
        <CardHeader title="Credentials" description="Education, certifications, memberships, employment, trade qualifications. Attach documentation to request verification." />
        <CardBody>
          {data.credentials.length ? (
            <ul className="mb-4 space-y-2">
              {data.credentials.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line px-3 py-2 text-sm">
                  <span><span className="font-medium">{c.title}</span> <span className="text-ink-3">· {humanize(c.type)}{c.issuer ? ` · ${c.issuer}` : ""}</span></span>
                  <ClaimBadge status={c.status} />
                </li>
              ))}
            </ul>
          ) : null}
          <CredentialsManager existing={data.credentials.map((c) => c.id)} />
        </CardBody>
      </Card>
    </div>
  );
}
