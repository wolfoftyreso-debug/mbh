import type { assignments } from "@/server/db/schema";

export type AiPolicy = "AI_DISABLED" | "AI_METADATA_ONLY" | "AI_ALLOWED";
export type AiDataClass = "NONE" | "METADATA" | "CONTENT";
export type ConfidentialityLevel = "STANDARD" | "PRIVATE" | "CONFIDENTIAL" | "STRICT_CONFIDENTIAL";

export class AiPolicyError extends Error {
  status = 403;
  constructor(message: string) {
    super(message);
    this.name = "AiPolicyError";
  }
}

/**
 * Central AI processing policy. Every AI call that touches assignment data must
 * pass through `assertAiAllowed` before any bytes are sent to a provider.
 */
export function isAiAllowed(policy: AiPolicy, dataClass: AiDataClass): boolean {
  if (dataClass === "NONE") return true;
  if (policy === "AI_DISABLED") return false;
  if (policy === "AI_METADATA_ONLY") return dataClass === "METADATA";
  return true;
}

export function assertAiAllowed(assignment: Pick<typeof assignments.$inferSelect, "aiPolicy" | "confidentiality">, dataClass: AiDataClass): void {
  if (!isAiAllowed(assignment.aiPolicy, dataClass)) {
    throw new AiPolicyError(`AI processing of ${dataClass.toLowerCase()} is not permitted by this assignment's AI policy (${assignment.aiPolicy}).`);
  }
}

/** Conservative default AI policy derived from confidentiality. */
export function defaultAiPolicyFor(level: ConfidentialityLevel): AiPolicy {
  switch (level) {
    case "STANDARD":
      return "AI_ALLOWED";
    case "PRIVATE":
      return "AI_METADATA_ONLY";
    case "CONFIDENTIAL":
      return "AI_METADATA_ONLY";
    case "STRICT_CONFIDENTIAL":
      return "AI_DISABLED";
  }
}

/** The strictest policy a confidentiality level permits. */
export function maxAiPolicyFor(level: ConfidentialityLevel): AiPolicy[] {
  switch (level) {
    case "STRICT_CONFIDENTIAL":
      return ["AI_DISABLED", "AI_METADATA_ONLY"];
    default:
      return ["AI_DISABLED", "AI_METADATA_ONLY", "AI_ALLOWED"];
  }
}

export function defaultPortfolioPermissionFor(level: ConfidentialityLevel): "NOT_PERMITTED" | "ATTRIBUTION_ONLY" {
  return level === "STANDARD" ? "ATTRIBUTION_ONLY" : "NOT_PERMITTED";
}

export const CONFIDENTIALITY_COPY: Record<ConfidentialityLevel, { label: string; short: string; detail: string }> = {
  STANDARD: {
    label: "Standard",
    short: "May be publicly attributed after your approval.",
    detail: "Suitable for work you intend to publish. Public authorship records and portfolio inclusion remain off until you explicitly enable them.",
  },
  PRIVATE: {
    label: "Private",
    short: "Only you and the professional can access this assignment.",
    detail: "Nothing becomes public automatically. Platform staff only access content for support, disputes or security reasons, and every such access is recorded.",
  },
  CONFIDENTIAL: {
    label: "Confidential",
    short: "Stricter confidentiality rules apply. The professional cannot publicly reference the work.",
    detail: "The professional may not publish, portfolio, describe or reuse the material, or identify you, without your explicit permission. AI processing is limited to metadata unless you allow more.",
  },
  STRICT_CONFIDENTIAL: {
    label: "Strict confidential",
    short: "Maximum platform confidentiality. Public attribution and AI processing are disabled unless explicitly enabled.",
    detail: "Administrative content access is restricted and additionally audited, file retention is shortened, exports show additional warnings and AI processing of content is disabled.",
  },
};
