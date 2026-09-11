import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import {
  agreementAcceptances,
  authorshipRecords,
  credentialDocuments,
  credentials,
  domains,
  expertiseClaims,
  identityVerifications,
  languages,
  portfolioItems,
  professionalLanguages,
  professionalProfiles,
  serviceCategories,
  serviceListings,
  attachments,
} from "@/server/db/schema";
import { slugify } from "@/lib/utils";
import { AGREEMENT_VERSIONS } from "@/lib/config/brand";
import { audit } from "@/server/audit/log";
import { ConflictError, ValidationError } from "@/server/security/errors";
import { requestContext } from "@/server/security/request";
import { rateLimit } from "@/server/security/rate-limit";
import type { Viewer } from "@/server/auth/session";
import { AuthorizationError } from "@/server/authz/policy";

type Profile = typeof professionalProfiles.$inferSelect;

async function uniqueSlug(base: string): Promise<string> {
  const slug = slugify(base);
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
    const [existing] = await db.select({ id: professionalProfiles.id }).from(professionalProfiles).where(eq(professionalProfiles.slug, candidate)).limit(1);
    if (!existing) return candidate;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

export async function createProfile(viewer: Viewer, input: { displayName: string; title: string; bio: string; country: string | null; region: string | null; yearsExperience: number | null }): Promise<Profile> {
  if (viewer.professionalProfileId) throw new ConflictError("You already have a professional profile");
  if (input.displayName.trim().length < 2) throw new ValidationError("Display name is required");
  const slug = await uniqueSlug(input.displayName);
  const [profile] = await db
    .insert(professionalProfiles)
    .values({ userId: viewer.userId, slug, displayName: input.displayName.trim(), title: input.title.trim(), bio: input.bio.trim(), country: input.country?.toUpperCase() ?? null, region: input.region, yearsExperience: input.yearsExperience })
    .returning();
  await audit({ actorType: "USER", actorUserId: viewer.userId, action: "PROFILE_CREATED", entityType: "professional_profile", entityId: profile.id });
  return profile;
}

export async function updateProfile(viewer: Viewer, patch: Partial<Pick<Profile, "displayName" | "title" | "bio" | "country" | "region" | "yearsExperience" | "availability" | "typicalTurnaroundDays" | "externalUrls" | "photoAttachmentId">>): Promise<void> {
  if (!viewer.professionalProfileId) throw new AuthorizationError("No professional profile");
  if (patch.externalUrls) {
    for (const u of patch.externalUrls) {
      try {
        const parsed = new URL(u.url);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      } catch {
        throw new ValidationError(`Invalid URL: ${u.url}`);
      }
    }
  }
  if (patch.photoAttachmentId) {
    const [att] = await db.select({ id: attachments.id }).from(attachments).where(and(eq(attachments.id, patch.photoAttachmentId), eq(attachments.ownerUserId, viewer.userId), eq(attachments.purpose, "PROFILE_PHOTO"))).limit(1);
    if (!att) throw new ValidationError("Invalid photo");
  }
  await db.update(professionalProfiles).set({ ...patch, country: patch.country ? patch.country.toUpperCase() : patch.country }).where(eq(professionalProfiles.id, viewer.professionalProfileId));
  await audit({ actorType: "USER", actorUserId: viewer.userId, action: "PROFILE_UPDATED", entityType: "professional_profile", entityId: viewer.professionalProfileId, metadata: { fields: Object.keys(patch) } });
}

/** Publishing the public profile is an explicit action (private by default). */
export async function setProfilePublished(viewer: Viewer, published: boolean): Promise<void> {
  if (!viewer.professionalProfileId) throw new AuthorizationError("No professional profile");
  if (published) {
    const langs = await db.select({ id: professionalLanguages.id }).from(professionalLanguages).where(eq(professionalLanguages.profileId, viewer.professionalProfileId)).limit(1);
    if (!langs.length) throw new ValidationError("Add at least one language before publishing your profile");
    if (!(await hasAcceptedAgreement(viewer.userId, "PROFESSIONAL_CONFIDENTIALITY"))) throw new ValidationError("Accept the professional confidentiality agreement before publishing");
  }
  await db.update(professionalProfiles).set({ publishedAt: published ? new Date() : null }).where(eq(professionalProfiles.id, viewer.professionalProfileId));
  await audit({ actorType: "USER", actorUserId: viewer.userId, action: published ? "PROFILE_PUBLISHED" : "PROFILE_UNPUBLISHED", entityType: "professional_profile", entityId: viewer.professionalProfileId });
}

export async function hasAcceptedAgreement(userId: string, type: "PROFESSIONAL_CONFIDENTIALITY" | "TERMS_OF_SERVICE"): Promise<boolean> {
  const [row] = await db
    .select({ id: agreementAcceptances.id })
    .from(agreementAcceptances)
    .where(and(eq(agreementAcceptances.userId, userId), eq(agreementAcceptances.agreementType, type), eq(agreementAcceptances.agreementVersion, AGREEMENT_VERSIONS[type])))
    .limit(1);
  return Boolean(row);
}

export async function acceptAgreement(viewer: Viewer, type: "PROFESSIONAL_CONFIDENTIALITY" | "TERMS_OF_SERVICE", assignmentId: string | null = null): Promise<void> {
  const req = await requestContext();
  const version = AGREEMENT_VERSIONS[type];
  await db.insert(agreementAcceptances).values({ userId: viewer.userId, agreementType: type, agreementVersion: version, assignmentId, ipHash: req.ipHash });
  if (type === "PROFESSIONAL_CONFIDENTIALITY" && viewer.professionalProfileId) {
    await db.update(professionalProfiles).set({ confidentialityAgreementVersion: version }).where(eq(professionalProfiles.id, viewer.professionalProfileId));
  }
  await audit({ actorType: "USER", actorUserId: viewer.userId, action: "AGREEMENT_ACCEPTED", entityType: "agreement", entityId: `${type}:${version}`, assignmentId, ipHash: req.ipHash, metadata: { type, version } });
}

/* ---------------- Languages ---------------- */

export async function upsertLanguage(viewer: Viewer, input: { languageCode: string; level: "NATIVE" | "FULL_PROFESSIONAL" | "PROFESSIONAL" | "WORKING"; editorialCapable: boolean }): Promise<void> {
  if (!viewer.professionalProfileId) throw new AuthorizationError("No professional profile");
  const [lang] = await db.select({ code: languages.code }).from(languages).where(and(eq(languages.code, input.languageCode), eq(languages.active, true))).limit(1);
  if (!lang) throw new ValidationError("Unknown language");
  await db
    .insert(professionalLanguages)
    .values({ profileId: viewer.professionalProfileId, languageCode: input.languageCode, level: input.level, editorialCapable: input.editorialCapable })
    .onConflictDoUpdate({ target: [professionalLanguages.profileId, professionalLanguages.languageCode], set: { level: input.level, editorialCapable: input.editorialCapable, status: "SELF_DECLARED", verifiedAt: null } });
  await audit({ actorType: "USER", actorUserId: viewer.userId, action: "PROFILE_UPDATED", entityType: "professional_profile", entityId: viewer.professionalProfileId, metadata: { language: input.languageCode, level: input.level } });
}

export async function removeLanguage(viewer: Viewer, languageCode: string): Promise<void> {
  if (!viewer.professionalProfileId) throw new AuthorizationError("No professional profile");
  await db.delete(professionalLanguages).where(and(eq(professionalLanguages.profileId, viewer.professionalProfileId), eq(professionalLanguages.languageCode, languageCode)));
}

/* ---------------- Expertise claims ---------------- */

export async function claimExpertise(viewer: Viewer, input: { domainId: string; yearsExperience: number | null; description: string; evidenceSummary: string }): Promise<void> {
  if (!viewer.professionalProfileId) throw new AuthorizationError("No professional profile");
  const [d] = await db.select({ id: domains.id }).from(domains).where(and(eq(domains.id, input.domainId), eq(domains.active, true))).limit(1);
  if (!d) throw new ValidationError("Unknown domain");
  await db
    .insert(expertiseClaims)
    .values({ profileId: viewer.professionalProfileId, domainId: input.domainId, yearsExperience: input.yearsExperience, description: input.description.slice(0, 2000), evidenceSummary: input.evidenceSummary.slice(0, 2000), status: input.evidenceSummary.trim() ? "PENDING_REVIEW" : "SELF_DECLARED" })
    .onConflictDoUpdate({ target: [expertiseClaims.profileId, expertiseClaims.domainId], set: { yearsExperience: input.yearsExperience, description: input.description.slice(0, 2000), evidenceSummary: input.evidenceSummary.slice(0, 2000) } });
  await audit({ actorType: "USER", actorUserId: viewer.userId, action: "EXPERTISE_CLAIMED", entityType: "expertise_claim", entityId: `${viewer.professionalProfileId}:${input.domainId}`, metadata: { domainId: input.domainId } });
}

export async function removeExpertise(viewer: Viewer, claimId: string): Promise<void> {
  if (!viewer.professionalProfileId) throw new AuthorizationError("No professional profile");
  await db.delete(expertiseClaims).where(and(eq(expertiseClaims.id, claimId), eq(expertiseClaims.profileId, viewer.professionalProfileId)));
}

/* ---------------- Credentials ---------------- */

export async function addCredential(viewer: Viewer, input: { type: typeof credentials.$inferSelect.type; title: string; issuer: string; field: string; startYear: number | null; endYear: number | null; description: string; publicVisible: boolean; documentAttachmentIds: string[] }): Promise<string> {
  if (!viewer.professionalProfileId) throw new AuthorizationError("No professional profile");
  if (input.title.trim().length < 2) throw new ValidationError("Title is required");
  await rateLimit(`credential:${viewer.userId}`, 50, 86400);
  if (input.documentAttachmentIds.length) {
    const owned = await db.select({ id: attachments.id }).from(attachments).where(and(inArray(attachments.id, input.documentAttachmentIds), eq(attachments.ownerUserId, viewer.userId), eq(attachments.purpose, "VERIFICATION_DOCUMENT")));
    if (owned.length !== input.documentAttachmentIds.length) throw new ValidationError("Invalid verification document");
  }
  return db.transaction(async (tx) => {
    const [c] = await tx
      .insert(credentials)
      .values({ profileId: viewer.professionalProfileId!, type: input.type, title: input.title.trim(), issuer: input.issuer.trim(), field: input.field.trim(), startYear: input.startYear, endYear: input.endYear, description: input.description.slice(0, 2000), publicVisible: input.publicVisible, status: input.documentAttachmentIds.length ? "PENDING_REVIEW" : "SELF_DECLARED" })
      .returning({ id: credentials.id });
    if (input.documentAttachmentIds.length) await tx.insert(credentialDocuments).values(input.documentAttachmentIds.map((attachmentId) => ({ credentialId: c.id, attachmentId })));
    await audit({ actorType: "USER", actorUserId: viewer.userId, action: "CREDENTIAL_SUBMITTED", entityType: "credential", entityId: c.id, metadata: { type: input.type, documents: input.documentAttachmentIds.length } }, tx);
    return c.id;
  });
}

export async function removeCredential(viewer: Viewer, credentialId: string): Promise<void> {
  if (!viewer.professionalProfileId) throw new AuthorizationError("No professional profile");
  await db.delete(credentials).where(and(eq(credentials.id, credentialId), eq(credentials.profileId, viewer.professionalProfileId)));
}

/* ---------------- Identity verification ---------------- */

export async function submitIdentity(viewer: Viewer, input: { legalName: string; documentAttachmentId: string }): Promise<void> {
  if (!viewer.professionalProfileId) throw new AuthorizationError("No professional profile");
  const [att] = await db.select({ id: attachments.id }).from(attachments).where(and(eq(attachments.id, input.documentAttachmentId), eq(attachments.ownerUserId, viewer.userId), eq(attachments.purpose, "VERIFICATION_DOCUMENT"))).limit(1);
  if (!att) throw new ValidationError("Invalid identity document");
  const [pending] = await db.select({ id: identityVerifications.id }).from(identityVerifications).where(and(eq(identityVerifications.profileId, viewer.professionalProfileId), eq(identityVerifications.status, "PENDING_REVIEW"))).limit(1);
  if (pending) throw new ConflictError("An identity verification is already pending");
  await db.insert(identityVerifications).values({ profileId: viewer.professionalProfileId, provider: "manual", documentAttachmentId: input.documentAttachmentId, legalName: input.legalName.slice(0, 200), retentionUntil: new Date(Date.now() + 90 * 86400000) });
  await db.update(attachments).set({ retentionUntil: new Date(Date.now() + 90 * 86400000) }).where(eq(attachments.id, input.documentAttachmentId));
  await audit({ actorType: "USER", actorUserId: viewer.userId, action: "IDENTITY_SUBMITTED", entityType: "professional_profile", entityId: viewer.professionalProfileId });
}

/* ---------------- Service listings ---------------- */

export async function upsertListing(viewer: Viewer, input: { id: string | null; categoryId: string; title: string; description: string; languageCode: string | null; domainId: string | null; pricingModel: "FIXED_PRICE" | "PER_WORD" | "HOURLY" | "CUSTOM_QUOTE"; basePriceMinor: number; currency: string; turnaroundDays: number; revisionsIncluded: number; requirements: string; active: boolean }): Promise<string> {
  if (!viewer.professionalProfileId) throw new AuthorizationError("No professional profile");
  const [cat] = await db.select({ id: serviceCategories.id }).from(serviceCategories).where(and(eq(serviceCategories.id, input.categoryId), eq(serviceCategories.active, true))).limit(1);
  if (!cat) throw new ValidationError("Unknown service category");
  if (!Number.isInteger(input.basePriceMinor) || input.basePriceMinor < 0) throw new ValidationError("Invalid price");
  const values = { profileId: viewer.professionalProfileId, categoryId: input.categoryId, title: input.title.trim().slice(0, 120), description: input.description.slice(0, 3000), languageCode: input.languageCode, domainId: input.domainId, pricingModel: input.pricingModel, basePriceMinor: input.basePriceMinor, currency: input.currency.toUpperCase(), turnaroundDays: input.turnaroundDays, revisionsIncluded: input.revisionsIncluded, requirements: input.requirements.slice(0, 2000), active: input.active };
  if (input.id) {
    const [existing] = await db.select({ id: serviceListings.id }).from(serviceListings).where(and(eq(serviceListings.id, input.id), eq(serviceListings.profileId, viewer.professionalProfileId))).limit(1);
    if (!existing) throw new ValidationError("Listing not found");
    await db.update(serviceListings).set(values).where(eq(serviceListings.id, input.id));
    return input.id;
  }
  const [row] = await db.insert(serviceListings).values(values).returning({ id: serviceListings.id });
  return row.id;
}

export async function deleteListing(viewer: Viewer, id: string): Promise<void> {
  if (!viewer.professionalProfileId) throw new AuthorizationError("No professional profile");
  await db.delete(serviceListings).where(and(eq(serviceListings.id, id), eq(serviceListings.profileId, viewer.professionalProfileId)));
}

/* ---------------- Portfolio ---------------- */

export async function addPortfolioItem(viewer: Viewer, input: { title: string; description: string; url: string | null; authorshipRecordId: string | null }): Promise<void> {
  if (!viewer.professionalProfileId) throw new AuthorizationError("No professional profile");
  if (input.authorshipRecordId) {
    const [rec] = await db.select({ id: authorshipRecords.id, visibility: authorshipRecords.visibility, professionalUserId: authorshipRecords.professionalUserId }).from(authorshipRecords).where(eq(authorshipRecords.id, input.authorshipRecordId)).limit(1);
    if (!rec || rec.professionalUserId !== viewer.userId) throw new ValidationError("Record not found");
    if (rec.visibility === "PRIVATE") throw new AuthorizationError("The customer has not permitted public attribution for this work");
  }
  await db.insert(portfolioItems).values({ profileId: viewer.professionalProfileId, title: input.title.slice(0, 200), description: input.description.slice(0, 2000), url: input.url, authorshipRecordId: input.authorshipRecordId, publicVisible: true });
}

export async function removePortfolioItem(viewer: Viewer, id: string): Promise<void> {
  if (!viewer.professionalProfileId) throw new AuthorizationError("No professional profile");
  await db.delete(portfolioItems).where(and(eq(portfolioItems.id, id), eq(portfolioItems.profileId, viewer.professionalProfileId)));
}

/* ---------------- Queries ---------------- */

export async function getOwnProfile(viewer: Viewer) {
  if (!viewer.professionalProfileId) return null;
  const [profile] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.id, viewer.professionalProfileId)).limit(1);
  if (!profile) return null;
  const [langs, exps, creds, lists, items, identity] = await Promise.all([
    db.select({ pl: professionalLanguages, name: languages.name }).from(professionalLanguages).innerJoin(languages, eq(languages.code, professionalLanguages.languageCode)).where(eq(professionalLanguages.profileId, profile.id)).orderBy(asc(languages.name)),
    db.select({ claim: expertiseClaims, domainName: domains.name, domainPath: domains.path }).from(expertiseClaims).innerJoin(domains, eq(domains.id, expertiseClaims.domainId)).where(eq(expertiseClaims.profileId, profile.id)).orderBy(asc(domains.path)),
    db.select().from(credentials).where(eq(credentials.profileId, profile.id)).orderBy(desc(credentials.createdAt)),
    db.select({ listing: serviceListings, categoryName: serviceCategories.name }).from(serviceListings).innerJoin(serviceCategories, eq(serviceCategories.id, serviceListings.categoryId)).where(eq(serviceListings.profileId, profile.id)).orderBy(desc(serviceListings.createdAt)),
    db.select().from(portfolioItems).where(eq(portfolioItems.profileId, profile.id)).orderBy(desc(portfolioItems.createdAt)),
    db.select().from(identityVerifications).where(eq(identityVerifications.profileId, profile.id)).orderBy(desc(identityVerifications.createdAt)).limit(1),
  ]);
  return { profile, languages: langs, expertise: exps, credentials: creds, listings: lists, portfolio: items, identity: identity[0] ?? null };
}

export async function publicPortfolio(profileId: string) {
  return db.select().from(portfolioItems).where(and(eq(portfolioItems.profileId, profileId), eq(portfolioItems.publicVisible, true))).orderBy(desc(portfolioItems.createdAt)).limit(20);
}

export async function publicCredentials(profileId: string) {
  return db.select().from(credentials).where(and(eq(credentials.profileId, profileId), eq(credentials.publicVisible, true), eq(credentials.publicVisible, true))).orderBy(desc(credentials.status), desc(credentials.endYear));
}

export async function publicRecordsForProfessional(userId: string, limit = 12) {
  return db
    .select()
    .from(authorshipRecords)
    .where(and(eq(authorshipRecords.professionalUserId, userId), inArray(authorshipRecords.visibility, ["ANONYMIZED", "PUBLIC"]), eq(authorshipRecords.status, "VALID")))
    .orderBy(desc(authorshipRecords.signedAt))
    .limit(limit);
}
