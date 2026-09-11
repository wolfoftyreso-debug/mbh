import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import {
  artifactVersionFiles,
  artifactVersions,
  assignmentStages,
  assignments,
  attachments,
  authorshipRecords,
  contributions,
  credentials,
  expertiseClaims,
  domains,
  organizations,
  professionalProfiles,
  publishedWorks,
  serviceCategories,
  signatures,
  users,
} from "@/server/db/schema";
import { fingerprint, hashText, hashVersion, sha256Hex } from "@/lib/hash";
import { newPublicRecordId } from "@/lib/ids";
import { audit } from "@/server/audit/log";
import { notify, notifyMany } from "@/server/notifications/service";
import { ConflictError, ValidationError } from "@/server/security/errors";
import type { AssignmentAuthContext } from "@/server/authz/policy";
import { AuthorizationError } from "@/server/authz/policy";
import { transitionAssignment, hasAcceptedConfidentialityAgreement } from "@/server/domain/assignments/service";
import { systemMessage, activeParticipantUserIds } from "@/server/domain/messages/service";
import { requestContext } from "@/server/security/request";

type ContributionRole = typeof contributions.$inferSelect.role;

export const SIGNING_STATEMENT =
  "I confirm that I personally performed the service described, that I have reviewed the exact version identified by the fingerprint shown, and that I accept attribution for it within the stated scope.";

export interface SigningPreview {
  version: typeof artifactVersions.$inferSelect;
  files: { id: string; filename: string; sha256: string }[];
  servicePerformed: string;
  contributionRole: ContributionRole;
  scope: string;
  categorySlug: string | null;
  customerLabel: string;
  fingerprint: string;
  recomputedHash: string;
  hashMatches: boolean;
  alreadySigned: boolean;
  verificationStatus: string;
  agreementAccepted: boolean;
}

async function serviceForContext(ctx: AssignmentAuthContext): Promise<{ servicePerformed: string; contributionRole: ContributionRole; scope: string; categorySlug: string | null }> {
  const [category] = ctx.assignment.serviceCategoryId ? await db.select().from(serviceCategories).where(eq(serviceCategories.id, ctx.assignment.serviceCategoryId)).limit(1) : [];
  const [contribution] = await db
    .select()
    .from(contributions)
    .where(and(eq(contributions.assignmentId, ctx.assignment.id), eq(contributions.userId, ctx.viewer.userId), inArray(contributions.status, ["ACTIVE", "COMPLETED"])))
    .orderBy(desc(contributions.createdAt))
    .limit(1);
  const role = (contribution?.role ?? (category?.defaultContributionRole as ContributionRole | undefined) ?? "AUTHOR") as ContributionRole;
  const service = category?.name ?? role.replace(/_/g, " ").toLowerCase();
  const scope = contribution?.scope || category?.description || service;
  return { servicePerformed: service, contributionRole: role, scope, categorySlug: category?.slug ?? null };
}

export async function getSigningPreview(ctx: AssignmentAuthContext, versionId: string): Promise<SigningPreview> {
  const [version] = await db.select().from(artifactVersions).where(and(eq(artifactVersions.id, versionId), eq(artifactVersions.assignmentId, ctx.assignment.id))).limit(1);
  if (!version) throw new ValidationError("Version not found");
  const files = await db
    .select({ id: attachments.id, filename: attachments.filename, sha256: attachments.sha256 })
    .from(artifactVersionFiles)
    .innerJoin(attachments, eq(attachments.id, artifactVersionFiles.attachmentId))
    .where(eq(artifactVersionFiles.versionId, versionId));
  const recomputed = hashVersion(version.content, files.map((f) => f.sha256));
  const svc = await serviceForContext(ctx);
  const [existing] = await db.select({ id: signatures.id }).from(signatures).where(and(eq(signatures.versionId, versionId), eq(signatures.signerUserId, ctx.viewer.userId))).limit(1);
  const [org] = ctx.assignment.organizationId ? await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, ctx.assignment.organizationId)).limit(1) : [];
  const [customer] = await db.select({ name: users.name }).from(users).where(eq(users.id, ctx.assignment.customerUserId)).limit(1);
  return {
    version,
    files,
    ...svc,
    customerLabel: org?.name ?? customer?.name ?? "Customer",
    fingerprint: fingerprint(version.contentHash),
    recomputedHash: recomputed,
    hashMatches: recomputed === version.contentHash,
    alreadySigned: Boolean(existing),
    verificationStatus: ctx.viewer.professionalVerificationStatus ?? "UNVERIFIED",
    agreementAccepted: await hasAcceptedConfidentialityAgreement(ctx.viewer.userId),
  };
}

