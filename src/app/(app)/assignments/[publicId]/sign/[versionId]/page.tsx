import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/session";
import { authorizeAssignment } from "@/server/authz/policy";
import { getSigningPreview, SIGNING_STATEMENT } from "@/server/domain/signing/service";
import { SigningCeremony } from "@/components/workspace/signing-ceremony";
import { Alert } from "@/components/ui/card";
import { VerificationBadge } from "@/components/ui/badge";
import { humanize, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Final human sign-off" };

export default async function SignPage({ params }: { params: Promise<{ publicId: string; versionId: string }> }) {
  const { publicId, versionId } = await params;
  const viewer = await requireViewer();
  let ctx;
  try {
    ctx = await authorizeAssignment(viewer, publicId, "sign");
  } catch {
    notFound();
  }
  let preview;
  try {
    preview = await getSigningPreview(ctx, versionId);
  } catch {
    notFound();
  }
  const v = preview.version;
  const blocked = preview.alreadySigned ? "You have already signed this version." : !preview.hashMatches ? "The stored hash does not match the content. Signing is blocked; contact support." : v.status !== "SUBMITTED" ? `Only submitted versions can be signed (this version is ${v.status.toLowerCase()}).` : !preview.agreementAccepted ? "Accept the professional confidentiality agreement before signing." : null;
  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs text-ink-3"><Link href={`/assignments/${publicId}`} className="hover:underline">← Back to assignment</Link></p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Final human sign-off</h1>
      <p className="mt-2 text-sm text-ink-2">You are signing the exact version shown here. Signing is deliberate and permanent: the version becomes immutable and a public-capable authorship record is created in your name.</p>
      <dl className="mt-6 grid grid-cols-[150px_1fr] gap-y-2 rounded-lg border border-line bg-surface p-5 text-sm">
        <dt className="text-ink-3">Work</dt><dd className="font-medium">{ctx.assignment.title}</dd>
        <dt className="text-ink-3">Version</dt><dd>Version {v.versionNumber}{v.label ? ` — ${v.label}` : ""} · created {formatDateTime(v.createdAt)}</dd>
        <dt className="text-ink-3">Word count</dt><dd>{v.wordCount}{preview.files.length ? ` · ${preview.files.length} attached file${preview.files.length > 1 ? "s" : ""}` : ""}</dd>
        <dt className="text-ink-3">Service</dt><dd>{preview.servicePerformed}</dd>
        <dt className="text-ink-3">Your role</dt><dd>{humanize(preview.contributionRole)}</dd>
        <dt className="text-ink-3">Scope</dt><dd>{preview.scope}</dd>
        <dt className="text-ink-3">Customer</dt><dd>{preview.customerLabel}</dd>
        <dt className="text-ink-3">Your verification</dt><dd><VerificationBadge status={preview.verificationStatus} /> <span className="text-xs text-ink-3">recorded on the signature</span></dd>
        <dt className="text-ink-3">Fingerprint</dt><dd className="mono">{preview.fingerprint}<span className="block break-all text-xs text-ink-3">sha256:{v.contentHash}</span></dd>
      </dl>
      {v.content ? (
        <details className="mt-4 rounded-lg border border-line bg-surface" open>
          <summary className="cursor-pointer px-5 py-3 text-sm font-medium">Exact content being signed</summary>
          <div className="prose-plain max-h-[50vh] overflow-y-auto border-t border-line px-5 py-4 text-sm">{v.content}</div>
        </details>
      ) : null}
      {preview.files.length ? (
        <ul className="mt-3 text-sm">
          {preview.files.map((f) => <li key={f.id}><a className="text-accent underline" href={`/api/files/${f.id}`} target="_blank" rel="noopener">{f.filename}</a> <span className="mono text-xs text-ink-3">sha256:{f.sha256.slice(0, 16)}…</span></li>)}
        </ul>
      ) : null}
      <div className="mt-6">
        {blocked ? <Alert tone="warn">{blocked}{!preview.agreementAccepted ? <> <Link href="/professional/agreement" className="underline">Open agreement</Link></> : null}</Alert> : <SigningCeremony publicId={publicId} versionId={versionId} statement={SIGNING_STATEMENT} />}
      </div>
    </div>
  );
}
