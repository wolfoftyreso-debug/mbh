import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { notificationPreferences, notifications, users } from "@/server/db/schema";
import { getEmailProvider } from "@/server/email";
import { renderEmail, type EmailTemplateKey } from "@/server/email/templates";
import { getSmsProvider } from "@/server/sms";
import { logger } from "@/server/logger";

/**
 * Unified notification model. Every notification is stored as an event per
 * channel. Non-essential notifications respect user preferences; security
 * notifications cannot be disabled.
 */
export type NotificationType = EmailTemplateKey;

interface TypeConfig {
  essential: boolean;
  sms: boolean; // whether SMS is considered for this type (still requires a verified phone)
  inAppTitle: (v: Record<string, string | undefined>) => string;
  inAppBody: (v: Record<string, string | undefined>) => string;
  link: (v: Record<string, string | undefined>) => string | null;
}

const assignmentLink = (v: Record<string, string | undefined>) => (v.publicId ? `/assignments/${v.publicId}` : null);

const TYPES: Record<NotificationType, TypeConfig> = {
  WELCOME: { essential: false, sms: false, inAppTitle: () => "Welcome", inAppBody: () => "Your account is ready.", link: () => "/dashboard" },
  ASSIGNMENT_RECEIVED: { essential: false, sms: false, inAppTitle: () => "Assignment created", inAppBody: (v) => `“${v.title}” is now ${v.statusLabel ?? "open"}.`, link: assignmentLink },
  PROFESSIONAL_INVITED: { essential: false, sms: true, inAppTitle: () => "You were invited", inAppBody: (v) => `Invitation to “${v.title}”.`, link: assignmentLink },
  OFFER_RECEIVED: { essential: false, sms: false, inAppTitle: () => "Offer received", inAppBody: (v) => `${v.professionalName} sent an offer: ${v.price}.`, link: assignmentLink },
  ASSIGNMENT_ACCEPTED: { essential: false, sms: true, inAppTitle: () => "Assignment accepted", inAppBody: (v) => `“${v.title}” is ready to start.`, link: assignmentLink },
  NEW_MESSAGE: { essential: false, sms: false, inAppTitle: () => "New message", inAppBody: (v) => `${v.senderName} wrote in “${v.title}”.`, link: assignmentLink },
  DELIVERY_RECEIVED: { essential: false, sms: false, inAppTitle: () => "Version delivered", inAppBody: (v) => `Version ${v.version} of “${v.title}” is ready to review.`, link: assignmentLink },
  REVISION_REQUESTED: { essential: false, sms: false, inAppTitle: () => "Revision requested", inAppBody: (v) => `Changes requested on “${v.title}”.`, link: assignmentLink },
  FINAL_VERSION_READY: { essential: false, sms: false, inAppTitle: () => "Ready for sign-off", inAppBody: (v) => `Version ${v.version} of “${v.title}” awaits sign-off.`, link: assignmentLink },
  SIGNATURE_COMPLETED: { essential: false, sms: false, inAppTitle: () => "Signed", inAppBody: (v) => `${v.professionalName} signed version ${v.version}.`, link: assignmentLink },
  PAYMENT_RECEIPT: { essential: true, sms: false, inAppTitle: () => "Payment received", inAppBody: (v) => `${v.amount} for “${v.title}”.`, link: assignmentLink },
  PAYOUT_NOTIFICATION: { essential: true, sms: false, inAppTitle: () => "Payout", inAppBody: (v) => `${v.amount} ${v.status}.`, link: () => "/professional/earnings" },
  DISPUTE_UPDATE: { essential: true, sms: false, inAppTitle: () => "Dispute update", inAppBody: (v) => `Dispute on “${v.title}” is ${v.status}.`, link: assignmentLink },
  VERIFICATION_UPDATE: { essential: true, sms: false, inAppTitle: () => "Verification update", inAppBody: (v) => `Status: ${v.status}.`, link: () => "/professional/profile" },
  SECURITY_ALERT: { essential: true, sms: true, inAppTitle: () => "Security notice", inAppBody: (v) => v.message ?? "", link: () => "/settings/security" },
  ORGANIZATION_INVITE: { essential: false, sms: false, inAppTitle: () => "Organization", inAppBody: (v) => `You were added to ${v.organizationName}.`, link: () => "/organizations" },
};

