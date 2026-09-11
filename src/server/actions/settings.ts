"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { requireViewer } from "@/server/auth/session";
import { safeAction, type ActionResult } from "@/server/security/errors";
import { db } from "@/server/db";
import { notificationPreferences, notifications, users } from "@/server/db/schema";
import { CONFIGURABLE_TYPES, type NotificationType } from "@/server/notifications/service";
import { audit } from "@/server/audit/log";
import { exportUserData, requestAccountDeletion, revokeAllSessions } from "@/server/domain/privacy/service";

const accountSchema = z.object({ name: z.string().trim().min(1).max(120), locale: z.enum(["en", "sv"]).default("en"), timezone: z.string().max(60).default("Europe/Stockholm"), phone: z.string().max(30).nullable().default(null) });

export async function updateAccountAction(payload: z.input<typeof accountSchema>): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("updateAccount", async () => {
    const p = accountSchema.parse(payload);
    const [current] = await db.select({ phone: users.phone }).from(users).where(eq(users.id, viewer.userId)).limit(1);
    await db.update(users).set({ name: p.name, locale: p.locale, timezone: p.timezone, phone: p.phone, phoneVerified: current?.phone === p.phone ? undefined : false }).where(eq(users.id, viewer.userId));
    await audit({ actorType: "USER", actorUserId: viewer.userId, action: "PROFILE_UPDATED", entityType: "user", entityId: viewer.userId, metadata: { fields: ["name", "locale", "timezone", "phone"] } });
    revalidatePath("/settings");
    return undefined;
  });
}

export async function updateNotificationPreferencesAction(prefs: { type: string; channel: "IN_APP" | "EMAIL" | "SMS"; enabled: boolean }[]): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("updateNotificationPreferences", async () => {
    for (const p of prefs) {
      if (!CONFIGURABLE_TYPES.includes(p.type as NotificationType)) continue;
      await db
        .insert(notificationPreferences)
        .values({ userId: viewer.userId, type: p.type, channel: p.channel, enabled: p.enabled })
        .onConflictDoUpdate({ target: [notificationPreferences.userId, notificationPreferences.type, notificationPreferences.channel], set: { enabled: p.enabled } });
    }
    revalidatePath("/settings/notifications");
    return undefined;
  });
}

export async function markNotificationsReadAction(): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("markNotificationsRead", async () => {
    await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, viewer.userId), eq(notifications.channel, "IN_APP"), isNull(notifications.readAt)));
    revalidatePath("/notifications");
    revalidatePath("/", "layout");
    return undefined;
  });
}

export async function revokeAllSessionsAction(): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("revokeAllSessions", async () => {
    await revokeAllSessions(viewer);
    return undefined;
  });
}

export async function exportDataAction(): Promise<ActionResult<Record<string, unknown>>> {
  const viewer = await requireViewer();
  return safeAction("exportData", () => exportUserData(viewer));
}

export async function requestDeletionAction(): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("requestDeletion", async () => {
    await requestAccountDeletion(viewer);
    revalidatePath("/settings/privacy");
    return undefined;
  });
}
