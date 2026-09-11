import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/session";
import { authorizeAssignment, can } from "@/server/authz/policy";
import { getVersion, listReviewComments } from "@/server/domain/artifacts/service";
import { db } from "@/server/db";
import { artifactVersionFiles, attachments, users } from "@/server/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { VersionReader } from "@/components/workspace/version-reader";
import { Badge } from "@/components/ui/badge";
import { fingerprint } from "@/lib/hash";
import { formatDateTime } from "@/lib/utils";
import { LinkButton } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function VersionPage({ params }: { params: Promise<{ publicId: string; versionId: string }> }) {
  const { publicId, versionId } = await params;
  const viewer = await requireViewer();
  let ctx;
  try {
    ctx = await authorizeAssignment(viewer, publicId, "view_content");
  } catch {
    notFound();
  }
  const v = await getVersion(ctx.assignment.id, versionId);
  if (!v) notFound();
  const [author] = await db.select({ name: users.name }).from(users).where(eq(users.id, v.createdByUserId)).limit(1);
  const files = await db.select({ id: attachments.id, filename: attachments.filename, sizeBytes: attachments.sizeBytes }).from(artifactVersionFiles).innerJoin(attachments, eq(attachments.id, artifactVersionFiles.attachmentId)).where(and(eq(artifactVersionFiles.versionId, v.id), isNull(attachments.deletedAt)));
  const comments = await listReviewComments(ctx.assignment.id, v.id);
  const canComment = can(ctx, "review_comment");
  const isPro = ctx.role === "PROFESSIONAL";
  const aiAllowed = ctx.assignment.aiPolicy === "AI_ALLOWED";
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs text-ink-3"><Link href={`/assignments/${publicId}`} className="hover:underline">← {ctx.assignment.title}</Link></p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Version {v.versionNumber}{v.label ? ` — ${v.label}` : ""}</h1>
          <p className="mt-1 text-sm text-ink-3">{author?.name} · {formatDateTime(v.createdAt)} · {v.wordCount} words · <span className="mono">{fingerprint(v.contentHash)}</span> <Badge tone={v.status === "SIGNED" ? "accent" : "neutral"}>{v.status === "SIGNED" ? "Signed · immutable" : v.status.toLowerCase()}</Badge></p>
        </div>
        {can(ctx, "sign") && v.status === "SUBMITTED" && !(v.metadata as Record<string, unknown>).source ? <LinkButton href={`/assignments/${publicId}/sign/${v.id}`} size="sm">Sign this version</LinkButton> : null}
      </div>
      {files.length ? <ul className="mt-3 flex flex-wrap gap-2 text-sm">{files.map((f) => <li key={f.id}><a href={`/api/files/${f.id}`} target="_blank" rel="noopener" className="rounded-md border border-line bg-surface px-2 py-1 hover:underline">{f.filename}</a></li>)}</ul> : null}
      <VersionReader publicId={publicId} versionId={v.id} content={v.content} comments={comments} canComment={canComment} viewerId={viewer.userId} showQualityHints={isPro && aiAllowed && v.createdByUserId === viewer.userId} isDomainReviewer={ctx.participantRoles.includes("DOMAIN_REVIEWER") || ctx.participantRoles.includes("FACT_CHECKER")} />
    </div>
  );
}
