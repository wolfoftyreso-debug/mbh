"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export interface UploadedFile {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

/** Uploads files through the authenticated upload route (never directly to storage). */
export function FileUpload({ purpose, assignmentPublicId, accept, multiple = true, onUploaded, label = "Add files", compact = false }: { purpose: string; assignmentPublicId?: string | null; accept?: string; multiple?: boolean; onUploaded: (files: UploadedFile[]) => void; label?: string; compact?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const done: UploadedFile[] = [];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", purpose);
      if (assignmentPublicId) fd.append("assignment", assignmentPublicId);
      try {
        const res = await fetch("/api/uploads", { method: "POST", body: fd });
        const json = (await res.json()) as UploadedFile & { error?: string };
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
        done.push(json);
      } catch (err) {
        setError(`${file.name}: ${(err as Error).message}`);
      }
    }
    if (done.length) onUploaded(done);
    setBusy(false);
    if (ref.current) ref.current.value = "";
  }

  return (
    <div className={compact ? "inline-flex items-center gap-2" : "space-y-2"}>
      <input ref={ref} type="file" className="hidden" accept={accept} multiple={multiple} onChange={(e) => handle(e.target.files)} />
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? "Uploading…" : label}
      </Button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
