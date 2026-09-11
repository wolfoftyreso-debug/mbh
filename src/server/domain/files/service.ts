import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { assignments, attachments, credentialDocuments, credentials, identityVerifications, professionalProfiles } from "@/server/db/schema";
import { newStorageKey } from "@/lib/ids";
import { sha256Hex } from "@/lib/hash";
import { audit } from "@/server/audit/log";
import { getStorage } from "@/server/storage";
import { validateUpload, type AttachmentPurpose } from "@/server/storage/validation";
import { rateLimit } from "@/server/security/rate-limit";
import { ValidationError } from "@/server/security/errors";
import type { Viewer } from "@/server/auth/session";
import { AuthorizationError, NotFoundError, resolveAssignmentContext, can } from "@/server/authz/policy";
import { requestContext } from "@/server/security/request";

type Attachment = typeof attachments.$inferSelect;

/**
 * Stores an upload in private storage. When assignmentPublicId is provided the
 * viewer must be allowed to upload to that assignment; otherwise the file is
 * held as an unattached upload owned by the viewer (attached when the
 * assignment is created).
 */
export async function storeUpload(viewer: Viewer, input: { purpose: AttachmentPurpose; filename: string; declaredType: string; bytes: Uint8Array; assignmentPublicId: string | null }): Promise<Attachment> {
  await rateLimit(`upload:${viewer.userId}`, 120, 3600);
  const { mimeType } = validateUpload(input.purpose, input.declaredType, input.bytes, input.filename);
  let assignmentId: string | null = null;
  let retentionUntil: Date | null = null;
  if (input.assignmentPublicId) {
    const [a] = await db.select().from(assignments).where(eq(assignments.publicId, input.assignmentPublicId)).limit(1);
    if (!a) throw new NotFoundError();
    const ctx = await resolveAssignmentContext(viewer, a);
    if (ctx.role === "NONE" || !can(ctx, "upload_file")) throw new AuthorizationError("You cannot upload files to this assignment");
    assignmentId = a.id;
    if (a.confidentiality === "STRICT_CONFIDENTIAL") {
      const { getPlatformSetting } = await import("@/server/domain/admin/settings");
      const days = Number((await getPlatformSetting("strict_confidential_retention_days")) ?? 90);
      retentionUntil = new Date(Date.now() + days * 86400000);
    }
  }
  if (input.purpose === "VERIFICATION_DOCUMENT") retentionUntil = new Date(Date.now() + 90 * 86400000);
  const ext = input.filename.includes(".") ? input.filename.split(".").pop()! : "";
  const key = newStorageKey(ext);
  const storage = getStorage();
  await storage.put(key, input.bytes, mimeType);
  const [row] = await db
    .insert(attachments)
    .values({ ownerUserId: viewer.userId, assignmentId, purpose: input.purpose, storageProvider: storage.name, storageKey: key, filename: input.filename.slice(0, 200), mimeType, sizeBytes: input.bytes.byteLength, sha256: sha256Hex(input.bytes), retentionUntil, scanStatus: "SKIPPED" })
    .returning();
  await audit({ actorType: "USER", actorUserId: viewer.userId, action: "FILE_UPLOADED", entityType: "attachment", entityId: row.id, assignmentId, metadata: { purpose: input.purpose, mimeType, sizeBytes: row.sizeBytes } });
  return row;
}

/**
 * Resolves whether the viewer may read a file. Assignment files follow the
 * assignment authorization; verification documents are readable only by their
 * owner and platform admins reviewing them; profile photos of published
 * profiles are readable by anyone.
 */
