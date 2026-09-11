import Link from "next/link";
import type { ProfessionalCard as Card } from "@/server/domain/matching/service";
import { Avatar } from "@/components/ui/avatar";
import { Badge, VerificationBadge } from "@/components/ui/badge";
import { Stars } from "@/components/ui/stars";
import { formatMoney } from "@/lib/money";
import { humanize, truncate } from "@/lib/utils";

export function ProfessionalCard({ p, action }: { p: Card; action?: React.ReactNode }) {
  const cheapest = [...p.listings].sort((a, b) => a.basePriceMinor - b.basePriceMinor)[0];
  return (
    <article className="flex flex-col rounded-lg border border-line bg-surface p-5">
      <div className="flex items-start gap-4">
        <Avatar name={p.displayName} photoId={p.photoAttachmentId} size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/professionals/${p.slug}`} className="font-semibold hover:underline">
              {p.displayName}
            </Link>
            <VerificationBadge status={p.verificationStatus} />
          </div>
          <p className="mt-0.5 text-sm text-ink-2">{p.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
            {p.ratingCount ? <Stars value={p.ratingAvg} count={p.ratingCount} /> : <span>No ratings yet</span>}
            <span>{p.completedAssignments} completed</span>
            {p.country ? <span>{p.country}{p.region ? `, ${p.region}` : ""}</span> : null}
          </div>
        </div>
      </div>
      {p.bio ? <p className="mt-3 text-sm text-ink-2">{truncate(p.bio, 180)}</p> : null}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {p.languages.map((l) => (
          <Badge key={l.code} tone={l.verified ? "accent" : "neutral"} title={`${l.name}: ${humanize(l.level)}${l.editorialCapable ? ", editorial" : ""}`}>
            {l.name} · {humanize(l.level)}{l.editorialCapable ? " · editorial" : ""}
          </Badge>
        ))}
        {p.expertise.slice(0, 4).map((e) => (
          <Badge key={e.path} tone={e.verified ? "accent" : "neutral"} title={e.verified ? "Platform-verified expertise" : "Self-declared expertise"}>
            {e.name}{e.verified ? " ✓" : ""}
          </Badge>
        ))}
      </div>
      {p.matchReasons?.length ? <p className="mt-3 text-xs text-accent">{p.matchReasons.join(" · ")}</p> : null}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
        <span className="text-ink-2">{cheapest ? `From ${formatMoney(cheapest.basePriceMinor, cheapest.currency)}${cheapest.pricingModel === "PER_WORD" ? " / word" : cheapest.pricingModel === "HOURLY" ? " / hour" : ""}` : "Custom quotes"}</span>
        {action ?? (
          <Link href={`/professionals/${p.slug}`} className="font-medium text-accent hover:underline">
            View profile →
          </Link>
        )}
      </div>
    </article>
  );
}
