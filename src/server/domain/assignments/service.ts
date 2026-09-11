import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db, type Tx } from "@/server/db";
import {
  agreementAcceptances,
  artifactVersions,
  artifacts,
  assignmentInvitations,
  assignmentParticipants,
  assignmentStages,
  assignmentStatusHistory,
  assignments,
  attachments,
  contributions,
  disputes,
  knowledgeSources,
  offers,
  organizations,
  portfolioPermissionChanges,
  professionalProfiles,
  serviceCategories,
  users,
} from "@/server/db/schema";
import { newAssignmentPublicId } from "@/lib/ids";
import { hashVersion, countWords } from "@/lib/hash";
import { formatMoney } from "@/lib/money";
import { audit } from "@/server/audit/log";
import { notify, notifyMany } from "@/server/notifications/service";
import { ConflictError, ValidationError } from "@/server/security/errors";
import { rateLimit } from "@/server/security/rate-limit";
import type { Viewer } from "@/server/auth/session";
import { AuthorizationError, type AssignmentAuthContext } from "@/server/authz/policy";
import { assertTransition, STATUS_LABELS, type AssignmentStatus, type TransitionActor } from "./state-machine";
import { defaultAiPolicyFor, defaultPortfolioPermissionFor, maxAiPolicyFor, type AiPolicy, type ConfidentialityLevel } from "@/server/ai/policy";
import { systemMessage } from "@/server/domain/messages/service";
import { AGREEMENT_VERSIONS } from "@/lib/config/brand";

type AssignmentRow = typeof assignments.$inferSelect;
type Template = AssignmentRow["template"];
type ContributionRole = typeof contributions.$inferSelect.role;
type StageKind = typeof assignmentStages.$inferSelect.kind;

/* ------------------------------------------------------------------ */
/* Stage templates (small domain-specific stage system, not a BPM engine) */
/* ------------------------------------------------------------------ */

const STAGE_TEMPLATES: Record<Template, { kind: StageKind; title: string; role: ContributionRole | null }[]> = {
  STANDARD: [
    { kind: "WRITING", title: "Professional work", role: "AUTHOR" },
    { kind: "SIGN_OFF", title: "Final human sign-off", role: "FINAL_APPROVER" },
    { kind: "CUSTOMER_APPROVAL", title: "Customer approval", role: null },
  ],
  EXPERT_BRAIN_DUMP: [
    { kind: "KNOWLEDGE_CAPTURE", title: "Knowledge capture (recording / notes)", role: "KNOWLEDGE_SOURCE" },
    { kind: "TRANSCRIPTION", title: "Transcription", role: null },
    { kind: "WRITING", title: "Professional writing", role: "AUTHOR" },
    { kind: "SIGN_OFF", title: "Final human sign-off", role: "FINAL_APPROVER" },
    { kind: "CUSTOMER_APPROVAL", title: "Customer approval", role: null },
  ],
  DOMAIN_REVIEW: [
    { kind: "DOMAIN_REVIEW", title: "Domain expert review", role: "DOMAIN_REVIEWER" },
    { kind: "SIGN_OFF", title: "Reviewer sign-off", role: "FINAL_APPROVER" },
    { kind: "CUSTOMER_APPROVAL", title: "Customer approval", role: null },
  ],
  MULTI_STAGE: [
    { kind: "WRITING", title: "Professional writing", role: "AUTHOR" },
    { kind: "DOMAIN_REVIEW", title: "Domain expert review", role: "DOMAIN_REVIEWER" },
    { kind: "CORRECTIONS", title: "Writer corrections", role: "AUTHOR" },
    { kind: "LANGUAGE_REVIEW", title: "Final language review", role: "LANGUAGE_REVIEWER" },
    { kind: "SIGN_OFF", title: "Final human sign-off", role: "FINAL_APPROVER" },
    { kind: "CUSTOMER_APPROVAL", title: "Customer approval", role: null },
  ],
};

export interface CreateAssignmentInput {
  template: Template;
  title: string;
  description: string;
  serviceCategoryId: string | null;
  languageCode: string | null;
  requiredLanguageLevel: "NATIVE" | "FULL_PROFESSIONAL" | "PROFESSIONAL" | "WORKING";
  editorialRequired: boolean;
  domainId: string | null;
  domainRequirement: "NOT_REQUIRED" | "PREFERRED" | "REQUIRED" | "VERIFIED_REQUIRED";
  targetAudience: string;
  intendedPublication: string;
  wordCount: number | null;
  deadline: Date | null;
  sourceUrls: string[];
  attributionRequirements: string;
  additionalInstructions: string;
  knowledgeSourceType: AssignmentRow["knowledgeSourceType"];
  knowledgeProvidedByName: string | null;
  knowledgeProvidedByTitle: string | null;
  confidentiality: ConfidentialityLevel;
  aiPolicy: AiPolicy | null;
  budgetMinor: number | null;
  currency: string;
  organizationId: string | null;
  sourceText: string | null;
  attachmentIds: string[];
  openImmediately: boolean;
}

