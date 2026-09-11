import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { identityVerifications, professionalProfiles, users } from "@/server/db/schema";
import { env } from "@/lib/config/env";
import { audit } from "@/server/audit/log";
import { notify } from "@/server/notifications/service";
import { ConflictError, ValidationError } from "@/server/security/errors";
import { rateLimit } from "@/server/security/rate-limit";
import type { Viewer } from "@/server/auth/session";
import { AuthorizationError } from "@/server/authz/policy";
import { getIdentityProvider } from "./index";
import { logger } from "@/server/logger";

/** Starts a hosted identity verification session (no-op for the manual provider). */
export async function startHostedIdentityVerification(viewer: Viewer): Promise<{ redirectUrl: string | null }> {
  if (!viewer.professionalProfileId) throw new AuthorizationError("No professional profile");
  const provider = getIdentityProvider();
  if (!provider.hosted) return { redirectUrl: null };
  await rateLimit(`identity-start:${viewer.userId}`, 5, 86400);
  const [pending] = await db.select({ id: identityVerifications.id }).from(identityVerifications).where(and(eq(identityVerifications.profileId, viewer.professionalProfileId), eq(identityVerifications.status, "PENDING_REVIEW"), eq(identityVerifications.provider, provider.name))).limit(1);
  if (pending) throw new ConflictError("An identity verification is already in progress");
  const result = await provider.start({ userId: viewer.userId, profileId: viewer.professionalProfileId, email: viewer.email, returnUrl: `${env.APP_URL}/professional/credentials?identity=returned` });
  await db.insert(identityVerifications).values({ profileId: viewer.professionalProfileId, provider: provider.name, providerRef: result.providerRef, status: "PENDING_REVIEW", retentionUntil: new Date(Date.now() + 90 * 86400000) });
  await audit({ actorType: "USER", actorUserId: viewer.userId, action: "IDENTITY_SUBMITTED", entityType: "professional_profile", entityId: viewer.professionalProfileId, metadata: { provider: provider.name } });
  return { redirectUrl: result.redirectUrl };
}

/** Applies a provider's verdict. Idempotent per provider reference. */
export async function applyHostedIdentityResult(providerRef: string, outcome: { verified: true; legalName: string | null } | { verified: false; reason: string }): Promise<void> {
  const [row] = await db.select().from(identityVerifications).where(eq(identityVerifications.providerRef, providerRef)).limit(1);
  if (!row) {
    logger.warn("identity_webhook_unknown_ref", { providerRef });
    return;
  }
  if (row.status !== "PENDING_REVIEW") return;
  const [profile] = await db.select({ userId: professionalProfiles.userId }).from(professionalProfiles).where(eq(professionalProfiles.id, row.profileId)).limit(1);
  if (outcome.verified) {
    await db.transaction(async (tx) => {
      await tx.update(identityVerifications).set({ status: "PLATFORM_VERIFIED", legalName: outcome.legalName, reviewedAt: new Date(), notes: "Verified by hosted provider" }).where(eq(identityVerifications.id, row.id));
      await tx.update(professionalProfiles).set({ identityVerifiedAt: new Date() }).where(eq(professionalProfiles.id, row.profileId));
      await audit({ actorType: "SYSTEM", action: "IDENTITY_VERIFIED", entityType: "professional_profile", entityId: row.profileId, metadata: { provider: row.provider } }, tx);
    });
    const [sys] = await db.select({ id: users.id }).from(users).where(eq(users.platformRole, "SUPER_ADMIN")).limit(1);
    const { recomputeVerificationStatus } = await import("@/server/domain/admin/service");
    // Recompute uses the viewer only for audit attribution; attribute to the system.
    await recomputeVerificationStatus({ userId: sys?.id ?? "system", isAdmin: true } as Viewer, row.profileId);
  } else {
    await db.update(identityVerifications).set({ status: "REJECTED", notes: outcome.reason.slice(0, 500), reviewedAt: new Date() }).where(eq(identityVerifications.id, row.id));
    await audit({ actorType: "SYSTEM", action: "IDENTITY_REJECTED", entityType: "professional_profile", entityId: row.profileId, metadata: { provider: row.provider, reason: outcome.reason } });
    if (profile) await notify(profile.userId, "VERIFICATION_UPDATE", { status: "identity verification not completed", notes: outcome.reason });
  }
}

export function identityProviderInfo(): { name: string; hosted: boolean } {
  const p = getIdentityProvider();
  return { name: p.name, hosted: p.hosted };
}

export { ValidationError };
