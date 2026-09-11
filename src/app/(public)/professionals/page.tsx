import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { domains, languages, serviceCategories } from "@/server/db/schema";
import { searchProfessionals, type SearchFilters } from "@/server/domain/matching/service";
import { ProfessionalCard } from "@/components/marketplace/professional-card";
import { Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";

export const metadata = { title: "Find professionals", description: "Verified human writers, editors, reviewers and domain experts." };
export const dynamic = "force-dynamic";

export default async function ProfessionalsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const filters: SearchFilters = {
    q: sp.q,
    language: sp.language || undefined,
    service: sp.service || undefined,
    domain: sp.domain || undefined,
    country: sp.country || undefined,
    verified: (sp.verified as SearchFilters["verified"]) || "any",
    minRating: sp.rating ? Number(sp.rating) : undefined,
    maxPriceMinor: sp.maxPrice ? Math.round(Number(sp.maxPrice) * 100) : undefined,
    availability: (sp.availability as SearchFilters["availability"]) || undefined,
    sort: (sp.sort as SearchFilters["sort"]) || "relevance",
    page: sp.page ? Number(sp.page) : 1,
  };
  const [result, langs, cats, doms] = await Promise.all([
    searchProfessionals(filters),
    db.select().from(languages).where(eq(languages.active, true)).orderBy(asc(languages.name)),
    db.select().from(serviceCategories).where(eq(serviceCategories.active, true)).orderBy(asc(serviceCategories.sortOrder)),
    db.select().from(domains).where(eq(domains.active, true)).orderBy(asc(domains.path)),
  ]);
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const qs = (page: number) => {
    const p = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    p.set("page", String(page));
    return `/professionals?${p.toString()}`;
  };
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Find professionals</h1>
      <p className="mt-2 max-w-2xl text-ink-2">Language competence and domain expertise are listed separately. Verified information is marked; everything else is self-declared.</p>
      <form className="mt-8 grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-4" method="get">
        <Input name="q" placeholder="Search by name or keyword" defaultValue={sp.q ?? ""} className="md:col-span-2" />
        <Select name="language" defaultValue={sp.language ?? ""}>
          <option value="">Any language</option>
          {langs.map((l) => (
            <option key={l.code} value={l.code}>{l.name}</option>
          ))}
        </Select>
        <Select name="service" defaultValue={sp.service ?? ""}>
          <option value="">Any service</option>
          {cats.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </Select>
        <Select name="domain" defaultValue={sp.domain ?? ""}>
          <option value="">Any domain expertise</option>
          {doms.map((d) => (
            <option key={d.path} value={d.path}>{" ".repeat(d.depth * 2)}{d.name}</option>
          ))}
        </Select>
        <Select name="verified" defaultValue={sp.verified ?? "any"}>
          <option value="any">Any verification</option>
          <option value="identity">Identity verified or better</option>
          <option value="professional">Professional verified only</option>
        </Select>
        <Select name="rating" defaultValue={sp.rating ?? ""}>
          <option value="">Any rating</option>
          <option value="4">4.0 and above</option>
          <option value="4.5">4.5 and above</option>
        </Select>
        <Select name="availability" defaultValue={sp.availability ?? ""}>
          <option value="">Any availability</option>
          <option value="AVAILABLE">Available now</option>
          <option value="LIMITED">Available or limited</option>
        </Select>
        <Input name="country" placeholder="Country (ISO, e.g. SE)" defaultValue={sp.country ?? ""} maxLength={2} />
        <Input name="maxPrice" type="number" min={0} placeholder="Max base price" defaultValue={sp.maxPrice ?? ""} />
        <Select name="sort" defaultValue={sp.sort ?? "relevance"}>
          <option value="relevance">Sort: relevance</option>
          <option value="rating">Sort: rating</option>
          <option value="experience">Sort: experience</option>
          <option value="newest">Sort: newest</option>
        </Select>
        <Button type="submit">Search</Button>
      </form>
      <p className="mt-6 text-sm text-ink-3">{result.total} professional{result.total === 1 ? "" : "s"}</p>
      {result.items.length ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {result.items.map((p) => (
            <ProfessionalCard key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState title="No professionals match these filters" description="Try removing a filter or searching a broader domain." />
        </div>
      )}
      {pages > 1 ? (
        <nav className="mt-8 flex items-center justify-center gap-2 text-sm">
          {result.page > 1 ? <Link href={qs(result.page - 1)} className="rounded-md border border-line px-3 py-1.5">Previous</Link> : null}
          <span className="text-ink-3">Page {result.page} of {pages}</span>
          {result.page < pages ? <Link href={qs(result.page + 1)} className="rounded-md border border-line px-3 py-1.5">Next</Link> : null}
        </nav>
      ) : null}
    </div>
  );
}