export async function createAssignment(viewer: Viewer, input: CreateAssignmentInput): Promise<{ id: string; publicId: string }> {
  await rateLimit(`assignment-create:${viewer.userId}`, 30, 3600);
  if (input.organizationId && !viewer.organizations.some((o) => o.organizationId === input.organizationId && o.role !== "BILLING")) {
    throw new AuthorizationError("You are not a member of that organization");
  }
  const allowedPolicies = maxAiPolicyFor(input.confidentiality);
  const aiPolicy = input.aiPolicy && allowedPolicies.includes(input.aiPolicy) ? input.aiPolicy : defaultAiPolicyFor(input.confidentiality);
  const publicId = newAssignmentPublicId();

  if (input.attachmentIds.length) {
    const owned = await db
      .select({ id: attachments.id })
      .from(attachments)
      .where(and(inArray(attachments.id, input.attachmentIds), eq(attachments.ownerUserId, viewer.userId), isNull(attachments.assignmentId)));
    if (owned.length !== input.attachmentIds.length) throw new ValidationError("One or more uploaded files are invalid");
  }

  const result = await db.transaction(async (tx) => {
    const status: AssignmentStatus = input.openImmediately ? "OPEN" : "DRAFT";
    const [a] = await tx
      .insert(assignments)
      .values({
        publicId,
        organizationId: input.organizationId,
        customerUserId: viewer.userId,
        template: input.template,
        title: input.title,
        description: input.description,
        serviceCategoryId: input.serviceCategoryId,
        languageCode: input.languageCode,
        requiredLanguageLevel: input.requiredLanguageLevel,
        editorialRequired: input.editorialRequired,
        domainId: input.domainId,
        domainRequirement: input.domainId ? input.domainRequirement : "NOT_REQUIRED",
        targetAudience: input.targetAudience,
        intendedPublication: input.intendedPublication,
        wordCount: input.wordCount,
        deadline: input.deadline,
        sourceUrls: input.sourceUrls,
        attributionRequirements: input.attributionRequirements,
        additionalInstructions: input.additionalInstructions,
        knowledgeSourceType: input.knowledgeSourceType,
        status,
        confidentiality: input.confidentiality,
        aiPolicy,
        portfolioPermission: defaultPortfolioPermissionFor(input.confidentiality),
        budgetMinor: input.budgetMinor,
        currency: input.currency,
        openedAt: input.openImmediately ? new Date() : null,
      })
      .returning();

    await tx.insert(assignmentParticipants).values({ assignmentId: a.id, userId: viewer.userId, role: "CUSTOMER", addedByUserId: viewer.userId });
    await tx.insert(assignmentStatusHistory).values({ assignmentId: a.id, fromStatus: null, toStatus: status, actorUserId: viewer.userId, reason: "Created" });
    await tx.insert(assignmentStages).values(STAGE_TEMPLATES[input.template].map((s, i) => ({ assignmentId: a.id, position: i + 1, kind: s.kind, title: s.title, contributionRole: s.role, status: (i === 0 ? "ACTIVE" : "PENDING") as "ACTIVE" | "PENDING" })));

    if (input.attachmentIds.length) {
      await tx.update(attachments).set({ assignmentId: a.id }).where(inArray(attachments.id, input.attachmentIds));
    }

    // Knowledge source provenance
    const ksType = input.knowledgeSourceType;
    await tx.insert(knowledgeSources).values({
      assignmentId: a.id,
      type: ksType,
      description: input.description.slice(0, 500),
      providedByUserId: ["CUSTOMER_EXPERTISE", "FOUNDER_EXPERTISE", "EMPLOYEE_EXPERTISE"].includes(ksType) ? viewer.userId : null,
      providedByName: input.knowledgeProvidedByName,
      providedByTitle: input.knowledgeProvidedByTitle,
    });
    if (["CUSTOMER_EXPERTISE", "FOUNDER_EXPERTISE", "EMPLOYEE_EXPERTISE", "VOICE_RECORDING", "INTERVIEW"].includes(ksType)) {
      await tx.insert(contributions).values({
        assignmentId: a.id,
        userId: viewer.userId,
        displayName: input.knowledgeProvidedByName ?? viewer.name,
        displayTitle: input.knowledgeProvidedByTitle,
        role: "KNOWLEDGE_SOURCE",
        scope: ksType === "VOICE_RECORDING" ? "Voice recording" : ksType === "INTERVIEW" ? "Interview" : "Subject knowledge",
        status: "COMPLETED",
        completedAt: new Date(),
      });
    }

    // Version 1: customer source (text and/or files)
    const fileHashes = input.attachmentIds.length
      ? (await tx.select({ sha256: attachments.sha256 }).from(attachments).where(inArray(attachments.id, input.attachmentIds))).map((r) => r.sha256)
      : [];
    if (input.sourceText || fileHashes.length) {
      const [artifact] = await tx.insert(artifacts).values({ assignmentId: a.id, kind: "TEXT", title: input.title }).returning();
      const [v1] = await tx
        .insert(artifactVersions)
        .values({
          artifactId: artifact.id,
          assignmentId: a.id,
          versionNumber: 1,
          label: "Customer source",
          content: input.sourceText,
          contentHash: hashVersion(input.sourceText, fileHashes),
          wordCount: countWords(input.sourceText),
          createdByUserId: viewer.userId,
          status: "SUBMITTED",
          submittedAt: new Date(),
          metadata: { source: true },
        })
        .returning();
      if (input.attachmentIds.length) {
        const { artifactVersionFiles } = await import("@/server/db/schema");
        await tx.insert(artifactVersionFiles).values(input.attachmentIds.map((attachmentId) => ({ versionId: v1.id, attachmentId })));
      }
      await tx.update(artifacts).set({ currentVersionId: v1.id }).where(eq(artifacts.id, artifact.id));
      await tx.update(assignments).set({ currentArtifactId: artifact.id }).where(eq(assignments.id, a.id));
    }

    await systemMessage(a.id, `${viewer.name} created the assignment.`, { event: "ASSIGNMENT_CREATED" }, tx);
    await audit({ actorType: "USER", actorUserId: viewer.userId, action: "ASSIGNMENT_CREATED", entityType: "assignment", entityId: a.id, assignmentId: a.id, metadata: { template: input.template, confidentiality: input.confidentiality, aiPolicy, status } }, tx);
    return { id: a.id, publicId: a.publicId };
  });

  await notify(viewer.userId, "ASSIGNMENT_RECEIVED", { title: input.title, publicId, statusLabel: input.openImmediately ? "open for offers" : "saved as a draft" });
  return result;
}

