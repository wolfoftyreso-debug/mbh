"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireViewer } from "@/server/auth/session";
import { authorizeAssignment } from "@/server/authz/policy";
import { safeAction, type ActionResult, ValidationError } from "@/server/security/errors";
import { sendMessage } from "@/server/domain/messages/service";
import * as artifacts from "@/server/domain/artifacts/service";
import * as signing from "@/server/domain/signing/service";
import { submitReview } from "@/server/domain/reviews/service";
import { startCheckout, capturePayment, assignmentPaymentState } from "@/server/finance/payments";
import { aiService } from "@/server/ai/service";
import { env } from "@/lib/config/env";
import { getPaymentProvider } from "@/server/finance/providers";
import { db } from "@/server/db";
import { attachments } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

export async function sendMessageAction(publicId: string, body: string, attachmentIds: string[] = []): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("sendMessage", async () => {
    const ctx = await authorizeAssignment(viewer, publicId, "send_message");
    await sendMessage({ assignmentId: ctx.assignment.id, senderUserId: viewer.userId, senderName: viewer.name, body, attachmentIds: attachmentIds.slice(0, 10) });
    revalidatePath(`/assignments/${publicId}`);
    return undefined;
  });
}

const versionSchema = z.object({ content: z.string().max(2_000_000).nullable(), attachmentIds: z.array(z.string()).max(20).default([]), label: z.string().max(120).default(""), submit: z.boolean().default(true), note: z.string().max(1000).optional() });

export async function createVersionAction(publicId: string, payload: z.input<typeof versionSchema>): Promise<ActionResult<{ versionId: string; versionNumber: number }>> {
  const viewer = await requireViewer();
  return safeAction("createVersion", async () => {
    const ctx = await authorizeAssignment(viewer, publicId, "submit_version");
    const p = versionSchema.parse(payload);
    const v = await artifacts.createVersion(ctx, p);
    revalidatePath(`/assignments/${publicId}`);
    return { versionId: v.id, versionNumber: v.versionNumber };
  });
}

export async function requestRevisionAction(publicId: string, versionId: string, message: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("requestRevision", async () => {
    const ctx = await authorizeAssignment(viewer, publicId, "request_revision");
    await artifacts.requestRevision(ctx, versionId, message);
    revalidatePath(`/assignments/${publicId}`);
    return undefined;
  });
}

export async function moveToFinalReviewAction(publicId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("moveToFinalReview", async () => {
    const ctx = await authorizeAssignment(viewer, publicId, "review_comment");
    if (ctx.assignment.status !== "DELIVERED") throw new ValidationError("Only delivered assignments can move to final review");
    await artifacts.moveToFinalReview(ctx);
    revalidatePath(`/assignments/${publicId}`);
    return undefined;
  });
}

const commentSchema = z.object({
  versionId: z.string(),
  type: z.enum(["LANGUAGE", "FACTUAL", "TERMINOLOGY", "DOMAIN", "LEGAL_RISK", "CLARITY", "STYLE", "SOURCE_REQUIRED", "OTHER"]),
  domainVerdict: z.enum(["CORRECT", "INCORRECT", "MISLEADING", "IMPRECISE", "TERMINOLOGY_ERROR", "NEEDS_CONTEXT", "RECOMMENDED_CHANGE"]).nullable().default(null),
  anchorStart: z.number().int().min(0).nullable().default(null),
  anchorEnd: z.number().int().min(0).nullable().default(null),
  quotedText: z.string().max(1000).default(""),
  body: z.string().min(1).max(5000),
  suggestion: z.string().max(5000).default(""),
});

export async function addReviewCommentAction(publicId: string, payload: z.input<typeof commentSchema>): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("addReviewComment", async () => {
    const ctx = await authorizeAssignment(viewer, publicId, "review_comment");
    await artifacts.addReviewComment(ctx, commentSchema.parse(payload));
    revalidatePath(`/assignments/${publicId}`);
    return undefined;
  });
}

export async function resolveReviewCommentAction(publicId: string, commentId: string, status: "RESOLVED" | "REJECTED"): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("resolveReviewComment", async () => {
    const ctx = await authorizeAssignment(viewer, publicId, "review_comment");
    await artifacts.resolveReviewComment(ctx, commentId, status);
    revalidatePath(`/assignments/${publicId}`);
    return undefined;
  });
}

export async function signVersionAction(publicId: string, versionId: string, confirmed: boolean, typedConfirmation: string): Promise<ActionResult<{ recordPublicId: string }>> {
  const viewer = await requireViewer();
  return safeAction("signVersion", async () => {
    const ctx = await authorizeAssignment(viewer, publicId, "sign");
    const res = await signing.signVersion(ctx, { versionId, confirmed, typedConfirmation });
    revalidatePath(`/assignments/${publicId}`);
    return res;
  });
}

