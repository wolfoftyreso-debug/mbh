import type { MetadataRoute } from "next";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/server/db";
import { authorshipRecords, professionalProfiles } from "@/server/db/schema";
import { env } from "@/lib/config/env";

/** Only explicitly public data is ever listed. Private and anonymized records are excluded. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.APP_URL;
  const staticPages = ["", "/professionals", "/how-it-works", "/verification", "/confidentiality", "/records", "/terms", "/privacy"].map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const }));
  try {
    const pros = await db.select({ slug: professionalProfiles.slug, updatedAt: professionalProfiles.updatedAt }).from(professionalProfiles).where(isNotNull(professionalProfiles.publishedAt)).limit(5000);
    const records = await db.select({ publicId: authorshipRecords.publicId, updatedAt: authorshipRecords.updatedAt }).from(authorshipRecords).where(and(eq(authorshipRecords.visibility, "PUBLIC"), eq(authorshipRecords.status, "VALID"))).limit(5000);
    return [...staticPages, ...pros.map((p) => ({ url: `${base}/professionals/${p.slug}`, lastModified: p.updatedAt })), ...records.map((r) => ({ url: `${base}/record/${r.publicId}`, lastModified: r.updatedAt }))];
  } catch {
    return staticPages;
  }
}
