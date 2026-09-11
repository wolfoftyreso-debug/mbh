import { cn, humanize } from "@/lib/utils";
import { STATUS_LABELS, type AssignmentStatus } from "@/server/domain/assignments/state-machine";

type Tone = "neutral" | "accent" | "warn" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2 border-line",
  accent: "bg-accent-soft text-accent border-accent/20",
  warn: "bg-warn-soft text-warn border-warn/20",
  danger: "bg-danger-soft text-danger border-danger/20",
  info: "bg-info-soft text-info border-info/20",
};

export function Badge({ tone = "neutral", className, children, title }: { tone?: Tone; className?: string; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5", tones[tone], className)}>
      {children}
    </span>
  );
}

const statusTone: Record<AssignmentStatus, Tone> = {
  DRAFT: "neutral",
  OPEN: "info",
  PROFESSIONAL_INVITED: "info",
  OFFER_RECEIVED: "info",
  ACCEPTED: "accent",
  IN_PROGRESS: "accent",
  DELIVERED: "accent",
  REVISION_REQUESTED: "warn",
  FINAL_REVIEW: "accent",
  SIGNED: "accent",
  CUSTOMER_APPROVED: "accent",
  COMPLETED: "accent",
  DISPUTED: "danger",
  CANCELLED: "neutral",
};

export function StatusBadge({ status }: { status: AssignmentStatus }) {
  return <Badge tone={statusTone[status]}>{STATUS_LABELS[status]}</Badge>;
}

export const VERIFICATION_LABELS: Record<string, { label: string; tone: Tone; short: string }> = {
  UNVERIFIED: { label: "Not verified", tone: "neutral", short: "Self-declared profile" },
  IDENTITY_VERIFIED: { label: "Identity verified", tone: "info", short: "Identity document reviewed by the platform" },
  CREDENTIALS_VERIFIED: { label: "Credentials verified", tone: "accent", short: "Identity and at least one credential reviewed" },
  PROFESSIONAL_VERIFIED: { label: "Professional verified", tone: "accent", short: "Identity, credentials and expertise reviewed" },
  SUSPENDED: { label: "Suspended", tone: "danger", short: "Temporarily suspended by the platform" },
  REVOKED: { label: "Verification revoked", tone: "danger", short: "Verification withdrawn by the platform" },
};

export function VerificationBadge({ status, withLink = true }: { status: string; withLink?: boolean }) {
  const v = VERIFICATION_LABELS[status] ?? { label: humanize(status), tone: "neutral" as Tone, short: "" };
  const inner = (
    <Badge tone={v.tone} title={v.short}>
      {v.tone === "accent" ? <CheckIcon /> : null}
      {v.label}
    </Badge>
  );
  return withLink ? (
    <a href="/verification" className="inline-flex" aria-label={`${v.label}. What verification means`}>
      {inner}
    </a>
  ) : (
    inner
  );
}

export function ClaimBadge({ status }: { status: string }) {
  if (status === "PLATFORM_VERIFIED")
    return (
      <Badge tone="accent">
        <CheckIcon /> Verified
      </Badge>
    );
  if (status === "PENDING_REVIEW") return <Badge tone="info">Under review</Badge>;
  if (status === "REJECTED") return <Badge tone="danger">Not verified</Badge>;
  if (status === "REVOKED") return <Badge tone="danger">Revoked</Badge>;
  return <Badge tone="neutral">Self-declared</Badge>;
}

export function ConfidentialityBadge({ level }: { level: string }) {
  const tone: Tone = level === "STANDARD" ? "neutral" : level === "PRIVATE" ? "info" : "warn";
  return <Badge tone={tone}>{humanize(level)}</Badge>;
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
