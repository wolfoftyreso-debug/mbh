import Link from "next/link";
import { brand } from "@/lib/config/brand";
import { LinkButton } from "@/components/ui/button";
import { db } from "@/server/db";
import { serviceCategories } from "@/server/db/schema";
import { asc, eq } from "drizzle-orm";

export const revalidate = 300;

export default async function HomePage() {
  const categories = await db.select({ slug: serviceCategories.slug, name: serviceCategories.name, description: serviceCategories.description }).from(serviceCategories).where(eq(serviceCategories.active, true)).orderBy(asc(serviceCategories.sortOrder)).catch(() => []);
  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="py-20 md:py-28">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Verified human authorship, review and expert sign-off</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">A real person stands behind this text. Provably.</h1>
        <p className="mt-6 max-w-2xl text-lg text-ink-2">
          Text is abundant. Accountability is not. {brand.name} connects you with identifiable, verified professionals who write, review, fact-check and sign the exact version you publish — and gives you a permanent record of who took responsibility for what.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <LinkButton href="/sign-in?next=/assignments/new" size="lg">Commission human work</LinkButton>
          <LinkButton href="/professionals" size="lg" variant="outline">Find a professional</LinkButton>
        </div>
        <p className="mt-6 text-sm text-ink-3">Not an AI detector. Not a content mill. A marketplace for human competence applied to information, with a chain of responsibility you can show your readers.</p>
      </section>

      <section className="grid gap-6 border-t border-line py-16 md:grid-cols-3">
        {[
          ["Who knew the subject", "A founder records eighteen minutes explaining how their product works. That knowledge is the source, and it is credited as such."],
          ["Who wrote the words", "A language professional turns notes, transcripts or rough drafts into text they genuinely consider their own work."],
          ["Who checked and signed", "A domain expert marks what is incorrect, imprecise or misleading. A named human signs the exact final version."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-lg border border-line bg-surface p-6">
            <h2 className="font-semibold">{t}</h2>
            <p className="mt-2 text-sm text-ink-2">{d}</p>
          </div>
        ))}
      </section>

      <section className="border-t border-line py-16">
        <div className="grid gap-10 md:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Person + work + version + responsibility + verification</h2>
            <p className="mt-4 text-ink-2">Every signed version gets a permanent authorship record with an opaque identifier, a cryptographic fingerprint of the exact artifact, the service performed, the scope accepted and the professional&apos;s verification status at the moment of signing.</p>
            <p className="mt-4 text-ink-2">Publish the record, embed a small attribution on your site, or keep it private. Confidential work still counts towards a professional&apos;s reputation without exposing what was written or for whom.</p>
            <div className="mt-6 flex gap-3">
              <Link href="/verification" className="text-sm font-medium text-accent underline-offset-4 hover:underline">What verification means</Link>
              <Link href="/confidentiality" className="text-sm font-medium text-accent underline-offset-4 hover:underline">How confidentiality works</Link>
            </div>
          </div>
          <div className="rounded-lg border border-line bg-surface p-6 record-serif">
            <p className="text-xs uppercase tracking-wider text-ink-3 font-sans">Example authorship record</p>
            <p className="mt-3 text-xl">How DSG servicing actually works</p>
            <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-2 text-sm">
              <dt className="text-ink-3">Knowledge</dt><dd>Erik Svensson, workshop owner</dd>
              <dt className="text-ink-3">Written by</dt><dd>Eva Svensson, Swedish language specialist</dd>
              <dt className="text-ink-3">Reviewed by</dt><dd>Johan Karlsson, automotive technician</dd>
              <dt className="text-ink-3">Signed</dt><dd>Version 4 · 11 September 2026</dd>
              <dt className="text-ink-3">Fingerprint</dt><dd className="mono text-xs">9F2A 71C0 3B8E D144</dd>
              <dt className="text-ink-3">Status</dt><dd className="text-accent">Valid</dd>
            </dl>
          </div>
        </div>
      </section>

      <section className="border-t border-line py-16">
        <h2 className="text-2xl font-semibold tracking-tight">Services</h2>
        <p className="mt-2 max-w-2xl text-ink-2">Language competence and domain competence are different resources. Buy exactly the human competence the work needs — no more, no less.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <Link key={c.slug} href={`/professionals?service=${c.slug}`} className="rounded-lg border border-line bg-surface p-5 transition-colors hover:border-line-strong">
              <p className="font-medium">{c.name}</p>
              <p className="mt-1 text-sm text-ink-3">{c.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-line py-16">
        <h2 className="text-2xl font-semibold tracking-tight">Three ways to work</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            ["You know the subject", "Record yourself or drop your notes. A language professional writes it. You are credited as the knowledge source; they sign the words.", "Knowledge owner → language professional"],
            ["Writer + domain expert", "A copywriter writes, an automotive technician checks the terminology, the writer corrects, an editor finalizes. Each signs their own responsibility.", "Two professionals, two signatures"],
            ["Expert review on demand", "Already have 30 agency articles and nobody knows if they are technically right? Buy two hours of verified domain review.", "Domain review as a standalone service"],
          ].map(([t, d, tag]) => (
            <div key={t} className="rounded-lg border border-line bg-surface p-6">
              <p className="text-xs uppercase tracking-wider text-ink-3">{tag}</p>
              <h3 className="mt-2 font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-ink-2">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="my-16 rounded-lg bg-accent px-8 py-12 text-white">
        <h2 className="text-2xl font-semibold tracking-tight">Are you a professional?</h2>
        <p className="mt-2 max-w-2xl text-white/80">Editors, translators, technicians, accountants, engineers, lawyers, teachers. If you can stand behind your work, there is a market for it.</p>
        <LinkButton href="/sign-in?next=/professional/onboarding" variant="secondary" className="mt-6">Create a professional profile</LinkButton>
      </section>
    </div>
  );
}