/* ------------------------------------------------------------------ */
/* Transitions                                                          */
/* ------------------------------------------------------------------ */

export async function transitionAssignment(assignmentId: string, to: AssignmentStatus, actor: TransitionActor, actorUserId: string | null, reason?: string, tx?: Tx): Promise<AssignmentRow> {
  const run = async (t: Tx) => {
    const [current] = await t.select().from(assignments).where(eq(assignments.id, assignmentId)).for("update");
    if (!current) throw new ValidationError("Assignment not found");
    assertTransition(current.status, to, actor);
    const patch: Partial<AssignmentRow> = { status: to };
    if (to === "OPEN" && !current.openedAt) patch.openedAt = new Date();
    if (to === "ACCEPTED") patch.acceptedAt = new Date();
    if (to === "DELIVERED") patch.deliveredAt = new Date();
    if (to === "SIGNED") patch.signedAt = new Date();
    if (to === "COMPLETED") patch.completedAt = new Date();
    if (to === "CANCELLED") patch.cancelledAt = new Date();
    const [updated] = await t.update(assignments).set(patch).where(eq(assignments.id, assignmentId)).returning();
    await t.insert(assignmentStatusHistory).values({ assignmentId, fromStatus: current.status, toStatus: to, actorUserId, reason: reason ?? null });
    await audit({ actorType: actor === "ADMIN" ? "ADMIN" : actor === "SYSTEM" ? "SYSTEM" : "USER", actorUserId, action: "ASSIGNMENT_STATUS_CHANGED", entityType: "assignment", entityId: assignmentId, assignmentId, metadata: { from: current.status, to, reason } }, t);
    await systemMessage(assignmentId, `Status changed to ${STATUS_LABELS[to]}${reason ? ` — ${reason}` : ""}.`, { event: "STATUS_CHANGED", from: current.status, to }, t);
    return updated;
  };
  return tx ? run(tx) : db.transaction(run);
}

export async function openAssignment(ctx: AssignmentAuthContext): Promise<void> {
  if (!ctx.assignment.title || !ctx.assignment.serviceCategoryId) throw new ValidationError("Add a title and a service before opening the assignment");
  await transitionAssignment(ctx.assignment.id, "OPEN", "CUSTOMER", ctx.viewer.userId);
}

export async function cancelAssignment(ctx: AssignmentAuthContext, reason: string): Promise<void> {
  await transitionAssignment(ctx.assignment.id, "CANCELLED", ctx.role === "ADMIN" ? "ADMIN" : "CUSTOMER", ctx.viewer.userId, reason || "Cancelled by customer");
  await audit({ actorType: "USER", actorUserId: ctx.viewer.userId, action: "ASSIGNMENT_CANCELLED", entityType: "assignment", entityId: ctx.assignment.id, assignmentId: ctx.assignment.id, metadata: { reason } });
}

/* ------------------------------------------------------------------ */
/* Brief updates and confidentiality                                    */
/* ------------------------------------------------------------------ */

