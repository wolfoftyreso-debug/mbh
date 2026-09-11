import { and, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  adminActions,
  assignments,
  auditEvents,
  credentials,
  disputes,
  domains,
  expertiseClaims,
  identityVerifications,
  organizations,
  payments,
  professionalProfiles,
  reviews,
  serviceCategories,
  sessions,
  users,
} from "@/server/db/schema";
import { audit } from "@/server/audit/log";
import { notify, notifyMany } from "@/server/notifications/service";
import { ConflictError, ValidationError } from "@/server/security/errors";
import type { Viewer } from "@/server/auth/session";
import { AuthorizationError } from "@/server/authz/policy";
import { transitionAssignment } from "@/server/domain/assignments/service";
import { activeParticipantUserIds, systemMessage } from "@/server/domain/messages/service";
import { getPlatformSetting } from "./settings";
import { slugify } from "@/lib/utils";

type VerificationStatus = typeof professionalProfiles.$inferSelect.verificationStatus;

function assertAdmin(viewer: Viewer): void {
  if (!viewer.isAdmin) throw new AuthorizationError("Administrator access required");
}

async function recordAdminAction(viewer: Viewer, action: string, targetType: string, targetId: string, reason: string, assignmentId: string | null = null, expiresAt: Date | null = null): Promise<void> {
  await db.insert(adminActions).values({ adminUserId: viewer.userId, action, targetType, targetId, assignmentId, reason: reason.slice(0, 1000), expiresAt });
  await audit({ actorType: "ADMIN", actorUserId: viewer.userId, action: "ADMIN_ACTION", entityType: targetType, entityId: targetId, assignmentId, metadata: { adminAction: action, reason } });
}

/* ---------------- Dashboard ---------------- */

export async function dashboardStats(viewer: Viewer) {
  assertAdmin(viewer);
  const [[u], [p], [a], [pendingCreds], [pendingExp], [pendingIds], [openDisputes], [rev]] = await Promise.all([
    db.select({ n: count() }).from(users).where(isNull(users.deletedAt)),
    db.select({ n: count() }).from(professionalProfiles),
    db.select({ n: count() }).from(assignments),
    db.select({ n: count() }).from(credentials).where(eq(credentials.status, "PENDING_REVIEW")),
    db.select({ n: count() }).from(expertiseClaims).where(eq(expertiseClaims.status, "PENDING_REVIEW")),
    db.select({ n: count() }).from(identityVerifications).where(eq(identityVerifications.status, "PENDING_REVIEW")),
    db.select({ n: count() }).from(disputes).where(inArray(disputes.status, ["OPEN", "UNDER_REVIEW"])),
    db.select({ total: sql<string>`coalesce(sum(${payments.platformFeeMinor}), 0)`, currency: payments.currency }).from(payments).where(eq(payments.status, "CAPTURED")).groupBy(payments.currency).limit(1),
  ]);
  return {
    users: Number(u.n),
    professionals: Number(p.n),
    assignments: Number(a.n),
    pendingCredentials: Number(pendingCreds.n),
    pendingExpertise: Number(pendingExp.n),
    pendingIdentity: Number(pendingIds.n),
    openDisputes: Number(openDisputes.n),
    feesCaptured: rev ? { amountMinor: Number(rev.total), currency: rev.currency } : null,
  };
}

/* ---------------- Users ---------------- */

export async function listUsers(viewer: Viewer, q: string | null, page = 1) {
  assertAdmin(viewer);
  const pageSize = 25;
  const where = q ? or(ilike(users.email, `%${q}%`), ilike(users.name, `%${q}%`)) : undefined;
  const rows = await db
    .select({ u: users, profileId: professionalProfiles.id, verificationStatus: professionalProfiles.verificationStatus })
    .from(users)
    .leftJoin(professionalProfiles, eq(professionalProfiles.userId, users.id))
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return rows.map((r) => ({ ...r.u, professionalProfileId: r.profileId, verificationStatus: r.verificationStatus }));
}

