import { eq } from "drizzle-orm";
import { requireViewer } from "@/server/auth/session";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { PageHeader } from "@/components/ui/card";
import { SettingsNav } from "@/components/settings/settings-nav";
import { AccountForm } from "@/components/settings/forms";

export default async function SettingsPage() {
  const viewer = await requireViewer();
  const [u] = await db.select().from(users).where(eq(users.id, viewer.userId)).limit(1);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" />
      <SettingsNav />
      <AccountForm initial={{ name: u.name, email: u.email, locale: u.locale, timezone: u.timezone, phone: u.phone ?? "" }} />
    </div>
  );
}