export async function updateBrief(ctx: AssignmentAuthContext, patch: Partial<Pick<CreateAssignmentInput, "title" | "description" | "serviceCategoryId" | "languageCode" | "requiredLanguageLevel" | "editorialRequired" | "domainId" | "domainRequirement" | "targetAudience" | "intendedPublication" | "wordCount" | "deadline" | "sourceUrls" | "attributionRequirements" | "additionalInstructions" | "budgetMinor">>): Promise<void> {
  await db.update(assignments).set({ ...patch, domainRequirement: patch.domainId === null ? "NOT_REQUIRED" : patch.domainRequirement }).where(eq(assignments.id, ctx.assignment.id));
  await audit({ actorType: "USER", actorUserId: ctx.viewer.userId, action: "ASSIGNMENT_UPDATED", entityType: "assignment", entityId: ctx.assignment.id, assignmentId: ctx.assignment.id, metadata: { fields: Object.keys(patch) } });
}

export async function setConfidentiality(ctx: AssignmentAuthContext, level: ConfidentialityLevel, aiPolicy: AiPolicy): Promise<void> {
  if (!maxAiPolicyFor(level).includes(aiPolicy)) throw new ValidationError(`AI policy ${aiPolicy} is not permitted for ${level} assignments`);
  const prev = ctx.assignment;
  await db.update(assignments).set({ confidentiality: level, aiPolicy }).where(eq(assignments.id, prev.id));
  if (prev.confidentiality !== level) {
    await audit({ actorType: "USER", actorUserId: ctx.viewer.userId, action: "CONFIDENTIALITY_CHANGED", entityType: "assignment", entityId: prev.id, assignmentId: prev.id, metadata: { from: prev.confidentiality, to: level } });
    await systemMessage(prev.id, `Confidentiality level set to ${level.replace(/_/g, " ").toLowerCase()}.`, { event: "CONFIDENTIALITY_CHANGED" });
  }
  if (prev.aiPolicy !== aiPolicy) {
    await audit({ actorType: "USER", actorUserId: ctx.viewer.userId, action: "AI_POLICY_CHANGED", entityType: "assignment", entityId: prev.id, assignmentId: prev.id, metadata: { from: prev.aiPolicy, to: aiPolicy } });
  }
}

export async function setPortfolioPermission(ctx: AssignmentAuthContext, permission: AssignmentRow["portfolioPermission"]): Promise<void> {
  const prev = ctx.assignment;
  if (prev.portfolioPermission === permission) return;
  await db.transaction(async (tx) => {
    await tx.update(assignments).set({ portfolioPermission: permission, publicAttributionAllowed: permission !== "NOT_PERMITTED" }).where(eq(assignments.id, prev.id));
    await tx.insert(portfolioPermissionChanges).values({ assignmentId: prev.id, fromPermission: prev.portfolioPermission, toPermission: permission, changedByUserId: ctx.viewer.userId });
    await audit({ actorType: "USER", actorUserId: ctx.viewer.userId, action: "PORTFOLIO_PERMISSION_CHANGED", entityType: "assignment", entityId: prev.id, assignmentId: prev.id, metadata: { from: prev.portfolioPermission, to: permission } }, tx);
    await systemMessage(prev.id, `Portfolio permission changed to ${permission.replace(/_/g, " ").toLowerCase()}.`, { event: "PORTFOLIO_PERMISSION_CHANGED" }, tx);
  });
  if (permission === "NOT_PERMITTED") {
    // Public presentation is removed while internal audit history is preserved.
    const { authorshipRecords } = await import("@/server/db/schema");
    await db.update(authorshipRecords).set({ visibility: "PRIVATE" }).where(and(eq(authorshipRecords.assignmentId, prev.id), eq(authorshipRecords.visibility, "PUBLIC")));
  }
}

/* ------------------------------------------------------------------ */
/* Invitations and offers                                               */
/* ------------------------------------------------------------------ */

export async function inviteProfessional(ctx: AssignmentAuthContext, professionalUserId: string, message: string): Promise<void> {
  const [profile] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, professionalUserId)).limit(1);
  if (!profile || !profile.publishedAt) throw new ValidationError("That professional is not available");
  if (professionalUserId === ctx.viewer.userId) throw new ValidationError("You cannot invite yourself");
  await rateLimit(`invite:${ctx.viewer.userId}`, 50, 3600);
  await db.transaction(async (tx) => {
    await tx
      .insert(assignmentInvitations)
      .values({ assignmentId: ctx.assignment.id, professionalUserId, invitedByUserId: ctx.viewer.userId, message: message.slice(0, 2000) })
      .onConflictDoNothing();
    if (ctx.assignment.status === "DRAFT" || ctx.assignment.status === "OPEN") {
      await transitionAssignment(ctx.assignment.id, "PROFESSIONAL_INVITED", "CUSTOMER", ctx.viewer.userId, `Invited ${profile.displayName}`, tx);
    }
    await audit({ actorType: "USER", actorUserId: ctx.viewer.userId, action: "PROFESSIONAL_INVITED", entityType: "assignment", entityId: ctx.assignment.id, assignmentId: ctx.assignment.id, metadata: { professionalUserId } }, tx);
  });
  await notify(professionalUserId, "PROFESSIONAL_INVITED", { title: ctx.assignment.title, publicId: ctx.assignment.publicId, customerName: ctx.viewer.name });
}