export async function setUserSuspended(viewer: Viewer, userId: string, suspended: boolean, reason: string): Promise<void> {
  assertAdmin(viewer);
  if (userId === viewer.userId) throw new ValidationError("You cannot suspend yourself");
  const [target] = await db.select({ platformRole: users.platformRole }).from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw new ValidationError("User not found");
  if (target.platformRole === "SUPER_ADMIN" && viewer.platformRole !== "SUPER_ADMIN") throw new AuthorizationError("Cannot suspend a super admin");
  await db.update(users).set({ suspendedAt: suspended ? new Date() : null, suspendedReason: suspended ? reason.slice(0, 500) : null }).where(eq(users.id, userId));
  if (suspended) {
    await db.delete(sessions).where(eq(sessions.userId, userId));
    await db.update(professionalProfiles).set({ verificationStatus: "SUSPENDED" }).where(and(eq(professionalProfiles.userId, userId), sql`${professionalProfiles.verificationStatus} <> 'REVOKED'`));
  }
  await recordAdminAction(viewer, suspended ? "SUSPEND_USER" : "UNSUSPEND_USER", "user", userId, reason);
  await audit({ actorType: "ADMIN", actorUserId: viewer.userId, action: suspended ? "ACCOUNT_SUSPENDED" : "ACCOUNT_UNSUSPENDED", entityType: "user", entityId: userId, metadata: { reason } });
  if (!suspended) await notify(userId, "SECURITY_ALERT", { message: "Your account suspension has been lifted." });
}

export async function setPlatformRole(viewer: Viewer, userId: string, role: "USER" | "ADMIN" | "SUPER_ADMIN"): Promise<void> {
  assertAdmin(viewer);
  if (viewer.platformRole !== "SUPER_ADMIN") throw new AuthorizationError("Only super admins can change platform roles");
  if (userId === viewer.userId) throw new ValidationError("You cannot change your own role");
  await db.update(users).set({ platformRole: role }).where(eq(users.id, userId));
  await recordAdminAction(viewer, "SET_PLATFORM_ROLE", "user", userId, `role=${role}`);
}

/* ---------------- Verification ---------------- */

export async function verificationQueue(viewer: Viewer) {
  assertAdmin(viewer);
  const [creds, exps, ids] = await Promise.all([
    db
      .select({ c: credentials, profileId: professionalProfiles.id, displayName: professionalProfiles.displayName, slug: professionalProfiles.slug })
      .from(credentials)
      .innerJoin(professionalProfiles, eq(professionalProfiles.id, credentials.profileId))
      .where(eq(credentials.status, "PENDING_REVIEW"))
      .orderBy(credentials.createdAt)
      .limit(100),
    db
      .select({ e: expertiseClaims, domainName: domains.name, domainPath: domains.path, profileId: professionalProfiles.id, displayName: professionalProfiles.displayName, slug: professionalProfiles.slug })
      .from(expertiseClaims)
      .innerJoin(domains, eq(domains.id, expertiseClaims.domainId))
      .innerJoin(professionalProfiles, eq(professionalProfiles.id, expertiseClaims.profileId))
      .where(eq(expertiseClaims.status, "PENDING_REVIEW"))
      .orderBy(expertiseClaims.createdAt)
      .limit(100),
    db
      .select({ i: identityVerifications, profileId: professionalProfiles.id, displayName: professionalProfiles.displayName, slug: professionalProfiles.slug })
      .from(identityVerifications)
      .innerJoin(professionalProfiles, eq(professionalProfiles.id, identityVerifications.profileId))
      .where(eq(identityVerifications.status, "PENDING_REVIEW"))
      .orderBy(identityVerifications.createdAt)
      .limit(100),
  ]);
  return { credentials: creds, expertise: exps, identities: ids };
}

