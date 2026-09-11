"use client";
import Link from "next/link";
import { approveSignedVersionAction, confirmManualPaymentAction, moveToFinalReviewAction, requestRevisionAction, startCheckoutAction } from "@/server/actions/workspace";
import { cancelAssignmentAction, declineInvitationAction, openAssignmentAction, openDisputeAction } from "@/server/actions/assignments";
import { useAction } from "@/components/common/use-action";
import { ConfirmButton } from "@/components/common/confirm-button";
import { Button, LinkButton } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { useT } from "@/components/i18n/provider";

export function CustomerActions(p: { publicId: string; status: string; latestSubmittedVersionId: string | null; hasSigned: boolean; paymentCaptured: boolean; paymentPending: boolean; agreedPriceMinor: number | null; currency: string; paymentProvider: string; manualConfirmAllowed: boolean; canPay: boolean; canCancel: boolean; canDispute: boolean }) {
  const { t } = useT();
  const open = useAction(openAssignmentAction);
  const approve = useAction(approveSignedVersionAction);
  const finalReview = useAction(moveToFinalReviewAction);
  const checkout = useAction(startCheckoutAction, { onSuccess: (d) => { if (d?.checkoutUrl) window.location.href = d.checkoutUrl; } });
  const confirmManual = useAction(confirmManualPaymentAction);
  const err = open.error ?? approve.error ?? finalReview.error ?? checkout.error ?? confirmManual.error;
  const needsPayment = (p.agreedPriceMinor ?? 0) > 0 && !p.paymentCaptured && p.canPay;
  return (
    <div className="space-y-2 rounded-lg border border-line bg-surface p-3">
      <h2 className="text-xs font-medium uppercase tracking-wider text-ink-3">{t("act.nextStep")}</h2>
      {p.status === "DRAFT" ? <Button size="sm" className="w-full" disabled={open.pending} onClick={() => open.run(p.publicId)}>{t("act.openForOffers")}</Button> : null}
      {needsPayment ? (
        <div className="space-y-1">
          <Button size="sm" className="w-full" disabled={checkout.pending} onClick={() => checkout.run(p.publicId)}>{p.paymentPending ? t("act.continuePayment") : t("act.pay", { amount: formatMoney(p.agreedPriceMinor!, p.currency) })}</Button>
          {p.paymentProvider === "manual" && p.manualConfirmAllowed && p.paymentPending ? <Button size="sm" variant="outline" className="w-full" disabled={confirmManual.pending} onClick={() => confirmManual.run(p.publicId)}>{t("act.confirmManual")}</Button> : null}
          <p className="text-xs text-ink-3">{t("act.escrowNote")}</p>
        </div>
      ) : null}
      {p.status === "DELIVERED" && p.latestSubmittedVersionId ? (
        <>
          <LinkButton href={`/assignments/${p.publicId}/versions/${p.latestSubmittedVersionId}`} size="sm" variant="outline" className="w-full">{t("act.reviewDelivered")}</LinkButton>
          <Button size="sm" variant="outline" className="w-full" disabled={finalReview.pending} onClick={() => finalReview.run(p.publicId)}>{t("act.requestSignOff")}</Button>
          <ConfirmButton label={t("act.requestRevision")} confirmLabel={t("act.sendRevision")} withReason reasonPlaceholder={t("act.whatShouldChange")} action={(reason) => requestRevisionAction(p.publicId, p.latestSubmittedVersionId!, reason)} />
        </>
      ) : null}
      {p.status === "FINAL_REVIEW" ? <p className="text-xs text-ink-2">{t("act.waitingSignOff")}</p> : null}
      {p.status === "SIGNED" && p.hasSigned ? (
        <>
          <Button size="sm" className="w-full" disabled={approve.pending} onClick={() => approve.run(p.publicId)}>{t("act.approve")}</Button>
          {p.latestSubmittedVersionId ? <ConfirmButton label={t("act.furtherChanges")} withReason reasonPlaceholder={t("act.whatShouldChange")} action={(reason) => requestRevisionAction(p.publicId, p.latestSubmittedVersionId!, reason)} /> : null}
        </>
      ) : null}
      {p.status === "CUSTOMER_APPROVED" && !p.paymentCaptured ? <p className="text-xs text-ink-2">{t("act.approvedAwaitingPayment")}</p> : null}
      {p.status === "COMPLETED" ? <p className="text-xs text-accent">{t("act.completedCustomer")}</p> : null}
      {err ? <p className="text-xs text-danger">{err}</p> : null}
      <div className="flex flex-wrap gap-2 pt-1">
        {p.canCancel ? <ConfirmButton label={t("act.cancel")} variant="ghost" withReason reasonPlaceholder={t("common.reason")} action={(reason) => cancelAssignmentAction(p.publicId, reason)} /> : null}
        {p.canDispute ? <ConfirmButton label={t("act.dispute")} variant="ghost" withReason reasonPlaceholder={t("act.disputePh")} action={(reason) => openDisputeAction(p.publicId, reason)} /> : null}
      </div>
    </div>
  );
}

export function ProfessionalActions(p: { publicId: string; status: string; latestSubmittedVersionId: string | null; canSign: boolean; canSubmit: boolean; canDispute: boolean }) {
  const { t } = useT();
  return (
    <div className="space-y-2 rounded-lg border border-line bg-surface p-3">
      <h2 className="text-xs font-medium uppercase tracking-wider text-ink-3">{t("act.nextStep")}</h2>
      {p.status === "ACCEPTED" ? <p className="text-xs text-ink-2">{t("act.waitingPayment")}</p> : null}
      {["IN_PROGRESS", "REVISION_REQUESTED"].includes(p.status) && p.canSubmit ? <p className="text-xs text-ink-2">{t("act.deliverHint")}</p> : null}
      {["DELIVERED", "FINAL_REVIEW"].includes(p.status) && p.canSign && p.latestSubmittedVersionId ? <LinkButton href={`/assignments/${p.publicId}/sign/${p.latestSubmittedVersionId}`} size="sm" className="w-full">{t("act.signOff")}</LinkButton> : null}
      {p.status === "SIGNED" ? <p className="text-xs text-ink-2">{t("act.signedWaiting")}</p> : null}
      {p.status === "COMPLETED" ? <p className="text-xs text-accent">{t("act.completedPro")}</p> : null}
      {p.canDispute ? <ConfirmButton label={t("act.dispute")} variant="ghost" withReason reasonPlaceholder={t("act.disputePh")} action={(reason) => openDisputeAction(p.publicId, reason)} /> : null}
    </div>
  );
}

export function ProspectActions({ publicId, hasInvitation }: { publicId: string; hasInvitation: boolean }) {
  const { t } = useT();
  const decline = useAction(declineInvitationAction, { onSuccess: () => { window.location.href = "/marketplace"; } });
  if (!hasInvitation) return <p className="text-xs text-ink-3"><Link href="/marketplace" className="underline">{t("act.backToMarketplace")}</Link></p>;
  return <Button variant="ghost" size="sm" disabled={decline.pending} onClick={() => decline.run(publicId)}>{t("act.declineInvitation")}</Button>;
}
