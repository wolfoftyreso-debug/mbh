"use client";
import { requestPayoutAction } from "@/server/actions/professionals";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";

export function PayoutButton({ currency }: { currency: string }) {
  const { run, pending, error, success } = useAction(requestPayoutAction);
  if (success) return <p className="text-xs text-accent">Payout requested.</p>;
  return (
    <div>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(currency)}>Request payout</Button>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