export async function decideCredential(viewer: Viewer, credentialId: string, decision: "PLATFORM_VERIFIED" | "REJECTED", notes: string): Promise<void> {
  assertAdmin(viewer);
  const [c] = await db.select().from(credentials).where(eq(credentials.id, credentialId)).limit(1);
  if (!c) throw new ValidationError("Credential not found");
  const { credentialVerifications } = await import("@/server/db/schema");
  await db.transaction(async (tx) => {
    await tx.update(credentials).set({ status: decision, verifiedAt: decision === "PLATFORM_VERIFIED" ? new Date() : null, verifiedByUserId: viewer.userId }).where(eq(credentials.id, credentialId));
    await tx.insert(credentialVerifications).values({ credentialId, reviewerUserId: viewer.userId, decision, notes: notes.slice(0, 2000) });
    await audit({ actorType: "ADMIN", actorUserId: viewer.userId, action: decision === "PLATFORM_VERIFIED" ? "CREDENTIAL_VERIFIED" : "CREDENTIAL_REJECTED", entityType: "credential", entityId: credentialId, metadata: { profileId: c.profileId } }, tx);
  });
  await recomputeVerificationStatus(viewer, c.profileId);
}

export async function decideExpertise(viewer: Viewer, claimId: string, decision: "PLATFORM_VERIFIED" | "REJECTED", notes: string): Promise<void> {
  assertAdmin(viewer);
  const [claim] = await db.select().from(expertiseClaims).where(eq(expertiseClaims.id, claimId)).limit(1);
  if (!claim) throw new ValidationError("Claim not found");
  const { expertiseVerifications } = await import("@/server/db/schema");
  await db.transaction(async (tx) => {
    await tx.update(expertiseClaims).set({ status: decision, verifiedAt: decision === "PLATFORM_VERIFIED" ? new Date() : null, verifiedByUserId: viewer.userId }).where(eq(expertiseClaims.id, claimId));
    await tx.insert(expertiseVerifications).values({ claimId, reviewerUserId: viewer.userId, decision, notes: notes.slice(0, 2000) });
    await audit({ actorType: "ADMIN", actorUserId: viewer.userId, action: decision === "PLATFORM_VERIFIED" ? "EXPERTISE_VERIFIED" : "EXPERTISE_REJECTED", entityType: "expertise_claim", entityId: claimId, metadata: { profileId: claim.profileId } }, tx);
  });
  await recomputeVerificationStatus(viewer, claim.profileId);
}

export async function decideIdentity(viewer: Viewer, verificationId: string, decision: "PLATFORM_VERIFIED" | "REJECTED", notes: string): Promise<void> {
  assertAdmin(viewer);
  const [idv] = await db.select().from(identityVerifications).where(eq(identityVerifications.id, verificationId)).limit(1);
  if (!idv) throw new ValidationError("Identity verification not found");
  await db.transaction(async (tx) => {
    await tx.update(identityVerifications).set({ status: decision, reviewerUserId: viewer.userId, notes: notes.slice(0, 2000), reviewedAt: new Date() }).where(eq(identityVerifications.id, verificationId));
    if (decision === "PLATFORM_VERIFIED") {
      await tx.update(professionalProfiles).set({ identityVerifiedAt: new Date() }).where(eq(professionalProfiles.id, idv.profileId));
    }
    await audit({ actorType: "ADMIN", actorUserId: viewer.userId, action: decision === "PLATFORM_VERIFIED" ? "IDENTITY_VERIFIED" : "IDENTITY_REJECTED", entityType: "professional_profile", entityId: idv.profileId }, tx);
  });
  await recomputeVerificationStatus(viewer, idv.profileId);
}

/**
 * Verification levels are derived from evidence actually reviewed:
 *  IDENTITY_VERIFIED       identity document reviewed
 *  CREDENTIALS_VERIFIED    identity + at least one verified credential
 *  PROFESSIONAL_VERIFIED   identity + verified credential + verified expertise or language (set explicitly by an admin)
 */
