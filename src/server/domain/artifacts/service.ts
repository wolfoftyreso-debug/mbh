import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { artifactVersionFiles, artifactVersions, artifacts, assignmentStages, assignments, attachments, contributions, reviewComments, revisionRequests, users } from "@/server/db/schema";
import { countWords, hashVersion } from "@/lib/hash";
import { audit } from "@/server/audit/log";
import { notify, notifyMany } from "@/server/notifications/service";
import { ConflictError, ValidationError } from "@/server/security/errors";
import type { AssignmentAuthContext } from "@/server/authz/policy";
import { transitionAssignment } from "@/server/domain/assignments/service";
import { systemMessage, activeParticipantUserIds } from "@/server/domain/messages/service";
import { rateLimit } from "@/server/security/rate-limit";

type VersionRow = typeof artifactVersions.$inferSelect;

export interface VersionSummary {
  id: string;
  versionNumber: number;
  label: string;
  status: VersionRow["status"];
  immutable: boolean;
  contentHash: string;
  wordCount: number;
  createdAt: Date;
  submittedAt: Date | null;
  createdBy: { id: string; name: string };
  files: { id: string; filename: string; mimeType: string; sizeBytes: number }[];
  hasContent: boolean;
  parentVersionId: string | null;
  deletedAt: Date | null;
}

export async function ensureArtifact(assignmentId: string, title: string): Promise<string> {
  const [a] = await db.select().from(assignments).where(eq(assignments.id, assignmentId)).limit(1);
  if (a?.currentArtifactId) return a.currentArtifactId;
  const [artifact] = await db.insert(artifacts).values({ assignmentId, kind: "TEXT", title }).returning({ id: artifacts.id });
  await db.update(assignments).set({ currentArtifactId: artifact.id }).where(eq(assignments.id, assignmentId));
  return artifact.id;
}

/**
 * Creates a new version. Never overwrites: a new row with the next version
 * number and a server-computed content hash. Optionally submits (delivers) it.
 */
