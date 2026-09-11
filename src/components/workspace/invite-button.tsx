"use client";
import { inviteProfessionalAction } from "@/server/actions/assignments";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/provider";

export function InviteButton({ publicId, professionalUserId, invited }: { publicId: string; professionalUserId: string; invited: boolean }) {
  const { t } = useT();
  const { run, pending, error, success } = useAction(inviteProfessionalAction);
  if (invited || success) return <span className="text-xs text-accent">{t("common.invited")}</span>;
  return (
    <span className="inline-flex flex-col items-end">
      <Button size="sm" disabled={pending} onClick={() => run(publicId, professionalUserId, "")}>{pending ? t("common.inviting") : t("common.invite")}</Button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
