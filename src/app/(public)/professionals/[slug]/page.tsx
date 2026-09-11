import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicProfile } from "@/server/domain/matching/service";
import { publicCredentials, publicPortfolio, publicRecordsForProfessional } from "@/server/domain/professionals/service";
import { publicReviews, reputationSummary } from "@/server/domain/reviews/service";
import { getViewer } from "@/server/auth/session";
import { Avatar } from "@/components/ui/avatar";
import { Badge, ClaimBadge, VerificationBadge } from "@/components/ui/badge";
import { Stars } from "@/components/ui/stars";
import { LinkButton } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { formatDate, formatMonthYear, humanize } from "@/lib/utils";
import { env } from "@/lib/config/env";
import { brand } from "@/lib/config/brand";
import { db } from "@/server/db";
import { professionalProfiles } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPublicProfile(slug);
  if (!p) return { title: "Professional not found", robots: { index: false } };
  return { title: `${p.displayName} — ${p.title}`, description: p.bio.slice(0, 160), alternates: { canonical: `${env.APP_URL}/professionals/${p.slug}` } };
}

export default async function ProfessionalProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getPublicProfile(slug);
  if (!p) notFound();
  const [viewer, creds, portfolio, records, reviews, rep, profileRow] = await Promise.all([
    getViewer(),
    publicCredentials(p.id),
    publicPortfolio(p.id),
    publicRecordsForProfessional(p.userId),
    publicReviews(p.userId),
    reputationSummary(p.userId),
    db.select({ externalUrls: professionalProfiles.externalUrls, yearsExperience: professionalProfiles.yearsExperience, typicalTurnaroundDays: professionalProfiles.typicalTurnaroundDays }).from(professionalProfiles).where(eq(professionalProfiles.id, p.id)).limit(1),
  ]);
  const extra = profileRow[0];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: p.displayName,
    jobTitle: p.title,
    description: p.bio,
    url: `${env.APP_URL}/professionals/${p.slug}`,
    knowsLanguage: p.languages.map((l) => l.code),
    knowsAbout: p.expertise.map((e) => e.name),
    ...(rep && rep.ratingCount ? { aggregateRating: { "@type": "AggregateRating", ratingValue: rep.ratingAvg, reviewCount: rep.ratingCount, bestRating: 5 } } : {}),
    memberOf: { "@type": "Organization", name: brand.name },
  };
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <Avatar name={p.displayName} photoId={p.photoAttachmentId} size={96} />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">{p.displayName}</h1>
            <VerificationBadge status={p.verificationStatus} />
          </div>
          <p className="mt-1 text-lg text-ink-2">{p.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-3">
            {rep?.ratingCount ? <Stars value={rep.ratingAvg} count={rep.ratingCount} /> : <span>No ratings yet</span>}
            {p.country ? <span>{p.country}{p.region ? `, ${p.region}` : ""}</span> : null}
            <span>Availability: {humanize(p.availability)}</span>
            {extra?.typicalTurnaroundDays ? <span>Typical turnaround {extra.typicalTurnaroundDays} days</span> : null}
          </div>
        </div>
        <div className="flex gap-2">
          {viewer && viewer.userId !== p.userId ? <LinkButton href={`/assignments/new?professional=${p.userId}`}>Invite to an assignment</LinkButton> : viewer ? null : <LinkButton href={`/sign-in?next=/assignments/new?professional=${p.userId}`}>Commission work</LinkButton>}
        </div>
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-[1fr_320px]">
        <div className="space-y-10">
          {p.bio ? (
            <section>
              <h2 className="text-lg font-semibold">About</h2>
              <p className="prose-plain mt-2 text-ink-2">{p.bio}</p>
            </section>
          ) : null}

          <section>
            <h2 className="text-lg font-semibold">Services</h2>
            {p.listings.length ? (
              <div className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
                {p.listings.map((l) => (
                  <div key={l.id} className="flex items-start justify-between gap-4 px-4 py-3">
                    <div>
                      <p className="font-medium">{l.title}</p>
                      <p className="text-xs text-ink-3">{l.categoryName} · {l.turnaroundDays} day turnaround</p>
                    </div>
                    <p className="whitespace-nowrap text-sm">{l.pricingModel === "CUSTOM_QUOTE" ? "Custom quote" : `${formatMoney(l.basePriceMinor, l.currency)}${l.pricingModel === "PER_WORD" ? " / word" : l.pricingModel === "HOURLY" ? " / hour" : ""}`}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-3">No public service listings.</p>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold">Credentials</h2>
            {creds.length ? (
              <ul className="mt-3 space-y-3">
                {creds.map((c) => (
                  <li key={c.id} className="rounded-lg border border-line bg-surface px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{c.title}</p>
                      <ClaimBadge status={c.status} />
                    </div>
                    <p className="text-sm text-ink-2">{[c.issuer, c.field].filter(Boolean).join(" · ")}{c.startYear ? ` · ${c.startYear}${c.endYear ? `–${c.endYear}` : "–present"}` : ""}</p>
                    <p className="text-xs text-ink-3">{humanize(c.type)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-3">No credentials listed.</p>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold">Verified platform work</h2>
            {records.length ? (
              <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
                {records.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div>
                      <Link href={`/record/${r.publicId}`} className="font-medium hover:underline">{r.visibility === "PUBLIC" && r.titlePublic ? r.workTitle : `Verified ${r.servicePerformed.toLowerCase()}`}</Link>
                      <p className="text-xs text-ink-3">{humanize(r.contributionRole)} · {r.languageCode?.toUpperCase() ?? ""} · {formatMonthYear(r.signedAt)}{r.visibility === "ANONYMIZED" ? " · confidential" : ""}</p>
                    </div>
                    <Badge tone={r.status === "VALID" ? "accent" : "danger"}>{r.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-3">No public records yet.</p>
            )}
          </section>

          {portfolio.length ? (
            <section>
              <h2 className="text-lg font-semibold">Selected work</h2>
              <ul className="mt-3 space-y-2">
                {portfolio.map((i) => (
                  <li key={i.id} className="rounded-lg border border-line bg-surface px-4 py-3 text-sm">
                    {i.url ? <a href={i.url} target="_blank" rel="noopener nofollow" className="font-medium hover:underline">{i.title}</a> : <p className="font-medium">{i.title}</p>}
                    {i.description ? <p className="text-ink-2">{i.description}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h2 className="text-lg font-semibold">Reviews</h2>
            {reviews.length ? (
              <ul className="mt-3 space-y-3">
                {reviews.map((r) => (
                  <li key={r.id} className="rounded-lg border border-line bg-surface px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{r.displayName} <span className="font-normal text-ink-3">— {r.context}</span></span>
                      <Stars value={r.rating} />
                    </div>
                    {r.comment ? <p className="mt-1 text-sm text-ink-2">{r.comment}</p> : null}
                    <p className="mt-1 text-xs text-ink-3">{formatDate(r.createdAt)} · verified transaction</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-3">No reviews yet. Only completed, paid assignments can be reviewed.</p>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <div className="rounded-lg border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold">Languages</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {p.languages.map((l) => (
                <li key={l.code} className="flex items-center justify-between gap-2">
                  <span>{l.name} <span className="text-ink-3">· {humanize(l.level)}{l.editorialCapable ? " · editorial" : ""}</span></span>
                  {l.verified ? <Badge tone="accent">Verified</Badge> : <Badge>Self-declared</Badge>}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold">Domain expertise</h2>
            {p.expertise.length ? (
              <ul className="mt-2 space-y-1.5 text-sm">
                {p.expertise.map((e) => (
                  <li key={e.path} className="flex items-center justify-between gap-2">
                    <span>{e.name}{e.years ? <span className="text-ink-3"> · {e.years} yrs</span> : null}</span>
                    {e.verified ? <Badge tone="accent">Verified</Badge> : <Badge>Self-declared</Badge>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-3">Language services only.</p>
            )}
          </div>
          {rep ? (
            <div className="rounded-lg border border-line bg-surface p-4">
              <h2 className="text-sm font-semibold">Reputation</h2>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <dt className="text-ink-3">Completed</dt><dd>{rep.completedAssignments}</dd>
                <dt className="text-ink-3">Signed works</dt><dd>{rep.signedWorks}</dd>
                <dt className="text-ink-3">Repeat customers</dt><dd>{rep.repeatCustomers}</dd>
                <dt className="text-ink-3">On time</dt><dd>{rep.completedAssignments ? `${rep.onTimeRate.toFixed(0)}%` : "—"}</dd>
                <dt className="text-ink-3">Revision rate</dt><dd>{rep.completedAssignments ? `${rep.revisionRate.toFixed(0)}%` : "—"}</dd>
                <dt className="text-ink-3">Disputes</dt><dd>{rep.disputeCount}</dd>
                <dt className="text-ink-3">Years on platform</dt><dd>{rep.yearsActive}</dd>
                {extra?.yearsExperience ? (<><dt className="text-ink-3">Experience</dt><dd>{extra.yearsExperience} years (declared)</dd></>) : null}
              </dl>
              {rep.ratingCount ? (
                <div className="mt-3 space-y-1">
                  {[5, 4, 3, 2, 1].map((s) => (
                    <div key={s} className="flex items-center gap-2 text-xs">
                      <span className="w-3 text-ink-3">{s}</span>
                      <div className="h-1.5 flex-1 rounded bg-surface-2"><div className="h-1.5 rounded bg-warn" style={{ width: `${(rep.distribution[s as 1] / rep.ratingCount) * 100}%` }} /></div>
                      <span className="w-6 text-right text-ink-3">{rep.distribution[s as 1]}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {extra?.externalUrls?.length ? (
            <div className="rounded-lg border border-line bg-surface p-4">
              <h2 className="text-sm font-semibold">Links</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {extra.externalUrls.map((u) => (
                  <li key={u.url}><a href={u.url} target="_blank" rel="noopener nofollow me" className="text-accent hover:underline">{u.label || u.url}</a></li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-xs text-ink-3"><Link href="/verification" className="underline">What verification means</Link></p>
        </aside>
      </div>
    </div>
  );
}
