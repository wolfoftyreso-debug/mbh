import Link from "next/link";
import { requireViewer } from "@/server/auth/session";
import { attachPendingMemberships, listOrganizationsForViewer } from "@/server/domain/organizations/service";
import { PageHeader, EmptyState, Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateOrganizationForm } from "@/components/organizations/forms";
import { getT } from "@/server/i18n";

export default async function OrganizationsPage() {
  const viewer = await requireViewer();
  await attachPendingMemberships(viewer.userId, viewer.email, viewer.emailVerified);
  const [orgs, { t }] = await Promise.all([listOrganizationsForViewer(viewer), getT()]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t("org.title")} description={t("org.lead")} />
      {orgs.length ? (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {orgs.map((o) => (
            <li key={o.id}><Link href={`/organizations/${o.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface-2"><span className="font-medium">{o.name}</span><Badge>{t(`org.role.${o.role}`)}</Badge></Link></li>
          ))}
        </ul>
      ) : <EmptyState title={t("org.none.title")} description={t("org.none.body")} />}
      <Card><CardHeader title={t("org.create")} /><CardBody><CreateOrganizationForm /></CardBody></Card>
    </div>
  );
}
