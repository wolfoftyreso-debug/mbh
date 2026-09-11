import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { env } from "@/lib/config/env";
import { audit } from "@/server/audit/log";
import { logger } from "@/server/logger";

/** Runs after Better Auth inserts a user row. */
export async function onUserCreated(userId: string, email: string, emailVerified = false): Promise<void> {
  try {
    const normalized = email.toLowerCase();
    const { attachPendingMemberships } = await import("@/server/domain/organizations/service");
    await attachPendingMemberships(userId, normalized, emailVerified);
    if (env.bootstrapAdminEmails.includes(normalized)) {
      await db.update(users).set({ platformRole: "ADMIN" }).where(eq(users.id, userId));
    }
    await audit({
      actorType: "USER",
      actorUserId: userId,
      action: "ACCOUNT_CREATED",
      entityType: "user",
      entityId: userId,
    });
    // Welcome e-mail is sent lazily by the notification service to avoid
    // blocking sign-up when the e-mail provider is slow.
    const { notify } = await import("@/server/notifications/service");
    await notify(userId, "WELCOME", {});
  } catch (err) {
    logger.error("user_created_hook_failed", { userId, error: (err as Error).message });
  }
}
