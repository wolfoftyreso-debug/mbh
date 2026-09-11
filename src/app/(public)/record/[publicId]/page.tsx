import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicRecord } from "@/server/domain/signing/service";
import { PUBLIC_RECORD_ID_PATTERN } from "@/lib/ids";
import { fingerprint } from "@/lib/hash";
import { formatDate, humanize } from "@/lib/utils";
import { VerificationBadge, Badge } from "@/components/ui/badge";
import { brand } from "@/lib/config/brand";
import { env } from "@/lib/config/env";
import { EmbedSnippet } from "@/components/records/embed-snippet";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  AUTHOR: "Written by",
  EDITOR: "Edited by",
  LANGUAGE_REVIEWER: "Language review by",
  DOMAIN_REVIEWER: "Expert review by",
  FACT_CHECKER: "Fact-checked by",
  TRANSLATOR: "Translated by",
  TRANSLATION_REVIEWER: "Translation reviewed by",
  FINAL_APPROVER: "Approved by",
  KNOWLEDGE_SOURCE: "Subject knowledge provided by",
};

export async function generateMetadata({ params }: { params: Promise<{ publicId: string }> }): Promise<Metadata> {
  const { publicId } = await params;
  const r = PUBLIC_RECORD_ID_PATTERN.test(publicId) ? await getPublicRecord(publicId) : null;
  if (!r) return { title: "Record not found", robots: { index: false } };
  return { title: `Record ${r.publicId}`, description: `${ROLE_LABEL[r.contributionRole]} ${r.professionalName} — ${r.servicePerformed}`, robots: { index: r.visibility === "PUBLIC", follow: true } };
}

export default async function RecordPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const r = PUBLIC_RECORD_ID_PATTERN.test(publicId) ? await getPublicRecord(publicId) : null;
  if (!r) notFound();
  const anonymized = r.visibility === "ANONYMIZED";
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 record-serif">
      <p className="font-sans text-xs uppercase tracking-wider text-ink-3">{brand.name} · Authorship record</p>
      <h1 className="mt-3 text-3xl leading-tight">{r.workTitle ?? `Verified ${r.servicePerformed.toLowerCase()}`}</h1>
      <div className="mt-6 flex flex-wrap items-center gap-2 font-sans">
        <Badge tone={r.status === "VALID" ? "accent" : "danger"}>{r.status}</Badge>
        {anonymized ? <Badge>Confidential work — anonymized record</Badge> : null}
      </div>

      <dl className="mt-8 grid grid-cols-[150px_1fr] gap-y-3 border-t border-line pt-6 text-[15px]">
        <dt className="text-ink-3">{ROLE_LABEL[r.contributionRole] ?? humanize(r.contributionRole)}</dt>
        <dd>
          {r.professionalSlug ? <Link href={`/professionals/${r.professionalSlug}`} className="underline underline-offset-4">{r.professionalName}</Link> : r.professionalName}
          {r.professionalTitle ? <span className="block text-sm text-ink-2">{r.professionalTitle}</span> : null}
        </dd>
        {r.otherContributions.map((c, i) => (
          <>
            <dt key={`dt-${i}`} className="text-ink-3">{ROLE_LABEL[c.role] ?? humanize(c.role)}</dt>
            <dd key={`dd-${i}`}>{c.displayName}{c.displayTitle ? <span className="block text-sm text-ink-2">{c.displayTitle}</span> : null}</dd>
          </>
        ))}
        <dt className="text-ink-3">Service</dt><dd>{r.servicePerformed}</dd>
        <dt className="text-ink-3">Scope</dt><dd>{r.scope}</dd>
        {r.languageCode ? (<><dt className="text-ink-3">Language</dt><dd>{r.languageCode.toUpperCase()}</dd></>) : null}
        <dt className="text-ink-3">Signed</dt><dd>{anonymized ? formatDate(r.signedAt).replace(/^\d+ /, "") : formatDate(r.signedAt)}</dd>
        {r.versionNumber ? (<><dt className="text-ink-3">Version</dt><dd>Version {r.versionNumber}{r.wordCount ? ` · ${r.wordCount} words` : ""}</dd></>) : null}
        <dt className="text-ink-3">Verification</dt>
        <dd className="font-sans"><VerificationBadge status={r.verificationStatusAtSigning} /> <span className="text-xs text-ink-3">at time of signing</span></dd>
        <dt className="text-ink-3">Customer</dt><dd>{r.customerLabel ?? (anonymized ? "Private organization" : "Not disclosed")}</dd>
        {anonymized ? (<><dt className="text-ink-3">Content</dt><dd>Confidential</dd></>) : null}
        {r.contentHash ? (<><dt className="text-ink-3">Fingerprint</dt><dd className="mono text-sm">{fingerprint(r.contentHash)}<span className="block break-all text-xs text-ink-3">sha256:{r.contentHash}</span></dd></>) : null}
        {r.publicationUrl ? (<><dt className="text-ink-3">Published at</dt><dd><a href={r.publicationUrl} rel="noopener nofollow" className="underline underline-offset-4 break-all">{r.publicationUrl}</a></dd></>) : null}
        <dt className="text-ink-3">Record</dt><dd className="mono text-sm">{r.publicId}</dd>
      </dl>

      {r.status === "REVOKED" ? (
        <p className="mt-6 rounded-md bg-danger-soft px-4 py-3 font-sans text-sm text-danger">This record was revoked{r.revokedAt ? ` on ${formatDate(r.revokedAt)}` : ""}. It is retained for transparency but should no longer be relied upon.</p>
      ) : null}

      {r.credentialSnapshot?.credentials?.length || r.credentialSnapshot?.expertise?.length ? (
        <section className="mt-10 border-t border-line pt-6">
          <h2 className="font-sans text-xs uppercase tracking-wider text-ink-3">About the professional (as verified at signing)</h2>
          <ul className="mt-3 space-y-1 text-[15px]">
            {r.credentialSnapshot.credentials?.map((c, i) => (
              <li key={i}>{c.title}{c.issuer ? `, ${c.issuer}` : ""} <span className="font-sans text-xs text-accent">verified</span></li>
            ))}
            {r.credentialSnapshot.expertise?.map((e, i) => (
              <li key={`e${i}`}>Expertise: {e.name} <span className="font-sans text-xs text-accent">verified</span></li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10 border-t border-line pt-6 font-sans text-sm text-ink-2">
        <h2 className="text-xs uppercase tracking-wider text-ink-3">Verification information</h2>
        <p className="mt-3">This record establishes that the named professional deliberately signed the exact artifact version identified above, accepting attribution for the stated service within the stated scope, and shows the verification status the platform had established for them at that moment.</p>
        <p className="mt-2">It does not establish factual truth, originality, copyright ownership, or that the source material was free of AI assistance. If the published content changes after signing, this record remains unchanged and refers only to the signed version.</p>
        {r.contentHash ? (
          <p className="mt-3">
            <Link href={`/record/${r.publicId}/verify`} className="font-medium text-accent underline-offset-4 hover:underline">Check a text or file against this record →</Link>
          </p>
        ) : null}
        <p className="mt-2"><Link href="/verification" className="underline-offset-4 hover:underline">What verification levels mean</Link></p>
      </section>

      {!anonymized && r.status === "VALID" ? <EmbedSnippet publicId={r.publicId} appUrl={env.APP_URL} professionalName={r.professionalName} roleLabel={ROLE_LABEL[r.contributionRole] ?? humanize(r.contributionRole)} /> : null}
    </div>
  );
}
