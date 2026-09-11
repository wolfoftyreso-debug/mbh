import { boolean, index, integer, jsonb, pgTable, smallint, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import {
  contributionRoleEnum,
  customerDisplayEnum,
  publicationCheckStateEnum,
  recordStatusEnum,
  recordVisibilityEnum,
  verificationStatusEnum,
} from "./enums";
import { users } from "./core";
import { assignments } from "./assignment";
import { artifactVersions, signatures } from "./artifacts";
import { newId } from "@/lib/ids";

/**
 * Permanent authorship / review record created at signing time.
 * Public visibility is PRIVATE by default and only changes through an explicit,
 * authorized customer action. The record itself never changes after creation
 * except for status (revocation) and visibility/display settings.
 */
export const authorshipRecords = pgTable(
  "authorship_record",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    publicId: text("public_id").notNull(), // e.g. HA-01JZ...
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignments.id),
    versionId: text("version_id")
      .notNull()
      .references(() => artifactVersions.id),
    signatureId: text("signature_id")
      .notNull()
      .references(() => signatures.id),
    professionalUserId: text("professional_user_id")
      .notNull()
      .references(() => users.id),
    professionalPublicName: text("professional_public_name").notNull(),
    professionalSlug: text("professional_slug").notNull(),
    contributionRole: contributionRoleEnum("contribution_role").notNull(),
    servicePerformed: text("service_performed").notNull(),
    serviceCategorySlug: text("service_category_slug"),
    scope: text("scope").notNull(),
    languageCode: text("language_code"),
    workTitle: text("work_title").notNull(),
    versionNumber: smallint("version_number").notNull(),
    contentHash: text("content_hash").notNull(),
    wordCount: integer("word_count").notNull().default(0),
    signedAt: timestamp("signed_at", { withTimezone: true }).notNull(),
    verificationStatusAtSigning: verificationStatusEnum("verification_status_at_signing").notNull(),
    credentialSnapshot: jsonb("credential_snapshot").$type<Record<string, unknown>>().notNull().default({}),
    customerOrganizationName: text("customer_organization_name"),
    status: recordStatusEnum("status").notNull().default("VALID"),
    visibility: recordVisibilityEnum("visibility").notNull().default("PRIVATE"),
    customerDisplay: customerDisplayEnum("customer_display").notNull().default("HIDDEN"),
    titlePublic: boolean("title_public").notNull().default(false),
    hashPublic: boolean("hash_public").notNull().default(false),
    publicationUrl: text("publication_url"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: text("revoked_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("authorship_record_public_id_unique").on(t.publicId),
    index("authorship_record_professional_idx").on(t.professionalUserId, t.visibility),
    index("authorship_record_assignment_idx").on(t.assignmentId),
  ],
);

export const publishedWorks = pgTable(
  "published_work",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    recordId: text("record_id")
      .notNull()
      .references(() => authorshipRecords.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    addedByUserId: text("added_by_user_id")
      .notNull()
      .references(() => users.id),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastVerifiedState: publicationCheckStateEnum("last_verified_state").notNull().default("UNCHECKED"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("published_work_record_idx").on(t.recordId)],
);

export const reviews = pgTable(
  "review",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignments.id),
    reviewerUserId: text("reviewer_user_id")
      .notNull()
      .references(() => users.id),
    professionalUserId: text("professional_user_id")
      .notNull()
      .references(() => users.id),
    rating: smallint("rating").notNull(), // 1..5 overall
    onTime: boolean("on_time").notNull().default(true),
    comment: text("comment").notNull().default(""),
    // Public display is anonymized unless the customer explicitly opts in
    displayName: text("display_name"),
    anonymized: boolean("anonymized").notNull().default(true),
    publicVisible: boolean("public_visible").notNull().default(true),
    // Only completed, paid assignments produce verified marketplace reviews
    verifiedTransaction: boolean("verified_transaction").notNull().default(true),
    hiddenByAdminAt: timestamp("hidden_by_admin_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("review_assignment_unique").on(t.assignmentId, t.reviewerUserId), index("review_professional_idx").on(t.professionalUserId)],
);

export const ratings = pgTable(
  "rating",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    dimension: text("dimension").notNull(), // QUALITY | COMMUNICATION | TIMELINESS | EXPERTISE
    score: smallint("score").notNull(),
  },
  (t) => [uniqueIndex("rating_dimension_unique").on(t.reviewId, t.dimension)],
);
