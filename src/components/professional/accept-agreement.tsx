"use client";
import { useState } from "react";
import { acceptAgreementAction } from "@/server/actions/professionals";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/form";
import { useT } from "@/components/i18n/provider";

export function AcceptAgreementButton() {
  const { t } = useT();
  const [checked, setChecked] = useState(false);
  const { run, pending, error } = useAction(acceptAgreementAction);
  return (
    <div className="space-y-3">
      <label className="flex items-start gap-2 text-sm"><Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5" /> {t("pro.agreement.readAccept")}</label>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <Button disabled={!checked || pending} onClick={() => run("PROFESSIONAL_CONFIDENTIALITY")}>{pending ? t("pro.agreement.recording") : t("pro.agreement.accept")}</Button>
    </div>
  );
}
