"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireViewer } from "@/server/auth/session";
import { safeAction, type ActionResult } from "@/server/security/errors";
import * as pro from "@/server/domain/professionals/service";
import { toMinor } from "@/lib/money";
import { createPayout } from "@/server/finance/payments";

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  title: z.string().trim().max(120).default(""),
  bio: z.string().trim().max(4000).default(""),
  country: z.string().trim().length(2).nullable().default(null),
  region: z.string().trim().max(80).nullable().default(null),
  yearsExperience: z.number().int().min(0).max(80).nullable().default(null),
});

export async function createProfileAction(payload: z.input<typeof profileSchema>): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("createProfile", async () => {
    await pro.createProfile(viewer, profileSchema.parse(payload));
    revalidatePath("/professional", "layout");
    return undefined;
  });
}

const updateSchema = profileSchema.partial().extend({
  availability: z.enum(["AVAILABLE", "LIMITED", "UNAVAILABLE"]).optional(),
  typicalTurnaroundDays: z.number().int().min(1).max(90).nullable().optional(),
  externalUrls: z.array(z.object({ label: z.string().max(40), url: z.string().url().max(300) })).max(8).optional(),
  photoAttachmentId: z.string().nullable().optional(),
});

export async function updateProfileAction(payload: z.input<typeof updateSchema>): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("updateProfile", async () => {
    await pro.updateProfile(viewer, updateSchema.parse(payload));
    revalidatePath("/professional", "layout");
    if (viewer.professionalSlug) revalidatePath(`/professionals/${viewer.professionalSlug}`);
    return undefined;
  });
}

export async function setProfilePublishedAction(published: boolean): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("setProfilePublished", async () => {
    await pro.setProfilePublished(viewer, published);
    revalidatePath("/professional", "layout");
    revalidatePath("/professionals");
    return undefined;
  });
}

export async function acceptAgreementAction(type: "PROFESSIONAL_CONFIDENTIALITY" | "TERMS_OF_SERVICE"): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("acceptAgreement", async () => {
    await pro.acceptAgreement(viewer, type);
    revalidatePath("/professional", "layout");
    return undefined;
  });
}

export async function upsertLanguageAction(languageCode: string, level: "NATIVE" | "FULL_PROFESSIONAL" | "PROFESSIONAL" | "WORKING", editorialCapable: boolean): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("upsertLanguage", async () => {
    await pro.upsertLanguage(viewer, { languageCode, level, editorialCapable });
    revalidatePath("/professional/credentials");
    return undefined;
  });
}

export async function removeLanguageAction(languageCode: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("removeLanguage", async () => {
    await pro.removeLanguage(viewer, languageCode);
    revalidatePath("/professional/credentials");
    return undefined;
  });
}

const expertiseSchema = z.object({ domainId: z.string(), yearsExperience: z.number().int().min(0).max(80).nullable().default(null), description: z.string().max(2000).default(""), evidenceSummary: z.string().max(2000).default("") });

export async function claimExpertiseAction(payload: z.input<typeof expertiseSchema>): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("claimExpertise", async () => {
    await pro.claimExpertise(viewer, expertiseSchema.parse(payload));
    revalidatePath("/professional/credentials");
    return undefined;
  });
}

export async function removeExpertiseAction(claimId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("removeExpertise", async () => {
    await pro.removeExpertise(viewer, claimId);
    revalidatePath("/professional/credentials");
    return undefined;
  });
}

const credentialSchema = z.object({
  type: z.enum(["EDUCATION", "CERTIFICATION", "PROFESSIONAL_MEMBERSHIP", "EMPLOYMENT", "TRADE_QUALIFICATION", "BUSINESS_OWNERSHIP", "PUBLISHED_WORK", "OTHER"]),
  title: z.string().trim().min(2).max(160),
  issuer: z.string().trim().max(160).default(""),
  field: z.string().trim().max(160).default(""),
  startYear: z.number().int().min(1950).max(2100).nullable().default(null),
  endYear: z.number().int().min(1950).max(2100).nullable().default(null),
  description: z.string().max(2000).default(""),
  publicVisible: z.boolean().default(true),
  documentAttachmentIds: z.array(z.string()).max(5).default([]),
});

export async function addCredentialAction(payload: z.input<typeof credentialSchema>): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("addCredential", async () => {
    await pro.addCredential(viewer, credentialSchema.parse(payload));
    revalidatePath("/professional/credentials");
    return undefined;
  });
}

export async function removeCredentialAction(id: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("removeCredential", async () => {
    await pro.removeCredential(viewer, id);
    revalidatePath("/professional/credentials");
    return undefined;
  });
}

export async function submitIdentityAction(legalName: string, documentAttachmentId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("submitIdentity", async () => {
    await pro.submitIdentity(viewer, { legalName, documentAttachmentId });
    revalidatePath("/professional/credentials");
    return undefined;
  });
}

const listingSchema = z.object({
  id: z.string().nullable().default(null),
  categoryId: z.string(),
  title: z.string().trim().min(3).max(120),
  description: z.string().max(3000).default(""),
  languageCode: z.string().nullable().default(null),
  domainId: z.string().nullable().default(null),
  pricingModel: z.enum(["FIXED_PRICE", "PER_WORD", "HOURLY", "CUSTOM_QUOTE"]),
  basePrice: z.string().max(20).default("0"),
  currency: z.string().length(3).default("SEK"),
  turnaroundDays: z.number().int().min(1).max(90).default(3),
  revisionsIncluded: z.number().int().min(0).max(10).default(1),
  requirements: z.string().max(2000).default(""),
  active: z.boolean().default(true),
});

export async function upsertListingAction(payload: z.input<typeof listingSchema>): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("upsertListing", async () => {
    const p = listingSchema.parse(payload);
    await pro.upsertListing(viewer, { ...p, basePriceMinor: toMinor(p.basePrice || "0", p.currency) });
    revalidatePath("/professional/services");
    return undefined;
  });
}

export async function deleteListingAction(id: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("deleteListing", async () => {
    await pro.deleteListing(viewer, id);
    revalidatePath("/professional/services");
    return undefined;
  });
}

export async function addPortfolioItemAction(payload: { title: string; description: string; url: string | null; authorshipRecordId: string | null }): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("addPortfolioItem", async () => {
    await pro.addPortfolioItem(viewer, payload);
    revalidatePath("/professional/profile");
    return undefined;
  });
}

export async function removePortfolioItemAction(id: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("removePortfolioItem", async () => {
    await pro.removePortfolioItem(viewer, id);
    revalidatePath("/professional/profile");
    return undefined;
  });
}

export async function requestPayoutAction(currency: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("requestPayout", async () => {
    await createPayout(viewer.userId, currency.toUpperCase(), viewer.userId);
    revalidatePath("/professional/earnings");
    return undefined;
  });
}
