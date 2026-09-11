import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { domains, languages, serviceCategories, users, professionalProfiles, professionalLanguages, expertiseClaims, credentials, serviceListings, agreementAcceptances } from "./schema";
import { newId } from "@/lib/ids";
import { AGREEMENT_VERSIONS } from "@/lib/config/brand";

/**
 * Reference data (languages, domain taxonomy, service categories) is idempotent
 * and safe to run in production. Demo users are only created when
 * SEED_DEMO=true and the development login is enabled.
 */

const LANGUAGES: [string, string, string][] = [
  ["sv", "Swedish", "Svenska"],
  ["en", "English", "English"],
  ["de", "German", "Deutsch"],
  ["fi", "Finnish", "Suomi"],
  ["no", "Norwegian", "Norsk"],
  ["da", "Danish", "Dansk"],
  ["pl", "Polish", "Polski"],
  ["fr", "French", "Français"],
  ["es", "Spanish", "Español"],
  ["nl", "Dutch", "Nederlands"],
  ["it", "Italian", "Italiano"],
  ["pt", "Portuguese", "Português"],
  ["ar", "Arabic", "العربية"],
  ["uk", "Ukrainian", "Українська"],
];

const CATEGORIES: { slug: string; name: string; description: string; kind: "LANGUAGE" | "DOMAIN" | "COMBINED"; role: string }[] = [
  { slug: "writing", name: "Writing from source material", description: "The professional writes new text from notes, recordings, transcripts or documentation you provide.", kind: "LANGUAGE", role: "AUTHOR" },
  { slug: "rewriting", name: "Human rewrite", description: "The professional reads the supplied material and produces a version they genuinely consider their own work.", kind: "LANGUAGE", role: "AUTHOR" },
  { slug: "editing", name: "Editorial review", description: "The professional reviews and materially improves the supplied text.", kind: "LANGUAGE", role: "EDITOR" },
  { slug: "proofreading", name: "Proofreading", description: "Correction of spelling, grammar and punctuation without changing substance.", kind: "LANGUAGE", role: "EDITOR" },
  { slug: "language-review", name: "Professional language review", description: "A qualified language professional reviews grammar, terminology, tone, readability and linguistic quality.", kind: "LANGUAGE", role: "LANGUAGE_REVIEWER" },
  { slug: "translation-review", name: "Translation review", description: "Review of a translation against its source for accuracy and fluency.", kind: "LANGUAGE", role: "TRANSLATION_REVIEWER" },
  { slug: "fact-checking", name: "Fact-checking", description: "Verification of specified factual claims against appropriate sources.", kind: "DOMAIN", role: "FACT_CHECKER" },
  { slug: "subject-matter-review", name: "Subject-matter review", description: "A domain expert reviews material within their documented area of competence.", kind: "DOMAIN", role: "DOMAIN_REVIEWER" },
  { slug: "expert-sign-off", name: "Expert sign-off", description: "A domain expert reviews the final version and explicitly accepts attribution within the defined scope.", kind: "DOMAIN", role: "FINAL_APPROVER" },
  { slug: "final-editorial-approval", name: "Final editorial approval", description: "Final human review and explicit approval of the exact version to be published.", kind: "LANGUAGE", role: "FINAL_APPROVER" },
];

