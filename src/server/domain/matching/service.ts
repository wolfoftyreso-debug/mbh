import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import { assignments, domains, expertiseClaims, languages, professionalLanguages, professionalProfiles, serviceCategories, serviceListings } from "@/server/db/schema";

/**
 * Marketplace discovery and expert matching. Search runs entirely in
 * PostgreSQL (full-text + trigram indexes). Matching considers BOTH language
 * capability and domain expertise, and deliberately avoids over-qualifying.
 */

export interface ProfessionalCard {
  id: string;
  userId: string;
  slug: string;
  displayName: string;
  title: string;
  bio: string;
  country: string | null;
  region: string | null;
  verificationStatus: string;
  availability: string;
  typicalTurnaroundDays: number | null;
  ratingAvg: number;
  ratingCount: number;
  completedAssignments: number;
  signedWorks: number;
  languages: { code: string; name: string; level: string; editorialCapable: boolean; verified: boolean }[];
  expertise: { name: string; path: string; verified: boolean; years: number | null }[];
  listings: { id: string; title: string; categoryName: string; pricingModel: string; basePriceMinor: number; currency: string; turnaroundDays: number }[];
  photoAttachmentId: string | null;
  score?: number;
  matchReasons?: string[];
}

export interface SearchFilters {
  q?: string;
  language?: string;
  service?: string; // category slug
  domain?: string; // domain path prefix
  country?: string;
  verified?: "any" | "identity" | "professional";
  minRating?: number;
  maxPriceMinor?: number;
  availability?: "AVAILABLE" | "LIMITED";
  sort?: "relevance" | "rating" | "experience" | "newest";
  page?: number;
  pageSize?: number;
}

const LANGUAGE_RANK: Record<string, number> = { WORKING: 1, PROFESSIONAL: 2, FULL_PROFESSIONAL: 3, NATIVE: 4 };

async function hydrate(rows: (typeof professionalProfiles.$inferSelect)[]): Promise<ProfessionalCard[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [langs, exps, lists] = await Promise.all([
    db
      .select({ profileId: professionalLanguages.profileId, code: professionalLanguages.languageCode, name: languages.name, level: professionalLanguages.level, editorialCapable: professionalLanguages.editorialCapable, status: professionalLanguages.status })
      .from(professionalLanguages)
      .innerJoin(languages, eq(languages.code, professionalLanguages.languageCode))
      .where(inArray(professionalLanguages.profileId, ids)),
    db
      .select({ profileId: expertiseClaims.profileId, name: domains.name, path: domains.path, status: expertiseClaims.status, years: expertiseClaims.yearsExperience })
      .from(expertiseClaims)
      .innerJoin(domains, eq(domains.id, expertiseClaims.domainId))
      .where(and(inArray(expertiseClaims.profileId, ids), inArray(expertiseClaims.status, ["SELF_DECLARED", "PENDING_REVIEW", "PLATFORM_VERIFIED"]))),
    db
      .select({ profileId: serviceListings.profileId, id: serviceListings.id, title: serviceListings.title, categoryName: serviceCategories.name, pricingModel: serviceListings.pricingModel, basePriceMinor: serviceListings.basePriceMinor, currency: serviceListings.currency, turnaroundDays: serviceListings.turnaroundDays })
      .from(serviceListings)
      .innerJoin(serviceCategories, eq(serviceCategories.id, serviceListings.categoryId))
      .where(and(inArray(serviceListings.profileId, ids), eq(serviceListings.active, true))),
  ]);
  return rows.map((p) => ({
    id: p.id,
    userId: p.userId,
    slug: p.slug,
    displayName: p.displayName,
    title: p.title,
    bio: p.bio,
    country: p.country,
    region: p.region,
    verificationStatus: p.verificationStatus,
    availability: p.availability,
    typicalTurnaroundDays: p.typicalTurnaroundDays,
    ratingAvg: p.ratingAvgX100 / 100,
    ratingCount: p.ratingCount,
    completedAssignments: p.completedAssignments,
    signedWorks: p.signedWorks,
    photoAttachmentId: p.photoAttachmentId,
    languages: langs.filter((l) => l.profileId === p.id).map((l) => ({ code: l.code, name: l.name, level: l.level, editorialCapable: l.editorialCapable, verified: l.status === "PLATFORM_VERIFIED" })),
    expertise: exps.filter((e) => e.profileId === p.id).map((e) => ({ name: e.name, path: e.path, verified: e.status === "PLATFORM_VERIFIED", years: e.years })),
    listings: lists.filter((l) => l.profileId === p.id).map(({ id, title, categoryName, pricingModel, basePriceMinor, currency, turnaroundDays }) => ({ id, title, categoryName, pricingModel, basePriceMinor, currency, turnaroundDays })),
  }));
}

