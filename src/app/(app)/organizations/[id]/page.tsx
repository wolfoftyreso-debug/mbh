import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/session";
import { getOrganizationWithMembers } from "@/server/domain/organizations/service";
import { canManageOrganization } from "@/server/authz/policy";
import { PageHeader, Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddMemberForm, MemberRow } from "@/components/organizations/forms";
import { humanize } from "@/lib/utils";

export default async function OrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer();
  let data;
  try {
    data = await getOrganizationWithMembers(viewer, id);
  } catch {
    notFound();
  }
  const manage = canManageOrganization(viewer, id);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={data.org.name} description={[data.org.country, data.org.website, data.org.billingEmail].filter(Boolean).join(" · ")} />
      <Card>
        <CardHeader title="Members" description="Owners and admins manage membership. Billing members can pay but do not see assignment content." />
        <CardBody className="p-0">
          <ul className="divide-y divide-line">
            {data.members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span><span className="font-medium">{m.name ?? m.email}</span>{m.name ? <span className="text-ink-3"> · {m.email}</span> : null}{m.pending ? <Badge className="ml-2">Pending sign-in</Badge> : null}</span>
                {manage && m.role !== "OWNER" ? <MemberRow organizationId={id} memberId={m.id} role={m.role} /> : <Badge>{humanize(m.role)}</Badge>}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
      {manage ? <Card><CardHeader title="Add a member" description="If the person has no account yet, they join automatically when they sign in with this verified e-mail." /><CardBody><AddMemberForm organizationId={id} /></CardBody></Card> : null}
    </div>
  );
}
