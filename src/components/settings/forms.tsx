"use client";
import { useState } from "react";
import { exportDataAction, markNotificationsReadAction, requestDeletionAction, requestPhoneCodeAction, revokeAllSessionsAction, updateAccountAction, updateNotificationPreferencesAction, verifyPhoneCodeAction } from "@/server/actions/settings";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { Alert } from "@/components/ui/card";
import { humanize } from "@/lib/utils";
import { useT } from "@/components/i18n/provider";

export function PhoneVerification({ phone, verified }: { phone: string; verified: boolean }) {
  const { t } = useT();
  const [number, setNumber] = useState(phone);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const request = useAction(requestPhoneCodeAction, { onSuccess: (d) => setDevCode(d?.devCode ?? null) });
  const verify = useAction(verifyPhoneCodeAction, { onSuccess: () => { setCode(""); setDevCode(null); } });
  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center justify-between"><p className="text-sm font-medium">{t("set.phone.title")}</p>{verified && phone ? <span className="text-xs text-accent">{t("set.phone.verified")}</span> : phone ? <span className="text-xs text-ink-3">{t("set.phone.notVerified")}</span> : null}</div>
      <p className="text-xs text-ink-3">{t("set.phone.hint")}</p>
      <div className="flex flex-wrap gap-2">
        <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="+46701234567" className="w-56" />
        <Button size="sm" variant="outline" disabled={request.pending || !number.trim()} onClick={() => request.run(number)}>{request.pending ? t("set.phone.sending") : t("set.phone.sendCode")}</Button>
      </div>
      {request.error ? <p className="text-xs text-danger">{request.error}</p> : null}
      {request.success ? (
        <div className="flex flex-wrap gap-2">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("set.phone.codePh")} inputMode="numeric" className="w-40" />
          <Button size="sm" disabled={verify.pending || code.trim().length !== 6} onClick={() => verify.run(code)}>{t("set.phone.verify")}</Button>
          {devCode ? <span className="text-xs text-ink-3">{t("set.phone.devCode", { code: devCode })}</span> : null}
        </div>
      ) : null}
      {verify.error ? <p className="text-xs text-danger">{verify.error}</p> : null}
      {verify.success ? <p className="text-xs text-accent">{t("set.phone.done")}</p> : null}
    </div>
  );
}

export function AccountForm({ initial }: { initial: { name: string; email: string; locale: string; timezone: string; phone: string } }) {
  const { t } = useT();
  const [f, setF] = useState(initial);
  const { run, pending, error, success } = useAction(updateAccountAction);
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run({ name: f.name, locale: f.locale as "en", timezone: f.timezone }); }}>
      <Field label={t("set.account.name")}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
      <Field label={t("set.account.email")} hint={t("set.account.email.hint")}><Input value={f.email} disabled /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("set.account.language")}><Select value={f.locale} onChange={(e) => setF({ ...f, locale: e.target.value })}><option value="en">English</option><option value="sv">Svenska</option></Select></Field>
        <Field label={t("set.account.timezone")}><Input value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} /></Field>
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {success ? <Alert tone="success">{t("set.account.saved")}</Alert> : null}
      <Button type="submit" disabled={pending}>{t("set.account.save")}</Button>
    </form>
  );
}

export function NotificationPreferencesForm({ types, prefs }: { types: string[]; prefs: { type: string; channel: string; enabled: boolean }[] }) {
  const { t } = useT();
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
        <thead><tr className="text-left text-xs uppercase text-ink-3"><th className="py-2">{t("set.notif.event")}</th>{channels.map((c) => <th key={c} className="py-2 text-center">{humanize(c)}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{types.map((t) => <tr key={t}><td className="py-2">{humanize(t)}</td>{channels.map((c) => <td key={c} className="py-2 text-center"><Checkbox checked={state[`${t}:${c}`]} onChange={(e) => setState({ ...state, [`${t}:${c}`]: e.target.checked })} /></td>)}</tr>)}</tbody>
      </table>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      {success ? <p className="mt-2 text-xs text-accent">{t("set.account.saved")}</p> : null}
      <Button type="submit" className="mt-4" disabled={pending}>{t("set.notif.save")}</Button>
    </form>
  );
}

export function RevokeSessionsButton() {
  const { t } = useT();
  const { run, pending, error, success } = useAction(revokeAllSessionsAction, { onSuccess: () => { window.location.href = "/sign-in"; } });
  return <span className="flex flex-col items-end gap-1"><Button size="sm" variant="outline" disabled={pending} onClick={() => run()}>{t("set.security.signOutEverywhere")}</Button>{error ? <span className="text-xs text-danger">{error}</span> : null}{success ? <span className="text-xs text-accent">{t("set.security.done")}</span> : null}</span>;
}

export function ExportDataButton() {
  const { t } = useT();
  const { run, pending, error } = useAction(exportDataAction, { refresh: false, onSuccess: (data) => { const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "humanauth-export.json"; a.click(); URL.revokeObjectURL(url); } });
  return <div><Button variant="outline" disabled={pending} onClick={() => run()}>{pending ? t("set.privacy.export.preparing") : t("set.privacy.export.button")}</Button>{error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}</div>;
}

export function RequestDeletionButton({ pending: already }: { pending: boolean }) {
  const { t } = useT();
  const [confirm, setConfirm] = useState(false);
  const { run, pending, error, success } = useAction(requestDeletionAction);
  if (already || success) return <p className="text-sm text-ink-2">{t("set.privacy.delete.pending")}</p>;
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> {t("set.privacy.delete.confirm")}</label>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <Button variant="danger" size="sm" disabled={!confirm || pending} onClick={() => run()}>{t("set.privacy.delete.button")}</Button>
    </div>
  );
}

export function MarkAllReadButton({ label = "Mark all as read" }: { label?: string }) {
  const { run, pending } = useAction(markNotificationsReadAction);
  return <Button size="sm" variant="outline" disabled={pending} onClick={() => run()}>{label}</Button>;
}
