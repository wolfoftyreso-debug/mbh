"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { useAction } from "./use-action";
import type { ActionResult } from "@/server/security/errors";

/** Two-step confirmation for consequential actions, optionally collecting a reason. */
export function ConfirmButton({ label, confirmLabel = "Confirm", description, action, variant = "outline", size = "sm", withReason = false, reasonPlaceholder = "Reason" }: { label: string; confirmLabel?: string; description?: string; action: (reason: string) => Promise<ActionResult<unknown>>; variant?: "primary" | "secondary" | "outline" | "ghost" | "danger"; size?: "sm" | "md"; withReason?: boolean; reasonPlaceholder?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { run, pending, error } = useAction(action, { onSuccess: () => setOpen(false) });
  if (!open)
    return (
      <Button variant={variant} size={size} type="button" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  return (
    <div className="space-y-2 rounded-md border border-line bg-surface-2 p-3">
      {description ? <p className="text-sm text-ink-2">{description}</p> : null}
      {withReason ? <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={reasonPlaceholder} rows={3} className="min-h-20" /> : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex gap-2">
        <Button size="sm" variant={variant === "danger" ? "danger" : "primary"} type="button" disabled={pending || (withReason && reason.trim().length < 3)} onClick={() => run(reason)}>
          {pending ? "Working…" : confirmLabel}
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
