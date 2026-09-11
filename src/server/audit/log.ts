import { db, type Tx } from "@/server/db";
import { auditEvents } from "@/server/db/schema";
import { logger } from "@/server/logger";

export type AuditAction =
  | "ACCOUNT_CREATED"
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_UNSUSPENDED"
  | "ACCOUNT_DELETION_REQUESTED"
  | "DATA_EXPORT_REQUESTED"
  | "SESSIONS_REVOKED"
  | "PROFILE_CREATED"
  | "PROFILE_UPDATED"
  | "PROFILE_PUBLISHED"
  | "PROFILE_UNPUBLISHED"
  | "CREDENTIAL_SUBMITTED"
  | "CREDENTIAL_VERIFIED"
  | "CREDENTIAL_REJECTED"
  | "EXPERTISE_CLAIMED"
  | "EXPERTISE_VERIFIED"
  | "EXPERTISE_REJECTED"
  | "IDENTITY_SUBMITTED"
  | "IDENTITY_VERIFIED"
  | "IDENTITY_REJECTED"
  | "VERIFICATION_STATUS_CHANGED"
  | "VERIFICATION_REVOKED"
  | "AGREEMENT_ACCEPTED"
  | "ORGANIZATION_CREATED"
  | "ORGANIZATION_MEMBER_ADDED"
  | "ORGANIZATION_MEMBER_REMOVED"
  | "ASSIGNMENT_CREATED"
  | "ASSIGNMENT_UPDATED"
  | "ASSIGNMENT_STATUS_CHANGED"
  | "ASSIGNMENT_ACCEPTED"
  | "ASSIGNMENT_CANCELLED"
  | "PROFESSIONAL_INVITED"
  | "OFFER_CREATED"
  | "OFFER_ACCEPTED"
  | "OFFER_DECLINED"
  | "PARTICIPANT_ADDED"
  | "PARTICIPANT_REMOVED"
  | "MESSAGE_SENT"
  | "FILE_UPLOADED"
  | "FILE_ACCESSED"
  | "FILE_DELETED"
  | "VERSION_CREATED"
  | "VERSION_SUBMITTED"
  | "REVISION_REQUESTED"
  | "REVIEW_COMMENT_CREATED"
  | "VERSION_SIGNED"
  | "RECORD_CREATED"
  | "RECORD_VISIBILITY_CHANGED"
  | "RECORD_REVOKED"
  | "PUBLISHED_WORK_ADDED"
  | "PORTFOLIO_PERMISSION_CHANGED"
  | "CONFIDENTIALITY_CHANGED"
  | "AI_POLICY_CHANGED"
  | "AI_REQUEST"
  | "AI_REQUEST_BLOCKED"
  | "CUSTOMER_APPROVED"
  | "ASSIGNMENT_COMPLETED"
  | "REVIEW_SUBMITTED"
  | "PAYMENT_INITIATED"
  | "PAYMENT_CAPTURED"
  | "PAYMENT_FAILED"
  | "REFUND_CREATED"
  | "PAYOUT_CREATED"
  | "PAYOUT_PAID"
  | "LEDGER_ADJUSTMENT"
  | "DISPUTE_OPENED"
  | "DISPUTE_UPDATED"
  | "DISPUTE_RESOLVED"
  | "ADMIN_CONTENT_ACCESS"
  | "ADMIN_ACTION"
  | "SETTING_CHANGED"
  | "CATEGORY_CHANGED"
  | "DOMAIN_CHANGED"
  | "CONTENT_DELETED_RETENTION";

export interface AuditInput {
  actorType: "USER" | "ADMIN" | "SYSTEM";
  actorUserId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  assignmentId?: string | null;
  metadata?: Record<string, unknown>;
  ipHash?: string | null;
}

const FORBIDDEN = /(content|body|token|secret|password|document|url)/i;

/** Defensive scrub so audit metadata can never carry secrets or content. */
function safeMetadata(meta: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!meta) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (FORBIDDEN.test(k)) continue;
    if (typeof v === "string") out[k] = v.slice(0, 300);
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else if (Array.isArray(v)) out[k] = v.slice(0, 50).map((x) => (typeof x === "string" ? x.slice(0, 120) : x));
  }
  return out;
}

export async function audit(input: AuditInput, tx?: Tx): Promise<void> {
  const executor = tx ?? db;
  try {
    await executor.insert(auditEvents).values({
      actorType: input.actorType,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      assignmentId: input.assignmentId ?? null,
      metadata: safeMetadata(input.metadata),
      ipHash: input.ipHash ?? null,
    });
  } catch (err) {
    // Audit failures must never take the product down, but they must be visible.
    logger.error("audit_write_failed", { action: input.action, entityType: input.entityType, error: (err as Error).message });
    if (tx) throw err;
  }
}