const TAXONOMY: Record<string, string[] | Record<string, string[]>> = {
  Automotive: { "Vehicle repair": ["Diagnostics", "Electrical systems", "Volkswagen Group", "Brakes and chassis"], "Tyres and wheels": [] },
  Manufacturing: { "CNC machining": ["Milling", "Turning", "CAM programming"], "Welding": [], "Quality assurance": [] },
  Construction: { "Electrical installation": [], HVAC: [], Plumbing: [], "Building regulations": [] },
  Finance: { Accounting: ["Swedish accounting (K2/K3)", "Bookkeeping"], "Corporate finance": [], Tax: ["VAT", "Corporate tax"], Insurance: [] },
  Software: { "Backend engineering": [], "Cloud infrastructure": [], Cybersecurity: [], "Data engineering": [] },
  Law: { "Corporate law": [], "Employment law": [], "Contract law": [], "GDPR and privacy": [] },
  Education: { "Secondary education": [], "Swedish language education": [], "Vocational training": [] },
  Healthcare: { "Medical information": [], Nursing: [], Dentistry: [], Pharmacy: [] },
  Engineering: { "Mechanical engineering": [], "Electrical engineering": [], "Civil engineering": [] },
  Logistics: { "EU freight and customs": [], Warehousing: [] },
  "Real estate": { "Property management": [], Brokerage: [] },
  Energy: { "Solar and storage": [], "Heat pumps": [], Grid: [] },
  Agriculture: { Forestry: [], "Crop production": [] },
  Hospitality: { Restaurants: [], Hotels: [] },
  "Industrial automation": { PLC: [], Robotics: [] },
  Marketing: { "Copywriting": [], "SEO": [], "Brand communication": [] },
};

