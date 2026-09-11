"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/session";
import { safeAction, type ActionResult } from "@/server/security/errors";
import * as admin from "@/server/domain/admin/service";
import { setPlatformSetting, type SettingKey } from "@/server/domain/admin/settings";
import { refundPayment, markPayoutPaid, createPayout } from "@/server/finance/payments";
import { revokeRecord } from "@/server/domain/signing/service";
import { executeAccountDeletion } from "@/server/domain/privacy/service";

export async function decideCredentialAction(id: string, decision: "PLATFORM_VERIFIED" | "REJECTED", notes: string): Promise<ActionResult> {
  const viewer = await requireAdmin();
  return safeAction("decideCredential", async () => {
    await admin.decideCredential(viewer, id, decision, notes);
    revalidatePath("/admin/verification");
    return undefined;
  });
}

export async function decideExpertiseAction(id: string, decision: "PLATFORM_VERIFIED" | "REJECTED", notes: string): Promise<ActionResult> {
  const viewer = await requireAdmin();
  return safeAction("decideExpertise", async () => {
    await admin.decideExpertise(viewer, id, decision, notes);
    revalidatePath("/admin/verification");
    return undefined;
  });
}

export async function decideIdentityAction(id: string, decision: "PLATFORM_VERIFIED" | "REJECTED", notes: string): Promise<ActionResult> {
  const viewer = await requireAdmin();
  return safeAction("decideIdentity", async () => {
    await admin.decideIdentity(viewer, id, decision, notes);
    revalidatePath("/admin/verification");
    return undefined;
  });
}

export async function setVerificationStatusAction(profileId: string, status: "UNVERIFIED" | "IDENTITY_VERIFIED" | "CREDENTIALS_VERIFIED" | "PROFESSIONAL_VERIFIED" | "SUSPENDED" | "REVOKED", reason: string): Promise<ActionResult> {
  const viewer = await requireAdmin();
  return safeAction("setVerificationStatus", async () => {
    await admin.setVerificationStatus(viewer, profileId, status, reason);
    revalidatePath("/admin/users");
    return undefined;
  });
}

export async function setUserSuspendedAction(userId: string, suspended: boolean, reason: string): Promise<ActionResult> {
  const viewer = await requireAdmin();
  return safeAction("setUserSuspended", async () => {
    await admin.setUserSuspended(viewer, userId, suspended, reason);
    revalidatePath("/admin/users");
    return undefined;
  });
}

export async function setPlatformRoleAction(userId: string, role: "USER" | "ADMIN" | "SUPER_ADMIN"): Promise<ActionResult> {
  const viewer = await requireAdmin();
  return safeAction("setPlatformRole", async () => {
    await admin.setPlatformRole(viewer, userId, role);
    revalidatePath("/admin/users");
    return undefined;
  });
}

export async function grantContentAccessAction(assignmentId: string, reason: string): Promise<ActionResult> {
  const viewer = await requireAdmin();
  return safeAction("grantContentAccess", async () => {
    await admin.grantContentAccess(viewer, assignmentId, reason);
    revalidatePath(`/admin/assignments/${assignmentId}`);
    return undefined;
  });
}

export async function resolveDisputeAction(disputeId: string, resolution: "RESOLVED_FOR_CUSTOMER" | "RESOLVED_FOR_PROFESSIONAL" | "RESOLVED_SPLIT" | "CLOSED" | "UNDER_REVIEW", notes: string, next: "COMPLETED" | "CANCELLED" | "IN_PROGRESS" | "SIGNED" | null): Promise<ActionResult> {
  const viewer = await requireAdmin();
  return safeAction("resolveDispute", async () => {
    await admin.resolveDispute(viewer, disputeId, resolution, notes, next);
    revalidatePath("/admin/disputes");
    return undefined;
  });
}

export async function hideReviewAction(reviewId: string, hidden: boolean, reason: string): Promise<ActionResult> {
  const viewer = await requireAdmin();
  return safeAction("hideReview", async () => {
    await admin.hideReview(viewer, reviewId, hidden, reason);
    return undefined;
  });
}

export async function upsertCategoryAction(input: { id: string | null; name: string; description: string; kind: "LANGUAGE" | "DOMAIN" | "COMBINED"; defaultContributionRole: string; active: boolean; sortOrder: number }): Promise<ActionResult> {
  const viewer = await requireAdmin();
  return safeAction("upsertCategory", async () => {
    await admin.upsertCategory(viewer, input);
    revalidatePath("/admin/taxonomy");
    return undefined;
  });
}

export async function upsertDomainAction(input: { id: string | null; parentId: string | null; name: string; description: string; active: boolean }): Promise<ActionResult> {
  const viewer = await requireAdmin();
  return safeAction("upsertDomain", async () => {
    await admin.upsertDomain(viewer, input);
    revalidatePath("/admin/taxonomy");
    return undefined;
  });
}

export async function setSettingAction(key: SettingKey, value: string): Promise<ActionResult> {
  const viewer = await requireAdmin();
  return safeAction("setSetting", async () => {
    const numeric = /^-?\d+$/.test(value) ? Number(value) : value;
    await setPlatformSetting(key, numeric, viewer.userId);
    const { audit } = await import("@/server/audit/log");
    await audit({ actorType: "ADMIN", actorUserId: viewer.userId, action: "SETTING_CHANGED", entityType: "platform_setting", entityId: key, metadata: { value: String(value) } });
    revalidatePath("/admin/settings");
    return undefined;
  });
}

export async function refundPaymentAction(paymentId: string, amountMinor: number, reason: string): Promise<ActionResult> {
  const viewer = await requireAdmin();
  return safeAction("refundPayment", async () => {
    await refundPayment(paymentId, amountMinor, { actorUserId: viewer.userId, reason });
    revalidatePath("/admin/finance");
    return undefined;
  });
}

export async function markPayoutPaidAction(payoutId: string): Promise<ActionResult> {
  const viewer = await requireAdmin();
  return safeAction("markPayoutPaid", async () => {
    await markPayoutPaid(payoutId, viewer.userId);
    revalidatePath("/admin/finance");
    return undefined;
  });
}

export async function createPayoutForProfessionalAction(professionalUserId: string, currency: string): Promise<ActionResult> {
  const viewer = await requireAdmin();
  return safeAction("createPayoutForProfessional", async () => {
    await createPayout(professionalUserId, currency, viewer.userId);
    revalidatePath("/admin/finance");
    return undefined;
  });
}

export async function revokeRecordAction(recordPublicId: string, reason: string): Promise<ActionResult> {
  const viewer = await requireAdmin();
  return safeAction("revokeRecord", async () => {
    await revokeRecord(recordPublicId, viewer.userId, reason);
    revalidatePath(`/record/${recordPublicId}`);
    return undefined;
  });
}

export async function executeDeletionAction(userId: string): Promise<ActionResult> {
  const viewer = await requireAdmin();
  return safeAction("executeDeletion", async () => {
    await executeAccountDeletion(viewer.userId, userId);
    revalidatePath("/admin/users");
    return undefined;
  });
}