export async function hasAcceptedConfidentialityAgreement(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: agreementAcceptances.id })
    .from(agreementAcceptances)
    .where(and(eq(agreementAcceptances.userId, userId), eq(agreementAcceptances.agreementType, "PROFESSIONAL_CONFIDENTIALITY"), eq(agreementAcceptances.agreementVersion, AGREEMENT_VERSIONS.PROFESSIONAL_CONFIDENTIALITY)))
    .limit(1);
  return Boolean(row);
}

export async function createOffer(viewer: Viewer, assignment: AssignmentRow, input: { priceMinor: number; currency: string; pricingModel: "FIXED_PRICE" | "PER_WORD" | "HOURLY" | "CUSTOM_QUOTE"; turnaroundDays: number; message: string; listingId: string | null; contributionRole: ContributionRole }): Promise<string> {
  if (!viewer.professionalProfileId) throw new AuthorizationError("Create a professional profile first");
  if (viewer.professionalVerificationStatus === "SUSPENDED" || viewer.professionalVerificationStatus === "REVOKED") throw new AuthorizationError("Your professional account cannot make offers");
  if (!(await hasAcceptedConfidentialityAgreement(viewer.userId))) throw new AuthorizationError("You must accept the professional confidentiality agreement before making offers");
  if (assignment.customerUserId === viewer.userId) throw new ValidationError("You cannot make an offer on your own assignment");
  if (assignment.domainRequirement === "VERIFIED_REQUIRED" && assignment.domainId) {
    const { expertiseClaims, domains } = await import("@/server/db/schema");
    const [required] = await db.select({ path: domains.path }).from(domains).where(eq(domains.id, assignment.domainId)).limit(1);
    const verified = await db
      .select({ path: domains.path })
      .from(expertiseClaims)
      .innerJoin(domains, eq(domains.id, expertiseClaims.domainId))
      .where(and(eq(expertiseClaims.profileId, viewer.professionalProfileId), eq(expertiseClaims.status, "PLATFORM_VERIFIED")));
    const ok = required && verified.some((v) => required.path === v.path || required.path.startsWith(v.path + "/") || v.path.startsWith(required.path + "/"));
    if (!ok) throw new AuthorizationError("This assignment requires platform-verified expertise in its domain");
  }
  if (!Number.isInteger(input.priceMinor) || input.priceMinor < 0) throw new ValidationError("Invalid price");
  if (input.currency !== assignment.currency) throw new ValidationError(`Offers must be in ${assignment.currency}`);
  await rateLimit(`offer:${viewer.userId}`, 40, 3600);

  const id = await db.transaction(async (tx) => {
    const [o] = await tx
      .insert(offers)
      .values({ assignmentId: assignment.id, professionalUserId: viewer.userId, listingId: input.listingId, contributionRole: input.contributionRole, pricingModel: input.pricingModel, priceMinor: input.priceMinor, currency: input.currency, turnaroundDays: input.turnaroundDays, message: input.message.slice(0, 4000), expiresAt: new Date(Date.now() + 14 * 86400000) })
      .returning({ id: offers.id });
    await tx.update(offers).set({ status: "PENDING" }).where(eq(offers.id, o.id));
    await tx.update(assignmentInvitations).set({ status: "ACCEPTED", respondedAt: new Date() }).where(and(eq(assignmentInvitations.assignmentId, assignment.id), eq(assignmentInvitations.professionalUserId, viewer.userId), eq(assignmentInvitations.status, "PENDING")));
    if (assignment.status === "OPEN" || assignment.status === "PROFESSIONAL_INVITED") {
      await transitionAssignment(assignment.id, "OFFER_RECEIVED", "PROFESSIONAL", viewer.userId, undefined, tx);
    }
    await systemMessage(assignment.id, `${viewer.name} sent an offer: ${formatMoney(input.priceMinor, input.currency)} · ${input.turnaroundDays} day turnaround.`, { event: "OFFER_CREATED", offerId: o.id, contributionRole: input.contributionRole }, tx);
    await audit({ actorType: "USER", actorUserId: viewer.userId, action: "OFFER_CREATED", entityType: "offer", entityId: o.id, assignmentId: assignment.id, metadata: { priceMinor: input.priceMinor, currency: input.currency, contributionRole: input.contributionRole } }, tx);
    return o.id;
  });
  await notify(assignment.customerUserId, "OFFER_RECEIVED", { title: assignment.title, publicId: assignment.publicId, professionalName: viewer.name, price: formatMoney(input.priceMinor, input.currency) });
  return id;
}

