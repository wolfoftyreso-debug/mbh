import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Enumerations are defined once here and reused by the schema, the domain layer
 * and the UI. Adding a value means adding it here and generating a migration.
 */

export const platformRoleEnum = pgEnum("platform_role", ["USER", "ADMIN", "SUPER_ADMIN"]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "UNVERIFIED",
  "IDENTITY_VERIFIED",
  "CREDENTIALS_VERIFIED",
  "PROFESSIONAL_VERIFIED",
  "SUSPENDED",
  "REVOKED",
]);

export const claimStatusEnum = pgEnum("claim_status", [
  "SELF_DECLARED",
  "PENDING_REVIEW",
  "PLATFORM_VERIFIED",
  "REJECTED",
  "REVOKED",
]);

export const credentialTypeEnum = pgEnum("credential_type", [
  "EDUCATION",
  "CERTIFICATION",
  "PROFESSIONAL_MEMBERSHIP",
  "EMPLOYMENT",
  "TRADE_QUALIFICATION",
  "BUSINESS_OWNERSHIP",
  "PUBLISHED_WORK",
  "OTHER",
]);

export const languageLevelEnum = pgEnum("language_level", ["NATIVE", "FULL_PROFESSIONAL", "PROFESSIONAL", "WORKING"]);

export const availabilityEnum = pgEnum("availability", ["AVAILABLE", "LIMITED", "UNAVAILABLE"]);

export const serviceKindEnum = pgEnum("service_kind", ["LANGUAGE", "DOMAIN", "COMBINED"]);

export const pricingModelEnum = pgEnum("pricing_model", ["FIXED_PRICE", "PER_WORD", "HOURLY", "CUSTOM_QUOTE"]);

export const orgRoleEnum = pgEnum("org_role", ["OWNER", "ADMIN", "MEMBER", "BILLING"]);

export const assignmentStatusEnum = pgEnum("assignment_status", [
  "DRAFT",
  "OPEN",
  "PROFESSIONAL_INVITED",
  "OFFER_RECEIVED",
  "ACCEPTED",
  "IN_PROGRESS",
  "DELIVERED",
  "REVISION_REQUESTED",
  "FINAL_REVIEW",
  "SIGNED",
  "CUSTOMER_APPROVED",
  "COMPLETED",
  "DISPUTED",
  "CANCELLED",
]);

export const assignmentTemplateEnum = pgEnum("assignment_template", [
  "STANDARD",
  "EXPERT_BRAIN_DUMP",
  "DOMAIN_REVIEW",
  "MULTI_STAGE",
]);

export const confidentialityLevelEnum = pgEnum("confidentiality_level", [
  "STANDARD",
  "PRIVATE",
  "CONFIDENTIAL",
  "STRICT_CONFIDENTIAL",
]);

export const aiPolicyEnum = pgEnum("ai_policy", ["AI_DISABLED", "AI_METADATA_ONLY", "AI_ALLOWED"]);

export const portfolioPermissionEnum = pgEnum("portfolio_permission", [
  "NOT_PERMITTED",
  "ATTRIBUTION_ONLY",
  "EXCERPT_PERMITTED",
  "FULL_WORK_PERMITTED",
]);

export const expertiseRequirementEnum = pgEnum("expertise_requirement", [
  "NOT_REQUIRED",
  "PREFERRED",
  "REQUIRED",
  "VERIFIED_REQUIRED",
]);

export const knowledgeSourceTypeEnum = pgEnum("knowledge_source_type", [
  "CUSTOMER_EXPERTISE",
  "FOUNDER_EXPERTISE",
  "EMPLOYEE_EXPERTISE",
  "PROFESSIONAL_EXPERTISE",
  "DOCUMENTATION",
  "INTERVIEW",
  "VOICE_RECORDING",
  "TRANSCRIPT",
  "EXTERNAL_SOURCES",
  "MIXED",
]);

export const contributionRoleEnum = pgEnum("contribution_role", [
  "KNOWLEDGE_SOURCE",
  "AUTHOR",
  "EDITOR",
  "LANGUAGE_REVIEWER",
  "DOMAIN_REVIEWER",
  "FACT_CHECKER",
  "TRANSLATOR",
  "TRANSLATION_REVIEWER",
  "FINAL_APPROVER",
]);

export const contributionStatusEnum = pgEnum("contribution_status", ["ACTIVE", "COMPLETED", "SIGNED", "WITHDRAWN"]);

export const participantRoleEnum = pgEnum("participant_role", ["CUSTOMER", "PROFESSIONAL", "ORG_MEMBER", "ADMIN_OBSERVER"]);

export const stageKindEnum = pgEnum("stage_kind", [
  "KNOWLEDGE_CAPTURE",
  "TRANSCRIPTION",
  "WRITING",
  "DOMAIN_REVIEW",
  "CORRECTIONS",
  "LANGUAGE_REVIEW",
  "FACT_CHECK",
  "TRANSLATION",
  "SIGN_OFF",
  "CUSTOMER_APPROVAL",
]);

