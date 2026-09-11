"use client";
import { useState } from "react";
import { addCredentialAction, claimExpertiseAction, removeCredentialAction, removeExpertiseAction, removeLanguageAction, submitIdentityAction, upsertLanguageAction } from "@/server/actions/professionals";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { ClaimBadge } from "@/components/ui/badge";
import { FileUpload, type UploadedFile } from "@/components/upload/file-upload";
import { humanize } from "@/lib/utils";

export function LanguagesManager({ current, languages }: { current: { code: string; name: string; level: string; editorialCapable: boolean; status: string }[]; languages: { code: string; name: string }[] }) {
  const [code, setCode] = useState("");
  const [level, setLevel] = useState<"NATIVE" | "FULL_PROFESSIONAL" | "PROFESSIONAL" | "WORKING">("PROFESSIONAL");
  const [editorial, setEditorial] = useState(false);
  const add = useAction(upsertLanguageAction, { onSuccess: () => setCode("") });
  const remove = useAction(removeLanguageAction);
  return (
    <div className="space-y-3 text-sm">
      {current.length ? <ul className="space-y-1">{current.map((l) => <li key={l.code} className="flex items-center justify-between gap-2 rounded-md border border-line px-3 py-2"><span>{l.name} <span className="text-ink-3">· {humanize(l.level)}{l.editorialCapable ? " · editorial" : ""}</span></span><span className="flex items-center gap-2"><ClaimBadge status={l.status} /><button type="button" className="text-xs text-ink-3 hover:text-danger" onClick={() => remove.run(l.code)}>Remove</button></span></li>)}</ul> : <p className="text-ink-3">No languages yet.</p>}
      <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]" onSubmit={(e) => { e.preventDefault(); if (code) add.run(code, level, editorial); }}>
        <Select value={code} onChange={(e) => setCode(e.target.value)} required><option value="">Language…</option>{languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}</Select>
        <Select value={level} onChange={(e) => setLevel(e.target.value as typeof level)}><option value="NATIVE">Native</option><option value="FULL_PROFESSIONAL">Full professional</option><option value="PROFESSIONAL">Professional</option><option value="WORKING">Working</option></Select>
        <label className="flex items-center gap-1.5 whitespace-nowrap text-xs"><Checkbox checked={editorial} onChange={(e) => setEditorial(e.target.checked)} /> Editorial</label>
        <Button size="sm" type="submit" disabled={add.pending || !code}>Add</Button>
      </form>
      {add.error ? <p className="text-xs text-danger">{add.error}</p> : null}
    </div>
  );
}

export function ExpertiseManager({ current, domains }: { current: { id: string; domainName: string; years: number | null; status: string; description: string }[]; domains: { id: string; name: string; depth: number }[] }) {
  const [domainId, setDomainId] = useState("");
  const [years, setYears] = useState("");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState("");
  const add = useAction(claimExpertiseAction, { onSuccess: () => { setDomainId(""); setYears(""); setDescription(""); setEvidence(""); } });
  const remove = useAction(removeExpertiseAction);
  return (
    <div className="space-y-3 text-sm">
      {current.length ? <ul className="space-y-1">{current.map((e) => <li key={e.id} className="flex items-center justify-between gap-2 rounded-md border border-line px-3 py-2"><span>{e.domainName}{e.years ? <span className="text-ink-3"> · {e.years} years</span> : null}</span><span className="flex items-center gap-2"><ClaimBadge status={e.status} /><button type="button" className="text-xs text-ink-3 hover:text-danger" onClick={() => remove.run(e.id)}>Remove</button></span></li>)}</ul> : <p className="text-ink-3">No expertise claimed. Language-only professionals do not need this.</p>}
      <form className="space-y-2 border-t border-line pt-3" onSubmit={(e) => { e.preventDefault(); add.run({ domainId, yearsExperience: years ? Number(years) : null, description, evidenceSummary: evidence }); }}>
        <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
          <Select value={domainId} onChange={(e) => setDomainId(e.target.value)} required><option value="">Domain…</option>{domains.map((d) => <option key={d.id} value={d.id}>{" ".repeat(d.depth * 3)}{d.name}</option>)}</Select>
          <Input type="number" min={0} max={80} placeholder="Years" value={years} onChange={(e) => setYears(e.target.value)} />
        </div>
        <Field label="What is your experience in this domain?"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="min-h-16" /></Field>
        <Field label="Evidence for verification (optional)" hint="Employment, certifications, business ownership, published work. Leaving this empty keeps the claim self-declared."><Textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={2} className="min-h-16" /></Field>
        {add.error ? <p className="text-xs text-danger">{add.error}</p> : null}
        <Button size="sm" type="submit" disabled={add.pending || !domainId}>{evidence.trim() ? "Claim and request review" : "Add self-declared claim"}</Button>
      </form>
    </div>
  );
}