function slug(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function seedReference() {
  for (const [code, name, nativeName] of LANGUAGES) {
    await db.insert(languages).values({ code, name, nativeName }).onConflictDoNothing();
  }
  let sort = 0;
  for (const c of CATEGORIES) {
    await db
      .insert(serviceCategories)
      .values({ slug: c.slug, name: c.name, description: c.description, kind: c.kind, defaultContributionRole: c.role, sortOrder: sort++ })
      .onConflictDoUpdate({ target: serviceCategories.slug, set: { name: c.name, description: c.description, kind: c.kind, defaultContributionRole: c.role } });
  }
  async function ensureDomain(name: string, parent: { id: string; path: string; depth: number } | null): Promise<{ id: string; path: string; depth: number }> {
    const s = slug(name);
    const path = parent ? `${parent.path}/${s}` : s;
    const [existing] = await db.select({ id: domains.id, path: domains.path, depth: domains.depth }).from(domains).where(eq(domains.path, path)).limit(1);
    if (existing) return existing;
    const [row] = await db.insert(domains).values({ id: newId(), parentId: parent?.id ?? null, slug: s, name, path, depth: parent ? parent.depth + 1 : 0 }).returning({ id: domains.id, path: domains.path, depth: domains.depth });
    return row;
  }
  for (const [top, children] of Object.entries(TAXONOMY)) {
    const t = await ensureDomain(top, null);
    if (Array.isArray(children)) {
      for (const c of children) await ensureDomain(c, t);
    } else {
      for (const [mid, leaves] of Object.entries(children)) {
        const m = await ensureDomain(mid, t);
        for (const leaf of leaves) await ensureDomain(leaf, m);
      }
    }
  }
  console.log("Reference data seeded.");
}

async function seedDemo() {
  const { auth } = await import("@/server/auth/config");
  const { env } = await import("@/lib/config/env");
  if (!env.devLoginEnabled) {
    console.log("Demo users skipped (AUTH_DEV_LOGIN is not enabled).");
    return;
  }
  const password = process.env.SEED_DEMO_PASSWORD ?? "humanauth-demo";
  async function ensureUser(email: string, name: string, role: "USER" | "ADMIN" | "SUPER_ADMIN" = "USER"): Promise<string> {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) return existing.id;
    const res = await auth.api.signUpEmail({ body: { email, password, name } });
    const id = res.user.id;
    await db.update(users).set({ platformRole: role, emailVerified: true }).where(eq(users.id, id));
    return id;
  }
  const adminId = await ensureUser("admin@example.com", "Platform Admin", "SUPER_ADMIN");
  const customerId = await ensureUser("customer@example.com", "Erik Svensson");
  const evaId = await ensureUser("eva@example.com", "Eva Svensson");
  const johanId = await ensureUser("johan@example.com", "Johan Karlsson");
  const annaId = await ensureUser("anna@example.com", "Anna Andersson");
  void adminId;
  void customerId;

  const cats = await db.select().from(serviceCategories);
  const cat = (s: string) => cats.find((c) => c.slug === s)!.id;
  const [autoRepair] = await db.select().from(domains).where(eq(domains.path, "automotive/vehicle-repair")).limit(1);
  const [eduSv] = await db.select().from(domains).where(eq(domains.path, "education/swedish-language-education")).limit(1);
  const [copy] = await db.select().from(domains).where(eq(domains.path, "marketing/copywriting")).limit(1);

  async function ensureProfile(userId: string, p: { slug: string; displayName: string; title: string; bio: string; country: string; years: number; status: "UNVERIFIED" | "IDENTITY_VERIFIED" | "CREDENTIALS_VERIFIED" | "PROFESSIONAL_VERIFIED" }) {
    const [existing] = await db.select({ id: professionalProfiles.id }).from(professionalProfiles).where(eq(professionalProfiles.userId, userId)).limit(1);
    if (existing) return existing.id;
    const now = new Date();
    const [row] = await db
      .insert(professionalProfiles)
      .values({ userId, slug: p.slug, displayName: p.displayName, title: p.title, bio: p.bio, country: p.country, yearsExperience: p.years, verificationStatus: p.status, identityVerifiedAt: p.status !== "UNVERIFIED" ? now : null, credentialsVerifiedAt: p.status === "CREDENTIALS_VERIFIED" || p.status === "PROFESSIONAL_VERIFIED" ? now : null, professionalVerifiedAt: p.status === "PROFESSIONAL_VERIFIED" ? now : null, publishedAt: now, confidentialityAgreementVersion: AGREEMENT_VERSIONS.PROFESSIONAL_CONFIDENTIALITY, typicalTurnaroundDays: 4 })
      .returning({ id: professionalProfiles.id });
    await db.insert(agreementAcceptances).values({ userId, agreementType: "PROFESSIONAL_CONFIDENTIALITY", agreementVersion: AGREEMENT_VERSIONS.PROFESSIONAL_CONFIDENTIALITY });
    return row.id;
  }

  const eva = await ensureProfile(evaId, { slug: "eva-svensson", displayName: "Eva Svensson", title: "Swedish language specialist and editor", bio: "Former upper-secondary Swedish teacher, now a full-time editor and writer. I turn expert knowledge into clear, professional Swedish for companies, schools and public organizations.", country: "SE", years: 14, status: "PROFESSIONAL_VERIFIED" });
  await db.insert(professionalLanguages).values([{ profileId: eva, languageCode: "sv", level: "NATIVE", editorialCapable: true, status: "PLATFORM_VERIFIED", verifiedAt: new Date() }, { profileId: eva, languageCode: "en", level: "FULL_PROFESSIONAL", editorialCapable: true }]).onConflictDoNothing();
  if (eduSv) await db.insert(expertiseClaims).values({ profileId: eva, domainId: eduSv.id, yearsExperience: 12, description: "Taught Swedish at upper-secondary level for twelve years.", status: "PLATFORM_VERIFIED", verifiedAt: new Date() }).onConflictDoNothing();
  await db.insert(credentials).values([{ profileId: eva, type: "EDUCATION", title: "Master of Education, Swedish", issuer: "Uppsala University", field: "Swedish language", startYear: 2006, endYear: 2011, status: "PLATFORM_VERIFIED", verifiedAt: new Date() }, { profileId: eva, type: "EMPLOYMENT", title: "Swedish teacher", issuer: "Katedralskolan Uppsala", field: "Secondary education", startYear: 2011, endYear: 2022, status: "PLATFORM_VERIFIED", verifiedAt: new Date() }]);
  await db.insert(serviceListings).values([
    { profileId: eva, categoryId: cat("rewriting"), title: "Swedish editorial rewrite", description: "I rewrite drafts, notes or AI-generated text into professional Swedish I can stand behind.", languageCode: "sv", pricingModel: "PER_WORD", basePriceMinor: 250, currency: "SEK", turnaroundDays: 4, revisionsIncluded: 2 },
    { profileId: eva, categoryId: cat("language-review"), title: "Swedish language quality review", description: "Grammar, terminology, tone and readability review with inline comments.", languageCode: "sv", pricingModel: "FIXED_PRICE", basePriceMinor: 350000, currency: "SEK", turnaroundDays: 3, revisionsIncluded: 1 },
    { profileId: eva, categoryId: cat("writing"), title: "From recording to finished Swedish text", description: "Send me a voice recording or rough notes. I write the article, product page or FAQ.", languageCode: "sv", pricingModel: "FIXED_PRICE", basePriceMinor: 650000, currency: "SEK", turnaroundDays: 5, revisionsIncluded: 2 },
  ]);

  const johan = await ensureProfile(johanId, { slug: "johan-karlsson", displayName: "Johan Karlsson", title: "Automotive technician, diagnostics specialist", bio: "Twenty years in workshops, the last eight as diagnostics lead for Volkswagen Group vehicles. I review technical content for correctness and terminology.", country: "SE", years: 20, status: "CREDENTIALS_VERIFIED" });
  await db.insert(professionalLanguages).values([{ profileId: johan, languageCode: "sv", level: "NATIVE", editorialCapable: false }]).onConflictDoNothing();
  if (autoRepair) await db.insert(expertiseClaims).values({ profileId: johan, domainId: autoRepair.id, yearsExperience: 20, description: "Workshop technician and diagnostics lead.", status: "PLATFORM_VERIFIED", verifiedAt: new Date() }).onConflictDoNothing();
  await db.insert(credentials).values([{ profileId: johan, type: "TRADE_QUALIFICATION", title: "Certified automotive technician", issuer: "Motorbranschens Yrkesnämnd", field: "Vehicle repair", startYear: 2006, endYear: null, status: "PLATFORM_VERIFIED", verifiedAt: new Date() }]);
  await db.insert(serviceListings).values([{ profileId: johan, categoryId: cat("subject-matter-review"), title: "Automotive technical review", description: "I mark technical errors, misleading claims and terminology mistakes in automotive content.", languageCode: "sv", domainId: autoRepair?.id ?? null, pricingModel: "HOURLY", basePriceMinor: 95000, currency: "SEK", turnaroundDays: 3, revisionsIncluded: 0 }]);

  const anna = await ensureProfile(annaId, { slug: "anna-andersson", displayName: "Anna Andersson", title: "Professional copywriter", bio: "Copywriter for B2B and industrial companies. Swedish and English.", country: "SE", years: 9, status: "IDENTITY_VERIFIED" });
  await db.insert(professionalLanguages).values([{ profileId: anna, languageCode: "sv", level: "NATIVE", editorialCapable: true }, { profileId: anna, languageCode: "en", level: "PROFESSIONAL", editorialCapable: true }]).onConflictDoNothing();
  if (copy) await db.insert(expertiseClaims).values({ profileId: anna, domainId: copy.id, yearsExperience: 9, description: "Agency and freelance copywriting.", status: "SELF_DECLARED" }).onConflictDoNothing();
  await db.insert(serviceListings).values([{ profileId: anna, categoryId: cat("writing"), title: "Swedish B2B copywriting", description: "Web copy, product pages and articles from your brief or recording.", languageCode: "sv", pricingModel: "FIXED_PRICE", basePriceMinor: 480000, currency: "SEK", turnaroundDays: 5, revisionsIncluded: 2 }]);

  console.log(`Demo users seeded (password: ${password}).`);
}

async function main() {
  await seedReference();
  if (process.env.SEED_DEMO === "true") await seedDemo();
  await db.execute(sql`select 1`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
