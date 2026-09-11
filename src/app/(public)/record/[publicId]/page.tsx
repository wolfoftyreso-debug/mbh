import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicRecord } from "@/server/domain/signing/service";
import { PUBLIC_RECORD_ID_PATTERN } from "@/lib/ids";
import { fingerprint } from "@/lib/hash";
import { formatDate, formatMonthYear } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { VerificationBadge } from "@/components/ui/status-badge";
import { brand } from "@/lib/config/brand";
import { env } from "@/lib/config/env";
import { EmbedSnippet } from "@/components/records/embed-snippet";
import { getT } from "@/server/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ publicId: string }> }): Promise<Metadata> {
  const { publicId } = await params;
  const r = PUBLIC_RECORD_ID_PATTERN.test(publicId) ? await getPublicRecord(publicId) : null;
  if (!r) return { title: "Record not found", robots: { index: false } };
  const { t } = await getT();
  return { title: `${t("rec.eyebrow")} ${r.publicId}`, description: `${t(`role.${r.contributionRole}`)} ${r.professionalName} · ${r.servicePerformed}`, robots: { index: r.visibility === "PUBLIC", follow: true } };
}

export default async function RecordPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const r = PUBLIC_RECORD_ID_PATTERN.test(publicId) ? await getPublicRecord(publicId) : null;
  if (!r) notFound();
  const { t, locale } = await getT();
  const dl = locale === "sv" ? "sv-SE" : "en-GB";
  const anonymized = r.visibility === "ANONYMIZED";
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 record-serif">
      <p className="font-sans text-xs uppercase tracking-wider text-ink-3">{brand.name} · {t("rec.eyebrow")}</p>
      <h1 className="mt-3 text-3xl leading-tight">{r.workTitle ?? t("rec.verifiedService", { service: r.servicePerformed.toLowerCase() })}</h1>
      <div className="mt-6 flex flex-wrap items-center gap-2 font-sans">
        <Badge tone={r.status === "VALID" ? "accent" : "danger"}>{r.status}</Badge>
        {anonymized ? <Badge>{t("rec.anonymized")}</Badge> : null}
      </div>

      <dl className="mt-8 grid grid-cols-[150px_1fr] gap-y-3 border-t border-line pt-6 text-[15px]">
        <dt className="text-ink-3">{t(`role.${r.contributionRole}`)}</dt>
        <dd>
          {r.professionalSlug ? <Link href={`/professionals/${r.professionalSlug}`} className="underline underline-offset-4">{r.professionalName}</Link> : r.professionalName}
          {r.professionalTitle ? <span className="block text-sm text-ink-2">{r.professionalTitle}</span> : null}
        </dd>
        {r.otherContributions.map((c, i) => (
          <>
            <dt key={`dt-${i}`} className="text-ink-3">{t(`role.${c.role}`)}</dt>
            <dd key={`dd-${i}`}>{c.displayName}{c.displayTitle ? <span className="block text-sm text-ink-2">{c.displayTitle}</span> : null}</dd>
          </>
        ))}
        <dt className="text-ink-3">{t("rec.service")}</dt><dd>{r.servicePerformed}</dd>
        <dt className="text-ink-3">{t("rec.scope")}</dt><dd>{r.scope}</dd>
        {r.languageCode ? (<><dt className="text-ink-3">{t("rec.language")}</dt><dd>{r.languageCode.toUpperCase()}</dd></>) : null}
        <dt className="text-ink-3">{t("rec.signed")}</dt><dd>{anonymized ? formatMonthYear(r.signedAt, dl) : formatDate(r.signedAt, dl)}</dd>
        {r.versionNumber ? (<><dt className="text-ink-3">{t("rec.version")}</dt><dd>{t("rec.version")} {r.versionNumber}{r.wordCount ? ` · ${r.wordCount} ${t("rec.words")}` : ""}</dd></>) : null}
        <dt className="text-ink-3">{t("rec.verification")}</dt>
        <dd className="font-sans"><VerificationBadge status={r.verificationStatusAtSigning} /> <span className="text-xs text-ink-3">{t("rec.atSigning")}</span></dd>
        <dt className="text-ink-3">{t("rec.customer")}</dt><dd>{r.customerLabel === "Private organization" ? t("rec.privateOrg") : r.customerLabel ?? (anonymized ? t("rec.privateOrg") : t("rec.notDisclosed"))}</dd>
        {anonymized ? (<><dt className="text-ink-3">{t("rec.content")}</dt><dd>{t("rec.confidential")}</dd></>) : null}
        {r.contentHash ? (<><dt className="text-ink-3">{t("rec.fingerprint")}</dt><dd className="mono text-sm">{fingerprint(r.contentHash)}<span className="block break-all text-xs text-ink-3">sha256:{r.contentHash}</span></dd></>) : null}
        {r.publicationUrl ? (<><dt className="text-ink-3">{t("rec.publishedAt")}</dt><dd><a href={r.publicationUrl} rel="noopener nofollow" className="underline underline-offset-4 break-all">{r.publicationUrl}</a></dd></>) : null}
        <dt className="text-ink-3">{t("rec.record")}</dt><dd className="mono text-sm">{r.publicId}</dd>
      </dl>

      {r.status === "REVOKED" ? (
        <p className="mt-6 rounded-md bg-danger-soft px-4 py-3 font-sans text-sm text-danger">{t("rec.revoked", { date: r.revokedAt ? ` (${formatDate(r.revokedAt, dl)})` : "" })}</p>
      ) : null}

      {r.credentialSnapshot?.credentials?.length || r.credentialSnapshot?.expertise?.length ? (
        <section className="mt-10 border-t border-line pt-6">
          <h2 className="font-sans text-xs uppercase tracking-wider text-ink-3">{t("rec.aboutPro")}</h2>
          <ul className="mt-3 space-y-1 text-[15px]">
            {r.credentialSnapshot.credentials?.map((c, i) => (
              <li key={i}>{c.title}{c.issuer ? `, ${c.issuer}` : ""} <span className="font-sans text-xs text-accent">{t("rec.verified")}</span></li>
            ))}
            {r.credentialSnapshot.expertise?.map((e, i) => (
              <li key={`e${i}`}>{t("rec.expertise")}: {e.name} <span className="font-sans text-xs text-accent">{t("rec.verified")}</span></li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10 border-t border-line pt-6 font-sans text-sm text-ink-2">
        <h2 className="text-xs uppercase tracking-wider text-ink-3">{t("rec.infoTitle")}</h2>
        <p className="mt-3">{t("rec.info1")}</p>
        <p className="mt-2">{t("rec.info2")}</p>
        {r.contentHash ? (
          <p className="mt-3">
            <Link href={`/record/${r.publicId}/verify`} className="font-medium text-accent underline-offset-4 hover:underline">{t("rec.check")}</Link>
          </p>
        ) : null}
        <p className="mt-2"><Link href="/verification" className="underline-offset-4 hover:underline">{t("rec.levels")}</Link></p>
      </section>

      {!anonymized && r.status === "VALID" ? <EmbedSnippet publicId={r.publicId} appUrl={env.APP_URL} professionalName={r.professionalName} roleLabel={t(`role.${r.contributionRole}`)} /> : null}
    </div>
  );
}