export function CredentialsManager({ existing }: { existing: string[] }) {
  const [type, setType] = useState<"EDUCATION" | "CERTIFICATION" | "PROFESSIONAL_MEMBERSHIP" | "EMPLOYMENT" | "TRADE_QUALIFICATION" | "BUSINESS_OWNERSHIP" | "PUBLISHED_WORK" | "OTHER">("EDUCATION");
  const [title, setTitle] = useState("");
  const [issuer, setIssuer] = useState("");
  const [field, setField] = useState("");
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");
  const [publicVisible, setPublicVisible] = useState(true);
  const [docs, setDocs] = useState<UploadedFile[]>([]);
  const add = useAction(addCredentialAction, { onSuccess: () => { setTitle(""); setIssuer(""); setField(""); setStartYear(""); setEndYear(""); setDocs([]); } });
  const remove = useAction(removeCredentialAction);
  void existing;
  void remove;
  return (
    <form className="space-y-3 text-sm" onSubmit={(e) => { e.preventDefault(); add.run({ type, title, issuer, field, startYear: startYear ? Number(startYear) : null, endYear: endYear ? Number(endYear) : null, description: "", publicVisible, documentAttachmentIds: docs.map((d) => d.id) }); }}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Type"><Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>{["EDUCATION", "CERTIFICATION", "PROFESSIONAL_MEMBERSHIP", "EMPLOYMENT", "TRADE_QUALIFICATION", "BUSINESS_OWNERSHIP", "PUBLISHED_WORK", "OTHER"].map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</Select></Field>
        <Field label="Title" required><Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Master of Education, Swedish" /></Field>
        <Field label="Issuer / employer"><Input value={issuer} onChange={(e) => setIssuer(e.target.value)} /></Field>
        <Field label="Field"><Input value={field} onChange={(e) => setField(e.target.value)} /></Field>
        <Field label="Start year"><Input type="number" min={1950} max={2100} value={startYear} onChange={(e) => setStartYear(e.target.value)} /></Field>
        <Field label="End year"><Input type="number" min={1950} max={2100} value={endYear} onChange={(e) => setEndYear(e.target.value)} /></Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <FileUpload purpose="VERIFICATION_DOCUMENT" accept="application/pdf,image/png,image/jpeg" onUploaded={(f) => setDocs((p) => [...p, ...f])} label="Attach documentation (private)" compact />
        {docs.map((d) => <span key={d.id} className="text-xs">{d.filename}</span>)}
      </div>
      <label className="flex items-center gap-2 text-xs"><Checkbox checked={publicVisible} onChange={(e) => setPublicVisible(e.target.checked)} /> Show this credential on my public profile</label>
      {add.error ? <p className="text-xs text-danger">{add.error}</p> : null}
      <Button size="sm" type="submit" disabled={add.pending || !title.trim()}>{docs.length ? "Add and request verification" : "Add self-declared credential"}</Button>
    </form>
  );
}

export function IdentityForm({ rejectedNote }: { rejectedNote: string | null }) {
  const [legalName, setLegalName] = useState("");
  const [doc, setDoc] = useState<UploadedFile | null>(null);
  const submit = useAction(submitIdentityAction);
  if (submit.success) return <p className="text-sm text-accent">Submitted. You will be notified after review.</p>;
  return (
    <form className="space-y-3 text-sm" onSubmit={(e) => { e.preventDefault(); if (doc) submit.run(legalName, doc.id); }}>
      {rejectedNote ? <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">Previous submission was not accepted: {rejectedNote}</p> : null}
      <Field label="Legal name as on the document" required><Input value={legalName} onChange={(e) => setLegalName(e.target.value)} required /></Field>
      <div className="flex items-center gap-3"><FileUpload purpose="VERIFICATION_DOCUMENT" accept="application/pdf,image/png,image/jpeg" multiple={false} onUploaded={(f) => setDoc(f[0] ?? null)} label={doc ? "Replace document" : "Upload identity document"} compact />{doc ? <span className="text-xs">{doc.filename}</span> : null}</div>
      {submit.error ? <p className="text-xs text-danger">{submit.error}</p> : null}
      <Button size="sm" type="submit" disabled={submit.pending || !doc || !legalName.trim()}>Submit for review</Button>
    </form>
  );
}
