import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/session";
import { authorizeAssignment } from "@/server/authz/policy";
import { getSigningPreview, SIGNING_STATEMENT } from "@/server/domain/signing/service";
import { SigningCeremony } from "@/components/workspace/signing-ceremony";
import { Alert } from "@/components/ui/card";
import { VerificationBadge } from "@/components/ui/status-badge";
import { humanize, formatDateTime } from "@/lib/utils";
import { getT } from "@/server/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "Final human sign-off" };

export default async function SignPage({ params }: { params: Promise<{ publicId: string; versionId: string }> }) {
  const { publicId, versionId } = await params;
  const [viewer, { t, locale }] = await Promise.all([requireViewer(), getT()]);
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
  const blocked = preview.alreadySigned ? t("sign.alreadySigned") : !preview.hashMatches ? t("sign.hashMismatch") : v.status !== "SUBMITTED" ? t("sign.notSubmitted", { status: v.status.toLowerCase() }) : !preview.agreementAccepted ? t("sign.agreementRequired") : null;
  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs text-ink-3"><Link href={`/assignments/${publicId}`} className="hover:underline">{t("sign.back")}</Link></p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t("sign.title")}</h1>
      <p className="mt-2 text-sm text-ink-2">{t("sign.lead")}</p>
      <dl className="mt-6 grid grid-cols-[150px_1fr] gap-y-2 rounded-lg border border-line bg-surface p-5 text-sm">
        <dt className="text-ink-3">{t("sign.work")}</dt><dd className="font-medium">{ctx.assignment.title}</dd>
        <dt className="text-ink-3">{t("sign.version")}</dt><dd>{t("sign.version")} {v.versionNumber}{v.label ? ` · ${v.label}` : ""} · {t("sign.created")} {formatDateTime(v.createdAt, locale === "sv" ? "sv-SE" : "en-GB")}</dd>
        <dt className="text-ink-3">{t("sign.wordCount")}</dt><dd>{v.wordCount}{preview.files.length ? ` · ${preview.files.length} ${t("ver.file")}` : ""}</dd>
        <dt className="text-ink-3">{t("sign.service")}</dt><dd>{preview.servicePerformed}</dd>
        <dt className="text-ink-3">{t("sign.yourRole")}</dt><dd>{humanize(preview.contributionRole)}</dd>
        <dt className="text-ink-3">{t("sign.scope")}</dt><dd>{preview.scope}</dd>
        <dt className="text-ink-3">{t("sign.customer")}</dt><dd>{preview.customerLabel}</dd>
        <dt className="text-ink-3">{t("sign.yourVerification")}</dt><dd><VerificationBadge status={preview.verificationStatus} /> <span className="text-xs text-ink-3">{t("sign.recordedOnSignature")}</span></dd>
        <dt className="text-ink-3">{t("sign.fingerprint")}</dt><dd className="mono">{preview.fingerprint}<span className="block break-all text-xs text-ink-3">sha256:{v.contentHash}</span></dd>
      </dl>
      {v.content ? (
        <details className="mt-4 rounded-lg border border-line bg-surface" open>
          <summary className="cursor-pointer px-5 py-3 text-sm font-medium">{t("sign.exactContent")}</summary>
          <div className="prose-plain max-h-[50vh] overflow-y-auto border-t border-line px-5 py-4 text-sm">{v.content}</div>
        </details>
      ) : null}
      {preview.files.length ? (
        <ul className="mt-3 text-sm">
          {preview.files.map((f) => <li key={f.id}><a className="text-accent underline" href={`/api/files/${f.id}`} target="_blank" rel="noopener">{f.filename}</a> <span className="mono text-xs text-ink-3">sha256:{f.sha256.slice(0, 16)}…</span></li>)}
        </ul>
      ) : null}
      <div className="mt-6">
        {blocked ? <Alert tone="warn">{blocked}{!preview.agreementAccepted ? <> <Link href="/professional/agreement" className="underline">{t("sign.openAgreement")}</Link></> : null}</Alert> : <SigningCeremony publicId={publicId} versionId={versionId} statement={locale === "sv" ? t("sign.statement") : SIGNING_STATEMENT} />}
      </div>
    </div>
  );
}
