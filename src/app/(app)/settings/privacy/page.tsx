import { desc, eq } from "drizzle-orm";
import { requireViewer } from "@/server/auth/session";
import { db } from "@/server/db";
import { privacyRequests } from "@/server/db/schema";
import { PageHeader, Card, CardHeader, CardBody } from "@/components/ui/card";
import { SettingsNav } from "@/components/settings/settings-nav";
import { ExportDataButton, RequestDeletionButton } from "@/components/settings/forms";
import { formatDateTime, humanize } from "@/lib/utils";

export default async function PrivacyPage() {
  const viewer = await requireViewer();
  const reqs = await db.select().from(privacyRequests).where(eq(privacyRequests.userId, viewer.userId)).orderBy(desc(privacyRequests.requestedAt)).limit(10);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Privacy and data" />
      <SettingsNav />
      <Card><CardHeader title="Export your data" description="A JSON file with your account, profile, assignments, messages and records." /><CardBody><ExportDataButton /></CardBody></Card>
      <Card><CardHeader title="Delete your account" description="Personal data is anonymized. Financial records, audit events and signed provenance metadata are retained without personal content where legally required." /><CardBody><RequestDeletionButton pending={reqs.some((r) => r.type === "ACCOUNT_DELETION" && r.status === "PENDING")} /></CardBody></Card>
      {reqs.length ? <Card><CardHeader title="Requests" /><CardBody className="p-0"><ul className="divide-y divide-line text-sm">{reqs.map((r) => <li key={r.id} className="flex justify-between px-5 py-2"><span>{humanize(r.type)}</span><span className="text-ink-3">{humanize(r.status)} · {formatDateTime(r.requestedAt)}</span></li>)}</ul></CardBody></Card> : null}
    </div>
  );
}
