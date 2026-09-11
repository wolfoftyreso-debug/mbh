"use client";
import { useState } from "react";
import { createPayoutForProfessionalAction, decideCredentialAction, decideExpertiseAction, decideIdentityAction, grantContentAccessAction, markPayoutPaidAction, refundPaymentAction, resolveDisputeAction, revokeRecordAction, setPlatformRoleAction, setSettingAction, setUserSuspendedAction, setVerificationStatusAction, upsertCategoryAction, upsertDomainAction, executeDeletionAction } from "@/server/actions/admin";
import { useAction } from "@/components/common/use-action";
import { ConfirmButton } from "@/components/common/confirm-button";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Checkbox, Field } from "@/components/ui/form";

export function DecisionButtons({ kind, id }: { kind: "credential" | "expertise" | "identity"; id: string }) {
  const [notes, setNotes] = useState("");
  const action = kind === "credential" ? decideCredentialAction : kind === "expertise" ? decideExpertiseAction : decideIdentityAction;
  const { run, pending, error } = useAction(action);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reviewer notes" className="h-8 w-56 text-xs" />
      <Button size="sm" disabled={pending} onClick={() => run(id, "PLATFORM_VERIFIED", notes)}>Verify</Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(id, "REJECTED", notes)}>Reject</Button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  );
}

export function UserAdminControls({ userId, suspended, platformRole, profileId, verificationStatus, isSuperAdmin, deletionPending }: { userId: string; suspended: boolean; platformRole: string; profileId: string | null; verificationStatus: string | null; isSuperAdmin: boolean; deletionPending: boolean }) {
  const role = useAction(setPlatformRoleAction);
  const vs = useAction(setVerificationStatusAction);
  const [status, setStatus] = useState(verificationStatus ?? "UNVERIFIED");
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <ConfirmButton label={suspended ? "Unsuspend" : "Suspend"} variant={suspended ? "outline" : "danger"} withReason action={(reason) => setUserSuspendedAction(userId, !suspended, reason)} />
      {isSuperAdmin ? <Select value={platformRole} onChange={(e) => role.run(userId, e.target.value as "USER")} className="h-8 w-36 py-0 text-xs"><option value="USER">User</option><option value="ADMIN">Admin</option><option value="SUPER_ADMIN">Super admin</option></Select> : null}
      {profileId ? (
        <span className="flex items-center gap-1">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 w-48 py-0 text-xs">{["UNVERIFIED", "IDENTITY_VERIFIED", "CREDENTIALS_VERIFIED", "PROFESSIONAL_VERIFIED", "SUSPENDED", "REVOKED"].map((s) => <option key={s} value={s}>{s}</option>)}</Select>
          <ConfirmButton label="Set" size="sm" withReason reasonPlaceholder="Reason for the change" action={(reason) => setVerificationStatusAction(profileId, status as "UNVERIFIED", reason)} />
        </span>
      ) : null}
      {deletionPending ? <ConfirmButton label="Execute deletion" variant="danger" description="Anonymizes the account. Ledger and audit are retained." action={() => executeDeletionAction(userId)} /> : null}
      {role.error || vs.error ? <span className="text-danger">{role.error ?? vs.error}</span> : null}
    </div>
  );
}

export function ContentAccessForm({ assignmentId }: { assignmentId: string }) {
  const [reason, setReason] = useState("");
  const { run, pending, error, success } = useAction(grantContentAccessAction);
  if (success) return <p className="text-sm text-accent">Access granted for a limited time. It is recorded in the audit log and visible to participants.</p>;
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(assignmentId, reason); }}>
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="min-h-16" placeholder="Operational reason: support request #, dispute id, abuse report, legal requirement, security incident" />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <Button size="sm" type="submit" disabled={pending || reason.trim().length < 10}>Request time-limited content access</Button>
    </form>
  );
}

export function DisputeResolver({ disputeId }: { disputeId: string }) {
  const [resolution, setResolution] = useState<"RESOLVED_FOR_CUSTOMER" | "RESOLVED_FOR_PROFESSIONAL" | "RESOLVED_SPLIT" | "CLOSED" | "UNDER_REVIEW">("UNDER_REVIEW");
  const [next, setNext] = useState<"" | "COMPLETED" | "CANCELLED" | "IN_PROGRESS" | "SIGNED">("");
  const [notes, setNotes] = useState("");
  const { run, pending, error, success } = useAction(resolveDisputeAction);
  if (success) return <p className="text-xs text-accent">Updated.</p>;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Select value={resolution} onChange={(e) => setResolution(e.target.value as typeof resolution)} className="h-8 w-56 py-0 text-xs"><option value="UNDER_REVIEW">Mark under review</option><option value="RESOLVED_FOR_CUSTOMER">Resolve for customer</option><option value="RESOLVED_FOR_PROFESSIONAL">Resolve for professional</option><option value="RESOLVED_SPLIT">Resolve split</option><option value="CLOSED">Close</option></Select>
        <Select value={next} onChange={(e) => setNext(e.target.value as typeof next)} className="h-8 w-56 py-0 text-xs"><option value="">Assignment: leave as is</option><option value="COMPLETED">Assignment: complete</option><option value="CANCELLED">Assignment: cancel</option><option value="IN_PROGRESS">Assignment: back to in progress</option><option value="SIGNED">Assignment: back to signed</option></Select>
      </div>
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="min-h-16" placeholder="Resolution notes (shared with participants)" />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <Button size="sm" disabled={pending} onClick={() => run(disputeId, resolution, notes, next || null)}>Apply</Button>
    </div>
  );
}