export async function declineInvitation(viewer: Viewer, assignmentId: string): Promise<void> {
  await db.update(assignmentInvitations).set({ status: "DECLINED", respondedAt: new Date() }).where(and(eq(assignmentInvitations.assignmentId, assignmentId), eq(assignmentInvitations.professionalUserId, viewer.userId), eq(assignmentInvitations.status, "PENDING")));
  await systemMessage(assignmentId, `${viewer.name} declined the invitation.`, { event: "INVITATION_DECLINED" });
}

export async function withdrawOffer(viewer: Viewer, offerId: string): Promise<void> {
  const [o] = await db.select().from(offers).where(and(eq(offers.id, offerId), eq(offers.professionalUserId, viewer.userId))).limit(1);
  if (!o) throw new ValidationError("Offer not found");
  if (o.status !== "PENDING") throw new ConflictError("Offer is no longer pending");
  await db.update(offers).set({ status: "WITHDRAWN", respondedAt: new Date() }).where(eq(offers.id, offerId));
  await systemMessage(o.assignmentId, `${viewer.name} withdrew their offer.`, { event: "OFFER_WITHDRAWN", offerId });
}

export async function declineOffer(ctx: AssignmentAuthContext, offerId: string): Promise<void> {
  const [o] = await db.select().from(offers).where(and(eq(offers.id, offerId), eq(offers.assignmentId, ctx.assignment.id))).limit(1);
  if (!o) throw new ValidationError("Offer not found");
  if (o.status !== "PENDING") throw new ConflictError("Offer is no longer pending");
  await db.update(offers).set({ status: "DECLINED", respondedAt: new Date() }).where(eq(offers.id, offerId));
  await audit({ actorType: "USER", actorUserId: ctx.viewer.userId, action: "OFFER_DECLINED", entityType: "offer", entityId: offerId, assignmentId: ctx.assignment.id });
  await systemMessage(ctx.assignment.id, `The customer declined an offer.`, { event: "OFFER_DECLINED", offerId });
}

/**
 * Accepts an offer. The first accepted professional becomes the primary
 * professional; further accepted offers add additional professionals with
 * their own contribution role (e.g. a domain reviewer).
 */
export async function acceptOffer(ctx: AssignmentAuthContext, offerId: string): Promise<void> {
  const [o] = await db.select().from(offers).where(and(eq(offers.id, offerId), eq(offers.assignmentId, ctx.assignment.id))).limit(1);
  if (!o) throw new ValidationError("Offer not found");
  if (o.status !== "PENDING") throw new ConflictError("Offer is no longer pending");
  if (o.expiresAt && o.expiresAt < new Date()) throw new ConflictError("Offer has expired");
  const [category] = ctx.assignment.serviceCategoryId ? await db.select().from(serviceCategories).where(eq(serviceCategories.id, ctx.assignment.serviceCategoryId)).limit(1) : [];
  const contributionRole: ContributionRole = o.contributionRole ?? ((category?.defaultContributionRole as ContributionRole | undefined) ?? "AUTHOR");
  const [profile] = await db.select({ displayName: professionalProfiles.displayName, verificationStatus: professionalProfiles.verificationStatus, userId: professionalProfiles.userId }).from(professionalProfiles).where(eq(professionalProfiles.userId, o.professionalUserId)).limit(1);
  if (!profile) throw new ValidationError("Professional profile not found");

  await db.transaction(async (tx) => {
    const isPrimary = !ctx.assignment.primaryProfessionalUserId;
    await tx.update(offers).set({ status: "ACCEPTED", respondedAt: new Date() }).where(eq(offers.id, offerId));
    if (isPrimary) {
      await tx.update(offers).set({ status: "DECLINED", respondedAt: new Date() }).where(and(eq(offers.assignmentId, ctx.assignment.id), eq(offers.status, "PENDING"), sql`${offers.id} <> ${offerId}`));
      await tx.update(assignments).set({ primaryProfessionalUserId: o.professionalUserId, acceptedOfferId: offerId, agreedPriceMinor: o.priceMinor, currency: o.currency }).where(eq(assignments.id, ctx.assignment.id));
    } else {
      await tx.update(assignments).set({ agreedPriceMinor: (ctx.assignment.agreedPriceMinor ?? 0) + o.priceMinor }).where(eq(assignments.id, ctx.assignment.id));
    }
    await tx
      .insert(assignmentParticipants)
      .values({ assignmentId: ctx.assignment.id, userId: o.professionalUserId, role: "PROFESSIONAL", contributionRoles: [contributionRole], addedByUserId: ctx.viewer.userId })
      .onConflictDoNothing();
    await tx.insert(contributions).values({ assignmentId: ctx.assignment.id, userId: o.professionalUserId, displayName: profile.displayName, role: contributionRole, scope: category?.name ?? "Professional work", status: "ACTIVE", verificationSnapshot: { verificationStatus: profile.verificationStatus } });
    // Assign matching stages
    await tx
      .update(assignmentStages)
      .set({ assigneeUserId: o.professionalUserId })
      .where(and(eq(assignmentStages.assignmentId, ctx.assignment.id), isNull(assignmentStages.assigneeUserId), or(eq(assignmentStages.contributionRole, contributionRole), eq(assignmentStages.contributionRole, "FINAL_APPROVER"))));
    if (isPrimary) {
      await transitionAssignment(ctx.assignment.id, "ACCEPTED", "CUSTOMER", ctx.viewer.userId, `Accepted offer from ${profile.displayName}`, tx);
    }
    await systemMessage(ctx.assignment.id, `${profile.displayName} joined as ${contributionRole.replace(/_/g, " ").toLowerCase()}.`, { event: "PARTICIPANT_ADDED", userId: o.professionalUserId, contributionRole }, tx);
    await audit({ actorType: "USER", actorUserId: ctx.viewer.userId, action: "OFFER_ACCEPTED", entityType: "offer", entityId: offerId, assignmentId: ctx.assignment.id, metadata: { professionalUserId: o.professionalUserId, priceMinor: o.priceMinor, currency: o.currency, contributionRole, isPrimary } }, tx);
    await audit({ actorType: "USER", actorUserId: ctx.viewer.userId, action: "PARTICIPANT_ADDED", entityType: "assignment", entityId: ctx.assignment.id, assignmentId: ctx.assignment.id, metadata: { userId: o.professionalUserId, contributionRole } }, tx);
  });

  await notify(o.professionalUserId, "ASSIGNMENT_ACCEPTED", { title: ctx.assignment.title, publicId: ctx.assignment.publicId });
  await notify(ctx.assignment.customerUserId, "ASSIGNMENT_ACCEPTED", { title: ctx.assignment.title, publicId: ctx.assignment.publicId });
}