export const stageStatusEnum = pgEnum("stage_status", ["PENDING", "ACTIVE", "COMPLETED", "SKIPPED"]);

export const offerStatusEnum = pgEnum("offer_status", ["PENDING", "ACCEPTED", "DECLINED", "WITHDRAWN", "EXPIRED"]);

export const invitationStatusEnum = pgEnum("invitation_status", ["PENDING", "ACCEPTED", "DECLINED", "EXPIRED"]);

export const messageKindEnum = pgEnum("message_kind", ["TEXT", "SYSTEM"]);

export const attachmentPurposeEnum = pgEnum("attachment_purpose", [
  "SOURCE_MATERIAL",
  "AUDIO_RECORDING",
  "TRANSCRIPT",
  "DELIVERABLE",
  "MESSAGE",
  "VERIFICATION_DOCUMENT",
  "PROFILE_PHOTO",
  "PORTFOLIO",
  "DISPUTE_EVIDENCE",
]);

export const scanStatusEnum = pgEnum("scan_status", ["PENDING", "CLEAN", "FLAGGED", "SKIPPED"]);

export const artifactKindEnum = pgEnum("artifact_kind", ["TEXT", "DOCUMENT", "TRANSCRIPT"]);

export const versionStatusEnum = pgEnum("version_status", ["DRAFT", "SUBMITTED", "SIGNED", "SUPERSEDED", "DELETED"]);

export const revisionStatusEnum = pgEnum("revision_status", ["OPEN", "ADDRESSED", "WITHDRAWN"]);

export const reviewCommentTypeEnum = pgEnum("review_comment_type", [
  "LANGUAGE",
  "FACTUAL",
  "TERMINOLOGY",
  "DOMAIN",
  "LEGAL_RISK",
  "CLARITY",
  "STYLE",
  "SOURCE_REQUIRED",
  "OTHER",
]);

export const domainVerdictEnum = pgEnum("domain_verdict", [
  "CORRECT",
  "INCORRECT",
  "MISLEADING",
  "IMPRECISE",
  "TERMINOLOGY_ERROR",
  "NEEDS_CONTEXT",
  "RECOMMENDED_CHANGE",
]);

export const commentStatusEnum = pgEnum("comment_status", ["OPEN", "RESOLVED", "REJECTED"]);

export const recordStatusEnum = pgEnum("record_status", ["VALID", "REVOKED", "SUPERSEDED"]);

export const recordVisibilityEnum = pgEnum("record_visibility", ["PRIVATE", "ANONYMIZED", "PUBLIC"]);

export const customerDisplayEnum = pgEnum("customer_display", ["HIDDEN", "PRIVATE_ORGANIZATION", "NAMED"]);

export const publicationCheckStateEnum = pgEnum("publication_check_state", [
  "UNCHECKED",
  "MATCHES",
  "CHANGED",
  "UNREACHABLE",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "PENDING",
  "AUTHORIZED",
  "CAPTURED",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "CANCELLED",
]);

export const ledgerEntryTypeEnum = pgEnum("ledger_entry_type", [
  "CUSTOMER_PAYMENT",
  "PLATFORM_FEE",
  "PROFESSIONAL_EARNING",
  "REFUND",
  "PAYOUT",
  "ADJUSTMENT",
]);

export const ledgerAccountEnum = pgEnum("ledger_account", [
  "CUSTOMER",
  "PLATFORM_ESCROW",
  "PLATFORM_REVENUE",
  "PROFESSIONAL",
]);

export const payoutStatusEnum = pgEnum("payout_status", ["PENDING", "PROCESSING", "PAID", "FAILED"]);

export const disputeStatusEnum = pgEnum("dispute_status", [
  "OPEN",
  "UNDER_REVIEW",
  "RESOLVED_FOR_CUSTOMER",
  "RESOLVED_FOR_PROFESSIONAL",
  "RESOLVED_SPLIT",
  "CLOSED",
]);

export const notificationChannelEnum = pgEnum("notification_channel", ["IN_APP", "EMAIL", "SMS"]);

export const notificationStatusEnum = pgEnum("notification_status", ["PENDING", "SENT", "FAILED", "SKIPPED"]);

export const actorTypeEnum = pgEnum("actor_type", ["USER", "ADMIN", "SYSTEM"]);

export const agreementTypeEnum = pgEnum("agreement_type", [
  "TERMS_OF_SERVICE",
  "PROFESSIONAL_CONFIDENTIALITY",
  "ASSIGNMENT_NDA",
]);

export const aiUsageStatusEnum = pgEnum("ai_usage_status", ["SUCCESS", "FAILED", "BLOCKED_BY_POLICY", "UNAVAILABLE"]);

export const privacyRequestTypeEnum = pgEnum("privacy_request_type", ["DATA_EXPORT", "ACCOUNT_DELETION"]);

export const privacyRequestStatusEnum = pgEnum("privacy_request_status", ["PENDING", "PROCESSING", "COMPLETED", "REJECTED"]);