export const NOTIFICATION_TYPES = Object.keys(TYPES) as NotificationType[];
export const CONFIGURABLE_TYPES = NOTIFICATION_TYPES.filter((t) => !TYPES[t].essential);

async function channelEnabled(userId: string, type: NotificationType, channel: "IN_APP" | "EMAIL" | "SMS"): Promise<boolean> {
  if (TYPES[type].essential) return true;
  const [pref] = await db
    .select({ enabled: notificationPreferences.enabled })
    .from(notificationPreferences)
    .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.type, type), eq(notificationPreferences.channel, channel)))
    .limit(1);
  return pref ? pref.enabled : true;
}

export async function notify(userId: string, type: NotificationType, vars: Record<string, string | undefined>): Promise<void> {
  const cfg = TYPES[type];
  const [user] = await db.select({ email: users.email, phone: users.phone, phoneVerified: users.phoneVerified, deletedAt: users.deletedAt }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.deletedAt) return;

  // In-app
  if (await channelEnabled(userId, type, "IN_APP")) {
    await db.insert(notifications).values({
      userId,
      type,
      channel: "IN_APP",
      title: cfg.inAppTitle(vars),
      body: cfg.inAppBody(vars),
      link: cfg.link(vars),
      status: "SENT",
      essential: cfg.essential,
      sentAt: new Date(),
      metadata: { publicId: vars.publicId ?? null },
    });
  }

  // E-mail
  if (await channelEnabled(userId, type, "EMAIL")) {
    const rendered = renderEmail(type, vars);
    const [row] = await db
      .insert(notifications)
      .values({ userId, type, channel: "EMAIL", title: rendered.subject, body: "", link: cfg.link(vars), status: "PENDING", essential: cfg.essential })
      .returning({ id: notifications.id });
    try {
      await getEmailProvider().send({ to: user.email, subject: rendered.subject, html: rendered.html, text: rendered.text, tags: { type } });
      await db.update(notifications).set({ status: "SENT", sentAt: new Date() }).where(eq(notifications.id, row.id));
    } catch (err) {
      logger.error("email_send_failed", { userId, type, error: (err as Error).message });
      await db.update(notifications).set({ status: "FAILED", error: (err as Error).message.slice(0, 200) }).where(eq(notifications.id, row.id));
    }
  }

  // SMS: secondary channel, only for selected types and verified phone numbers
  if (cfg.sms && user.phone && user.phoneVerified && (await channelEnabled(userId, type, "SMS"))) {
    const body = `${cfg.inAppTitle(vars)}: ${cfg.inAppBody(vars)}`.slice(0, 300);
    const [row] = await db
      .insert(notifications)
      .values({ userId, type, channel: "SMS", title: cfg.inAppTitle(vars), body: "", status: "PENDING", essential: cfg.essential })
      .returning({ id: notifications.id });
    try {
      await getSmsProvider().send(user.phone, body);
      await db.update(notifications).set({ status: "SENT", sentAt: new Date() }).where(eq(notifications.id, row.id));
    } catch (err) {
      await db.update(notifications).set({ status: "FAILED", error: (err as Error).message.slice(0, 200) }).where(eq(notifications.id, row.id));
    }
  }
}

export async function notifyMany(userIds: string[], type: NotificationType, vars: Record<string, string | undefined>): Promise<void> {
  await Promise.all([...new Set(userIds)].map((id) => notify(id, type, vars).catch((err) => logger.error("notify_failed", { userId: id, type, error: (err as Error).message }))));
}
