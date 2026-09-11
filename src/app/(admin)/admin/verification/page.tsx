import Link from "next/link";
import { requireAdmin } from "@/server/auth/session";
import { verificationQueue } from "@/server/domain/admin/service";
import { db } from "@/server/db";
import { credentialDocuments } from "@/server/db/schema";
import { PageHeader, Card, CardHeader, CardBody, EmptyState } from "@/components/ui/card";
import { DecisionButtons } from "@/components/admin/forms";
import { humanize } from "@/lib/utils";

export default async function VerificationQueuePage() {
  const viewer = await requireAdmin();
  const q = await verificationQueue(viewer);
  const docs = q.credentials.length ? await db.select().from(credentialDocuments) : [];
  return (
    <div className="space-y-6">
      <PageHeader title="Verification queue" description="Review documentation and decide. Every decision is recorded. Documents are private and access is audited." />
      <Card>
        <CardHeader title={`Identity (${q.identities.length})`} />
        <CardBody className="p-0">
          {q.identities.length ? <ul className="divide-y divide-line">{q.identities.map((i) => <li key={i.i.id} className="space-y-2 px-5 py-3 text-sm"><p><Link href={`/professionals/${i.slug}`} className="font-medium hover:underline">{i.displayName}</Link> · legal name: {i.i.legalName}{i.i.documentAttachmentId ? <> · <a href={`/api/files/${i.i.documentAttachmentId}`} target="_blank" rel="noopener" className="text-accent underline">open document</a></> : null}</p><DecisionButtons kind="identity" id={i.i.id} /></li>)}</ul> : <div className="p-5"><EmptyState title="No pending identity verifications" /></div>}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={`Credentials (${q.credentials.length})`} />
        <CardBody className="p-0">
          {q.credentials.length ? <ul className="divide-y divide-line">{q.credentials.map((c) => <li key={c.c.id} className="space-y-2 px-5 py-3 text-sm"><p><Link href={`/professionals/${c.slug}`} className="font-medium hover:underline">{c.displayName}</Link> · {humanize(c.c.type)}: {c.c.title}{c.c.issuer ? `, ${c.c.issuer}` : ""}{c.c.startYear ? ` (${c.c.startYear}–${c.c.endYear ?? "present"})` : ""}</p>{docs.filter((d) => d.credentialId === c.c.id).map((d) => <a key={d.id} href={`/api/files/${d.attachmentId}`} target="_blank" rel="noopener" className="mr-2 text-xs text-accent underline">document</a>)}<DecisionButtons kind="credential" id={c.c.id} /></li>)}</ul> : <div className="p-5"><EmptyState title="No pending credentials" /></div>}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={`Expertise claims (${q.expertise.length})`} />
        <CardBody className="p-0">
          {q.expertise.length ? <ul className="divide-y divide-line">{q.expertise.map((e) => <li key={e.e.id} className="space-y-2 px-5 py-3 text-sm"><p><Link href={`/professionals/${e.slug}`} className="font-medium hover:underline">{e.displayName}</Link> · {e.domainName} <span className="text-ink-3">({e.domainPath})</span>{e.e.yearsExperience ? ` · ${e.e.yearsExperience} years` : ""}</p><p className="text-ink-2">{e.e.description}</p><p className="text-xs text-ink-3">Evidence: {e.e.evidenceSummary}</p><DecisionButtons kind="expertise" id={e.e.id} /></li>)}</ul> : <div className="p-5"><EmptyState title="No pending expertise claims" /></div>}
        </CardBody>
      </Card>
    </div>
  );
}
