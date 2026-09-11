"use client";
import { useState } from "react";
import { exportDataAction, markNotificationsReadAction, requestDeletionAction, revokeAllSessionsAction, updateAccountAction, updateNotificationPreferencesAction } from "@/server/actions/settings";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { Alert } from "@/components/ui/card";
import { humanize } from "@/lib/utils";

export function AccountForm({ initial }: { initial: { name: string; email: string; locale: string; timezone: string; phone: string } }) {
  const [f, setF] = useState(initial);
  const { run, pending, error, success } = useAction(updateAccountAction);
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run({ name: f.name, locale: f.locale as "en", timezone: f.timezone, phone: f.phone || null }); }}>
      <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
      <Field label="E-mail" hint="Managed by your sign-in provider."><Input value={f.email} disabled /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Language"><Select value={f.locale} onChange={(e) => setF({ ...f, locale: e.target.value })}><option value="en">English</option><option value="sv">Svenska</option></Select></Field>
        <Field label="Time zone"><Input value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} /></Field>
      </div>
      <Field label="Mobile number" hint="Optional. Used only for security and high-priority notifications after verification."><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+46…" /></Field>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {success ? <Alert tone="success">Saved.</Alert> : null}
      <Button type="submit" disabled={pending}>Save</Button>
    </form>
  );
}

export function NotificationPreferencesForm({ types, prefs }: { types: string[]; prefs: { type: string; channel: string; enabled: boolean }[] }) {
  const channels = ["IN_APP", "EMAIL", "SMS"] as const;
  const [state, setState] = useState<Record<string, boolean>>(() => {
    const s: Record<string, boolean> = {};
    for (const t of types) for (const c of channels) s[`${t}:${c}`] = prefs.find((p) => p.type === t && p.channel === c)?.enabled ?? true;
    return s;
  });
  const { run, pending, error, success } = useAction(updateNotificationPreferencesAction);
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(Object.entries(state).map(([k, enabled]) => { const [type, channel] = k.split(":"); return { type, channel: channel as "EMAIL", enabled }; })); }}>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase text-ink-3"><th className="py-2">Event</th>{channels.map((c) => <th key={c} className="py-2 text-center">{humanize(c)}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{types.map((t) => <tr key={t}><td className="py-2">{humanize(t)}</td>{channels.map((c) => <td key={c} className="py-2 text-center"><Checkbox checked={state[`${t}:${c}`]} onChange={(e) => setState({ ...state, [`${t}:${c}`]: e.target.checked })} /></td>)}</tr>)}</tbody>
      </table>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      {success ? <p className="mt-2 text-xs text-accent">Saved.</p> : null}
      <Button type="submit" className="mt-4" disabled={pending}>Save preferences</Button>
    </form>
  );
}

export function RevokeSessionsButton() {
  const { run, pending, error, success } = useAction(revokeAllSessionsAction, { onSuccess: () => { window.location.href = "/sign-in"; } });
  return <span className="flex flex-col items-end gap-1"><Button size="sm" variant="outline" disabled={pending} onClick={() => run()}>Sign out everywhere</Button>{error ? <span className="text-xs text-danger">{error}</span> : null}{success ? <span className="text-xs text-accent">Done</span> : null}</span>;
}

export function ExportDataButton() {
  const { run, pending, error } = useAction(exportDataAction, { refresh: false, onSuccess: (data) => { const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "humanauth-export.json"; a.click(); URL.revokeObjectURL(url); } });
  return <div><Button variant="outline" disabled={pending} onClick={() => run()}>{pending ? "Preparing…" : "Download my data"}</Button>{error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}</div>;
}

export function RequestDeletionButton({ pending: already }: { pending: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const { run, pending, error, success } = useAction(requestDeletionAction);
  if (already || success) return <p className="text-sm text-ink-2">A deletion request is pending review.</p>;
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> I understand that open assignments must be settled first and that some records are retained.</label>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <Button variant="danger" size="sm" disabled={!confirm || pending} onClick={() => run()}>Request account deletion</Button>
    </div>
  );
}

export function MarkAllReadButton() {
  const { run, pending } = useAction(markNotificationsReadAction);
  return <Button size="sm" variant="outline" disabled={pending} onClick={() => run()}>Mark all as read</Button>;
}