export async function authorizeFileRead(viewer: Viewer | null, attachmentId: string): Promise<{ attachment: Attachment; public: boolean }> {
  const [att] = await db.select().from(attachments).where(and(eq(attachments.id, attachmentId), isNull(attachments.deletedAt))).limit(1);
  if (!att) throw new NotFoundError();

  if (att.purpose === "PROFILE_PHOTO") {
    const [p] = await db.select({ publishedAt: professionalProfiles.publishedAt, userId: professionalProfiles.userId }).from(professionalProfiles).where(eq(professionalProfiles.photoAttachmentId, att.id)).limit(1);
    if (p?.publishedAt) return { attachment: att, public: true };
    if (viewer && (viewer.userId === att.ownerUserId || viewer.isAdmin)) return { attachment: att, public: false };
    throw new NotFoundError();
  }
  if (!viewer) throw new NotFoundError();
  if (att.ownerUserId === viewer.userId && !att.assignmentId) return { attachment: att, public: false };

  if (att.purpose === "VERIFICATION_DOCUMENT") {
    if (att.ownerUserId === viewer.userId) return { attachment: att, public: false };
    if (viewer.isAdmin) {
      // Admins may read verification documents only in the context of a pending review; access is audited by the caller.
      const [cred] = await db.select({ id: credentialDocuments.id }).from(credentialDocuments).innerJoin(credentials, eq(credentials.id, credentialDocuments.credentialId)).where(eq(credentialDocuments.attachmentId, att.id)).limit(1);
      const [idv] = await db.select({ id: identityVerifications.id }).from(identityVerifications).where(eq(identityVerifications.documentAttachmentId, att.id)).limit(1);
      if (cred || idv) return { attachment: att, public: false };
    }
    throw new NotFoundError();
  }

  if (att.assignmentId) {
    const [a] = await db.select().from(assignments).where(eq(assignments.id, att.assignmentId)).limit(1);
    if (!a) throw new NotFoundError();
    const ctx = await resolveAssignmentContext(viewer, a);
    if (ctx.role === "NONE") throw new NotFoundError();
    if (!can(ctx, "view_content")) throw new AuthorizationError("Content access requires an explicit grant");
    return { attachment: att, public: false };
  }
  if (att.ownerUserId === viewer.userId || viewer.isAdmin) return { attachment: att, public: false };
  throw new NotFoundError();
}

export async function readFileBytes(att: Attachment): Promise<Uint8Array | null> {
  const storage = getStorage();
  if (storage.name !== att.storageProvider) {
    // Provider changed since upload: try the original provider by name.
    const { DatabaseStorage } = await import("@/server/storage/database");
    const { LocalDiskStorage } = await import("@/server/storage/local");
    const { env } = await import("@/lib/config/env");
    if (att.storageProvider === "database") return new DatabaseStorage().get(att.storageKey);
    if (att.storageProvider === "local") return new LocalDiskStorage(env.STORAGE_LOCAL_DIR).get(att.storageKey);
  }
  return storage.get(att.storageKey);
}

export async function recordFileAccess(viewer: Viewer, att: Attachment): Promise<void> {
  // Sensitive purposes and confidential assignments are audited on every access.
  let sensitive = att.purpose === "VERIFICATION_DOCUMENT";
  if (att.assignmentId && !sensitive) {
    const [a] = await db.select({ confidentiality: assignments.confidentiality }).from(assignments).where(eq(assignments.id, att.assignmentId)).limit(1);
    sensitive = a?.confidentiality === "CONFIDENTIAL" || a?.confidentiality === "STRICT_CONFIDENTIAL" || viewer.isAdmin;
  }
  if (!sensitive) return;
  const req = await requestContext();
  await audit({ actorType: viewer.isAdmin ? "ADMIN" : "USER", actorUserId: viewer.userId, action: "FILE_ACCESSED", entityType: "attachment", entityId: att.id, assignmentId: att.assignmentId, ipHash: req.ipHash, metadata: { purpose: att.purpose } });
}

export async function deleteFile(viewer: Viewer, attachmentId: string, reason: string): Promise<void> {
  const [att] = await db.select().from(attachments).where(and(eq(attachments.id, attachmentId), isNull(attachments.deletedAt))).limit(1);
  if (!att) throw new NotFoundError();
  if (att.ownerUserId !== viewer.userId && !viewer.isAdmin) throw new AuthorizationError("Not permitted");
  const { artifactVersionFiles } = await import("@/server/db/schema");
  const [signedUse] = await db.select({ id: artifactVersionFiles.id }).from(artifactVersionFiles).where(eq(artifactVersionFiles.attachmentId, attachmentId)).limit(1);
  if (signedUse) throw new ValidationError("Files that belong to a delivered version cannot be deleted; they are retained under the retention policy");
  await getStorage().delete(att.storageKey).catch(() => undefined);
  await db.update(attachments).set({ deletedAt: new Date(), deletionReason: reason.slice(0, 200) }).where(eq(attachments.id, attachmentId));
  await audit({ actorType: viewer.isAdmin ? "ADMIN" : "USER", actorUserId: viewer.userId, action: "FILE_DELETED", entityType: "attachment", entityId: attachmentId, assignmentId: att.assignmentId, metadata: { reason } });
}

export async function listAssignmentFiles(assignmentId: string) {
  return db.select().from(attachments).where(and(eq(attachments.assignmentId, assignmentId), isNull(attachments.deletedAt)));
}
