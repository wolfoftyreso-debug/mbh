import { cn } from "@/lib/utils";

export type Tone = "neutral" | "accent" | "warn" | "danger" | "info";

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

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
