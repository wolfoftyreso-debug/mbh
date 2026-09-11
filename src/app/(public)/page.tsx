import Link from "next/link";
import { brand } from "@/lib/config/brand";
import { LinkButton } from "@/components/ui/button";
import { db } from "@/server/db";
import { serviceCategories } from "@/server/db/schema";
import { asc, eq } from "drizzle-orm";
import { getT } from "@/server/i18n";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [{ t }, categories] = await Promise.all([getT(), db.select({ slug: serviceCategories.slug, name: serviceCategories.name, description: serviceCategories.description }).from(serviceCategories).where(eq(serviceCategories.active, true)).orderBy(asc(serviceCategories.sortOrder)).catch(() => [])]);
  const who = [
    [t("home.who1.title"), t("home.who1.body")],
    [t("home.who2.title"), t("home.who2.body")],
    [t("home.who3.title"), t("home.who3.body")],
  ];
  const modes = [
    [t("home.modes.1.title"), t("home.modes.1.body"), t("home.modes.1.tag")],
    [t("home.modes.2.title"), t("home.modes.2.body"), t("home.modes.2.tag")],
    [t("home.modes.3.title"), t("home.modes.3.body"), t("home.modes.3.tag")],
  ];
  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="py-20 md:py-28">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-3">{t("home.eyebrow")}</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">{t("home.title")}</h1>
        <p className="mt-6 max-w-2xl text-lg text-ink-2">{t("home.lead", { brand: brand.name })}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <LinkButton href="/sign-in?next=/assignments/new" size="lg">{t("home.ctaCommission")}</LinkButton>
          <LinkButton href="/professionals" size="lg" variant="outline">{t("home.ctaFind")}</LinkButton>
        </div>
        <p className="mt-6 text-sm text-ink-3">{t("home.notA")}</p>
      </section>

      <section className="grid gap-6 border-t border-line py-16 md:grid-cols-3">
        {who.map(([title, body]) => (
          <div key={title} className="rounded-lg border border-line bg-surface p-6">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-ink-2">{body}</p>
          </div>
        ))}
      </section>

      <section className="border-t border-line py-16">
        <div className="grid gap-10 md:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{t("home.chain.title")}</h2>
            <p className="mt-4 text-ink-2">{t("home.chain.p1")}</p>
            <p className="mt-4 text-ink-2">{t("home.chain.p2")}</p>
            <div className="mt-6 flex gap-3">
              <Link href="/verification" className="text-sm font-medium text-accent underline-offset-4 hover:underline">{t("footer.whatVerificationMeans")}</Link>
              <Link href="/confidentiality" className="text-sm font-medium text-accent underline-offset-4 hover:underline">{t("nav.confidentiality")}</Link>
            </div>
          </div>
          <div className="rounded-lg border border-line bg-surface p-6 record-serif">
            <p className="text-xs uppercase tracking-wider text-ink-3 font-sans">{t("home.example.eyebrow")}</p>
            <p className="mt-3 text-xl">{t("home.example.title")}</p>
            <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-2 text-sm">
              <dt className="text-ink-3">{t("home.example.knowledge")}</dt><dd>Erik Svensson</dd>
              <dt className="text-ink-3">{t("home.example.writtenBy")}</dt><dd>Eva Svensson</dd>
              <dt className="text-ink-3">{t("home.example.reviewedBy")}</dt><dd>Johan Karlsson</dd>
              <dt className="text-ink-3">{t("home.example.signed")}</dt><dd>Version 4 · 2026-09-11</dd>
              <dt className="text-ink-3">{t("home.example.fingerprint")}</dt><dd className="mono text-xs">9F2A 71C0 3B8E D144</dd>
              <dt className="text-ink-3">{t("home.example.status")}</dt><dd className="text-accent">{t("home.example.valid")}</dd>
            </dl>
          </div>
        </div>
      </section>

      <section className="border-t border-line py-16">
        <h2 className="text-2xl font-semibold tracking-tight">{t("home.services.title")}</h2>
        <p className="mt-2 max-w-2xl text-ink-2">{t("home.services.lead")}</p>
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
        <h2 className="text-2xl font-semibold tracking-tight">{t("home.modes.title")}</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {modes.map(([title, body, tag]) => (
            <div key={title} className="rounded-lg border border-line bg-surface p-6">
              <p className="text-xs uppercase tracking-wider text-ink-3">{tag}</p>
              <h3 className="mt-2 font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-ink-2">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="my-16 rounded-lg bg-accent px-8 py-12 text-white">
        <h2 className="text-2xl font-semibold tracking-tight">{t("home.pro.title")}</h2>
        <p className="mt-2 max-w-2xl text-white/80">{t("home.pro.body")}</p>
        <LinkButton href="/sign-in?next=/professional/onboarding" variant="secondary" className="mt-6">{t("home.pro.cta")}</LinkButton>
      </section>
    </div>
  );
}