export function RefundForm({ paymentId, maxMinor, currency }: { paymentId: string; maxMinor: number; currency: string }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const { run, pending, error, success } = useAction(refundPaymentAction);
  if (success) return <span className="text-xs text-accent">Refunded.</span>;
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Amount (max ${maxMinor / 100} ${currency})`} className="h-8 w-36 text-xs" />
      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className="h-8 w-40 text-xs" />
      <Button size="sm" variant="outline" disabled={pending || !amount || reason.length < 3} onClick={() => run(paymentId, Math.round(Number(amount.replace(",", ".")) * 100), reason)}>Refund</Button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}

export function PayoutControls({ payoutId, status }: { payoutId: string; status: string }) {
  const { run, pending, error } = useAction(markPayoutPaidAction);
  if (status === "PAID") return null;
  return <span><Button size="sm" variant="outline" disabled={pending} onClick={() => run(payoutId)}>Mark paid</Button>{error ? <span className="ml-2 text-xs text-danger">{error}</span> : null}</span>;
}

export function CreatePayoutButton({ userId, currency }: { userId: string; currency: string }) {
  const { run, pending, error } = useAction(createPayoutForProfessionalAction);
  return <span><Button size="sm" variant="outline" disabled={pending} onClick={() => run(userId, currency)}>Create payout</Button>{error ? <span className="ml-2 text-xs text-danger">{error}</span> : null}</span>;
}

export function RevokeRecordButton({ publicId }: { publicId: string }) {
  return <ConfirmButton label="Revoke record" variant="danger" withReason action={(reason) => revokeRecordAction(publicId, reason)} />;
}

export function CategoryForm({ initial }: { initial?: { id: string; name: string; description: string; kind: "LANGUAGE" | "DOMAIN" | "COMBINED"; defaultContributionRole: string; active: boolean; sortOrder: number } }) {
  const [f, setF] = useState(initial ?? { id: "", name: "", description: "", kind: "LANGUAGE" as const, defaultContributionRole: "AUTHOR", active: true, sortOrder: 100 });
  const { run, pending, error, success } = useAction(upsertCategoryAction);
  return (
    <form className="grid gap-2 sm:grid-cols-6" onSubmit={(e) => { e.preventDefault(); run({ ...f, id: f.id || null }); }}>
      <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name" required className="sm:col-span-2" />
      <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as "LANGUAGE" })}><option value="LANGUAGE">Language</option><option value="DOMAIN">Domain</option><option value="COMBINED">Combined</option></Select>
      <Select value={f.defaultContributionRole} onChange={(e) => setF({ ...f, defaultContributionRole: e.target.value })}>{["AUTHOR", "EDITOR", "LANGUAGE_REVIEWER", "DOMAIN_REVIEWER", "FACT_CHECKER", "TRANSLATOR", "TRANSLATION_REVIEWER", "FINAL_APPROVER"].map((r) => <option key={r} value={r}>{r}</option>)}</Select>
      <Input type="number" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: Number(e.target.value) })} placeholder="Sort" />
      <label className="flex items-center gap-1 text-xs"><Checkbox checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Active</label>
      <Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Description" className="sm:col-span-5" />
      <Button size="sm" type="submit" disabled={pending}>{f.id ? "Save" : "Add"}</Button>
      {error ? <p className="text-xs text-danger sm:col-span-6">{error}</p> : null}
      {success ? <p className="text-xs text-accent sm:col-span-6">Saved.</p> : null}
    </form>
  );
}

export function DomainForm({ domains }: { domains: { id: string; name: string; depth: number }[] }) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [description, setDescription] = useState("");
  const { run, pending, error, success } = useAction(upsertDomainAction, { onSuccess: () => setName("") });
  return (
    <form className="grid gap-2 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); run({ id: null, parentId: parentId || null, name, description, active: true }); }}>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New domain name" required />
      <Select value={parentId} onChange={(e) => setParentId(e.target.value)}><option value="">Top level</option>{domains.map((d) => <option key={d.id} value={d.id}>{" ".repeat(d.depth * 3)}{d.name}</option>)}</Select>
      <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
      <Button size="sm" type="submit" disabled={pending}>Add domain</Button>
      {error ? <p className="text-xs text-danger sm:col-span-4">{error}</p> : null}
      {success ? <p className="text-xs text-accent sm:col-span-4">Added.</p> : null}
    </form>
  );
}

export function SettingField({ k, value }: { k: string; value: unknown }) {
  const [v, setV] = useState(String(value ?? ""));
  const { run, pending, error, success } = useAction(setSettingAction);
  return (
    <Field label={k}>
      <span className="flex gap-2"><Input value={v} onChange={(e) => setV(e.target.value)} /><Button size="sm" variant="outline" disabled={pending} onClick={() => run(k as "commission_bps", v)}>Save</Button></span>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
      {success ? <span className="text-xs text-accent">Saved.</span> : null}
    </Field>
  );
}