/**
 * The signing ceremony. Server-side it:
 *  - re-verifies authorization and the professional's standing,
 *  - recomputes the content hash and refuses to sign on mismatch,
 *  - freezes the version (immutable) and stores the signature,
 *  - snapshots verification state and credentials,
 *  - creates the permanent authorship record (private by default),
 *  - moves the assignment to SIGNED.
 */
export async function signVersion(ctx: AssignmentAuthContext, input: { versionId: string; confirmed: boolean; typedConfirmation: string }): Promise<{ recordPublicId: string }> {
  if (!input.confirmed || input.typedConfirmation.trim().toUpperCase() !== "SIGN") throw new ValidationError("Explicit confirmation is required to sign");
  if (!ctx.viewer.professionalProfileId) throw new AuthorizationError("Only professionals can sign");
  const status = ctx.viewer.professionalVerificationStatus;
  if (status === "SUSPENDED" || status === "REVOKED") throw new AuthorizationError("Your professional account cannot sign at the moment");
  if (!(await hasAcceptedConfidentialityAgreement(ctx.viewer.userId))) throw new AuthorizationError("Accept the professional confidentiality agreement before signing");

  const preview = await getSigningPreview(ctx, input.versionId);
  const v = preview.version;
  if (v.deletedAt) throw new ConflictError("This version is no longer available");
  if (v.status !== "SUBMITTED" && v.status !== "SIGNED") throw new ConflictError("Only submitted versions can be signed");
  if (v.metadata && (v.metadata as Record<string, unknown>).source) throw new ConflictError("The customer source version cannot be signed");
  if (!preview.hashMatches) throw new ConflictError("Content hash mismatch: the version cannot be signed");
  if (preview.alreadySigned) throw new ConflictError("You have already signed this version");
  const latest = await db.select({ id: artifactVersions.id }).from(artifactVersions).where(and(eq(artifactVersions.assignmentId, ctx.assignment.id), isNull(artifactVersions.deletedAt))).orderBy(desc(artifactVersions.versionNumber)).limit(1);
  if (latest[0]?.id !== v.id) throw new ConflictError("Only the latest version can be signed");

  const [profile] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, ctx.viewer.userId)).limit(1);
  if (!profile) throw new AuthorizationError("Professional profile not found");
  const verifiedCredentials = await db.select({ title: credentials.title, issuer: credentials.issuer, type: credentials.type }).from(credentials).where(and(eq(credentials.profileId, profile.id), eq(credentials.status, "PLATFORM_VERIFIED"), eq(credentials.publicVisible, true)));
  const verifiedExpertise = await db.select({ name: domains.name, path: domains.path }).from(expertiseClaims).innerJoin(domains, eq(domains.id, expertiseClaims.domainId)).where(and(eq(expertiseClaims.profileId, profile.id), eq(expertiseClaims.status, "PLATFORM_VERIFIED")));
  const snapshot = {
    verificationStatus: profile.verificationStatus,
    identityVerifiedAt: profile.identityVerifiedAt,
    credentials: verifiedCredentials,
    expertise: verifiedExpertise,
    title: profile.title,
  };
  const [org] = ctx.assignment.organizationId ? await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, ctx.assignment.organizationId)).limit(1) : [];
  const req = await requestContext();
  const publicId = newPublicRecordId();

  await db.transaction(async (tx) => {
    const [sig] = await tx
      .insert(signatures)
      .values({
        assignmentId: ctx.assignment.id,
        versionId: v.id,
        signerUserId: ctx.viewer.userId,
        contributionRole: preview.contributionRole,
        contentHash: v.contentHash,
        servicePerformed: preview.servicePerformed,
        scope: preview.scope,
        languageCode: ctx.assignment.languageCode,
        wordCount: v.wordCount,
        verificationStatusAtSigning: profile.verificationStatus,
        credentialSnapshot: snapshot,
        confirmationStatement: SIGNING_STATEMENT,
        sessionId: ctx.viewer.sessionId,
        ipHash: req.ipHash,
        userAgent: req.userAgent,
      })
      .returning({ id: signatures.id });
    await tx.update(artifactVersions).set({ status: "SIGNED", immutable: true }).where(eq(artifactVersions.id, v.id));
    await tx
      .update(contributions)
      .set({ status: "SIGNED", signedAt: new Date(), signatureId: sig.id, versionId: v.id, completedAt: new Date(), verificationSnapshot: snapshot })
      .where(and(eq(contributions.assignmentId, ctx.assignment.id), eq(contributions.userId, ctx.viewer.userId), inArray(contributions.status, ["ACTIVE", "COMPLETED"])));
    await tx.insert(authorshipRecords).values({
      publicId,
      assignmentId: ctx.assignment.id,
      versionId: v.id,
      signatureId: sig.id,
      professionalUserId: ctx.viewer.userId,
      professionalPublicName: profile.displayName,
      professionalSlug: profile.slug,
      contributionRole: preview.contributionRole,
      servicePerformed: preview.servicePerformed,
      serviceCategorySlug: preview.categorySlug,
      scope: preview.scope,
      languageCode: ctx.assignment.languageCode,
      workTitle: ctx.assignment.title,
      versionNumber: v.versionNumber,
      contentHash: v.contentHash,
      wordCount: v.wordCount,
      signedAt: new Date(),
      verificationStatusAtSigning: profile.verificationStatus,
      credentialSnapshot: snapshot,
      customerOrganizationName: org?.name ?? null,
      visibility: "PRIVATE",
      customerDisplay: "HIDDEN",
      titlePublic: false,
      hashPublic: false,
    });
    await tx.update(assignmentStages).set({ status: "COMPLETED", completedAt: new Date() }).where(and(eq(assignmentStages.assignmentId, ctx.assignment.id), eq(assignmentStages.kind, "SIGN_OFF")));
    await tx.update(assignmentStages).set({ status: "ACTIVE", startedAt: new Date() }).where(and(eq(assignmentStages.assignmentId, ctx.assignment.id), eq(assignmentStages.kind, "CUSTOMER_APPROVAL"), eq(assignmentStages.status, "PENDING")));
    if (ctx.assignment.status !== "SIGNED") {
      if (ctx.assignment.status === "IN_PROGRESS" || ctx.assignment.status === "REVISION_REQUESTED") {
        await transitionAssignment(ctx.assignment.id, "DELIVERED", "PROFESSIONAL", ctx.viewer.userId, undefined, tx);
      }
      await transitionAssignment(ctx.assignment.id, "SIGNED", "PROFESSIONAL", ctx.viewer.userId, undefined, tx);
    }
    await tx.update(professionalProfiles).set({ signedWorks: profile.signedWorks + 1 }).where(eq(professionalProfiles.id, profile.id));
    await audit({ actorType: "USER", actorUserId: ctx.viewer.userId, action: "VERSION_SIGNED", entityType: "signature", entityId: sig.id, assignmentId: ctx.assignment.id, metadata: { versionNumber: v.versionNumber, hash: v.contentHash, contributionRole: preview.contributionRole, verificationStatus: profile.verificationStatus, sessionId: ctx.viewer.sessionId }, ipHash: req.ipHash }, tx);
    await audit({ actorType: "USER", actorUserId: ctx.viewer.userId, action: "RECORD_CREATED", entityType: "authorship_record", entityId: publicId, assignmentId: ctx.assignment.id, metadata: { versionNumber: v.versionNumber } }, tx);
    await systemMessage(ctx.assignment.id, `${profile.displayName} signed Version ${v.versionNumber} (fingerprint ${preview.fingerprint}). Record ${publicId}.`, { event: "VERSION_SIGNED", versionId: v.id, versionNumber: v.versionNumber, recordPublicId: publicId }, tx);
  });

  const recipients = (await activeParticipantUserIds(ctx.assignment.id)).filter((u) => u !== ctx.viewer.userId);
  await notifyMany(recipients, "SIGNATURE_COMPLETED", { title: ctx.assignment.title, publicId: ctx.assignment.publicId, professionalName: profile.displayName, version: String(v.versionNumber), recordId: publicId });
  return { recordPublicId: publicId };
}