export async function recomputeVerificationStatus(viewer: Viewer, profileId: string): Promise<void> {
  const [p] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.id, profileId)).limit(1);
  if (!p || p.verificationStatus === "SUSPENDED" || p.verificationStatus === "REVOKED" || p.verificationStatus === "PROFESSIONAL_VERIFIED") return;
  const [vc] = await db.select({ n: count() }).from(credentials).where(and(eq(credentials.profileId, profileId), eq(credentials.status, "PLATFORM_VERIFIED")));
  let next: VerificationStatus = "UNVERIFIED";
  if (p.identityVerifiedAt) next = Number(vc.n) > 0 ? "CREDENTIALS_VERIFIED" : "IDENTITY_VERIFIED";
  if (next !== p.verificationStatus) {
    await db.update(professionalProfiles).set({ verificationStatus: next, credentialsVerifiedAt: next === "CREDENTIALS_VERIFIED" ? new Date() : p.credentialsVerifiedAt }).where(eq(professionalProfiles.id, profileId));
    await audit({ actorType: "ADMIN", actorUserId: viewer.userId, action: "VERIFICATION_STATUS_CHANGED", entityType: "professional_profile", entityId: profileId, metadata: { from: p.verificationStatus, to: next } });
    await notify(p.userId, "VERIFICATION_UPDATE", { status: next.replace(/_/g, " ").toLowerCase() });
  }
}

export async function setVerificationStatus(viewer: Viewer, profileId: string, status: VerificationStatus, reason: string): Promise<void> {
  assertAdmin(viewer);
  const [p] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.id, profileId)).limit(1);
  if (!p) throw new ValidationError("Profile not found");
  if (status === "PROFESSIONAL_VERIFIED" && !p.identityVerifiedAt) throw new ValidationError("Professional verification requires a verified identity");
  await db.update(professionalProfiles).set({ verificationStatus: status, professionalVerifiedAt: status === "PROFESSIONAL_VERIFIED" ? new Date() : p.professionalVerifiedAt, verificationNote: reason.slice(0, 500) }).where(eq(professionalProfiles.id, profileId));
  await recordAdminAction(viewer, "SET_VERIFICATION_STATUS", "professional_profile", profileId, reason);
  await audit({ actorType: "ADMIN", actorUserId: viewer.userId, action: status === "REVOKED" ? "VERIFICATION_REVOKED" : "VERIFICATION_STATUS_CHANGED", entityType: "professional_profile", entityId: profileId, metadata: { from: p.verificationStatus, to: status, reason } });
  await notify(p.userId, "VERIFICATION_UPDATE", { status: status.replace(/_/g, " ").toLowerCase(), notes: reason });
}

/* ---------------- Assignments and content access ---------------- */

