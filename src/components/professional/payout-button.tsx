"use client";
import { requestPayoutAction } from "@/server/actions/professionals";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/provider";

export function PayoutButton({ currency }: { currency: string }) {
  const { t } = useT();
  const { run, pending, error, success } = useAction(requestPayoutAction);
  if (success) return <p className="text-xs text-accent">{t("pro.earn.payoutRequested")}</p>;
  return (
    <div>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(currency)}>{t("pro.earn.requestPayout")}</Button>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