export async function createVersion(ctx: AssignmentAuthContext, input: { content: string | null; attachmentIds: string[]; label: string; submit: boolean; note?: string }): Promise<VersionSummary> {
  const content = input.content?.trim() ? input.content : null;
  if (!content && input.attachmentIds.length === 0) throw new ValidationError("Provide text or at least one file");
  if (content && content.length > 2_000_000) throw new ValidationError("Text is too long");
  await rateLimit(`version:${ctx.viewer.userId}`, 60, 3600);

  if (input.attachmentIds.length) {
    const owned = await db
      .select({ id: attachments.id, sha256: attachments.sha256 })
      .from(attachments)
      .where(and(inArray(attachments.id, input.attachmentIds), eq(attachments.assignmentId, ctx.assignment.id), isNull(attachments.deletedAt)));
    if (owned.length !== input.attachmentIds.length) throw new ValidationError("One or more files are invalid");
  }
  const files = input.attachmentIds.length ? await db.select({ id: attachments.id, sha256: attachments.sha256 }).from(attachments).where(inArray(attachments.id, input.attachmentIds)) : [];
  const artifactId = await ensureArtifact(ctx.assignment.id, ctx.assignment.title);

  const version = await db.transaction(async (tx) => {
    const [last] = await tx.select().from(artifactVersions).where(eq(artifactVersions.artifactId, artifactId)).orderBy(desc(artifactVersions.versionNumber)).limit(1).for("update");
    const versionNumber = (last?.versionNumber ?? 0) + 1;
    const [v] = await tx
      .insert(artifactVersions)
      .values({
        artifactId,
        assignmentId: ctx.assignment.id,
        versionNumber,
        parentVersionId: last?.id ?? null,
        label: input.label.slice(0, 120),
        content,
        contentHash: hashVersion(content, files.map((f) => f.sha256)),
        wordCount: countWords(content),
        createdByUserId: ctx.viewer.userId,
        status: input.submit ? "SUBMITTED" : "DRAFT",
        submittedAt: input.submit ? new Date() : null,
        metadata: input.note ? { note: input.note.slice(0, 1000) } : {},
      })
      .returning();
    if (files.length) await tx.insert(artifactVersionFiles).values(files.map((f) => ({ versionId: v.id, attachmentId: f.id })));
    await tx.update(artifacts).set({ currentVersionId: v.id }).where(eq(artifacts.id, artifactId));
    // Previous submitted-but-unsigned versions are superseded
    if (last && last.status === "SUBMITTED") await tx.update(artifactVersions).set({ status: "SUPERSEDED" }).where(eq(artifactVersions.id, last.id));
    // Mark open revision requests as addressed
    await tx.update(revisionRequests).set({ status: "ADDRESSED", resolvedByVersionId: v.id, resolvedAt: new Date() }).where(and(eq(revisionRequests.assignmentId, ctx.assignment.id), eq(revisionRequests.status, "OPEN")));
    await audit({ actorType: "USER", actorUserId: ctx.viewer.userId, action: input.submit ? "VERSION_SUBMITTED" : "VERSION_CREATED", entityType: "artifact_version", entityId: v.id, assignmentId: ctx.assignment.id, metadata: { versionNumber, wordCount: v.wordCount, files: files.length } }, tx);
    await systemMessage(ctx.assignment.id, `${ctx.viewer.name} ${input.submit ? "submitted" : "saved a draft of"} Version ${versionNumber}${input.label ? ` — ${input.label}` : ""}.`, { event: input.submit ? "VERSION_SUBMITTED" : "VERSION_CREATED", versionId: v.id, versionNumber }, tx);
    if (input.submit && ctx.role === "PROFESSIONAL") {
      if (ctx.assignment.status === "IN_PROGRESS" || ctx.assignment.status === "REVISION_REQUESTED") {
        await transitionAssignment(ctx.assignment.id, "DELIVERED", "PROFESSIONAL", ctx.viewer.userId, undefined, tx);
      } else if (ctx.assignment.status === "ACCEPTED") {
        await transitionAssignment(ctx.assignment.id, "IN_PROGRESS", "PROFESSIONAL", ctx.viewer.userId, undefined, tx);
        await transitionAssignment(ctx.assignment.id, "DELIVERED", "PROFESSIONAL", ctx.viewer.userId, undefined, tx);
      }
      await tx.update(assignmentStages).set({ status: "COMPLETED", completedAt: new Date() }).where(and(eq(assignmentStages.assignmentId, ctx.assignment.id), eq(assignmentStages.assigneeUserId, ctx.viewer.userId), eq(assignmentStages.status, "ACTIVE"), inArray(assignmentStages.kind, ["WRITING", "CORRECTIONS", "DOMAIN_REVIEW", "LANGUAGE_REVIEW", "FACT_CHECK", "TRANSLATION"])));
      await activateNextStage(ctx.assignment.id, tx);
    }
    return v;
  });

  if (input.submit) {
    const recipients = (await activeParticipantUserIds(ctx.assignment.id)).filter((u) => u !== ctx.viewer.userId);
    await notifyMany(recipients, "DELIVERY_RECEIVED", { title: ctx.assignment.title, publicId: ctx.assignment.publicId, version: String(version.versionNumber) });
  }
  return toSummary(version, { id: ctx.viewer.userId, name: ctx.viewer.name }, []);
}

async function activateNextStage(assignmentId: string, tx: Parameters<Parameters<typeof db.transaction>[0]>[0]): Promise<void> {
  const stages = await tx.select().from(assignmentStages).where(eq(assignmentStages.assignmentId, assignmentId)).orderBy(asc(assignmentStages.position));
  const active = stages.find((s) => s.status === "ACTIVE");
  if (active) return;
  const next = stages.find((s) => s.status === "PENDING");
  if (next) await tx.update(assignmentStages).set({ status: "ACTIVE", startedAt: new Date() }).where(eq(assignmentStages.id, next.id));
}

export async function requestRevision(ctx: AssignmentAuthContext, versionId: string, message: string): Promise<void> {
  if (message.trim().length < 5) throw new ValidationError("Describe the changes you need");
  const [v] = await db.select().from(artifactVersions).where(and(eq(artifactVersions.id, versionId), eq(artifactVersions.assignmentId, ctx.assignment.id))).limit(1);
  if (!v) throw new ValidationError("Version not found");
  await db.transaction(async (tx) => {
    const [r] = await tx.insert(revisionRequests).values({ assignmentId: ctx.assignment.id, versionId, requestedByUserId: ctx.viewer.userId, message: message.slice(0, 10000) }).returning({ id: revisionRequests.id });
    await transitionAssignment(ctx.assignment.id, "REVISION_REQUESTED", "CUSTOMER", ctx.viewer.userId, undefined, tx);
    await tx.update(assignmentStages).set({ status: "ACTIVE", startedAt: new Date() }).where(and(eq(assignmentStages.assignmentId, ctx.assignment.id), inArray(assignmentStages.kind, ["WRITING", "CORRECTIONS", "DOMAIN_REVIEW"]), eq(assignmentStages.status, "COMPLETED")));
    await audit({ actorType: "USER", actorUserId: ctx.viewer.userId, action: "REVISION_REQUESTED", entityType: "revision_request", entityId: r.id, assignmentId: ctx.assignment.id, metadata: { versionNumber: v.versionNumber } }, tx);
    await systemMessage(ctx.assignment.id, `${ctx.viewer.name} requested a revision of Version ${v.versionNumber}.`, { event: "REVISION_REQUESTED", versionId, versionNumber: v.versionNumber }, tx);
  });
  if (ctx.assignment.primaryProfessionalUserId) {
    await notify(ctx.assignment.primaryProfessionalUserId, "REVISION_REQUESTED", { title: ctx.assignment.title, publicId: ctx.assignment.publicId, version: String(v.versionNumber) });
  }
}

