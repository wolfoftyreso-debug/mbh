"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProfileAction, updateProfileAction, setProfilePublishedAction } from "@/server/actions/professionals";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/card";
import { FileUpload } from "@/components/upload/file-upload";
import { Avatar } from "@/components/ui/avatar";

interface Initial { displayName: string; title: string; bio: string; country: string; region: string; yearsExperience: string; availability?: string; typicalTurnaroundDays?: string; externalUrls?: { label: string; url: string }[]; photoAttachmentId?: string | null; published?: boolean }

export function ProfileForm({ mode, initial }: { mode: "create" | "edit"; initial: Initial }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [urls, setUrls] = useState<{ label: string; url: string }[]>(initial.externalUrls ?? []);
  const [photo, setPhoto] = useState<string | null>(initial.photoAttachmentId ?? null);
  const create = useAction(createProfileAction, { onSuccess: () => router.push("/professional/credentials") });
  const update = useAction(updateProfileAction);
  const publish = useAction(setProfilePublishedAction);
  const pending = create.pending || update.pending;
  const error = create.error ?? update.error;
  const set = (k: keyof Initial, v: string) => setF({ ...f, [k]: v });
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const base = { displayName: f.displayName, title: f.title, bio: f.bio, country: f.country || null, region: f.region || null, yearsExperience: f.yearsExperience ? Number(f.yearsExperience) : null };
        if (mode === "create") create.run(base);
        else update.run({ ...base, availability: f.availability as "AVAILABLE", typicalTurnaroundDays: f.typicalTurnaroundDays ? Number(f.typicalTurnaroundDays) : null, externalUrls: urls.filter((u) => u.url), photoAttachmentId: photo });
      }}
    >
      {mode === "edit" ? (
        <div className="flex items-center gap-4">
          <Avatar name={f.displayName} photoId={photo} size={64} />
          <FileUpload purpose="PROFILE_PHOTO" accept="image/png,image/jpeg,image/webp" multiple={false} onUploaded={(files) => setPhoto(files[0]?.id ?? null)} label="Change photo" compact />
        </div>
      ) : null}
      <Field label="Public name" required hint="Shown on your public profile and on authorship records."><Input value={f.displayName} onChange={(e) => set("displayName", e.target.value)} required maxLength={80} /></Field>
      <Field label="Professional title" hint="e.g. Swedish language specialist, Automotive technician, Authorized accountant"><Input value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={120} /></Field>
      <Field label="Biography" hint="Describe your background factually. Do not claim platform verification; the platform marks what it has verified."><Textarea value={f.bio} onChange={(e) => set("bio", e.target.value)} rows={6} maxLength={4000} /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Country (ISO code)"><Input value={f.country} onChange={(e) => set("country", e.target.value.toUpperCase())} maxLength={2} placeholder="SE" /></Field>
        <Field label="City / region"><Input value={f.region} onChange={(e) => set("region", e.target.value)} maxLength={80} /></Field>
        <Field label="Years of experience"><Input type="number" min={0} max={80} value={f.yearsExperience} onChange={(e) => set("yearsExperience", e.target.value)} /></Field>
      </div>
      {mode === "edit" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Availability"><Select value={f.availability ?? "AVAILABLE"} onChange={(e) => set("availability", e.target.value)}><option value="AVAILABLE">Available</option><option value="LIMITED">Limited</option><option value="UNAVAILABLE">Unavailable</option></Select></Field>
            <Field label="Typical turnaround (days)"><Input type="number" min={1} max={90} value={f.typicalTurnaroundDays ?? ""} onChange={(e) => set("typicalTurnaroundDays", e.target.value)} /></Field>
          </div>
          <div>
            <p className="text-sm font-medium">External professional links</p>
            {urls.map((u, i) => (
              <div key={i} className="mt-2 flex gap-2"><Input value={u.label} placeholder="Label" onChange={(e) => setUrls(urls.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="w-40" /><Input value={u.url} placeholder="https://" onChange={(e) => setUrls(urls.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} /><Button type="button" variant="ghost" size="sm" onClick={() => setUrls(urls.filter((_, j) => j !== i))}>Remove</Button></div>
            ))}
            {urls.length < 8 ? <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setUrls([...urls, { label: "", url: "" }])}>Add link</Button> : null}
          </div>
        </>
      ) : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {update.success ? <Alert tone="success">Saved.</Alert> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : mode === "create" ? "Create profile" : "Save changes"}</Button>
        {mode === "edit" ? (
          <Button type="button" variant={initial.published ? "outline" : "secondary"} disabled={publish.pending} onClick={() => publish.run(!initial.published)}>{initial.published ? "Unpublish public profile" : "Publish public profile"}</Button>
        ) : null}
        {publish.error ? <span className="text-xs text-danger">{publish.error}</span> : null}
      </div>
    </form>
  );
}
