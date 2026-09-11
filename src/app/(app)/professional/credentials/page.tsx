import { asc, eq } from "drizzle-orm";
import { requireProfessional } from "@/server/auth/session";
import { getOwnProfile } from "@/server/domain/professionals/service";
import { db } from "@/server/db";
import { domains, languages } from "@/server/db/schema";
import { PageHeader, Card, CardHeader, CardBody } from "@/components/ui/card";
import { ClaimBadge } from "@/components/ui/badge";
import { VerificationBadge } from "@/components/ui/status-badge";
import { CredentialsManager, ExpertiseManager, IdentityForm, LanguagesManager, HostedIdentityButton } from "@/components/professional/competence-managers";
import { identityProviderInfo } from "@/server/identity/service";
import { getT } from "@/server/i18n";
import { humanize, formatDate } from "@/lib/utils";

export default async function CredentialsPage() {
  const viewer = await requireProfessional();
  const data = await getOwnProfile(viewer);
  if (!data) return null;
  const identity = identityProviderInfo();
  const { t, locale } = await getT();
  const [langs, doms] = await Promise.all([db.select().from(languages).where(eq(languages.active, true)).orderBy(asc(languages.name)), db.select().from(domains).where(eq(domains.active, true)).orderBy(asc(domains.path))]);
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title={t("pro.comp.title")} description={<span className="inline-flex items-center gap-2">{t("pro.comp.status")} <VerificationBadge status={data.profile.verificationStatus} /></span>} />
      <Card>
        <CardHeader title={t("pro.comp.identity.title")} description={identity.hosted ? t("pro.comp.identity.hosted") : t("pro.comp.identity.manual")} />
        <CardBody>
          {data.profile.identityVerifiedAt ? <p className="text-sm text-accent">{t("pro.comp.identity.verifiedOn", { date: formatDate(data.profile.identityVerifiedAt, locale === "sv" ? "sv-SE" : "en-GB") })}</p> : data.identity?.status === "PENDING_REVIEW" ? <p className="text-sm text-ink-2">{identity.hosted ? t("pro.comp.identity.pendingHosted") : t("pro.comp.identity.pending")}</p> : identity.hosted ? <HostedIdentityButton rejectedNote={data.identity?.status === "REJECTED" ? data.identity.notes : null} /> : <IdentityForm rejectedNote={data.identity?.status === "REJECTED" ? data.identity.notes : null} />}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t("pro.comp.languages.title")} description={t("pro.comp.languages.desc")} />
        <CardBody><LanguagesManager current={data.languages.map((l) => ({ code: l.pl.languageCode, name: l.name, level: l.pl.level, editorialCapable: l.pl.editorialCapable, status: l.pl.status }))} languages={langs.map((l) => ({ code: l.code, name: l.name }))} /></CardBody>
      </Card>
      <Card>
        <CardHeader title={t("pro.comp.expertise.title")} description={t("pro.comp.expertise.desc")} />
        <CardBody><ExpertiseManager current={data.expertise.map((e) => ({ id: e.claim.id, domainName: e.domainName, years: e.claim.yearsExperience, status: e.claim.status, description: e.claim.description }))} domains={doms.map((d) => ({ id: d.id, name: d.name, depth: d.depth }))} /></CardBody>
      </Card>
      <Card>
        <CardHeader title={t("pro.comp.credentials.title")} description={t("pro.comp.credentials.desc")} />
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
