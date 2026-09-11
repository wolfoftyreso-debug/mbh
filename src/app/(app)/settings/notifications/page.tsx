import { eq } from "drizzle-orm";
import { requireViewer } from "@/server/auth/session";
import { db } from "@/server/db";
import { notificationPreferences } from "@/server/db/schema";
import { CONFIGURABLE_TYPES } from "@/server/notifications/service";
import { PageHeader } from "@/components/ui/card";
import { SettingsNav } from "@/components/settings/settings-nav";
import { NotificationPreferencesForm } from "@/components/settings/forms";
import { getT } from "@/server/i18n";

export default async function NotificationSettingsPage() {
  const viewer = await requireViewer();
  const { t } = await getT();
  const prefs = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, viewer.userId));
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("set.notif.title")} description={t("set.notif.lead")} />
      <SettingsNav />
      <NotificationPreferencesForm types={CONFIGURABLE_TYPES} prefs={prefs.map((p) => ({ type: p.type, channel: p.channel, enabled: p.enabled }))} />
    </div>
  );
}