/* ------------------------------------------------------------------ */
/* Completion and disputes                                              */
/* ------------------------------------------------------------------ */

export async function completeAssignment(assignmentId: string, actor: TransitionActor, actorUserId: string | null): Promise<void> {
  const [a] = await db.select().from(assignments).where(eq(assignments.id, assignmentId)).limit(1);
  if (!a) throw new ValidationError("Assignment not found");
  if (a.status === "COMPLETED") return;
  const { assignmentPaymentState, releaseEscrow } = await import("@/server/finance/payments");
  const pay = await assignmentPaymentState(assignmentId);
  if ((a.agreedPriceMinor ?? 0) > 0 && !pay.captured && actor !== "ADMIN") {
    throw new ConflictError("The assignment cannot be completed before payment is secured");
  }
  await transitionAssignment(assignmentId, "COMPLETED", actor, actorUserId);
  await db.update(assignmentStages).set({ status: "COMPLETED", completedAt: new Date() }).where(and(eq(assignmentStages.assignmentId, assignmentId), eq(assignmentStages.kind, "CUSTOMER_APPROVAL")));
  await db.update(contributions).set({ status: "COMPLETED", completedAt: new Date() }).where(and(eq(contributions.assignmentId, assignmentId), eq(contributions.status, "ACTIVE")));
  await releaseEscrow(assignmentId);
  await audit({ actorType: actor === "SYSTEM" ? "SYSTEM" : actor === "ADMIN" ? "ADMIN" : "USER", actorUserId, action: "ASSIGNMENT_COMPLETED", entityType: "assignment", entityId: assignmentId, assignmentId });
  const { refreshReputation } = await import("@/server/domain/reviews/service");
  const pros = await db.select({ userId: assignmentParticipants.userId }).from(assignmentParticipants).where(and(eq(assignmentParticipants.assignmentId, assignmentId), eq(assignmentParticipants.role, "PROFESSIONAL")));
  for (const p of pros) await refreshReputation(p.userId);
}

export async function openDispute(ctx: AssignmentAuthContext, reason: string): Promise<void> {
  if (reason.trim().length < 20) throw new ValidationError("Please describe the issue in at least 20 characters");
  await db.transaction(async (tx) => {
    const [d] = await tx.insert(disputes).values({ assignmentId: ctx.assignment.id, openedByUserId: ctx.viewer.userId, reason: reason.slice(0, 5000) }).returning({ id: disputes.id });
    await transitionAssignment(ctx.assignment.id, "DISPUTED", ctx.role === "PROFESSIONAL" ? "PROFESSIONAL" : "CUSTOMER", ctx.viewer.userId, "Dispute opened", tx);
    await audit({ actorType: "USER", actorUserId: ctx.viewer.userId, action: "DISPUTE_OPENED", entityType: "dispute", entityId: d.id, assignmentId: ctx.assignment.id }, tx);
  });
  const participants = await db.select({ userId: assignmentParticipants.userId }).from(assignmentParticipants).where(and(eq(assignmentParticipants.assignmentId, ctx.assignment.id), isNull(assignmentParticipants.removedAt)));
  await notifyMany(participants.map((p) => p.userId), "DISPUTE_UPDATE", { title: ctx.assignment.title, publicId: ctx.assignment.publicId, status: "open" });
}

