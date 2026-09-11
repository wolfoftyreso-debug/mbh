import { eq } from "drizzle-orm";
import { requireViewer } from "@/server/auth/session";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { PageHeader } from "@/components/ui/card";
import { SettingsNav } from "@/components/settings/settings-nav";
import { AccountForm, PhoneVerification } from "@/components/settings/forms";
import { getT } from "@/server/i18n";

export default async function SettingsPage() {
  const viewer = await requireViewer();
  const { t } = await getT();
  const [u] = await db.select().from(users).where(eq(users.id, viewer.userId)).limit(1);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("set.title")} />
      <SettingsNav />
      <AccountForm initial={{ name: u.name, email: u.email, locale: u.locale, timezone: u.timezone, phone: u.phone ?? "" }} />
      <div className="mt-8"><PhoneVerification phone={u.phone ?? ""} verified={u.phoneVerified} /></div>
    </div>
  );
}
