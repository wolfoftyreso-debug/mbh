"use client";
import { useState } from "react";
import Link from "next/link";
import { createVersionAction } from "@/server/actions/workspace";
import type { VersionSummary } from "@/server/domain/artifacts/service";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Textarea, Input, Checkbox } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { FileUpload, type UploadedFile } from "@/components/upload/file-upload";
import { fingerprint } from "@/lib/fingerprint";
import { formatDateTime } from "@/lib/utils";
import { useT } from "@/components/i18n/provider";

export function VersionPanel({ publicId, versions, canSubmit, canSign, viewerId }: { publicId: string; versions: VersionSummary[]; canSubmit: boolean; canSign: boolean; viewerId: string }) {
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [label, setLabel] = useState("");
  const [submit, setSubmit] = useState(true);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const { run, pending, error } = useAction(createVersionAction, { onSuccess: () => { setOpen(false); setContent(""); setLabel(""); setFiles([]); } });
  const latest = versions.at(-1);
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-ink-3">{t("ver.title")}</h2>
        {canSubmit ? <Button size="sm" variant="outline" type="button" onClick={() => setOpen(!open)}>{open ? t("ver.close") : t("ver.new")}</Button> : null}
      </div>
      {open ? (
        <form className="mt-2 space-y-2 rounded-md border border-line bg-surface p-3" onSubmit={(e) => { e.preventDefault(); run(publicId, { content: content || null, attachmentIds: files.map((f) => f.id), label, submit }); }}>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("ver.labelPh")} maxLength={120} />
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} placeholder={t("ver.contentPh")} />
          <div className="flex flex-wrap items-center gap-2">
            <FileUpload purpose="DELIVERABLE" assignmentPublicId={publicId} onUploaded={(f) => setFiles((p) => [...p, ...f])} label={t("ver.attach")} compact />
            {files.map((f) => <span key={f.id} className="text-xs">{f.filename}</span>)}
          </div>
          <label className="flex items-center gap-2 text-xs"><Checkbox checked={submit} onChange={(e) => setSubmit(e.target.checked)} /> {t("ver.deliverNow")}</label>
          {error ? <p className="text-xs text-danger">{error}</p> : null}
          <Button size="sm" type="submit" disabled={pending}>{pending ? t("ver.saving") : submit ? t("ver.deliver") : t("ver.saveDraft")}</Button>
        </form>
      ) : null}
      {versions.length ? (
        <ol className="mt-2 space-y-1.5">
          {[...versions].reverse().map((v) => (
            <li key={v.id} className="rounded-md border border-line bg-surface px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/assignments/${publicId}/versions/${v.id}`} className="font-medium hover:underline">V{v.versionNumber}{v.label ? ` — ${v.label}` : ""}</Link>
                <Badge tone={v.status === "SIGNED" ? "accent" : v.status === "SUBMITTED" ? "info" : "neutral"}>{v.status === "SIGNED" ? t("ver.signedImmutable") : v.status.toLowerCase()}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-ink-3">{v.createdBy.name} · {formatDateTime(v.createdAt, locale === "sv" ? "sv-SE" : "en-GB")} · {v.wordCount} {t("ver.words")}{v.files.length ? ` · ${v.files.length} ${t("ver.file")}` : ""}</p>
              <p className="mono text-[11px] text-ink-3">{fingerprint(v.contentHash)}</p>
              {canSign && latest?.id === v.id && v.status === "SUBMITTED" && v.label !== "Customer source" ? <Link href={`/assignments/${publicId}/sign/${v.id}`} className="mt-1 inline-block text-xs font-medium text-accent underline">{t("ver.signThis")}</Link> : null}
              {v.status === "SIGNED" && v.createdBy.id === viewerId ? <span className="mt-1 block text-xs text-accent">{t("ver.youSigned")}</span> : null}
            </li>
          ))}
        </ol>
      ) : <p className="mt-2 text-xs text-ink-3">{t("ver.none")}</p>}
    </div>
  );
}