export async function approveSignedVersion(ctx: AssignmentAuthContext): Promise<void> {
  const [signed] = await db.select().from(artifactVersions).where(and(eq(artifactVersions.assignmentId, ctx.assignment.id), eq(artifactVersions.status, "SIGNED"))).orderBy(desc(artifactVersions.versionNumber)).limit(1);
  if (!signed) throw new ConflictError("There is no signed version to approve yet");
  await transitionAssignment(ctx.assignment.id, "CUSTOMER_APPROVED", "CUSTOMER", ctx.viewer.userId);
  await audit({ actorType: "USER", actorUserId: ctx.viewer.userId, action: "CUSTOMER_APPROVED", entityType: "assignment", entityId: ctx.assignment.id, assignmentId: ctx.assignment.id, metadata: { versionNumber: signed.versionNumber } });
  const { assignmentPaymentState } = await import("@/server/finance/payments");
  const pay = await assignmentPaymentState(ctx.assignment.id);
  if ((ctx.assignment.agreedPriceMinor ?? 0) === 0 || pay.captured) {
    const { completeAssignment } = await import("@/server/domain/assignments/service");
    await completeAssignment(ctx.assignment.id, "SYSTEM", ctx.viewer.userId);
  }
}

/* ------------------------------------------------------------------ */
/* Records                                                              */
/* ------------------------------------------------------------------ */

