"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signVersionAction } from "@/server/actions/workspace";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/card";

export function SigningCeremony({ publicId, versionId, statement }: { publicId: string; versionId: string; statement: string }) {
  const [confirmed, setConfirmed] = useState(false);
  const [typed, setTyped] = useState("");
  const router = useRouter();
  const { run, pending, error, success } = useAction(signVersionAction, { onSuccess: (d) => { setTimeout(() => router.push(`/assignments/${publicId}?signed=${d?.recordPublicId ?? ""}`), 1200); } });
  if (success) return <Alert tone="success" title="Signed">Your signature and the authorship record were created. Returning to the assignment…</Alert>;
  return (
    <div className="space-y-4 rounded-lg border-2 border-accent bg-surface p-5">
      <p className="text-sm">{statement}</p>
      <label className="flex items-start gap-2 text-sm"><Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" /> I have read the exact version above and I confirm the statement.</label>
      <label className="block text-sm">Type <span className="mono font-semibold">SIGN</span> to confirm<Input value={typed} onChange={(e) => setTyped(e.target.value)} className="mt-1 mono" autoComplete="off" /></label>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Button size="lg" disabled={pending || !confirmed || typed.trim().toUpperCase() !== "SIGN"} onClick={() => run(publicId, versionId, confirmed, typed)}>{pending ? "Signing…" : "Sign this version"}</Button>
      <p className="text-xs text-ink-3">Your session, a hashed network address and the time are recorded with the signature.</p>
    </div>
  );
}
