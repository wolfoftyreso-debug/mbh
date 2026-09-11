import { and, eq, isNull, lt, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { artifactVersions, assignments, attachments, identityVerifications } from "@/server/db/schema";
import { getStorage } from "@/server/storage";
import { audit } from "@/server/audit/log";
import { logger } from "@/server/logger";
import { systemMessage } from "@/server/domain/messages/service";
import { getPlatformSetting } from "@/server/domain/admin/settings";

export interface RetentionResult {
  filesDeleted: number;
  versionsCleared: number;
  assignmentsProcessed: number;
}

/**
 * Retention job. Deletes file bytes whose retention date has passed and clears
 * the content of versions in strictly confidential assignments after the
 * configured period. Hashes, metadata, ledger, audit and signed provenance
 * metadata are always kept; only content is removed.
 */
export async function runRetention(now = new Date()): Promise<RetentionResult> {
  const result: RetentionResult = { filesDeleted: 0, versionsCleared: 0, assignmentsProcessed: 0 };
  const storage = getStorage();

  // 1. Files past their retention date
  const expired = await db.select().from(attachments).where(and(lt(attachments.retentionUntil, now), isNull(attachments.deletedAt))).limit(500);
  for (const att of expired) {
    try {
      await storage.delete(att.storageKey);
    } catch (err) {
      logger.warn("retention_storage_delete_failed", { attachmentId: att.id, error: (err as Error).message });
    }
    await db.update(attachments).set({ deletedAt: now, deletionReason: "retention_policy" }).where(eq(attachments.id, att.id));
    await db.update(identityVerifications).set({ documentAttachmentId: null }).where(eq(identityVerifications.documentAttachmentId, att.id));
    await audit({ actorType: "SYSTEM", action: "CONTENT_DELETED_RETENTION", entityType: "attachment", entityId: att.id, assignmentId: att.assignmentId, metadata: { purpose: att.purpose } });
    result.filesDeleted++;
  }

  // 2. Strictly confidential assignments: clear version content after the retention period
  const days = Number((await getPlatformSetting("strict_confidential_retention_days")) ?? 90);
  const cutoff = new Date(now.getTime() - days * 86400000);
  const candidates = await db
    .select({ id: assignments.id, completedAt: assignments.completedAt, cancelledAt: assignments.cancelledAt })
    .from(assignments)
    .where(and(eq(assignments.confidentiality, "STRICT_CONFIDENTIAL"), inArray(assignments.status, ["COMPLETED", "CANCELLED"]), isNull(assignments.contentDeletedAt)))
    .limit(200);
  for (const a of candidates) {
    const endedAt = a.completedAt ?? a.cancelledAt;
    if (!endedAt || endedAt > cutoff) continue;
    const versions = await db.select({ id: artifactVersions.id, content: artifactVersions.content }).from(artifactVersions).where(and(eq(artifactVersions.assignmentId, a.id), isNull(artifactVersions.deletedAt)));
    for (const v of versions) {
      // Signed versions may only have their content cleared with status DELETED (enforced by trigger).
      await db.update(artifactVersions).set({ content: null, status: "DELETED", deletedAt: now, deletionReason: "retention_policy" }).where(eq(artifactVersions.id, v.id));
      result.versionsCleared++;
    }
    const files = await db.select().from(attachments).where(and(eq(attachments.assignmentId, a.id), isNull(attachments.deletedAt)));
    for (const att of files) {
      await storage.delete(att.storageKey).catch(() => undefined);
      await db.update(attachments).set({ deletedAt: now, deletionReason: "retention_policy" }).where(eq(attachments.id, att.id));
      result.filesDeleted++;
    }
    await db.update(assignments).set({ contentDeletedAt: now }).where(eq(assignments.id, a.id));
    await systemMessage(a.id, "Artifact content deleted according to the retention policy. Provenance metadata and fingerprints are retained.", { event: "CONTENT_DELETED_RETENTION" });
    await audit({ actorType: "SYSTEM", action: "CONTENT_DELETED_RETENTION", entityType: "assignment", entityId: a.id, assignmentId: a.id, metadata: { versions: versions.length, files: files.length, retentionDays: days } });
    result.assignmentsProcessed++;
  }
  logger.info("retention_job_completed", { ...result });
  return result;
}
