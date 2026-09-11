import { and, eq, lt } from "drizzle-orm";
import { db } from "@/server/db";
import { assignmentInvitations, offers, rateLimitBuckets, verifications } from "@/server/db/schema";
import { logger } from "@/server/logger";

/** Expires stale offers and invitations and prunes transient tables. Idempotent. */
export async function runHousekeeping(now = new Date()): Promise<{ offersExpired: number; invitationsExpired: number }> {
  const expiredOffers = await db.update(offers).set({ status: "EXPIRED", respondedAt: now }).where(and(eq(offers.status, "PENDING"), lt(offers.expiresAt, now))).returning({ id: offers.id });
  const staleInvitations = await db
    .update(assignmentInvitations)
    .set({ status: "EXPIRED", respondedAt: now })
    .where(and(eq(assignmentInvitations.status, "PENDING"), lt(assignmentInvitations.createdAt, new Date(now.getTime() - 30 * 86400000))))
    .returning({ id: assignmentInvitations.id });
  await db.delete(rateLimitBuckets).where(lt(rateLimitBuckets.windowStart, new Date(now.getTime() - 86400000)));
  await db.delete(verifications).where(lt(verifications.expiresAt, now));
  const result = { offersExpired: expiredOffers.length, invitationsExpired: staleInvitations.length };
  logger.info("housekeeping_completed", result);
  return result;
}