export async function listAssignmentsAdmin(viewer: Viewer, filters: { status?: string; q?: string; page?: number }) {
  assertAdmin(viewer);
  const page = filters.page ?? 1;
  const conds = [];
  if (filters.status) conds.push(eq(assignments.status, filters.status as typeof assignments.$inferSelect.status));
  if (filters.q) conds.push(or(ilike(assignments.title, `%${filters.q}%`), eq(assignments.publicId, filters.q)));
  return db
    .select({ a: assignments, customerName: users.name, orgName: organizations.name })
    .from(assignments)
    .innerJoin(users, eq(users.id, assignments.customerUserId))
    .leftJoin(organizations, eq(organizations.id, assignments.organizationId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(assignments.updatedAt))
    .limit(50)
    .offset((page - 1) * 50);
}

/** Time-boxed, audited content access grant. Required for admins to see assignment content. */
export async function grantContentAccess(viewer: Viewer, assignmentId: string, reason: string): Promise<void> {
  assertAdmin(viewer);
  if (reason.trim().length < 10) throw new ValidationError("A specific reason (support request, dispute, abuse investigation, legal requirement or security incident) is required");
  const [a] = await db.select({ id: assignments.id, confidentiality: assignments.confidentiality, title: assignments.title, publicId: assignments.publicId }).from(assignments).where(eq(assignments.id, assignmentId)).limit(1);
  if (!a) throw new ValidationError("Assignment not found");
  if (a.confidentiality === "STRICT_CONFIDENTIAL" && viewer.platformRole !== "SUPER_ADMIN") throw new AuthorizationError("Strictly confidential assignments require super admin access");
  const minutes = Number((await getPlatformSetting("content_access_grant_minutes")) ?? 60);
  const expiresAt = new Date(Date.now() + minutes * 60000);
  await db.insert(adminActions).values({ adminUserId: viewer.userId, action: "ADMIN_CONTENT_ACCESS", targetType: "assignment", targetId: assignmentId, assignmentId, reason: reason.slice(0, 1000), expiresAt });
  await audit({ actorType: "ADMIN", actorUserId: viewer.userId, action: "ADMIN_CONTENT_ACCESS", entityType: "assignment", entityId: assignmentId, assignmentId, metadata: { reason, expiresMinutes: minutes, confidentiality: a.confidentiality } });
  await systemMessage(assignmentId, `Platform staff accessed this assignment for: ${reason.slice(0, 200)}.`, { event: "ADMIN_CONTENT_ACCESS" });
}

/* ---------------- Disputes ---------------- */

export async function listDisputes(viewer: Viewer) {
  assertAdmin(viewer);
  return db
    .select({ d: disputes, title: assignments.title, publicId: assignments.publicId, openerName: users.name })
    .from(disputes)
    .innerJoin(assignments, eq(assignments.id, disputes.assignmentId))
    .innerJoin(users, eq(users.id, disputes.openedByUserId))
    .orderBy(desc(disputes.createdAt))
    .limit(100);
}

export async function resolveDispute(viewer: Viewer, disputeId: string, resolution: "RESOLVED_FOR_CUSTOMER" | "RESOLVED_FOR_PROFESSIONAL" | "RESOLVED_SPLIT" | "CLOSED" | "UNDER_REVIEW", notes: string, nextAssignmentStatus: "COMPLETED" | "CANCELLED" | "IN_PROGRESS" | "SIGNED" | null): Promise<void> {
  assertAdmin(viewer);
  const [d] = await db.select().from(disputes).where(eq(disputes.id, disputeId)).limit(1);
  if (!d) throw new ValidationError("Dispute not found");
  if (d.status !== "OPEN" && d.status !== "UNDER_REVIEW") throw new ConflictError("Dispute already resolved");
  const resolved = resolution !== "UNDER_REVIEW";
  await db.update(disputes).set({ status: resolution, resolutionNotes: notes.slice(0, 5000), resolvedByUserId: resolved ? viewer.userId : null, resolvedAt: resolved ? new Date() : null }).where(eq(disputes.id, disputeId));
  if (resolved && nextAssignmentStatus) {
    if (nextAssignmentStatus === "COMPLETED") {
      const { completeAssignment } = await import("@/server/domain/assignments/service");
      await completeAssignment(d.assignmentId, "ADMIN", viewer.userId);
    } else {
      await transitionAssignment(d.assignmentId, nextAssignmentStatus, "ADMIN", viewer.userId, `Dispute ${resolution.toLowerCase().replace(/_/g, " ")}`);
    }
  }
  await recordAdminAction(viewer, resolved ? "RESOLVE_DISPUTE" : "REVIEW_DISPUTE", "dispute", disputeId, notes, d.assignmentId);
  await audit({ actorType: "ADMIN", actorUserId: viewer.userId, action: resolved ? "DISPUTE_RESOLVED" : "DISPUTE_UPDATED", entityType: "dispute", entityId: disputeId, assignmentId: d.assignmentId, metadata: { resolution } });
  const [a] = await db.select({ title: assignments.title, publicId: assignments.publicId }).from(assignments).where(eq(assignments.id, d.assignmentId)).limit(1);
  const participants = await activeParticipantUserIds(d.assignmentId);
  if (a) await notifyMany(participants, "DISPUTE_UPDATE", { title: a.title, publicId: a.publicId, status: resolution.toLowerCase().replace(/_/g, " "), notes: notes.slice(0, 500) });
}

/* ---------------- Reviews moderation ---------------- */

export async function hideReview(viewer: Viewer, reviewId: string, hidden: boolean, reason: string): Promise<void> {
  assertAdmin(viewer);
  const [r] = await db.select({ professionalUserId: reviews.professionalUserId }).from(reviews).where(eq(reviews.id, reviewId)).limit(1);
  if (!r) throw new ValidationError("Review not found");
  await db.update(reviews).set({ hiddenByAdminAt: hidden ? new Date() : null }).where(eq(reviews.id, reviewId));
  await recordAdminAction(viewer, hidden ? "HIDE_REVIEW" : "UNHIDE_REVIEW", "review", reviewId, reason);
  const { refreshReputation } = await import("@/server/domain/reviews/service");
  await refreshReputation(r.professionalUserId);
}

/* ---------------- Taxonomy and categories ---------------- */

export async function upsertCategory(viewer: Viewer, input: { id: string | null; name: string; description: string; kind: "LANGUAGE" | "DOMAIN" | "COMBINED"; defaultContributionRole: string; active: boolean; sortOrder: number }): Promise<void> {
  assertAdmin(viewer);
  if (input.id) {
    await db.update(serviceCategories).set({ name: input.name, description: input.description, kind: input.kind, defaultContributionRole: input.defaultContributionRole, active: input.active, sortOrder: input.sortOrder }).where(eq(serviceCategories.id, input.id));
  } else {
    await db.insert(serviceCategories).values({ slug: slugify(input.name), name: input.name, description: input.description, kind: input.kind, defaultContributionRole: input.defaultContributionRole, active: input.active, sortOrder: input.sortOrder });
  }
  await audit({ actorType: "ADMIN", actorUserId: viewer.userId, action: "CATEGORY_CHANGED", entityType: "service_category", entityId: input.id ?? slugify(input.name), metadata: { name: input.name } });
}

export async function upsertDomain(viewer: Viewer, input: { id: string | null; parentId: string | null; name: string; description: string; active: boolean }): Promise<void> {
  assertAdmin(viewer);
  const parent = input.parentId ? (await db.select().from(domains).where(eq(domains.id, input.parentId)).limit(1))[0] : null;
  if (input.parentId && !parent) throw new ValidationError("Parent domain not found");
  const slug = slugify(input.name);
  const path = parent ? `${parent.path}/${slug}` : slug;
  if (input.id) {
    await db.update(domains).set({ name: input.name, description: input.description, active: input.active }).where(eq(domains.id, input.id));
  } else {
    await db.insert(domains).values({ parentId: input.parentId, slug, name: input.name, path, depth: parent ? parent.depth + 1 : 0, description: input.description, active: input.active });
  }
  await audit({ actorType: "ADMIN", actorUserId: viewer.userId, action: "DOMAIN_CHANGED", entityType: "domain", entityId: input.id ?? path, metadata: { name: input.name } });
}

/* ---------------- Audit ---------------- */

export async function listAuditEvents(viewer: Viewer, filters: { action?: string; entityId?: string; assignmentId?: string; page?: number }) {
  assertAdmin(viewer);
  const conds = [];
  if (filters.action) conds.push(eq(auditEvents.action, filters.action));
  if (filters.entityId) conds.push(eq(auditEvents.entityId, filters.entityId));
  if (filters.assignmentId) conds.push(eq(auditEvents.assignmentId, filters.assignmentId));
  const page = filters.page ?? 1;
  return db
    .select({ e: auditEvents, actorName: users.name })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorUserId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(auditEvents.createdAt))
    .limit(100)
    .offset((page - 1) * 100);
}
