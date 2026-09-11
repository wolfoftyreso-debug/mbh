import { getT } from "@/server/i18n";
import { Badge, type Tone } from "./badge";
import type { AssignmentStatus } from "@/server/domain/assignments/state-machine";

const statusTone: Record<AssignmentStatus, Tone> = {
  DRAFT: "neutral", OPEN: "info", PROFESSIONAL_INVITED: "info", OFFER_RECEIVED: "info", ACCEPTED: "accent", IN_PROGRESS: "accent", DELIVERED: "accent", REVISION_REQUESTED: "warn", FINAL_REVIEW: "accent", SIGNED: "accent", CUSTOMER_APPROVED: "accent", COMPLETED: "accent", DISPUTED: "danger", CANCELLED: "neutral",
};

/** Server component: localized assignment status. */
export async function StatusBadge({ status }: { status: AssignmentStatus }) {
  const { t } = await getT();
  return <Badge tone={statusTone[status]}>{t(`status.${status}`)}</Badge>;
}

const verificationTone: Record<string, Tone> = { UNVERIFIED: "neutral", IDENTITY_VERIFIED: "info", CREDENTIALS_VERIFIED: "accent", PROFESSIONAL_VERIFIED: "accent", SUSPENDED: "danger", REVOKED: "danger" };

/** Server component: localized verification level with a link to the explanation page. */
export async function VerificationBadge({ status, withLink = true }: { status: string; withLink?: boolean }) {
  const { t } = await getT();
  const tone = verificationTone[status] ?? "neutral";
  const key = `ver.${status}` as const;
  const label = (["UNVERIFIED", "IDENTITY_VERIFIED", "CREDENTIALS_VERIFIED", "PROFESSIONAL_VERIFIED", "SUSPENDED", "REVOKED"] as const).includes(status as "UNVERIFIED") ? t(key as "ver.UNVERIFIED") : status;
  const inner = (
    <Badge tone={tone}>
      {tone === "accent" ? <CheckIcon /> : null}
      {label}
    </Badge>
  );
  return withLink ? (
    <a href="/verification" className="inline-flex" aria-label={`${label}. ${t("ver.whatItMeans")}`}>
      {inner}
    </a>
  ) : (
    inner
  );
}

export async function ConfidentialityBadge({ level }: { level: string }) {
  const { t } = await getT();
  const tone: Tone = level === "STANDARD" ? "neutral" : level === "PRIVATE" ? "info" : "warn";
  const key = `conf.${level}.label` as "conf.PRIVATE.label";
  return <Badge tone={tone}>{t(key)}</Badge>;
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