export async function moveToFinalReview(ctx: AssignmentAuthContext): Promise<void> {
  await transitionAssignment(ctx.assignment.id, "FINAL_REVIEW", ctx.role === "PROFESSIONAL" ? "PROFESSIONAL" : "CUSTOMER", ctx.viewer.userId);
  const latest = await latestVersion(ctx.assignment.id);
  if (ctx.assignment.primaryProfessionalUserId && latest) {
    await notify(ctx.assignment.primaryProfessionalUserId, "FINAL_VERSION_READY", { title: ctx.assignment.title, publicId: ctx.assignment.publicId, version: String(latest.versionNumber) });
  }
}

export async function addReviewComment(ctx: AssignmentAuthContext, input: { versionId: string; type: typeof reviewComments.$inferSelect.type; domainVerdict: typeof reviewComments.$inferSelect.domainVerdict; anchorStart: number | null; anchorEnd: number | null; quotedText: string; body: string; suggestion: string }): Promise<string> {
  if (input.body.trim().length < 2) throw new ValidationError("Comment cannot be empty");
  const [v] = await db.select({ id: artifactVersions.id, versionNumber: artifactVersions.versionNumber }).from(artifactVersions).where(and(eq(artifactVersions.id, input.versionId), eq(artifactVersions.assignmentId, ctx.assignment.id))).limit(1);
  if (!v) throw new ValidationError("Version not found");
  await rateLimit(`comment:${ctx.viewer.userId}`, 200, 3600);
  const [c] = await db
    .insert(reviewComments)
    .values({
      assignmentId: ctx.assignment.id,
      versionId: input.versionId,
      authorUserId: ctx.viewer.userId,
      type: input.type,
      domainVerdict: input.type === "DOMAIN" || input.type === "TERMINOLOGY" || input.type === "FACTUAL" ? input.domainVerdict : null,
      anchorStart: input.anchorStart,
      anchorEnd: input.anchorEnd,
      quotedText: input.quotedText.slice(0, 1000),
      body: input.body.slice(0, 5000),
      suggestion: input.suggestion.slice(0, 5000),
    })
    .returning({ id: reviewComments.id });
  await audit({ actorType: "USER", actorUserId: ctx.viewer.userId, action: "REVIEW_COMMENT_CREATED", entityType: "review_comment", entityId: c.id, assignmentId: ctx.assignment.id, metadata: { type: input.type, verdict: input.domainVerdict, versionNumber: v.versionNumber } });
  // A reviewer contribution becomes visible in provenance
  if (ctx.role === "PROFESSIONAL") {
    await db
      .update(contributions)
      .set({ versionId: input.versionId })
      .where(and(eq(contributions.assignmentId, ctx.assignment.id), eq(contributions.userId, ctx.viewer.userId), eq(contributions.status, "ACTIVE"), isNull(contributions.versionId)));
  }
  return c.id;
}

export async function resolveReviewComment(ctx: AssignmentAuthContext, commentId: string, status: "RESOLVED" | "REJECTED"): Promise<void> {
  const [c] = await db.select().from(reviewComments).where(and(eq(reviewComments.id, commentId), eq(reviewComments.assignmentId, ctx.assignment.id))).limit(1);
  if (!c) throw new ValidationError("Comment not found");
  if (c.status !== "OPEN") throw new ConflictError("Comment already resolved");
  await db.update(reviewComments).set({ status, resolvedByUserId: ctx.viewer.userId, resolvedAt: new Date() }).where(eq(reviewComments.id, commentId));
}

/* ------------------------------------------------------------------ */
/* Queries                                                              */
/* ------------------------------------------------------------------ */

function toSummary(v: VersionRow, createdBy: { id: string; name: string }, files: VersionSummary["files"]): VersionSummary {
  return {
    id: v.id,
    versionNumber: v.versionNumber,
    label: v.label,
    status: v.status,
    immutable: v.immutable,
    contentHash: v.contentHash,
    wordCount: v.wordCount,
    createdAt: v.createdAt,
    submittedAt: v.submittedAt,
    createdBy,
    files,
    hasContent: v.content !== null,
    parentVersionId: v.parentVersionId,
    deletedAt: v.deletedAt,
  };
}

