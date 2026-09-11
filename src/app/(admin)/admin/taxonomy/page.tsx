import { asc } from "drizzle-orm";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db";
import { domains, serviceCategories } from "@/server/db/schema";
import { PageHeader, Card, CardHeader, CardBody } from "@/components/ui/card";
import { CategoryForm, DomainForm } from "@/components/admin/forms";
import { Badge } from "@/components/ui/badge";

export default async function TaxonomyPage() {
  await requireAdmin();
  const [cats, doms] = await Promise.all([db.select().from(serviceCategories).orderBy(asc(serviceCategories.sortOrder)), db.select().from(domains).orderBy(asc(domains.path))]);
  return (
    <div className="space-y-6">
      <PageHeader title="Service categories and domain taxonomy" description="Database-driven. Adding a category or domain never requires a deploy." />
      <Card>
        <CardHeader title="Service categories" />
        <CardBody className="space-y-4">
          {cats.map((c) => <div key={c.id} className="border-b border-line pb-3"><p className="mb-1 text-xs text-ink-3">{c.slug} {!c.active ? <Badge>Inactive</Badge> : null}</p><CategoryForm initial={{ id: c.id, name: c.name, description: c.description, kind: c.kind, defaultContributionRole: c.defaultContributionRole, active: c.active, sortOrder: c.sortOrder }} /></div>)}
          <div><p className="mb-1 text-xs font-medium uppercase text-ink-3">New category</p><CategoryForm /></div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Domains" description={`${doms.length} domains`} />
        <CardBody className="space-y-4">
          <ul className="max-h-96 overflow-y-auto text-sm">{doms.map((d) => <li key={d.id} style={{ paddingLeft: d.depth * 16 }} className="py-0.5">{d.name} <span className="text-xs text-ink-3">{d.path}</span></li>)}</ul>
          <DomainForm domains={doms.map((d) => ({ id: d.id, name: d.name, depth: d.depth }))} />
        </CardBody>
      </Card>
    </div>
  );
}