export async function searchProfessionals(filters: SearchFilters): Promise<{ items: ProfessionalCard[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 12));
  const conds: SQL[] = [isNotNull(professionalProfiles.publishedAt), inArray(professionalProfiles.verificationStatus, ["UNVERIFIED", "IDENTITY_VERIFIED", "CREDENTIALS_VERIFIED", "PROFESSIONAL_VERIFIED"])];

  if (filters.q?.trim()) {
    const q = filters.q.trim().slice(0, 100);
    conds.push(or(sql`${professionalProfiles.searchVector} @@ plainto_tsquery('simple', ${q})`, ilike(professionalProfiles.displayName, `%${q}%`), sql`similarity(${professionalProfiles.displayName}, ${q}) > 0.3`)!);
  }
  if (filters.country) conds.push(eq(professionalProfiles.country, filters.country.toUpperCase()));
  if (filters.verified === "identity") conds.push(inArray(professionalProfiles.verificationStatus, ["IDENTITY_VERIFIED", "CREDENTIALS_VERIFIED", "PROFESSIONAL_VERIFIED"]));
  if (filters.verified === "professional") conds.push(eq(professionalProfiles.verificationStatus, "PROFESSIONAL_VERIFIED"));
  if (filters.minRating) conds.push(gte(professionalProfiles.ratingAvgX100, Math.round(filters.minRating * 100)));
  if (filters.availability) conds.push(filters.availability === "AVAILABLE" ? eq(professionalProfiles.availability, "AVAILABLE") : inArray(professionalProfiles.availability, ["AVAILABLE", "LIMITED"]));
  if (filters.language) {
    conds.push(sql`exists (select 1 from professional_language pl where pl.profile_id = ${professionalProfiles.id} and pl.language_code = ${filters.language})`);
  }
  if (filters.domain) {
    conds.push(sql`exists (select 1 from expertise_claim ec join domain d on d.id = ec.domain_id where ec.profile_id = ${professionalProfiles.id} and ec.status in ('SELF_DECLARED','PENDING_REVIEW','PLATFORM_VERIFIED') and (d.path = ${filters.domain} or d.path like ${filters.domain + "/%"}))`);
  }
  if (filters.service || filters.maxPriceMinor) {
    const parts: SQL[] = [sql`sl.profile_id = ${professionalProfiles.id}`, sql`sl.active = true`];
    if (filters.service) parts.push(sql`sc.slug = ${filters.service}`);
    if (filters.maxPriceMinor) parts.push(lte(sql`sl.base_price_minor`, filters.maxPriceMinor));
    conds.push(sql`exists (select 1 from service_listing sl join service_category sc on sc.id = sl.category_id where ${sql.join(parts, sql` and `)})`);
  }

  const where = and(...conds);
  const order =
    filters.sort === "rating"
      ? [desc(professionalProfiles.ratingAvgX100), desc(professionalProfiles.ratingCount)]
      : filters.sort === "experience"
        ? [desc(professionalProfiles.completedAssignments), desc(professionalProfiles.signedWorks)]
        : filters.sort === "newest"
          ? [desc(professionalProfiles.publishedAt)]
          : [
              sql`case ${professionalProfiles.verificationStatus} when 'PROFESSIONAL_VERIFIED' then 0 when 'CREDENTIALS_VERIFIED' then 1 when 'IDENTITY_VERIFIED' then 2 else 3 end`,
              desc(professionalProfiles.ratingAvgX100),
              desc(professionalProfiles.completedAssignments),
              asc(professionalProfiles.displayName),
            ];

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(professionalProfiles).where(where).orderBy(...order).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(professionalProfiles).where(where),
  ]);
  return { items: await hydrate(rows), total: Number(total), page, pageSize };
}

export async function getPublicProfile(slug: string): Promise<ProfessionalCard | null> {
  const [row] = await db.select().from(professionalProfiles).where(and(eq(professionalProfiles.slug, slug), isNotNull(professionalProfiles.publishedAt), inArray(professionalProfiles.verificationStatus, ["UNVERIFIED", "IDENTITY_VERIFIED", "CREDENTIALS_VERIFIED", "PROFESSIONAL_VERIFIED"]))).limit(1);
  if (!row) return null;
  const [card] = await hydrate([row]);
  return card ?? null;
}

/**
 * Suggests professionals for an assignment. Scores language fit (required level,
 * editorial capability), domain fit (taxonomy path containment, verification),
 * verification status, reputation and availability. When domain expertise is
 * NOT_REQUIRED the domain contributes nothing, so a founder-to-writer brief is
 * matched with language professionals rather than expensive experts.
 */
