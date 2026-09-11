"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireViewer } from "@/server/auth/session";
import { authorizeAssignment } from "@/server/authz/policy";
import { safeAction, type ActionResult } from "@/server/security/errors";
import * as svc from "@/server/domain/assignments/service";
import { aiService } from "@/server/ai/service";
import { db } from "@/server/db";
import { assignments, domains, languages, serviceCategories } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { toMinor } from "@/lib/money";

const createSchema = z.object({
  template: z.enum(["STANDARD", "EXPERT_BRAIN_DUMP", "DOMAIN_REVIEW", "MULTI_STAGE"]),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(20000).default(""),
  serviceCategoryId: z.string().nullable().default(null),
  languageCode: z.string().max(10).nullable().default(null),
  requiredLanguageLevel: z.enum(["NATIVE", "FULL_PROFESSIONAL", "PROFESSIONAL", "WORKING"]).default("PROFESSIONAL"),
  editorialRequired: z.boolean().default(true),
  domainId: z.string().nullable().default(null),
  domainRequirement: z.enum(["NOT_REQUIRED", "PREFERRED", "REQUIRED", "VERIFIED_REQUIRED"]).default("NOT_REQUIRED"),
  targetAudience: z.string().max(500).default(""),
  intendedPublication: z.string().max(500).default(""),
  wordCount: z.number().int().positive().max(1_000_000).nullable().default(null),
  deadline: z.string().nullable().default(null),
  sourceUrls: z.array(z.string().url().max(500)).max(20).default([]),
  attributionRequirements: z.string().max(2000).default(""),
  additionalInstructions: z.string().max(10000).default(""),
  knowledgeSourceType: z.enum(["CUSTOMER_EXPERTISE", "FOUNDER_EXPERTISE", "EMPLOYEE_EXPERTISE", "PROFESSIONAL_EXPERTISE", "DOCUMENTATION", "INTERVIEW", "VOICE_RECORDING", "TRANSCRIPT", "EXTERNAL_SOURCES", "MIXED"]).default("MIXED"),
  knowledgeProvidedByName: z.string().max(120).nullable().default(null),
  knowledgeProvidedByTitle: z.string().max(120).nullable().default(null),
  confidentiality: z.enum(["STANDARD", "PRIVATE", "CONFIDENTIAL", "STRICT_CONFIDENTIAL"]).default("PRIVATE"),
  aiPolicy: z.enum(["AI_DISABLED", "AI_METADATA_ONLY", "AI_ALLOWED"]).nullable().default(null),
  budget: z.string().max(20).nullable().default(null),
  currency: z.string().length(3).default("SEK"),
  organizationId: z.string().nullable().default(null),
  sourceText: z.string().max(2_000_000).nullable().default(null),
  attachmentIds: z.array(z.string()).max(30).default([]),
  openImmediately: z.boolean().default(true),
});

export type CreateAssignmentPayload = z.input<typeof createSchema>;

export async function createAssignmentAction(payload: CreateAssignmentPayload): Promise<ActionResult<{ publicId: string }>> {
  const viewer = await requireViewer();
  return safeAction("createAssignment", async () => {
    const input = createSchema.parse(payload);
    const result = await svc.createAssignment(viewer, {
      ...input,
      deadline: input.deadline ? new Date(input.deadline) : null,
      budgetMinor: input.budget ? toMinor(input.budget, input.currency) : null,
      currency: input.currency.toUpperCase(),
    });
    revalidatePath("/assignments");
    return { publicId: result.publicId };
  });
}

export async function suggestBriefAction(description: string): Promise<ActionResult<Awaited<ReturnType<typeof aiService.suggestBrief>>>> {
  const viewer = await requireViewer();
  return safeAction("suggestBrief", async () => {
    const [cats, doms, langs] = await Promise.all([db.select({ slug: serviceCategories.slug }).from(serviceCategories).where(eq(serviceCategories.active, true)), db.select({ path: domains.path }).from(domains).where(eq(domains.active, true)), db.select({ code: languages.code }).from(languages).where(eq(languages.active, true))]);
    return aiService.suggestBrief(viewer.userId, description.slice(0, 6000), { categories: cats.map((c) => c.slug), domainPaths: doms.map((d) => d.path), languages: langs.map((l) => l.code) });
  });
}

export async function openAssignmentAction(publicId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("openAssignment", async () => {
    const ctx = await authorizeAssignment(viewer, publicId, "edit_brief");
    await svc.openAssignment(ctx);
    revalidatePath(`/assignments/${publicId}`);
    return undefined;
  });
}

export async function cancelAssignmentAction(publicId: string, reason: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("cancelAssignment", async () => {
    const ctx = await authorizeAssignment(viewer, publicId, "cancel");
    await svc.cancelAssignment(ctx, reason.slice(0, 500));
    revalidatePath(`/assignments/${publicId}`);
    return undefined;
  });
}

const briefPatchSchema = createSchema.pick({ title: true, description: true, serviceCategoryId: true, languageCode: true, requiredLanguageLevel: true, editorialRequired: true, domainId: true, domainRequirement: true, targetAudience: true, intendedPublication: true, wordCount: true, deadline: true, sourceUrls: true, attributionRequirements: true, additionalInstructions: true, budget: true, currency: true }).partial();

