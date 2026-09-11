import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, smallint, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import {
  aiPolicyEnum,
  assignmentStatusEnum,
  assignmentTemplateEnum,
  attachmentPurposeEnum,
  confidentialityLevelEnum,
  contributionRoleEnum,
  expertiseRequirementEnum,
  invitationStatusEnum,
  knowledgeSourceTypeEnum,
  languageLevelEnum,
  messageKindEnum,
  offerStatusEnum,
  participantRoleEnum,
  portfolioPermissionEnum,
  pricingModelEnum,
  scanStatusEnum,
  stageKindEnum,
  stageStatusEnum,
} from "./enums";
import { organizations, users } from "./core";
import { domains, languages, serviceCategories, serviceListings } from "./professional";
import { newId } from "@/lib/ids";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ------------------------------------------------------------------ */
/* Files (private by default; served only through authorized routes)   */
/* ------------------------------------------------------------------ */

export const attachments = pgTable(
  "attachment",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id),
    assignmentId: text("assignment_id"),
    purpose: attachmentPurposeEnum("purpose").notNull(),
    storageProvider: text("storage_provider").notNull(),
    // Unpredictable key inside the storage provider
    storageKey: text("storage_key").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    scanStatus: scanStatusEnum("scan_status").notNull().default("SKIPPED"),
    retentionUntil: timestamp("retention_until", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletionReason: text("deletion_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("attachment_assignment_idx").on(t.assignmentId), index("attachment_owner_idx").on(t.ownerUserId), uniqueIndex("attachment_storage_key_unique").on(t.storageProvider, t.storageKey)],
);

/** Used by the DATABASE storage provider only. */
export const fileBlobs = pgTable("file_blob", {
  key: text("key").primaryKey(),
  data: text("data").notNull(), // base64 encoded
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Assignments                                                         */
/* ------------------------------------------------------------------ */

export const assignments = pgTable(
  "assignment",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    // Opaque identifier used in URLs (never sequential)
    publicId: text("public_id").notNull(),
    organizationId: text("organization_id").references(() => organizations.id),
    customerUserId: text("customer_user_id")
      .notNull()
      .references(() => users.id),
    template: assignmentTemplateEnum("template").notNull().default("STANDARD"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    serviceCategoryId: text("service_category_id").references(() => serviceCategories.id),
    languageCode: text("language_code").references(() => languages.code),
    requiredLanguageLevel: languageLevelEnum("required_language_level").notNull().default("PROFESSIONAL"),
    editorialRequired: boolean("editorial_required").notNull().default(true),
    domainId: text("domain_id").references(() => domains.id),
    domainRequirement: expertiseRequirementEnum("domain_requirement").notNull().default("NOT_REQUIRED"),
    targetAudience: text("target_audience").notNull().default(""),
    intendedPublication: text("intended_publication").notNull().default(""),
    wordCount: integer("word_count"),
    deadline: timestamp("deadline", { withTimezone: true }),
    sourceUrls: jsonb("source_urls").$type<string[]>().notNull().default([]),
    attributionRequirements: text("attribution_requirements").notNull().default(""),
    additionalInstructions: text("additional_instructions").notNull().default(""),
    knowledgeSourceType: knowledgeSourceTypeEnum("knowledge_source_type").notNull().default("MIXED"),
    status: assignmentStatusEnum("status").notNull().default("DRAFT"),
    confidentiality: confidentialityLevelEnum("confidentiality").notNull().default("PRIVATE"),
    aiPolicy: aiPolicyEnum("ai_policy").notNull().default("AI_METADATA_ONLY"),
    portfolioPermission: portfolioPermissionEnum("portfolio_permission").notNull().default("NOT_PERMITTED"),
    // Explicit customer consent for public attribution of this assignment
    publicAttributionAllowed: boolean("public_attribution_allowed").notNull().default(false),
    budgetMinor: integer("budget_minor"),
    agreedPriceMinor: integer("agreed_price_minor"),
    currency: text("currency").notNull().default("SEK"),
    primaryProfessionalUserId: text("primary_professional_user_id").references(() => users.id),
    acceptedOfferId: text("accepted_offer_id"),
    currentArtifactId: text("current_artifact_id"),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    contentDeletedAt: timestamp("content_deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("assignment_public_id_unique").on(t.publicId),
    index("assignment_customer_idx").on(t.customerUserId, t.status),
    index("assignment_org_idx").on(t.organizationId),
    index("assignment_professional_idx").on(t.primaryProfessionalUserId, t.status),
    index("assignment_open_idx").on(t.status, t.languageCode, t.domainId),
  ],
);

export const assignmentParticipants = pgTable(
  "assignment_participant",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: participantRoleEnum("role").notNull(),
    contributionRoles: jsonb("contribution_roles").$type<string[]>().notNull().default([]),
    addedByUserId: text("added_by_user_id").references(() => users.id),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
  },
  (t) => [
    index("participant_assignment_idx").on(t.assignmentId),
    index("participant_user_idx").on(t.userId),
    uniqueIndex("participant_active_unique")
      .on(t.assignmentId, t.userId)
      .where(sql`${t.removedAt} is null`),
  ],
);

/** Append-only workflow history. */
export const assignmentStatusHistory = pgTable(
  "assignment_status_history",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    fromStatus: assignmentStatusEnum("from_status"),
    toStatus: assignmentStatusEnum("to_status").notNull(),
    actorUserId: text("actor_user_id").references(() => users.id),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("status_history_assignment_idx").on(t.assignmentId, t.createdAt)],
);

export const assignmentStages = pgTable(
  "assignment_stage",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
    kind: stageKindEnum("kind").notNull(),
    title: text("title").notNull(),
    assigneeUserId: text("assignee_user_id").references(() => users.id),
    contributionRole: contributionRoleEnum("contribution_role"),
    status: stageStatusEnum("status").notNull().default("PENDING"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("stage_position_unique").on(t.assignmentId, t.position)],
);

export const knowledgeSources = pgTable("knowledge_source", {
  id: text("id").primaryKey().$defaultFn(newId),
  assignmentId: text("assignment_id")
    .notNull()
    .references(() => assignments.id, { onDelete: "cascade" }),
  type: knowledgeSourceTypeEnum("type").notNull(),
  description: text("description").notNull().default(""),
  providedByUserId: text("provided_by_user_id").references(() => users.id),
  providedByName: text("provided_by_name"),
  providedByTitle: text("provided_by_title"),
  attachmentId: text("attachment_id").references(() => attachments.id),
  // Whether the knowledge provider may be named on public provenance
  publicAttribution: boolean("public_attribution").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assignmentInvitations = pgTable(
  "assignment_invitation",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    professionalUserId: text("professional_user_id")
      .notNull()
      .references(() => users.id),
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => users.id),
    message: text("message").notNull().default(""),
    status: invitationStatusEnum("status").notNull().default("PENDING"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("invitation_professional_idx").on(t.professionalUserId, t.status), uniqueIndex("invitation_unique").on(t.assignmentId, t.professionalUserId)],
);

export const offers = pgTable(
  "offer",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    professionalUserId: text("professional_user_id")
      .notNull()
      .references(() => users.id),
    listingId: text("listing_id").references(() => serviceListings.id),
    contributionRole: contributionRoleEnum("contribution_role").notNull().default("AUTHOR"),
    pricingModel: pricingModelEnum("pricing_model").notNull(),
    priceMinor: integer("price_minor").notNull(),
    currency: text("currency").notNull(),
    turnaroundDays: smallint("turnaround_days").notNull(),
    message: text("message").notNull().default(""),
    status: offerStatusEnum("status").notNull().default("PENDING"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("offer_assignment_idx").on(t.assignmentId, t.status), index("offer_professional_idx").on(t.professionalUserId)],
);

export const messages = pgTable(
  "message",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    senderUserId: text("sender_user_id").references(() => users.id),
    kind: messageKindEnum("kind").notNull().default("TEXT"),
    body: text("body").notNull(),
    // Structured references: version ids, urls, system event codes (never secrets)
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("message_assignment_idx").on(t.assignmentId, t.createdAt)],
);

export const messageAttachments = pgTable("message_attachment", {
  id: text("id").primaryKey().$defaultFn(newId),
  messageId: text("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  attachmentId: text("attachment_id")
    .notNull()
    .references(() => attachments.id),
});

export const portfolioPermissionChanges = pgTable("portfolio_permission_change", {
  id: text("id").primaryKey().$defaultFn(newId),
  assignmentId: text("assignment_id")
    .notNull()
    .references(() => assignments.id, { onDelete: "cascade" }),
  fromPermission: portfolioPermissionEnum("from_permission").notNull(),
  toPermission: portfolioPermissionEnum("to_permission").notNull(),
  changedByUserId: text("changed_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