export async function listVersions(assignmentId: string): Promise<VersionSummary[]> {
  const rows = await db
    .select({ v: artifactVersions, userId: users.id, userName: users.name })
    .from(artifactVersions)
    .innerJoin(users, eq(users.id, artifactVersions.createdByUserId))
    .where(eq(artifactVersions.assignmentId, assignmentId))
    .orderBy(asc(artifactVersions.versionNumber));
  const ids = rows.map((r) => r.v.id);
  const files = ids.length
    ? await db
        .select({ versionId: artifactVersionFiles.versionId, id: attachments.id, filename: attachments.filename, mimeType: attachments.mimeType, sizeBytes: attachments.sizeBytes })
        .from(artifactVersionFiles)
        .innerJoin(attachments, eq(attachments.id, artifactVersionFiles.attachmentId))
        .where(and(inArray(artifactVersionFiles.versionId, ids), isNull(attachments.deletedAt)))
    : [];
  return rows.map((r) => toSummary(r.v, { id: r.userId, name: r.userName }, files.filter((f) => f.versionId === r.v.id).map(({ id, filename, mimeType, sizeBytes }) => ({ id, filename, mimeType, sizeBytes }))));
}

export async function getVersion(assignmentId: string, versionId: string): Promise<VersionRow | null> {
  const [v] = await db.select().from(artifactVersions).where(and(eq(artifactVersions.id, versionId), eq(artifactVersions.assignmentId, assignmentId))).limit(1);
  return v ?? null;
}

export async function latestVersion(assignmentId: string): Promise<VersionRow | null> {
  const [v] = await db.select().from(artifactVersions).where(and(eq(artifactVersions.assignmentId, assignmentId), isNull(artifactVersions.deletedAt))).orderBy(desc(artifactVersions.versionNumber)).limit(1);
  return v ?? null;
}

export async function latestSubmittedVersion(assignmentId: string): Promise<VersionRow | null> {
  const [v] = await db
    .select()
    .from(artifactVersions)
    .where(and(eq(artifactVersions.assignmentId, assignmentId), inArray(artifactVersions.status, ["SUBMITTED", "SIGNED"]), isNull(artifactVersions.deletedAt), sql`coalesce((${artifactVersions.metadata}->>'source')::boolean, false) = false`))
    .orderBy(desc(artifactVersions.versionNumber))
    .limit(1);
  return v ?? null;
}

export interface ReviewCommentView {
  id: string;
  versionId: string;
  type: typeof reviewComments.$inferSelect.type;
  domainVerdict: typeof reviewComments.$inferSelect.domainVerdict;
  anchorStart: number | null;
  anchorEnd: number | null;
  quotedText: string;
  body: string;
  suggestion: string;
  status: typeof reviewComments.$inferSelect.status;
  createdAt: Date;
  author: { id: string; name: string };
}

export async function listReviewComments(assignmentId: string, versionId?: string): Promise<ReviewCommentView[]> {
  const rows = await db
    .select({ c: reviewComments, userId: users.id, userName: users.name })
    .from(reviewComments)
    .innerJoin(users, eq(users.id, reviewComments.authorUserId))
    .where(versionId ? and(eq(reviewComments.assignmentId, assignmentId), eq(reviewComments.versionId, versionId)) : eq(reviewComments.assignmentId, assignmentId))
    .orderBy(asc(reviewComments.createdAt));
  return rows.map((r) => ({
    id: r.c.id,
    versionId: r.c.versionId,
    type: r.c.type,
    domainVerdict: r.c.domainVerdict,
    anchorStart: r.c.anchorStart,
    anchorEnd: r.c.anchorEnd,
    quotedText: r.c.quotedText,
    body: r.c.body,
    suggestion: r.c.suggestion,
    status: r.c.status,
    createdAt: r.c.createdAt,
    author: { id: r.userId, name: r.userName },
  }));
}

export async function listRevisionRequests(assignmentId: string) {
  return db
    .select({ r: revisionRequests, userName: users.name, versionNumber: artifactVersions.versionNumber })
    .from(revisionRequests)
    .innerJoin(users, eq(users.id, revisionRequests.requestedByUserId))
    .innerJoin(artifactVersions, eq(artifactVersions.id, revisionRequests.versionId))
    .where(eq(revisionRequests.assignmentId, assignmentId))
    .orderBy(desc(revisionRequests.createdAt));
}
