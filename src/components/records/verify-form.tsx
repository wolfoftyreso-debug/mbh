"use client";
import { useState, useTransition } from "react";
import { verifyRecordAction } from "@/server/actions/records";
import { Button } from "@/components/ui/button";
import { Textarea, Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/card";

export function VerifyForm({ publicId }: { publicId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ result: string; suppliedHash: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        setResult(null);
        start(async () => {
          const res = await verifyRecordAction(publicId, fd);
          if (res.ok && res.data) setResult(res.data);
          else if (!res.ok) setError(res.error);
        });
      }}
    >
      <Field label="Text">
        <Textarea name="text" rows={10} placeholder="Paste the full text exactly as published" />
      </Field>
      <Field label="Or a file" hint="The file is compared byte for byte with files attached to the signed version.">
        <Input type="file" name="file" />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Checking…" : "Compare"}</Button>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {result ? (
        result.result === "MATCH" ? (
          <Alert tone="success" title="Match">The supplied content has the same fingerprint as the signed version.</Alert>
        ) : result.result === "NO_MATCH" ? (
          <Alert tone="warn" title="No match">The supplied content differs from the signed version. {result.suppliedHash ? <span className="mono block break-all text-xs">supplied sha256:{result.suppliedHash}</span> : null}</Alert>
        ) : (
          <Alert tone="info">Comparison is not available for this record.</Alert>
        )
      ) : null}
    </form>
  );
}
