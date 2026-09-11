"use client";
import { useState } from "react";
import Link from "next/link";
import { setRecordVisibilityAction } from "@/server/actions/workspace";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Select, Field, Checkbox, Input } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface RecordView { id: string; publicId: string; visibility: "PRIVATE" | "ANONYMIZED" | "PUBLIC"; customerDisplay: "HIDDEN" | "PRIVATE_ORGANIZATION" | "NAMED"; titlePublic: boolean; hashPublic: boolean; publicationUrl: string | null; status: string; versionNumber: number; professionalPublicName: string; signedAt: Date }

function RecordEditor({ publicId, r, confidential }: { publicId: string; r: RecordView; confidential: boolean }) {
  const [visibility, setVisibility] = useState(r.visibility);
  const [display, setDisplay] = useState(r.customerDisplay);
  const [titlePublic, setTitlePublic] = useState(r.titlePublic);
  const [hashPublic, setHashPublic] = useState(r.hashPublic);
  const [url, setUrl] = useState(r.publicationUrl ?? "");
  const { run, pending, error, success } = useAction(setRecordVisibilityAction);
  return (
    <div className="mt-2 space-y-2 rounded-md border border-line bg-surface-2 p-3">
      <Field label="Visibility" hint={confidential ? "Confidential assignments can only publish anonymized records." : "Public records are indexable and show the title and fingerprint if enabled."}>
        <Select value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)}>
          <option value="PRIVATE">Private — only participants</option>
          <option value="ANONYMIZED">Anonymized — service and professional only</option>
          {!confidential ? <option value="PUBLIC">Public — full record</option> : null}
        </Select>
      </Field>
      <Field label="Customer shown as"><Select value={display} onChange={(e) => setDisplay(e.target.value as typeof display)}><option value="HIDDEN">Hidden</option><option value="PRIVATE_ORGANIZATION">“Private organization”</option>{!confidential ? <option value="NAMED">Named organization</option> : null}</Select></Field>
      {visibility === "PUBLIC" ? (
        <>
          <label className="flex items-center gap-2 text-xs"><Checkbox checked={titlePublic} onChange={(e) => setTitlePublic(e.target.checked)} /> Show the work title</label>
          <label className="flex items-center gap-2 text-xs"><Checkbox checked={hashPublic} onChange={(e) => setHashPublic(e.target.checked)} /> Show the content fingerprint (enables public verification)</label>
          <Field label="Publication URL" hint="Where the signed version is published."><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></Field>
        </>
      ) : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {success ? <p className="text-xs text-accent">Saved.</p> : null}
      <Button size="sm" disabled={pending} onClick={() => run(publicId, r.id, { visibility, customerDisplay: display, titlePublic, hashPublic, publicationUrl: url.trim() || null })}>Save record settings</Button>
    </div>
  );
}

export function RecordsPanel({ publicId, records, canManage, confidentiality }: { publicId: string; records: RecordView[]; canManage: boolean; confidentiality: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const confidential = confidentiality === "CONFIDENTIAL" || confidentiality === "STRICT_CONFIDENTIAL";
  return (
    <div>
      <h2 className="text-xs font-medium uppercase tracking-wider text-ink-3">Authorship records</h2>
      <ul className="mt-2 space-y-2">
        {records.map((r) => (
          <li key={r.id} className="rounded-md border border-line bg-surface px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="mono text-xs">{r.publicId}</span>
              <Badge tone={r.status === "VALID" ? "accent" : "danger"}>{r.status}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-ink-2">{r.professionalPublicName} · V{r.versionNumber} · {formatDate(r.signedAt)}</p>
            <p className="text-xs text-ink-3">Visibility: {r.visibility.toLowerCase()}{r.visibility !== "PRIVATE" ? <> · <Link href={`/record/${r.publicId}`} className="text-accent underline" target="_blank">view public page</Link></> : null}</p>
            {canManage ? <button type="button" className="mt-1 text-xs text-accent underline" onClick={() => setEditing(editing === r.id ? null : r.id)}>{editing === r.id ? "Close" : "Publication settings"}</button> : null}
            {editing === r.id ? <RecordEditor publicId={publicId} r={r} confidential={confidential} /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
