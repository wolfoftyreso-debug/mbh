CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TYPE "public"."actor_type" AS ENUM('USER', 'ADMIN', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."agreement_type" AS ENUM('TERMS_OF_SERVICE', 'PROFESSIONAL_CONFIDENTIALITY', 'ASSIGNMENT_NDA');--> statement-breakpoint
CREATE TYPE "public"."ai_policy" AS ENUM('AI_DISABLED', 'AI_METADATA_ONLY', 'AI_ALLOWED');--> statement-breakpoint
CREATE TYPE "public"."ai_usage_status" AS ENUM('SUCCESS', 'FAILED', 'BLOCKED_BY_POLICY', 'UNAVAILABLE');--> statement-breakpoint
CREATE TYPE "public"."artifact_kind" AS ENUM('TEXT', 'DOCUMENT', 'TRANSCRIPT');--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('DRAFT', 'OPEN', 'PROFESSIONAL_INVITED', 'OFFER_RECEIVED', 'ACCEPTED', 'IN_PROGRESS', 'DELIVERED', 'REVISION_REQUESTED', 'FINAL_REVIEW', 'SIGNED', 'CUSTOMER_APPROVED', 'COMPLETED', 'DISPUTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."assignment_template" AS ENUM('STANDARD', 'EXPERT_BRAIN_DUMP', 'DOMAIN_REVIEW', 'MULTI_STAGE');--> statement-breakpoint
CREATE TYPE "public"."attachment_purpose" AS ENUM('SOURCE_MATERIAL', 'AUDIO_RECORDING', 'TRANSCRIPT', 'DELIVERABLE', 'MESSAGE', 'VERIFICATION_DOCUMENT', 'PROFILE_PHOTO', 'PORTFOLIO', 'DISPUTE_EVIDENCE');--> statement-breakpoint
CREATE TYPE "public"."availability" AS ENUM('AVAILABLE', 'LIMITED', 'UNAVAILABLE');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('SELF_DECLARED', 'PENDING_REVIEW', 'PLATFORM_VERIFIED', 'REJECTED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."comment_status" AS ENUM('OPEN', 'RESOLVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."confidentiality_level" AS ENUM('STANDARD', 'PRIVATE', 'CONFIDENTIAL', 'STRICT_CONFIDENTIAL');--> statement-breakpoint
CREATE TYPE "public"."contribution_role" AS ENUM('KNOWLEDGE_SOURCE', 'AUTHOR', 'EDITOR', 'LANGUAGE_REVIEWER', 'DOMAIN_REVIEWER', 'FACT_CHECKER', 'TRANSLATOR', 'TRANSLATION_REVIEWER', 'FINAL_APPROVER');--> statement-breakpoint
CREATE TYPE "public"."contribution_status" AS ENUM('ACTIVE', 'COMPLETED', 'SIGNED', 'WITHDRAWN');--> statement-breakpoint
CREATE TYPE "public"."credential_type" AS ENUM('EDUCATION', 'CERTIFICATION', 'PROFESSIONAL_MEMBERSHIP', 'EMPLOYMENT', 'TRADE_QUALIFICATION', 'BUSINESS_OWNERSHIP', 'PUBLISHED_WORK', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."customer_display" AS ENUM('HIDDEN', 'PRIVATE_ORGANIZATION', 'NAMED');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('OPEN', 'UNDER_REVIEW', 'RESOLVED_FOR_CUSTOMER', 'RESOLVED_FOR_PROFESSIONAL', 'RESOLVED_SPLIT', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."domain_verdict" AS ENUM('CORRECT', 'INCORRECT', 'MISLEADING', 'IMPRECISE', 'TERMINOLOGY_ERROR', 'NEEDS_CONTEXT', 'RECOMMENDED_CHANGE');--> statement-breakpoint
CREATE TYPE "public"."expertise_requirement" AS ENUM('NOT_REQUIRED', 'PREFERRED', 'REQUIRED', 'VERIFIED_REQUIRED');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."knowledge_source_type" AS ENUM('CUSTOMER_EXPERTISE', 'FOUNDER_EXPERTISE', 'EMPLOYEE_EXPERTISE', 'PROFESSIONAL_EXPERTISE', 'DOCUMENTATION', 'INTERVIEW', 'VOICE_RECORDING', 'TRANSCRIPT', 'EXTERNAL_SOURCES', 'MIXED');--> statement-breakpoint
CREATE TYPE "public"."language_level" AS ENUM('NATIVE', 'FULL_PROFESSIONAL', 'PROFESSIONAL', 'WORKING');--> statement-breakpoint
CREATE TYPE "public"."ledger_account" AS ENUM('CUSTOMER', 'PLATFORM_ESCROW', 'PLATFORM_REVENUE', 'PROFESSIONAL');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('CUSTOMER_PAYMENT', 'PLATFORM_FEE', 'PROFESSIONAL_EARNING', 'REFUND', 'PAYOUT', 'ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."message_kind" AS ENUM('TEXT', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('IN_APP', 'EMAIL', 'SMS');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('OWNER', 'ADMIN', 'MEMBER', 'BILLING');--> statement-breakpoint
CREATE TYPE "public"."participant_role" AS ENUM('CUSTOMER', 'PROFESSIONAL', 'ORG_MEMBER', 'ADMIN_OBSERVER');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('PENDING', 'PROCESSING', 'PAID', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."platform_role" AS ENUM('USER', 'ADMIN', 'SUPER_ADMIN');--> statement-breakpoint
CREATE TYPE "public"."portfolio_permission" AS ENUM('NOT_PERMITTED', 'ATTRIBUTION_ONLY', 'EXCERPT_PERMITTED', 'FULL_WORK_PERMITTED');--> statement-breakpoint
CREATE TYPE "public"."pricing_model" AS ENUM('FIXED_PRICE', 'PER_WORD', 'HOURLY', 'CUSTOM_QUOTE');--> statement-breakpoint
CREATE TYPE "public"."privacy_request_status" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."privacy_request_type" AS ENUM('DATA_EXPORT', 'ACCOUNT_DELETION');--> statement-breakpoint
CREATE TYPE "public"."publication_check_state" AS ENUM('UNCHECKED', 'MATCHES', 'CHANGED', 'UNREACHABLE');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('VALID', 'REVOKED', 'SUPERSEDED');--> statement-breakpoint
CREATE TYPE "public"."record_visibility" AS ENUM('PRIVATE', 'ANONYMIZED', 'PUBLIC');--> statement-breakpoint
CREATE TYPE "public"."review_comment_type" AS ENUM('LANGUAGE', 'FACTUAL', 'TERMINOLOGY', 'DOMAIN', 'LEGAL_RISK', 'CLARITY', 'STYLE', 'SOURCE_REQUIRED', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."revision_status" AS ENUM('OPEN', 'ADDRESSED', 'WITHDRAWN');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('PENDING', 'CLEAN', 'FLAGGED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."service_kind" AS ENUM('LANGUAGE', 'DOMAIN', 'COMBINED');--> statement-breakpoint
CREATE TYPE "public"."stage_kind" AS ENUM('KNOWLEDGE_CAPTURE', 'TRANSCRIPTION', 'WRITING', 'DOMAIN_REVIEW', 'CORRECTIONS', 'LANGUAGE_REVIEW', 'FACT_CHECK', 'TRANSLATION', 'SIGN_OFF', 'CUSTOMER_APPROVAL');--> statement-breakpoint
CREATE TYPE "public"."stage_status" AS ENUM('PENDING', 'ACTIVE', 'COMPLETED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('UNVERIFIED', 'IDENTITY_VERIFIED', 'CREDENTIALS_VERIFIED', 'PROFESSIONAL_VERIFIED', 'SUSPENDED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."version_status" AS ENUM('DRAFT', 'SUBMITTED', 'SIGNED', 'SUPERSEDED', 'DELETED');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"invited_email" text,
	"role" "org_role" DEFAULT 'MEMBER' NOT NULL,
	"invited_by_user_id" text,
	"accepted_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"country" text,
	"vat_number" text,
	"billing_email" text,
	"website" text,
	"created_by_user_id" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"platform_role" "platform_role" DEFAULT 'USER' NOT NULL,
	"phone" text,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"timezone" text DEFAULT 'Europe/Stockholm' NOT NULL,
	"suspended_at" timestamp with time zone,
	"suspended_reason" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credential_document" (
	"id" text PRIMARY KEY NOT NULL,
	"credential_id" text NOT NULL,
	"attachment_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credential_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"credential_id" text NOT NULL,
	"reviewer_user_id" text NOT NULL,
	"decision" "claim_status" NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credential" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"type" "credential_type" NOT NULL,
	"title" text NOT NULL,
	"issuer" text DEFAULT '' NOT NULL,
	"field" text DEFAULT '' NOT NULL,
	"start_year" smallint,
	"end_year" smallint,
	"description" text DEFAULT '' NOT NULL,
	"status" "claim_status" DEFAULT 'SELF_DECLARED' NOT NULL,
	"public_visible" boolean DEFAULT true NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"path" text NOT NULL,
	"depth" smallint DEFAULT 0 NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expertise_claim" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"domain_id" text NOT NULL,
	"years_experience" smallint,
	"description" text DEFAULT '' NOT NULL,
	"evidence_summary" text DEFAULT '' NOT NULL,
	"status" "claim_status" DEFAULT 'SELF_DECLARED' NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expertise_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"claim_id" text NOT NULL,
	"reviewer_user_id" text NOT NULL,
	"decision" "claim_status" NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"evidence_attachment_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"provider" text DEFAULT 'manual' NOT NULL,
	"provider_ref" text,
	"document_attachment_id" text,
	"legal_name" text,
	"status" "claim_status" DEFAULT 'PENDING_REVIEW' NOT NULL,
	"reviewer_user_id" text,
	"notes" text DEFAULT '' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"retention_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "language" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"native_name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_item" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"url" text,
	"authorship_record_id" text,
	"attachment_id" text,
	"public_visible" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professional_language" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"language_code" text NOT NULL,
	"level" "language_level" NOT NULL,
	"editorial_capable" boolean DEFAULT false NOT NULL,
	"status" "claim_status" DEFAULT 'SELF_DECLARED' NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professional_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"country" text,
	"region" text,
	"photo_attachment_id" text,
	"years_experience" smallint,
	"availability" "availability" DEFAULT 'AVAILABLE' NOT NULL,
	"typical_turnaround_days" smallint,
	"external_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verification_status" "verification_status" DEFAULT 'UNVERIFIED' NOT NULL,
	"identity_verified_at" timestamp with time zone,
	"credentials_verified_at" timestamp with time zone,
	"professional_verified_at" timestamp with time zone,
	"verification_note" text,
	"published_at" timestamp with time zone,
	"confidentiality_agreement_version" text,
	"completed_assignments" integer DEFAULT 0 NOT NULL,
	"signed_works" integer DEFAULT 0 NOT NULL,
	"repeat_customers" integer DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"rating_avg_x100" integer DEFAULT 0 NOT NULL,
	"on_time_rate_x100" integer DEFAULT 0 NOT NULL,
	"revision_rate_x100" integer DEFAULT 0 NOT NULL,
	"dispute_count" integer DEFAULT 0 NOT NULL,
	"first_active_at" timestamp with time zone,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(display_name,'') || ' ' || coalesce(title,'') || ' ' || coalesce(bio,''))) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_category" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"kind" "service_kind" DEFAULT 'LANGUAGE' NOT NULL,
	"default_contribution_role" text DEFAULT 'AUTHOR' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_listing" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"category_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"language_code" text,
	"domain_id" text,
	"pricing_model" "pricing_model" DEFAULT 'FIXED_PRICE' NOT NULL,
	"base_price_minor" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'SEK' NOT NULL,
	"turnaround_days" smallint DEFAULT 3 NOT NULL,
	"revisions_included" smallint DEFAULT 1 NOT NULL,
	"requirements" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"professional_user_id" text NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"status" "invitation_status" DEFAULT 'PENDING' NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_participant" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "participant_role" NOT NULL,
	"contribution_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"added_by_user_id" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "assignment_stage" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"position" smallint NOT NULL,
	"kind" "stage_kind" NOT NULL,
	"title" text NOT NULL,
	"assignee_user_id" text,
	"contribution_role" "contribution_role",
	"status" "stage_status" DEFAULT 'PENDING' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_status_history" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"from_status" "assignment_status",
	"to_status" "assignment_status" NOT NULL,
	"actor_user_id" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"organization_id" text,
	"customer_user_id" text NOT NULL,
	"template" "assignment_template" DEFAULT 'STANDARD' NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"service_category_id" text,
	"language_code" text,
	"required_language_level" "language_level" DEFAULT 'PROFESSIONAL' NOT NULL,
	"editorial_required" boolean DEFAULT true NOT NULL,
	"domain_id" text,
	"domain_requirement" "expertise_requirement" DEFAULT 'NOT_REQUIRED' NOT NULL,
	"target_audience" text DEFAULT '' NOT NULL,
	"intended_publication" text DEFAULT '' NOT NULL,
	"word_count" integer,
	"deadline" timestamp with time zone,
	"source_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attribution_requirements" text DEFAULT '' NOT NULL,
	"additional_instructions" text DEFAULT '' NOT NULL,
	"knowledge_source_type" "knowledge_source_type" DEFAULT 'MIXED' NOT NULL,
	"status" "assignment_status" DEFAULT 'DRAFT' NOT NULL,
	"confidentiality" "confidentiality_level" DEFAULT 'PRIVATE' NOT NULL,
	"ai_policy" "ai_policy" DEFAULT 'AI_METADATA_ONLY' NOT NULL,
	"portfolio_permission" "portfolio_permission" DEFAULT 'NOT_PERMITTED' NOT NULL,
	"public_attribution_allowed" boolean DEFAULT false NOT NULL,
	"budget_minor" integer,
	"agreed_price_minor" integer,
	"currency" text DEFAULT 'SEK' NOT NULL,
	"primary_professional_user_id" text,
	"accepted_offer_id" text,
	"current_artifact_id" text,
	"opened_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"signed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"content_deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"assignment_id" text,
	"purpose" "attachment_purpose" NOT NULL,
	"storage_provider" text NOT NULL,
	"storage_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"scan_status" "scan_status" DEFAULT 'SKIPPED' NOT NULL,
	"retention_until" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deletion_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_blob" (
	"key" text PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_source" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"type" "knowledge_source_type" NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"provided_by_user_id" text,
	"provided_by_name" text,
	"provided_by_title" text,
	"attachment_id" text,
	"public_attribution" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"attachment_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"sender_user_id" text,
	"kind" "message_kind" DEFAULT 'TEXT' NOT NULL,
	"body" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"professional_user_id" text NOT NULL,
	"listing_id" text,
	"contribution_role" "contribution_role" DEFAULT 'AUTHOR' NOT NULL,
	"pricing_model" "pricing_model" NOT NULL,
	"price_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"turnaround_days" smallint NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"status" "offer_status" DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_permission_change" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"from_permission" "portfolio_permission" NOT NULL,
	"to_permission" "portfolio_permission" NOT NULL,
	"changed_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifact_version_file" (
	"id" text PRIMARY KEY NOT NULL,
	"version_id" text NOT NULL,
	"attachment_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifact_version" (
	"id" text PRIMARY KEY NOT NULL,
	"artifact_id" text NOT NULL,
	"assignment_id" text NOT NULL,
	"version_number" smallint NOT NULL,
	"parent_version_id" text,
	"label" text DEFAULT '' NOT NULL,
	"content" text,
	"content_hash" text NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" text NOT NULL,
	"status" "version_status" DEFAULT 'DRAFT' NOT NULL,
	"immutable" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"submitted_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deletion_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifact" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"kind" "artifact_kind" DEFAULT 'TEXT' NOT NULL,
	"title" text NOT NULL,
	"current_version_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contribution" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"version_id" text,
	"user_id" text,
	"display_name" text,
	"display_title" text,
	"role" "contribution_role" NOT NULL,
	"scope" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"status" "contribution_status" DEFAULT 'ACTIVE' NOT NULL,
	"signature_id" text,
	"verification_snapshot" jsonb,
	"public_attribution" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_comment" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"version_id" text NOT NULL,
	"author_user_id" text NOT NULL,
	"type" "review_comment_type" NOT NULL,
	"domain_verdict" "domain_verdict",
	"anchor_start" integer,
	"anchor_end" integer,
	"quoted_text" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"suggestion" text DEFAULT '' NOT NULL,
	"status" "comment_status" DEFAULT 'OPEN' NOT NULL,
	"resolved_by_user_id" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revision_request" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"version_id" text NOT NULL,
	"requested_by_user_id" text NOT NULL,
	"message" text NOT NULL,
	"status" "revision_status" DEFAULT 'OPEN' NOT NULL,
	"resolved_by_version_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "signature" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"version_id" text NOT NULL,
	"signer_user_id" text NOT NULL,
	"contribution_role" "contribution_role" NOT NULL,
	"content_hash" text NOT NULL,
	"service_performed" text NOT NULL,
	"scope" text NOT NULL,
	"language_code" text,
	"word_count" integer DEFAULT 0 NOT NULL,
	"verification_status_at_signing" "verification_status" NOT NULL,
	"credential_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confirmation_statement" text NOT NULL,
	"session_id" text,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authorship_record" (
	"id" text PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"assignment_id" text NOT NULL,
	"version_id" text NOT NULL,
	"signature_id" text NOT NULL,
	"professional_user_id" text NOT NULL,
	"professional_public_name" text NOT NULL,
	"professional_slug" text NOT NULL,
	"contribution_role" "contribution_role" NOT NULL,
	"service_performed" text NOT NULL,
	"service_category_slug" text,
	"scope" text NOT NULL,
	"language_code" text,
	"work_title" text NOT NULL,
	"version_number" smallint NOT NULL,
	"content_hash" text NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"signed_at" timestamp with time zone NOT NULL,
	"verification_status_at_signing" "verification_status" NOT NULL,
	"credential_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"customer_organization_name" text,
	"status" "record_status" DEFAULT 'VALID' NOT NULL,
	"visibility" "record_visibility" DEFAULT 'PRIVATE' NOT NULL,
	"customer_display" "customer_display" DEFAULT 'HIDDEN' NOT NULL,
	"title_public" boolean DEFAULT false NOT NULL,
	"hash_public" boolean DEFAULT false NOT NULL,
	"publication_url" text,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "published_work" (
	"id" text PRIMARY KEY NOT NULL,
	"record_id" text NOT NULL,
	"url" text NOT NULL,
	"published_at" timestamp with time zone,
	"added_by_user_id" text NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_verified_state" "publication_check_state" DEFAULT 'UNCHECKED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rating" (
	"id" text PRIMARY KEY NOT NULL,
	"review_id" text NOT NULL,
	"dimension" text NOT NULL,
	"score" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"reviewer_user_id" text NOT NULL,
	"professional_user_id" text NOT NULL,
	"rating" smallint NOT NULL,
	"on_time" boolean DEFAULT true NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"display_name" text,
	"anonymized" boolean DEFAULT true NOT NULL,
	"public_visible" boolean DEFAULT true NOT NULL,
	"verified_transaction" boolean DEFAULT true NOT NULL,
	"hidden_by_admin_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispute" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"opened_by_user_id" text NOT NULL,
	"reason" text NOT NULL,
	"status" "dispute_status" DEFAULT 'OPEN' NOT NULL,
	"resolution_notes" text,
	"resolved_by_user_id" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "ledger_entry_type" NOT NULL,
	"account" "ledger_account" NOT NULL,
	"account_ref" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"assignment_id" text,
	"payment_id" text,
	"payout_id" text,
	"description" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"payer_user_id" text NOT NULL,
	"organization_id" text,
	"provider" text NOT NULL,
	"provider_ref" text,
	"provider_checkout_url" text,
	"amount_minor" integer NOT NULL,
	"platform_fee_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"idempotency_key" text NOT NULL,
	"refunded_minor" integer DEFAULT 0 NOT NULL,
	"captured_at" timestamp with time zone,
	"failure_reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout" (
	"id" text PRIMARY KEY NOT NULL,
	"professional_user_id" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"status" "payout_status" DEFAULT 'PENDING' NOT NULL,
	"requested_by_user_id" text,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "admin_action" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_user_id" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"assignment_id" text,
	"reason" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agreement_acceptance" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"agreement_type" "agreement_type" NOT NULL,
	"agreement_version" text NOT NULL,
	"assignment_id" text,
	"ip_hash" text,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_event" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"assignment_id" text,
	"feature" text NOT NULL,
	"model" text,
	"policy_at_time" "ai_policy",
	"data_class" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"status" "ai_usage_status" NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"assignment_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preference" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"status" "notification_status" DEFAULT 'PENDING' NOT NULL,
	"essential" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by_user_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "privacy_request" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "privacy_request_type" NOT NULL,
	"status" "privacy_request_status" DEFAULT 'PENDING' NOT NULL,
	"notes" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rate_limit_bucket" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_document" ADD CONSTRAINT "credential_document_credential_id_credential_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."credential"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_verification" ADD CONSTRAINT "credential_verification_credential_id_credential_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."credential"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_verification" ADD CONSTRAINT "credential_verification_reviewer_user_id_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential" ADD CONSTRAINT "credential_profile_id_professional_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."professional_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential" ADD CONSTRAINT "credential_verified_by_user_id_user_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expertise_claim" ADD CONSTRAINT "expertise_claim_profile_id_professional_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."professional_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expertise_claim" ADD CONSTRAINT "expertise_claim_domain_id_domain_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domain"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expertise_claim" ADD CONSTRAINT "expertise_claim_verified_by_user_id_user_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expertise_verification" ADD CONSTRAINT "expertise_verification_claim_id_expertise_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."expertise_claim"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expertise_verification" ADD CONSTRAINT "expertise_verification_reviewer_user_id_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_verification" ADD CONSTRAINT "identity_verification_profile_id_professional_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."professional_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_verification" ADD CONSTRAINT "identity_verification_reviewer_user_id_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_item" ADD CONSTRAINT "portfolio_item_profile_id_professional_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."professional_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_language" ADD CONSTRAINT "professional_language_profile_id_professional_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."professional_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_language" ADD CONSTRAINT "professional_language_language_code_language_code_fk" FOREIGN KEY ("language_code") REFERENCES "public"."language"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_language" ADD CONSTRAINT "professional_language_verified_by_user_id_user_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_profile" ADD CONSTRAINT "professional_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_listing" ADD CONSTRAINT "service_listing_profile_id_professional_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."professional_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_listing" ADD CONSTRAINT "service_listing_category_id_service_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_listing" ADD CONSTRAINT "service_listing_language_code_language_code_fk" FOREIGN KEY ("language_code") REFERENCES "public"."language"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_listing" ADD CONSTRAINT "service_listing_domain_id_domain_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domain"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_invitation" ADD CONSTRAINT "assignment_invitation_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_invitation" ADD CONSTRAINT "assignment_invitation_professional_user_id_user_id_fk" FOREIGN KEY ("professional_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_invitation" ADD CONSTRAINT "assignment_invitation_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_participant" ADD CONSTRAINT "assignment_participant_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_participant" ADD CONSTRAINT "assignment_participant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_participant" ADD CONSTRAINT "assignment_participant_added_by_user_id_user_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_stage" ADD CONSTRAINT "assignment_stage_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_stage" ADD CONSTRAINT "assignment_stage_assignee_user_id_user_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_status_history" ADD CONSTRAINT "assignment_status_history_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_status_history" ADD CONSTRAINT "assignment_status_history_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_customer_user_id_user_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_service_category_id_service_category_id_fk" FOREIGN KEY ("service_category_id") REFERENCES "public"."service_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_language_code_language_code_fk" FOREIGN KEY ("language_code") REFERENCES "public"."language"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_domain_id_domain_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domain"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_primary_professional_user_id_user_id_fk" FOREIGN KEY ("primary_professional_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_source" ADD CONSTRAINT "knowledge_source_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_source" ADD CONSTRAINT "knowledge_source_provided_by_user_id_user_id_fk" FOREIGN KEY ("provided_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_source" ADD CONSTRAINT "knowledge_source_attachment_id_attachment_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachment" ADD CONSTRAINT "message_attachment_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachment" ADD CONSTRAINT "message_attachment_attachment_id_attachment_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_sender_user_id_user_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer" ADD CONSTRAINT "offer_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer" ADD CONSTRAINT "offer_professional_user_id_user_id_fk" FOREIGN KEY ("professional_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer" ADD CONSTRAINT "offer_listing_id_service_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."service_listing"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_permission_change" ADD CONSTRAINT "portfolio_permission_change_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_permission_change" ADD CONSTRAINT "portfolio_permission_change_changed_by_user_id_user_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_version_file" ADD CONSTRAINT "artifact_version_file_version_id_artifact_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."artifact_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_version_file" ADD CONSTRAINT "artifact_version_file_attachment_id_attachment_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_version" ADD CONSTRAINT "artifact_version_artifact_id_artifact_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_version" ADD CONSTRAINT "artifact_version_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_version" ADD CONSTRAINT "artifact_version_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact" ADD CONSTRAINT "artifact_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution" ADD CONSTRAINT "contribution_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution" ADD CONSTRAINT "contribution_version_id_artifact_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."artifact_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution" ADD CONSTRAINT "contribution_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_comment" ADD CONSTRAINT "review_comment_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_comment" ADD CONSTRAINT "review_comment_version_id_artifact_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."artifact_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_comment" ADD CONSTRAINT "review_comment_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_comment" ADD CONSTRAINT "review_comment_resolved_by_user_id_user_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_request" ADD CONSTRAINT "revision_request_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_request" ADD CONSTRAINT "revision_request_version_id_artifact_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."artifact_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_request" ADD CONSTRAINT "revision_request_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature" ADD CONSTRAINT "signature_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature" ADD CONSTRAINT "signature_version_id_artifact_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."artifact_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature" ADD CONSTRAINT "signature_signer_user_id_user_id_fk" FOREIGN KEY ("signer_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorship_record" ADD CONSTRAINT "authorship_record_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorship_record" ADD CONSTRAINT "authorship_record_version_id_artifact_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."artifact_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorship_record" ADD CONSTRAINT "authorship_record_signature_id_signature_id_fk" FOREIGN KEY ("signature_id") REFERENCES "public"."signature"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorship_record" ADD CONSTRAINT "authorship_record_professional_user_id_user_id_fk" FOREIGN KEY ("professional_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_work" ADD CONSTRAINT "published_work_record_id_authorship_record_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."authorship_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_work" ADD CONSTRAINT "published_work_added_by_user_id_user_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating" ADD CONSTRAINT "rating_review_id_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_reviewer_user_id_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_professional_user_id_user_id_fk" FOREIGN KEY ("professional_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_opened_by_user_id_user_id_fk" FOREIGN KEY ("opened_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_resolved_by_user_id_user_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_payer_user_id_user_id_fk" FOREIGN KEY ("payer_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_professional_user_id_user_id_fk" FOREIGN KEY ("professional_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_action" ADD CONSTRAINT "admin_action_admin_user_id_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_acceptance" ADD CONSTRAINT "agreement_acceptance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_request" ADD CONSTRAINT "privacy_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_unique" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "org_member_org_idx" ON "organization_member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "org_member_user_idx" ON "organization_member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_member_user_unique" ON "organization_member" USING btree ("organization_id","user_id") WHERE "organization_member"."user_id" is not null and "organization_member"."removed_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_unique" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_unique" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_unique" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "credential_profile_idx" ON "credential" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "domain_path_unique" ON "domain" USING btree ("path");--> statement-breakpoint
CREATE INDEX "domain_parent_idx" ON "domain" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "expertise_claim_unique" ON "expertise_claim" USING btree ("profile_id","domain_id");--> statement-breakpoint
CREATE INDEX "expertise_claim_domain_idx" ON "expertise_claim" USING btree ("domain_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "professional_language_unique" ON "professional_language" USING btree ("profile_id","language_code");--> statement-breakpoint
CREATE INDEX "professional_language_code_idx" ON "professional_language" USING btree ("language_code");--> statement-breakpoint
CREATE UNIQUE INDEX "professional_profile_user_unique" ON "professional_profile" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "professional_profile_slug_unique" ON "professional_profile" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "professional_profile_search_idx" ON "professional_profile" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "professional_profile_name_trgm_idx" ON "professional_profile" USING gin ("display_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "professional_profile_status_idx" ON "professional_profile" USING btree ("verification_status","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "service_category_slug_unique" ON "service_category" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "service_listing_profile_idx" ON "service_listing" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "service_listing_category_idx" ON "service_listing" USING btree ("category_id","active");--> statement-breakpoint
CREATE INDEX "invitation_professional_idx" ON "assignment_invitation" USING btree ("professional_user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_unique" ON "assignment_invitation" USING btree ("assignment_id","professional_user_id");--> statement-breakpoint
CREATE INDEX "participant_assignment_idx" ON "assignment_participant" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "participant_user_idx" ON "assignment_participant" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participant_active_unique" ON "assignment_participant" USING btree ("assignment_id","user_id") WHERE "assignment_participant"."removed_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "stage_position_unique" ON "assignment_stage" USING btree ("assignment_id","position");--> statement-breakpoint
CREATE INDEX "status_history_assignment_idx" ON "assignment_status_history" USING btree ("assignment_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "assignment_public_id_unique" ON "assignment" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "assignment_customer_idx" ON "assignment" USING btree ("customer_user_id","status");--> statement-breakpoint
CREATE INDEX "assignment_org_idx" ON "assignment" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "assignment_professional_idx" ON "assignment" USING btree ("primary_professional_user_id","status");--> statement-breakpoint
CREATE INDEX "assignment_open_idx" ON "assignment" USING btree ("status","language_code","domain_id");--> statement-breakpoint
CREATE INDEX "attachment_assignment_idx" ON "attachment" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "attachment_owner_idx" ON "attachment" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attachment_storage_key_unique" ON "attachment" USING btree ("storage_provider","storage_key");--> statement-breakpoint
CREATE INDEX "message_assignment_idx" ON "message" USING btree ("assignment_id","created_at");--> statement-breakpoint
CREATE INDEX "offer_assignment_idx" ON "offer" USING btree ("assignment_id","status");--> statement-breakpoint
CREATE INDEX "offer_professional_idx" ON "offer" USING btree ("professional_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "artifact_version_number_unique" ON "artifact_version" USING btree ("artifact_id","version_number");--> statement-breakpoint
CREATE INDEX "artifact_version_assignment_idx" ON "artifact_version" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "artifact_assignment_idx" ON "artifact" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "contribution_assignment_idx" ON "contribution" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "contribution_user_idx" ON "contribution" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "review_comment_version_idx" ON "review_comment" USING btree ("version_id","status");--> statement-breakpoint
CREATE INDEX "revision_request_assignment_idx" ON "revision_request" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "signature_assignment_idx" ON "signature" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "signature_signer_idx" ON "signature" USING btree ("signer_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "authorship_record_public_id_unique" ON "authorship_record" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "authorship_record_professional_idx" ON "authorship_record" USING btree ("professional_user_id","visibility");--> statement-breakpoint
CREATE INDEX "authorship_record_assignment_idx" ON "authorship_record" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "published_work_record_idx" ON "published_work" USING btree ("record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rating_dimension_unique" ON "rating" USING btree ("review_id","dimension");--> statement-breakpoint
CREATE UNIQUE INDEX "review_assignment_unique" ON "review" USING btree ("assignment_id","reviewer_user_id");--> statement-breakpoint
CREATE INDEX "review_professional_idx" ON "review" USING btree ("professional_user_id");--> statement-breakpoint
CREATE INDEX "dispute_assignment_idx" ON "dispute" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "dispute_status_idx" ON "dispute" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_idempotency_unique" ON "ledger_entry" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "ledger_account_idx" ON "ledger_entry" USING btree ("account","account_ref","currency");--> statement-breakpoint
CREATE INDEX "ledger_assignment_idx" ON "ledger_entry" USING btree ("assignment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_idempotency_unique" ON "payment" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "payment_assignment_idx" ON "payment" USING btree ("assignment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_provider_ref_unique" ON "payment" USING btree ("provider","provider_ref");--> statement-breakpoint
CREATE INDEX "payout_professional_idx" ON "payout" USING btree ("professional_user_id","status");--> statement-breakpoint
CREATE INDEX "admin_action_target_idx" ON "admin_action" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "admin_action_admin_idx" ON "admin_action" USING btree ("admin_user_id","created_at");--> statement-breakpoint
CREATE INDEX "agreement_user_idx" ON "agreement_acceptance" USING btree ("user_id","agreement_type");--> statement-breakpoint
CREATE INDEX "ai_usage_assignment_idx" ON "ai_usage_event" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "ai_usage_user_idx" ON "ai_usage_event" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_event" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_assignment_idx" ON "audit_event" USING btree ("assignment_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_event" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_event" USING btree ("action","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_pref_unique" ON "notification_preference" USING btree ("user_id","type","channel");--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notification" USING btree ("user_id","channel","read_at");