export async function approveSignedVersionAction(publicId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("approveSignedVersion", async () => {
    const ctx = await authorizeAssignment(viewer, publicId, "approve");
    await signing.approveSignedVersion(ctx);
    revalidatePath(`/assignments/${publicId}`);
    return undefined;
  });
}

const visibilitySchema = z.object({ visibility: z.enum(["PRIVATE", "ANONYMIZED", "PUBLIC"]), customerDisplay: z.enum(["HIDDEN", "PRIVATE_ORGANIZATION", "NAMED"]), titlePublic: z.boolean(), hashPublic: z.boolean(), publicationUrl: z.string().max(500).nullable() });

export async function setRecordVisibilityAction(publicId: string, recordId: string, payload: z.input<typeof visibilitySchema>): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("setRecordVisibility", async () => {
    const ctx = await authorizeAssignment(viewer, publicId, "manage_publication");
    await signing.setRecordVisibility(ctx, recordId, visibilitySchema.parse(payload));
    revalidatePath(`/assignments/${publicId}`);
    return undefined;
  });
}

export async function startCheckoutAction(publicId: string): Promise<ActionResult<{ checkoutUrl: string | null; status: string }>> {
  const viewer = await requireViewer();
  return safeAction("startCheckout", async () => {
    const ctx = await authorizeAssignment(viewer, publicId, "pay");
    const res = await startCheckout({ assignmentId: ctx.assignment.id, payerUserId: viewer.userId, organizationId: ctx.assignment.organizationId, email: viewer.email });
    revalidatePath(`/assignments/${publicId}`);
    return { checkoutUrl: res.checkoutUrl, status: res.status };
  });
}

/**
 * Manual provider only: the paying customer confirms an off-platform payment in
 * non-production environments; in production only administrators may confirm.
 */
export async function confirmManualPaymentAction(publicId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("confirmManualPayment", async () => {
    if (getPaymentProvider().name !== "manual") throw new ValidationError("Manual confirmation is not available for this payment provider");
    if (env.isProd && !viewer.isAdmin) throw new ValidationError("Payments are confirmed by the platform once received");
    const ctx = await authorizeAssignment(viewer, publicId, "pay");
    const state = await assignmentPaymentState(ctx.assignment.id);
    if (!state.payment) throw new ValidationError("Start the checkout first");
    await capturePayment(state.payment.id, { actorType: viewer.isAdmin ? "ADMIN" : "USER", actorUserId: viewer.userId });
    revalidatePath(`/assignments/${publicId}`);
    return undefined;
  });
}

const reviewSchema = z.object({ professionalUserId: z.string(), rating: z.number().int().min(1).max(5), onTime: z.boolean(), comment: z.string().max(3000).default(""), dimensions: z.record(z.string(), z.number().int().min(1).max(5)).default({}), anonymized: z.boolean().default(true) });

export async function submitReviewAction(publicId: string, payload: z.input<typeof reviewSchema>): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("submitReview", async () => {
    const ctx = await authorizeAssignment(viewer, publicId, "rate");
    await submitReview(ctx, reviewSchema.parse(payload));
    revalidatePath(`/assignments/${publicId}`);
    return undefined;
  });
}

/** AI helpers for the workspace — all routed through the policy-checked AI service. */
export async function qualityHintsAction(publicId: string, text: string): Promise<ActionResult<string[] | null>> {
  const viewer = await requireViewer();
  return safeAction("qualityHints", async () => {
    const ctx = await authorizeAssignment(viewer, publicId, "submit_version");
    return aiService.qualityHints(viewer.userId, ctx.assignment, text);
  });
}

export async function transcribeAttachmentAction(publicId: string, attachmentId: string): Promise<ActionResult<{ text: string } | null>> {
  const viewer = await requireViewer();
  return safeAction("transcribeAttachment", async () => {
    const ctx = await authorizeAssignment(viewer, publicId, "view_content");
    const [att] = await db.select().from(attachments).where(and(eq(attachments.id, attachmentId), eq(attachments.assignmentId, ctx.assignment.id))).limit(1);
    if (!att || !att.mimeType.startsWith("audio/")) throw new ValidationError("Not an audio file");
    const { readFileBytes } = await import("@/server/domain/files/service");
    const bytes = await readFileBytes(att);
    if (!bytes) throw new ValidationError("File not available");
    const text = await aiService.transcribe(viewer.userId, ctx.assignment, { bytes, filename: att.filename, mimeType: att.mimeType }, ctx.assignment.languageCode ?? undefined);
    return text === null ? null : { text };
  });
}
