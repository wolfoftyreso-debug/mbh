"use client";
import { inviteProfessionalAction } from "@/server/actions/assignments";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";

export function InviteButton({ publicId, professionalUserId, invited }: { publicId: string; professionalUserId: string; invited: boolean }) {
  const { run, pending, error, success } = useAction(inviteProfessionalAction);
  if (invited || success) return <span className="text-xs text-accent">Invited</span>;
  return (
    <span className="inline-flex flex-col items-end">
      <Button size="sm" disabled={pending} onClick={() => run(publicId, professionalUserId, "")}>{pending ? "Inviting…" : "Invite"}</Button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