export interface RecordVisibilityInput {
  visibility: "PRIVATE" | "ANONYMIZED" | "PUBLIC";
  customerDisplay: "HIDDEN" | "PRIVATE_ORGANIZATION" | "NAMED";
  titlePublic: boolean;
  hashPublic: boolean;
  publicationUrl: string | null;
}

/** Only the customer side may change what a record reveals. Confidential levels constrain the options. */
export async function setRecordVisibility(ctx: AssignmentAuthContext, recordId: string, input: RecordVisibilityInput): Promise<void> {
  const [record] = await db.select().from(authorshipRecords).where(and(eq(authorshipRecords.id, recordId), eq(authorshipRecords.assignmentId, ctx.assignment.id))).limit(1);
  if (!record) throw new ValidationError("Record not found");
  const level = ctx.assignment.confidentiality;
  let next = { ...input };
  if (level === "CONFIDENTIAL" || level === "STRICT_CONFIDENTIAL") {
    // Confidential work can contribute to reputation only through anonymized records.
    if (next.visibility === "PUBLIC") next.visibility = "ANONYMIZED";
    next.titlePublic = false;
    next.hashPublic = false;
    next.customerDisplay = next.customerDisplay === "NAMED" ? "PRIVATE_ORGANIZATION" : next.customerDisplay;
    next.publicationUrl = null;
  }
  if (next.visibility === "ANONYMIZED") {
    next = { ...next, titlePublic: false, hashPublic: false, customerDisplay: next.customerDisplay === "NAMED" ? "PRIVATE_ORGANIZATION" : next.customerDisplay };
  }
  if (next.visibility !== "PRIVATE" && !ctx.assignment.publicAttributionAllowed && ctx.assignment.portfolioPermission === "NOT_PERMITTED") {
    // Publishing the record is itself the explicit consent; reflect it on the assignment.
    await db.update(assignments).set({ publicAttributionAllowed: true }).where(eq(assignments.id, ctx.assignment.id));
  }
  if (next.publicationUrl) {
    try {
      const u = new URL(next.publicationUrl);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    } catch {
      throw new ValidationError("Publication URL must be a valid http(s) URL");
    }
  }
  await db.transaction(async (tx) => {
    await tx.update(authorshipRecords).set({ visibility: next.visibility, customerDisplay: next.customerDisplay, titlePublic: next.titlePublic, hashPublic: next.hashPublic, publicationUrl: next.publicationUrl }).where(eq(authorshipRecords.id, recordId));
    // Naming the customer on the record is the consent for naming customer-side knowledge sources.
    await tx.update(contributions).set({ publicAttribution: next.customerDisplay === "NAMED" }).where(and(eq(contributions.assignmentId, ctx.assignment.id), eq(contributions.role, "KNOWLEDGE_SOURCE")));
    if (next.publicationUrl && next.publicationUrl !== record.publicationUrl) {
      await tx.insert(publishedWorks).values({ recordId, url: next.publicationUrl, publishedAt: new Date(), addedByUserId: ctx.viewer.userId });
      await audit({ actorType: "USER", actorUserId: ctx.viewer.userId, action: "PUBLISHED_WORK_ADDED", entityType: "authorship_record", entityId: record.publicId, assignmentId: ctx.assignment.id }, tx);
    }
    await audit({ actorType: "USER", actorUserId: ctx.viewer.userId, action: "RECORD_VISIBILITY_CHANGED", entityType: "authorship_record", entityId: record.publicId, assignmentId: ctx.assignment.id, metadata: { from: record.visibility, to: next.visibility, customerDisplay: next.customerDisplay, titlePublic: next.titlePublic, hashPublic: next.hashPublic } }, tx);
  });
  await systemMessage(ctx.assignment.id, `Record ${record.publicId} visibility set to ${next.visibility.toLowerCase()}.`, { event: "RECORD_VISIBILITY_CHANGED", recordPublicId: record.publicId });
}

