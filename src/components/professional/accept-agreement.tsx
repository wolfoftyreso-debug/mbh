"use client";
import { useState } from "react";
import { acceptAgreementAction } from "@/server/actions/professionals";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/form";

export function AcceptAgreementButton() {
  const [checked, setChecked] = useState(false);
  const { run, pending, error } = useAction(acceptAgreementAction);
  return (
    <div className="space-y-3">
      <label className="flex items-start gap-2 text-sm"><Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5" /> I have read and accept the professional confidentiality agreement.</label>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <Button disabled={!checked || pending} onClick={() => run("PROFESSIONAL_CONFIDENTIALITY")}>{pending ? "Recording…" : "Accept agreement"}</Button>
    </div>
  );
}