export async function matchProfessionals(assignment: typeof assignments.$inferSelect, limit = 8): Promise<ProfessionalCard[]> {
  const conds: SQL[] = [isNotNull(professionalProfiles.publishedAt), inArray(professionalProfiles.verificationStatus, ["UNVERIFIED", "IDENTITY_VERIFIED", "CREDENTIALS_VERIFIED", "PROFESSIONAL_VERIFIED"]), sql`${professionalProfiles.userId} <> ${assignment.customerUserId}`];
  if (assignment.languageCode) {
    conds.push(sql`exists (select 1 from professional_language pl where pl.profile_id = ${professionalProfiles.id} and pl.language_code = ${assignment.languageCode})`);
  }
  const [requiredDomain] = assignment.domainId ? await db.select({ path: domains.path, name: domains.name }).from(domains).where(eq(domains.id, assignment.domainId)).limit(1) : [];
  if (requiredDomain && (assignment.domainRequirement === "REQUIRED" || assignment.domainRequirement === "VERIFIED_REQUIRED")) {
    const statusFilter = assignment.domainRequirement === "VERIFIED_REQUIRED" ? sql`ec.status = 'PLATFORM_VERIFIED'` : sql`ec.status in ('SELF_DECLARED','PENDING_REVIEW','PLATFORM_VERIFIED')`;
    conds.push(sql`exists (select 1 from expertise_claim ec join domain d on d.id = ec.domain_id where ec.profile_id = ${professionalProfiles.id} and ${statusFilter} and (d.path = ${requiredDomain.path} or ${requiredDomain.path} like d.path || '/%' or d.path like ${requiredDomain.path + "/%"}))`);
  }
  const rows = await db.select().from(professionalProfiles).where(and(...conds)).limit(200);
  const cards = await hydrate(rows);
  const requiredRank = LANGUAGE_RANK[assignment.requiredLanguageLevel] ?? 2;

  type Scored = ProfessionalCard & { score: number; matchReasons: string[] };
  const scored: Scored[] = cards
    .map((c): Scored | null => {
      let score = 0;
      const reasons: string[] = [];
      const lang = c.languages.find((l) => l.code === assignment.languageCode);
      if (assignment.languageCode) {
        if (!lang) return null;
        const rank = LANGUAGE_RANK[lang.level] ?? 1;
        if (rank < requiredRank) return null;
        score += 30 + (rank - requiredRank) * 5;
        reasons.push(`${lang.name}: ${lang.level.replace(/_/g, " ").toLowerCase()}`);
        if (assignment.editorialRequired) {
          if (!lang.editorialCapable) return null;
          score += 10;
          reasons.push("Editorial capability");
        }
        if (lang.verified) score += 5;
      }
      if (requiredDomain && assignment.domainRequirement !== "NOT_REQUIRED") {
        const match = c.expertise.find((e) => e.path === requiredDomain.path || requiredDomain.path.startsWith(e.path + "/") || e.path.startsWith(requiredDomain.path + "/"));
        if (match) {
          score += match.verified ? 30 : 15;
          reasons.push(`${match.verified ? "Verified" : "Declared"} expertise: ${match.name}`);
        } else if (assignment.domainRequirement === "PREFERRED") {
          score -= 5;
        }
      }
      const vs: Record<string, number> = { PROFESSIONAL_VERIFIED: 20, CREDENTIALS_VERIFIED: 14, IDENTITY_VERIFIED: 8, UNVERIFIED: 0 };
      score += vs[c.verificationStatus] ?? 0;
      if (c.verificationStatus !== "UNVERIFIED") reasons.push(c.verificationStatus.replace(/_/g, " ").toLowerCase());
      score += Math.min(10, c.completedAssignments) + (c.ratingCount ? c.ratingAvg * 2 : 0);
      if (c.availability === "AVAILABLE") score += 5;
      else if (c.availability === "UNAVAILABLE") score -= 20;
      return { ...c, score, matchReasons: reasons };
    })
    .filter((c): c is Scored => c !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored;
}

/** Human-readable recommendation of the minimum appropriate competence for a brief. */
export function recommendCompetence(input: { knowledgeSourceType: string; domainRequirement: string; template: string }): { headline: string; detail: string } {
  const customerKnows = ["CUSTOMER_EXPERTISE", "FOUNDER_EXPERTISE", "EMPLOYEE_EXPERTISE", "VOICE_RECORDING", "INTERVIEW"].includes(input.knowledgeSourceType);
  if (input.template === "DOMAIN_REVIEW") {
    return { headline: "Domain reviewer", detail: "A subject-matter expert checks facts and terminology. Add a language editor afterwards only if the text also needs polishing." };
  }
  if (customerKnows && input.domainRequirement === "NOT_REQUIRED") {
    return { headline: "Language professional", detail: "You provide the subject knowledge. A writer or editor turns it into excellent text. No separate domain expert is needed." };
  }
  if (input.domainRequirement === "VERIFIED_REQUIRED") {
    return { headline: "Verified domain expert", detail: "Only professionals with platform-verified expertise in this domain can take the assignment." };
  }
  if (input.domainRequirement === "REQUIRED") {
    return { headline: "Writer with domain expertise", detail: "A professional who combines language competence with the required subject knowledge, or a writer plus a domain reviewer." };
  }
  return { headline: "Language professional", detail: "Domain expertise is preferred but not required; professionals with relevant background rank higher." };
}
