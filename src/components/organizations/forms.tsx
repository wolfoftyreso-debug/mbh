"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { addMemberAction, createOrganizationAction, removeMemberAction, updateMemberRoleAction } from "@/server/actions/organizations";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";

export function CreateOrganizationForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [website, setWebsite] = useState("");
  const { run, pending, error } = useAction(createOrganizationAction, { onSuccess: (d) => d && router.push(`/organizations/${d.id}`) });
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run({ name, country: country || null, billingEmail: billingEmail || null, website: website || null }); }}>
      <Field label="Name" required><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
      <Field label="Country (ISO)"><Input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} /></Field>
      <Field label="Billing e-mail"><Input type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} /></Field>
      <Field label="Website"><Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" /></Field>
      {error ? <p className="text-xs text-danger sm:col-span-2">{error}</p> : null}
      <div className="sm:col-span-2"><Button type="submit" disabled={pending}>Create organization</Button></div>
    </form>
  );
}

export function AddMemberForm({ organizationId }: { organizationId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER" | "BILLING">("MEMBER");
  const { run, pending, error, success } = useAction(addMemberAction, { onSuccess: () => setEmail("") });
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); run(organizationId, email, role); }}>
      <Field label="E-mail"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-64" /></Field>
      <Field label="Role"><Select value={role} onChange={(e) => setRole(e.target.value as typeof role)}><option value="MEMBER">Member</option><option value="ADMIN">Admin</option><option value="BILLING">Billing</option></Select></Field>
      <Button type="submit" disabled={pending}>Add</Button>
      {error ? <p className="w-full text-xs text-danger">{error}</p> : null}
      {success ? <p className="w-full text-xs text-accent">Added.</p> : null}
    </form>
  );
}

export function MemberRow({ organizationId, memberId, role }: { organizationId: string; memberId: string; role: string }) {
  const update = useAction(updateMemberRoleAction);
  const remove = useAction(removeMemberAction);
  return (
    <span className="flex items-center gap-2">
      <Select value={role} onChange={(e) => update.run(organizationId, memberId, e.target.value as "MEMBER")} className="h-8 w-32 py-0 text-xs"><option value="ADMIN">Admin</option><option value="MEMBER">Member</option><option value="BILLING">Billing</option></Select>
      <button type="button" className="text-xs text-ink-3 hover:text-danger" disabled={remove.pending} onClick={() => remove.run(organizationId, memberId)}>Remove</button>
    </span>
  );
}