export async function listRecordsForAssignment(assignmentId: string) {
  return db.select().from(authorshipRecords).where(eq(authorshipRecords.assignmentId, assignmentId)).orderBy(desc(authorshipRecords.signedAt));
}

export interface PublicRecordView {
  publicId: string;
  status: "VALID" | "REVOKED" | "SUPERSEDED";
  visibility: "ANONYMIZED" | "PUBLIC";
  workTitle: string | null;
  professionalName: string;
  professionalSlug: string;
  professionalTitle: string | null;
  contributionRole: ContributionRole;
  servicePerformed: string;
  scope: string;
  languageCode: string | null;
  signedAt: Date;
  versionNumber: number | null;
  wordCount: number | null;
  contentHash: string | null;
  verificationStatusAtSigning: string;
  credentialSnapshot: { credentials?: { title: string; issuer: string; type: string }[]; expertise?: { name: string; path: string }[]; title?: string };
  customerLabel: string | null;
  publicationUrl: string | null;
  revokedAt: Date | null;
  otherContributions: { role: ContributionRole; displayName: string; displayTitle: string | null; scope: string; signedAt: Date | null }[];
}

/** Public view: never returns private records; anonymized records omit identifying details. */
export async function getPublicRecord(publicId: string): Promise<PublicRecordView | null> {
  const [r] = await db.select().from(authorshipRecords).where(eq(authorshipRecords.publicId, publicId)).limit(1);
  if (!r || r.visibility === "PRIVATE") return null;
  const [profile] = await db.select({ title: professionalProfiles.title, publishedAt: professionalProfiles.publishedAt }).from(professionalProfiles).where(eq(professionalProfiles.userId, r.professionalUserId)).limit(1);
  const anonymized = r.visibility === "ANONYMIZED";
  const others = anonymized
    ? []
    : await db
        .select({ role: contributions.role, displayName: contributions.displayName, displayTitle: contributions.displayTitle, scope: contributions.scope, signedAt: contributions.signedAt, publicAttribution: contributions.publicAttribution, userId: contributions.userId })
        .from(contributions)
        .where(and(eq(contributions.assignmentId, r.assignmentId), inArray(contributions.status, ["SIGNED", "COMPLETED"])));
  const customerLabel = r.customerDisplay === "NAMED" ? r.customerOrganizationName : r.customerDisplay === "PRIVATE_ORGANIZATION" ? "Private organization" : null;
  return {
    publicId: r.publicId,
    status: r.status,
    visibility: r.visibility as "ANONYMIZED" | "PUBLIC",
    workTitle: r.titlePublic && !anonymized ? r.workTitle : null,
    professionalName: r.professionalPublicName,
    professionalSlug: profile?.publishedAt ? r.professionalSlug : "",
    professionalTitle: (r.credentialSnapshot as { title?: string }).title ?? profile?.title ?? null,
    contributionRole: r.contributionRole,
    servicePerformed: r.servicePerformed,
    scope: r.scope,
    languageCode: r.languageCode,
    signedAt: r.signedAt,
    versionNumber: anonymized ? null : r.versionNumber,
    wordCount: anonymized ? null : r.wordCount,
    contentHash: r.hashPublic && !anonymized ? r.contentHash : null,
    verificationStatusAtSigning: r.verificationStatusAtSigning,
    credentialSnapshot: r.credentialSnapshot as PublicRecordView["credentialSnapshot"],
    customerLabel,
    publicationUrl: anonymized ? null : r.publicationUrl,
    revokedAt: r.revokedAt,
    otherContributions: others
      .filter((o) => o.userId !== r.professionalUserId)
      .map((o) => ({ role: o.role, displayName: o.role === "KNOWLEDGE_SOURCE" && !o.publicAttribution ? "Customer" : (o.displayName ?? "Contributor"), displayTitle: o.displayTitle, scope: o.scope, signedAt: o.signedAt })),
  };
}

