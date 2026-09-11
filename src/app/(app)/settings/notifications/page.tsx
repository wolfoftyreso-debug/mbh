import { eq } from "drizzle-orm";
import { requireViewer } from "@/server/auth/session";
import { db } from "@/server/db";
import { notificationPreferences } from "@/server/db/schema";
import { CONFIGURABLE_TYPES } from "@/server/notifications/service";
import { PageHeader } from "@/components/ui/card";
import { SettingsNav } from "@/components/settings/settings-nav";
import { NotificationPreferencesForm } from "@/components/settings/forms";

export default async function NotificationSettingsPage() {
  const viewer = await requireViewer();
  const prefs = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, viewer.userId));
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Notification preferences" description="Security, payment, verification and dispute notifications are always delivered." />
      <SettingsNav />
      <NotificationPreferencesForm types={CONFIGURABLE_TYPES} prefs={prefs.map((p) => ({ type: p.type, channel: p.channel, enabled: p.enabled }))} />
    </div>
  );
}
