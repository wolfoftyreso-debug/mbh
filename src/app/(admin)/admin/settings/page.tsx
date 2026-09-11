import { requireAdmin } from "@/server/auth/session";
import { getAllSettings } from "@/server/domain/admin/settings";
import { PageHeader, Card, CardBody } from "@/components/ui/card";
import { SettingField } from "@/components/admin/forms";
import { enabledProviders } from "@/server/auth/config";
import { env } from "@/lib/config/env";
import { getPaymentProvider } from "@/server/finance/providers";
import { getEmailProvider } from "@/server/email";
import { getSmsProvider } from "@/server/sms";
import { getStorage } from "@/server/storage";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getAllSettings();
  return (
    <div className="space-y-6">
      <PageHeader title="Platform settings" />
      <Card><CardBody className="space-y-4">{settings.map((s) => <SettingField key={s.key} k={s.key} value={s.value} />)}<p className="text-xs text-ink-3">commission_bps is in basis points (1500 = 15%). content_access_grant_minutes limits admin content access grants.</p></CardBody></Card>
      <Card><CardBody><h2 className="font-semibold">Integrations (from environment)</h2><dl className="mt-2 grid grid-cols-2 gap-1 text-sm"><dt className="text-ink-3">Auth providers</dt><dd>{Object.entries(enabledProviders).filter(([, v]) => v).map(([k]) => k).join(", ") || "none"}</dd><dt className="text-ink-3">Payments</dt><dd>{getPaymentProvider().name}</dd><dt className="text-ink-3">E-mail</dt><dd>{getEmailProvider().name}</dd><dt className="text-ink-3">SMS</dt><dd>{getSmsProvider().name}</dd><dt className="text-ink-3">Storage</dt><dd>{getStorage().name}</dd><dt className="text-ink-3">AI gateway</dt><dd>{env.aiConfigured ? "configured" : "not configured (features degrade gracefully)"}</dd></dl></CardBody></Card>
    </div>
  );
}
