import { desc, eq } from "drizzle-orm";
import { requireViewer } from "@/server/auth/session";
import { db } from "@/server/db";
import { accounts, sessions } from "@/server/db/schema";
import { PageHeader, Card, CardHeader, CardBody } from "@/components/ui/card";
import { SettingsNav } from "@/components/settings/settings-nav";
import { RevokeSessionsButton } from "@/components/settings/forms";
import { formatDateTime, humanize } from "@/lib/utils";
import { getT } from "@/server/i18n";

export default async function SecurityPage() {
  const viewer = await requireViewer();
  const { t, locale } = await getT();
  const dl = locale === "sv" ? "sv-SE" : "en-GB";
  const [sess, accts] = await Promise.all([db.select().from(sessions).where(eq(sessions.userId, viewer.userId)).orderBy(desc(sessions.updatedAt)).limit(20), db.select({ providerId: accounts.providerId, createdAt: accounts.createdAt }).from(accounts).where(eq(accounts.userId, viewer.userId))]);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t("set.security.title")} />
      <SettingsNav />
      <Card>
        <CardHeader title={t("set.security.linked")} description={t("set.security.linked.desc")} />
        <CardBody><ul className="text-sm">{accts.map((a) => <li key={a.providerId}>{humanize(a.providerId === "credential" ? "development login" : a.providerId)} <span className="text-ink-3">· {t("set.security.linkedOn", { date: formatDateTime(a.createdAt, dl) })}</span></li>)}</ul></CardBody>
      </Card>
      <Card>
        <CardHeader title={t("set.security.sessions")} action={<RevokeSessionsButton />} />
        <CardBody className="p-0">
          <ul className="divide-y divide-line text-sm">{sess.map((s) => <li key={s.id} className="flex justify-between px-5 py-2"><span className={s.id === viewer.sessionId ? "font-medium" : ""}>{s.id === viewer.sessionId ? t("set.security.thisSession") : t("set.security.session")} <span className="text-ink-3">· {(s.userAgent ?? "unknown device").slice(0, 60)}</span></span><span className="text-ink-3">{t("set.security.expires", { date: formatDateTime(s.expiresAt, dl) })}</span></li>)}</ul>
        </CardBody>
      </Card>
    </div>
  );
}
