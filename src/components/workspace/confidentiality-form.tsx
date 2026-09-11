"use client";
import { useState } from "react";
import { setConfidentialityAction, setPortfolioPermissionAction } from "@/server/actions/assignments";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Select, Field } from "@/components/ui/form";
import { useT } from "@/components/i18n/provider";
const LEVELS: Level[] = ["STANDARD", "PRIVATE", "CONFIDENTIAL", "STRICT_CONFIDENTIAL"];

type Level = "STANDARD" | "PRIVATE" | "CONFIDENTIAL" | "STRICT_CONFIDENTIAL";
type Ai = "AI_DISABLED" | "AI_METADATA_ONLY" | "AI_ALLOWED";
type Perm = "NOT_PERMITTED" | "ATTRIBUTION_ONLY" | "EXCERPT_PERMITTED" | "FULL_WORK_PERMITTED";

export function ConfidentialityForm({ publicId, level, aiPolicy, portfolioPermission }: { publicId: string; level: Level; aiPolicy: Ai; portfolioPermission: Perm }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [l, setL] = useState<Level>(level);
  const [ai, setAi] = useState<Ai>(aiPolicy);
  const [perm, setPerm] = useState<Perm>(portfolioPermission);
  const conf = useAction(setConfidentialityAction, { onSuccess: () => setOpen(false) });
  const pf = useAction(setPortfolioPermissionAction);
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-ink-3">Confidentiality</h2>
        <button type="button" className="text-xs text-accent underline" onClick={() => setOpen(!open)}>{open ? "Close" : "Change"}</button>
      </div>
      <p className="mt-1 text-xs text-ink-2">{t(`conf.${level}.short`)}</p>
      {open ? (
        <div className="mt-2 space-y-3 rounded-md border border-line bg-surface p-3">
          <Field label="Level"><Select value={l} onChange={(e) => { const v = e.target.value as Level; setL(v); if (v === "STRICT_CONFIDENTIAL" && ai === "AI_ALLOWED") setAi("AI_DISABLED"); }}>{LEVELS.map((k) => <option key={k} value={k}>{t(`conf.${k}.label`)}</option>)}</Select></Field>
          <Field label="AI processing"><Select value={ai} onChange={(e) => setAi(e.target.value as Ai)}><option value="AI_DISABLED">Disabled</option><option value="AI_METADATA_ONLY">Metadata only</option>{l !== "STRICT_CONFIDENTIAL" ? <option value="AI_ALLOWED">Allowed</option> : null}</Select></Field>
          {conf.error ? <p className="text-xs text-danger">{conf.error}</p> : null}
          <Button size="sm" disabled={conf.pending} onClick={() => conf.run(publicId, l, ai)}>Save</Button>
          <Field label="Portfolio permission for the professional" hint="Explicit consent. Revoking removes public presentation while audit history is kept.">
            <Select value={perm} onChange={(e) => { const v = e.target.value as Perm; setPerm(v); pf.run(publicId, v); }}>
              <option value="NOT_PERMITTED">Not permitted</option>
              <option value="ATTRIBUTION_ONLY">Attribution only (name the work, no content)</option>
              <option value="EXCERPT_PERMITTED">Excerpt permitted</option>
              <option value="FULL_WORK_PERMITTED">Full work permitted</option>
            </Select>
          </Field>
          {pf.error ? <p className="text-xs text-danger">{pf.error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