export async function updateBriefAction(publicId: string, payload: z.input<typeof briefPatchSchema>): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("updateBrief", async () => {
    const ctx = await authorizeAssignment(viewer, publicId, "edit_brief");
    const p = briefPatchSchema.parse(payload);
    await svc.updateBrief(ctx, { ...p, deadline: p.deadline === undefined ? undefined : p.deadline ? new Date(p.deadline) : null, budgetMinor: p.budget === undefined ? undefined : p.budget ? toMinor(p.budget, p.currency ?? ctx.assignment.currency) : null });
    revalidatePath(`/assignments/${publicId}`);
    return undefined;
  });
}

export async function inviteProfessionalAction(publicId: string, professionalUserId: string, message: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("inviteProfessional", async () => {
    const ctx = await authorizeAssignment(viewer, publicId, "invite_professional");
    await svc.inviteProfessional(ctx, professionalUserId, message);
    revalidatePath(`/assignments/${publicId}`);
    return undefined;
  });
}

const offerSchema = z.object({
  price: z.string().max(20),
  pricingModel: z.enum(["FIXED_PRICE", "PER_WORD", "HOURLY", "CUSTOM_QUOTE"]),
  turnaroundDays: z.number().int().min(1).max(365),
  message: z.string().max(4000).default(""),
  listingId: z.string().nullable().default(null),
  contributionRole: z.enum(["AUTHOR", "EDITOR", "LANGUAGE_REVIEWER", "DOMAIN_REVIEWER", "FACT_CHECKER", "TRANSLATOR", "TRANSLATION_REVIEWER", "FINAL_APPROVER"]).default("AUTHOR"),
});

export async function createOfferAction(publicId: string, payload: z.input<typeof offerSchema>): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("createOffer", async () => {
    const ctx = await authorizeAssignment(viewer, publicId, "make_offer");
    const p = offerSchema.parse(payload);
    await svc.createOffer(viewer, ctx.assignment, { priceMinor: toMinor(p.price, ctx.assignment.currency), currency: ctx.assignment.currency, pricingModel: p.pricingModel, turnaroundDays: p.turnaroundDays, message: p.message, listingId: p.listingId, contributionRole: p.contributionRole });
    revalidatePath(`/assignments/${publicId}`);
    return undefined;
  });
}

export async function acceptOfferAction(publicId: string, offerId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("acceptOffer", async () => {
    const ctx = await authorizeAssignment(viewer, publicId, "accept_offer");
    await svc.acceptOffer(ctx, offerId);
    revalidatePath(`/assignments/${publicId}`);
    return undefined;
  });
}

export async function declineOfferAction(publicId: string, offerId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("declineOffer", async () => {
    const ctx = await authorizeAssignment(viewer, publicId, "accept_offer");
    await svc.declineOffer(ctx, offerId);
    revalidatePath(`/assignments/${publicId}`);
    return undefined;
  });
}

export async function withdrawOfferAction(publicId: string, offerId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("withdrawOffer", async () => {
    await svc.withdrawOffer(viewer, offerId);
    revalidatePath(`/assignments/${publicId}`);
    return undefined;
  });
}

export async function declineInvitationAction(publicId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("declineInvitation", async () => {
    const [a] = await db.select({ id: assignments.id }).from(assignments).where(eq(assignments.publicId, publicId)).limit(1);
    if (a) await svc.declineInvitation(viewer, a.id);
    revalidatePath("/marketplace");
    return undefined;
  });
}

export async function setConfidentialityAction(publicId: string, level: "STANDARD" | "PRIVATE" | "CONFIDENTIAL" | "STRICT_CONFIDENTIAL", aiPolicy: "AI_DISABLED" | "AI_METADATA_ONLY" | "AI_ALLOWED"): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("setConfidentiality", async () => {
    const ctx = await authorizeAssignment(viewer, publicId, "manage_confidentiality");
    await svc.setConfidentiality(ctx, level, aiPolicy);
    revalidatePath(`/assignments/${publicId}`);
    return undefined;
  });
}

export async function setPortfolioPermissionAction(publicId: string, permission: "NOT_PERMITTED" | "ATTRIBUTION_ONLY" | "EXCERPT_PERMITTED" | "FULL_WORK_PERMITTED"): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("setPortfolioPermission", async () => {
    const ctx = await authorizeAssignment(viewer, publicId, "manage_confidentiality");
    await svc.setPortfolioPermission(ctx, permission);
    revalidatePath(`/assignments/${publicId}`);
    return undefined;
  });
}

export async function openDisputeAction(publicId: string, reason: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("openDispute", async () => {
    const ctx = await authorizeAssignment(viewer, publicId, "open_dispute");
    await svc.openDispute(ctx, reason);
    revalidatePath(`/assignments/${publicId}`);
    return undefined;
  });
}

export async function goToAssignment(publicId: string): Promise<never> {
  redirect(`/assignments/${publicId}`);
}
