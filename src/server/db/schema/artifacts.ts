import { boolean, index, integer, jsonb, pgTable, smallint, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import {
  artifactKindEnum,
  commentStatusEnum,
  contributionRoleEnum,
  contributionStatusEnum,
  domainVerdictEnum,
  reviewCommentTypeEnum,
  revisionStatusEnum,
  verificationStatusEnum,
  versionStatusEnum,
} from "./enums";
import { users } from "./core";
import { assignments, attachments } from "./assignment";
import { newId } from "@/lib/ids";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const artifacts = pgTable(
  "artifact",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    kind: artifactKindEnum("kind").notNull().default("TEXT"),
    title: text("title").notNull(),
    currentVersionId: text("current_version_id"),
    ...timestamps,
  },
  (t) => [index("artifact_assignment_idx").on(t.assignmentId)],
);

/**
 * Every material revision creates a new version. Signed versions are immutable
 * (enforced in the domain layer and by a database trigger created in a migration).
 */
export const artifactVersions = pgTable(
  "artifact_version",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    artifactId: text("artifact_id")
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    versionNumber: smallint("version_number").notNull(),
    parentVersionId: text("parent_version_id"),
    label: text("label").notNull().default(""),
    // Plain-text content. Null when the version is file-only or content was deleted by retention.
    content: text("content"),
    contentHash: text("content_hash").notNull(), // sha256 hex of canonical content (+ file hashes)
    wordCount: integer("word_count").notNull().default(0),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    status: versionStatusEnum("status").notNull().default("DRAFT"),
    immutable: boolean("immutable").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletionReason: text("deletion_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("artifact_version_number_unique").on(t.artifactId, t.versionNumber), index("artifact_version_assignment_idx").on(t.assignmentId)],
);

export const artifactVersionFiles = pgTable("artifact_version_file", {
  id: text("id").primaryKey().$defaultFn(newId),
  versionId: text("version_id")
    .notNull()
    .references(() => artifactVersions.id, { onDelete: "cascade" }),
  attachmentId: text("attachment_id")
    .notNull()
    .references(() => attachments.id),
});

export const revisionRequests = pgTable(
  "revision_request",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    versionId: text("version_id")
      .notNull()
      .references(() => artifactVersions.id),
    requestedByUserId: text("requested_by_user_id")
      .notNull()
      .references(() => users.id),
    message: text("message").notNull(),
    status: revisionStatusEnum("status").notNull().default("OPEN"),
    resolvedByVersionId: text("resolved_by_version_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("revision_request_assignment_idx").on(t.assignmentId)],
);

/** Structured inline review comments anchored to a text selection of a version. */
export const reviewComments = pgTable(
  "review_comment",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    versionId: text("version_id")
      .notNull()
      .references(() => artifactVersions.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => users.id),
    type: reviewCommentTypeEnum("type").notNull(),
    domainVerdict: domainVerdictEnum("domain_verdict"),
    anchorStart: integer("anchor_start"),
    anchorEnd: integer("anchor_end"),
    quotedText: text("quoted_text").notNull().default(""),
    body: text("body").notNull(),
    suggestion: text("suggestion").notNull().default(""),
    status: commentStatusEnum("status").notNull().default("OPEN"),
    resolvedByUserId: text("resolved_by_user_id").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("review_comment_version_idx").on(t.versionId, t.status)],
);

/** Multi-person provenance: who did what, on which version. */
export const contributions = pgTable(
  "contribution",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    versionId: text("version_id").references(() => artifactVersions.id),
    userId: text("user_id").references(() => users.id),
    // For knowledge sources without an account (e.g. a founder named by the customer)
    displayName: text("display_name"),
    displayTitle: text("display_title"),
    role: contributionRoleEnum("role").notNull(),
    scope: text("scope").notNull().default(""),
    notes: text("notes").notNull().default(""),
    status: contributionStatusEnum("status").notNull().default("ACTIVE"),
    signatureId: text("signature_id"),
    verificationSnapshot: jsonb("verification_snapshot").$type<Record<string, unknown>>(),
    publicAttribution: boolean("public_attribution").notNull().default(false),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("contribution_assignment_idx").on(t.assignmentId), index("contribution_user_idx").on(t.userId)],
);

/** Deliberate human signature over the exact hash of a version. Append-only. */
export const signatures = pgTable(
  "signature",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignments.id),
    versionId: text("version_id")
      .notNull()
      .references(() => artifactVersions.id),
    signerUserId: text("signer_user_id")
      .notNull()
      .references(() => users.id),
    contributionRole: contributionRoleEnum("contribution_role").notNull(),
    contentHash: text("content_hash").notNull(),
    servicePerformed: text("service_performed").notNull(),
    scope: text("scope").notNull(),
    languageCode: text("language_code"),
    wordCount: integer("word_count").notNull().default(0),
    verificationStatusAtSigning: verificationStatusEnum("verification_status_at_signing").notNull(),
    credentialSnapshot: jsonb("credential_snapshot").$type<Record<string, unknown>>().notNull().default({}),
    confirmationStatement: text("confirmation_statement").notNull(),
    sessionId: text("session_id"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("signature_assignment_idx").on(t.assignmentId), index("signature_signer_idx").on(t.signerUserId)],
);
