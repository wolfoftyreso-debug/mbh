import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { agreementAcceptances, assignments, authorshipRecords, credentials, expertiseClaims, ledgerEntries, messages, notificationPreferences, notifications, organizationMembers, privacyRequests, professionalLanguages, professionalProfiles, reviews, serviceListings, sessions, users } from "@/server/db/schema";
import { audit } from "@/server/audit/log";
import { ConflictError } from "@/server/security/errors";
import type { Viewer } from "@/server/auth/session";
import { notify } from "@/server/notifications/service";
import { auth } from "@/server/auth/config";
import { headers } from "next/headers";

/**
 * GDPR-aware data handling. Export returns the user's own data in a portable
 * JSON structure. Deletion is a workflow: content is removed or anonymized
 * while records the platform must retain (ledger, audit, signed provenance
 * metadata) are preserved without personal content.
 */
export async function exportUserData(viewer: Viewer): Promise<Record<string, unknown>> {
  const [user] = await db.select({ id: users.id, name: users.name, email: users.email, locale: users.locale, timezone: users.timezone, createdAt: users.createdAt }).from(users).where(eq(users.id, viewer.userId)).limit(1);
  const [profile] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, viewer.userId)).limit(1);
  const [langs, exps, creds, listings, ownAssignments, ownMessages, ownReviews, prefs, acceptances, memberships, records] = await Promise.all([
    profile ? db.select().from(professionalLanguages).where(eq(professionalLanguages.profileId, profile.id)) : [],
    profile ? db.select().from(expertiseClaims).where(eq(expertiseClaims.profileId, profile.id)) : [],
    profile ? db.select().from(credentials).where(eq(credentials.profileId, profile.id)) : [],
    profile ? db.select().from(serviceListings).where(eq(serviceListings.profileId, profile.id)) : [],
    db.select({ publicId: assignments.publicId, title: assignments.title, status: assignments.status, createdAt: assignments.createdAt, confidentiality: assignments.confidentiality }).from(assignments).where(eq(assignments.customerUserId, viewer.userId)),
    db.select({ assignmentId: messages.assignmentId, body: messages.body, createdAt: messages.createdAt }).from(messages).where(eq(messages.senderUserId, viewer.userId)),
    db.select().from(reviews).where(eq(reviews.reviewerUserId, viewer.userId)),
    db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, viewer.userId)),
    db.select().from(agreementAcceptances).where(eq(agreementAcceptances.userId, viewer.userId)),
    db.select().from(organizationMembers).where(eq(organizationMembers.userId, viewer.userId)),
    db.select({ publicId: authorshipRecords.publicId, workTitle: authorshipRecords.workTitle, signedAt: authorshipRecords.signedAt, visibility: authorshipRecords.visibility }).from(authorshipRecords).where(eq(authorshipRecords.professionalUserId, viewer.userId)),
  ]);
  await db.insert(privacyRequests).values({ userId: viewer.userId, type: "DATA_EXPORT", status: "COMPLETED", completedAt: new Date() });
  await audit({ actorType: "USER", actorUserId: viewer.userId, action: "DATA_EXPORT_REQUESTED", entityType: "user", entityId: viewer.userId });
  return {
    exportedAt: new Date().toISOString(),
    user,
    professionalProfile: profile ? { ...profile, languages: langs, expertise: exps, credentials: creds, listings } : null,
    assignmentsAsCustomer: ownAssignments,
    messages: ownMessages,
    reviewsWritten: ownReviews,
    notificationPreferences: prefs,
    agreements: acceptances,
    organizationMemberships: memberships,
    authorshipRecords: records,
  };
}

export async function requestAccountDeletion(viewer: Viewer): Promise<void> {
  const [pending] = await db.select({ id: privacyRequests.id }).from(privacyRequests).where(and(eq(privacyRequests.userId, viewer.userId), eq(privacyRequests.type, "ACCOUNT_DELETION"), eq(privacyRequests.status, "PENDING"))).limit(1);
  if (pending) throw new ConflictError("A deletion request is already pending");
  await db.insert(privacyRequests).values({ userId: viewer.userId, type: "ACCOUNT_DELETION", status: "PENDING" });
  await audit({ actorType: "USER", actorUserId: viewer.userId, action: "ACCOUNT_DELETION_REQUESTED", entityType: "user", entityId: viewer.userId });
  await notify(viewer.userId, "SECURITY_ALERT", { message: "We received your account deletion request. It will be processed after open assignments and legally required retention periods are settled." });
}

/**
 * Executes an approved deletion: personal data is anonymized, sessions
 * revoked, public profile unpublished. Ledger entries, audit events and
 * authorship record metadata are retained (they reference an anonymized id).
 */
export async function executeAccountDeletion(adminUserId: string, userId: string): Promise<void> {
  const [openWork] = await db.select({ id: assignments.id }).from(assignments).where(and(eq(assignments.customerUserId, userId), eq(assignments.status, "IN_PROGRESS"))).limit(1);
  if (openWork) throw new ConflictError("User has assignments in progress");
  const anonymizedEmail = `deleted-${userId.toLowerCase()}@anonymized.invalid`;
  await db.transaction(async (tx) => {
    await tx.update(users).set({ name: "Deleted user", email: anonymizedEmail, image: null, phone: null, deletedAt: new Date() }).where(eq(users.id, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.update(professionalProfiles).set({ publishedAt: null, bio: "", title: "", displayName: "Former professional", externalUrls: [], photoAttachmentId: null }).where(eq(professionalProfiles.userId, userId));
    await tx.update(privacyRequests).set({ status: "COMPLETED", completedAt: new Date() }).where(and(eq(privacyRequests.userId, userId), eq(privacyRequests.type, "ACCOUNT_DELETION")));
    await tx.delete(notifications).where(eq(notifications.userId, userId));
    await audit({ actorType: "ADMIN", actorUserId: adminUserId, action: "ADMIN_ACTION", entityType: "user", entityId: userId, metadata: { adminAction: "EXECUTE_ACCOUNT_DELETION", ledgerRetained: true } }, tx);
  });
  // ledgerEntries intentionally untouched: financial records are retained.
  void ledgerEntries;
}

export async function revokeAllSessions(viewer: Viewer): Promise<void> {
  await auth.api.revokeSessions({ headers: await headers() });
  await audit({ actorType: "USER", actorUserId: viewer.userId, action: "SESSIONS_REVOKED", entityType: "user", entityId: viewer.userId });
  await notify(viewer.userId, "SECURITY_ALERT", { message: "You signed out of all devices." });
}
