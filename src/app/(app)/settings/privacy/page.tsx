import { desc, eq } from "drizzle-orm";
import { requireViewer } from "@/server/auth/session";
import { db } from "@/server/db";
import { privacyRequests } from "@/server/db/schema";
import { PageHeader, Card, CardHeader, CardBody } from "@/components/ui/card";
import { SettingsNav } from "@/components/settings/settings-nav";
import { ExportDataButton, RequestDeletionButton } from "@/components/settings/forms";
import { formatDateTime, humanize } from "@/lib/utils";
import { getT } from "@/server/i18n";

export default async function PrivacyPage() {
  const viewer = await requireViewer();
  const { t, locale } = await getT();
  const reqs = await db.select().from(privacyRequests).where(eq(privacyRequests.userId, viewer.userId)).orderBy(desc(privacyRequests.requestedAt)).limit(10);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t("set.privacy.title")} />
      <SettingsNav />
      <Card><CardHeader title={t("set.privacy.export.title")} description={t("set.privacy.export.desc")} /><CardBody><ExportDataButton /></CardBody></Card>
      <Card><CardHeader title={t("set.privacy.delete.title")} description={t("set.privacy.delete.desc")} /><CardBody><RequestDeletionButton pending={reqs.some((r) => r.type === "ACCOUNT_DELETION" && r.status === "PENDING")} /></CardBody></Card>
      {reqs.length ? <Card><CardHeader title={t("set.privacy.requests")} /><CardBody className="p-0"><ul className="divide-y divide-line text-sm">{reqs.map((r) => <li key={r.id} className="flex justify-between px-5 py-2"><span>{humanize(r.type)}</span><span className="text-ink-3">{humanize(r.status)} · {formatDateTime(r.requestedAt, locale === "sv" ? "sv-SE" : "en-GB")}</span></li>)}</ul></CardBody></Card> : null}
    </div>
  );
}
