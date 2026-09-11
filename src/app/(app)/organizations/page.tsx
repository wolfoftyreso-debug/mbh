import Link from "next/link";
import { requireViewer } from "@/server/auth/session";
import { listOrganizationsForViewer } from "@/server/domain/organizations/service";
import { PageHeader, EmptyState, Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateOrganizationForm } from "@/components/organizations/forms";
import { humanize } from "@/lib/utils";

export default async function OrganizationsPage() {
  const viewer = await requireViewer();
  const orgs = await listOrganizationsForViewer(viewer);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Organizations" description="Agencies, publishers and companies can commission work as a team with owner, admin, member and billing roles." />
      {orgs.length ? (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {orgs.map((o) => (
            <li key={o.id}><Link href={`/organizations/${o.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface-2"><span className="font-medium">{o.name}</span><Badge>{humanize(o.role)}</Badge></Link></li>
          ))}
        </ul>
      ) : <EmptyState title="You are not part of an organization" description="Create one to commission work on behalf of a company." />}
      <Card><CardHeader title="Create an organization" /><CardBody><CreateOrganizationForm /></CardBody></Card>
    </div>
  );
}