/* ------------------------------------------------------------------ */
/* Queries                                                              */
/* ------------------------------------------------------------------ */

export async function listAssignmentsForViewer(viewer: Viewer): Promise<{ asCustomer: AssignmentListItem[]; asProfessional: AssignmentListItem[]; invitations: AssignmentListItem[] }> {
  const orgIds = viewer.organizations.map((o) => o.organizationId);
  const customerRows = await db
    .select({ a: assignments, orgName: organizations.name, proName: users.name })
    .from(assignments)
    .leftJoin(organizations, eq(organizations.id, assignments.organizationId))
    .leftJoin(users, eq(users.id, assignments.primaryProfessionalUserId))
    .where(orgIds.length ? or(eq(assignments.customerUserId, viewer.userId), inArray(assignments.organizationId, orgIds)) : eq(assignments.customerUserId, viewer.userId))
    .orderBy(desc(assignments.updatedAt))
    .limit(200);
  const proRows = viewer.professionalProfileId
    ? await db
        .select({ a: assignments, orgName: organizations.name, proName: users.name })
        .from(assignmentParticipants)
        .innerJoin(assignments, eq(assignments.id, assignmentParticipants.assignmentId))
        .leftJoin(organizations, eq(organizations.id, assignments.organizationId))
        .leftJoin(users, eq(users.id, assignments.customerUserId))
        .where(and(eq(assignmentParticipants.userId, viewer.userId), eq(assignmentParticipants.role, "PROFESSIONAL"), isNull(assignmentParticipants.removedAt)))
        .orderBy(desc(assignments.updatedAt))
        .limit(200)
    : [];
  const invitationRows = viewer.professionalProfileId
    ? await db
        .select({ a: assignments, orgName: organizations.name, proName: users.name })
        .from(assignmentInvitations)
        .innerJoin(assignments, eq(assignments.id, assignmentInvitations.assignmentId))
        .leftJoin(organizations, eq(organizations.id, assignments.organizationId))
        .leftJoin(users, eq(users.id, assignments.customerUserId))
        .where(and(eq(assignmentInvitations.professionalUserId, viewer.userId), eq(assignmentInvitations.status, "PENDING"), inArray(assignments.status, ["OPEN", "PROFESSIONAL_INVITED", "OFFER_RECEIVED"])))
        .orderBy(desc(assignments.updatedAt))
        .limit(50)
    : [];
  const map = (r: { a: AssignmentRow; orgName: string | null; proName: string | null }): AssignmentListItem => ({
    id: r.a.id,
    publicId: r.a.publicId,
    title: r.a.title,
    status: r.a.status,
    template: r.a.template,
    confidentiality: r.a.confidentiality,
    languageCode: r.a.languageCode,
    deadline: r.a.deadline,
    updatedAt: r.a.updatedAt,
    counterpartName: r.proName,
    organizationName: r.orgName,
    agreedPriceMinor: r.a.agreedPriceMinor,
    currency: r.a.currency,
  });
  return { asCustomer: customerRows.map(map), asProfessional: proRows.map(map), invitations: invitationRows.map(map) };
}

export interface AssignmentListItem {
  id: string;
  publicId: string;
  title: string;
  status: AssignmentStatus;
  template: Template;
  confidentiality: ConfidentialityLevel;
  languageCode: string | null;
  deadline: Date | null;
  updatedAt: Date;
  counterpartName: string | null;
  organizationName: string | null;
  agreedPriceMinor: number | null;
  currency: string;
}

/** Open marketplace assignments visible to professionals (metadata only, no content). */
export async function listOpenAssignments(viewer: Viewer): Promise<AssignmentListItem[]> {
  const rows = await db
    .select({ a: assignments, orgName: organizations.name, proName: users.name })
    .from(assignments)
    .leftJoin(organizations, eq(organizations.id, assignments.organizationId))
    .leftJoin(users, eq(users.id, assignments.customerUserId))
    .where(and(inArray(assignments.status, ["OPEN", "OFFER_RECEIVED"]), sql`${assignments.customerUserId} <> ${viewer.userId}`))
    .orderBy(desc(assignments.openedAt))
    .limit(100);
  return rows.map((r) => ({
    id: r.a.id,
    publicId: r.a.publicId,
    title: r.a.title,
    status: r.a.status,
    template: r.a.template,
    confidentiality: r.a.confidentiality,
    languageCode: r.a.languageCode,
    deadline: r.a.deadline,
    updatedAt: r.a.updatedAt,
    counterpartName: r.orgName ?? r.proName,
    organizationName: r.orgName,
    agreedPriceMinor: r.a.budgetMinor,
    currency: r.a.currency,
  }));
}