/** Compares supplied text or file bytes against a record's signed hash. */
export async function verifyAgainstRecord(publicId: string, input: { text?: string; fileBytes?: Uint8Array }): Promise<{ result: "MATCH" | "NO_MATCH" | "NOT_AVAILABLE"; suppliedHash: string | null }> {
  const [r] = await db.select({ contentHash: authorshipRecords.contentHash, hashPublic: authorshipRecords.hashPublic, visibility: authorshipRecords.visibility, versionId: authorshipRecords.versionId }).from(authorshipRecords).where(eq(authorshipRecords.publicId, publicId)).limit(1);
  if (!r || r.visibility !== "PUBLIC" || !r.hashPublic) return { result: "NOT_AVAILABLE", suppliedHash: null };
  const files = await db.select({ sha256: attachments.sha256 }).from(artifactVersionFiles).innerJoin(attachments, eq(attachments.id, artifactVersionFiles.attachmentId)).where(eq(artifactVersionFiles.versionId, r.versionId));
  if (input.text !== undefined) {
    // Compare canonical text hash within the composite version hash.
    const composite = hashVersion(input.text, files.map((f) => f.sha256));
    return { result: composite === r.contentHash ? "MATCH" : "NO_MATCH", suppliedHash: hashText(input.text) };
  }
  if (input.fileBytes) {
    const fileHash = sha256Hex(input.fileBytes);
    const [version] = await db.select({ content: artifactVersions.content }).from(artifactVersions).where(eq(artifactVersions.id, r.versionId)).limit(1);
    const composite = hashVersion(version?.content ?? null, [fileHash]);
    return { result: composite === r.contentHash || files.some((f) => f.sha256 === fileHash) ? "MATCH" : "NO_MATCH", suppliedHash: fileHash };
  }
  return { result: "NOT_AVAILABLE", suppliedHash: null };
}

export async function revokeRecord(recordPublicId: string, adminUserId: string, reason: string): Promise<void> {
  const [r] = await db.select().from(authorshipRecords).where(eq(authorshipRecords.publicId, recordPublicId)).limit(1);
  if (!r) throw new ValidationError("Record not found");
  await db.update(authorshipRecords).set({ status: "REVOKED", revokedAt: new Date(), revokedReason: reason.slice(0, 500) }).where(eq(authorshipRecords.id, r.id));
  await audit({ actorType: "ADMIN", actorUserId: adminUserId, action: "RECORD_REVOKED", entityType: "authorship_record", entityId: recordPublicId, assignmentId: r.assignmentId, metadata: { reason } });
  await notify(r.professionalUserId, "VERIFICATION_UPDATE", { status: `Record ${recordPublicId} revoked`, notes: reason });
}
