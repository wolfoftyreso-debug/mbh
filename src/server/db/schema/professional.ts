import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  availabilityEnum,
  claimStatusEnum,
  credentialTypeEnum,
  languageLevelEnum,
  pricingModelEnum,
  serviceKindEnum,
  verificationStatusEnum,
} from "./enums";
import { users } from "./core";
import { newId } from "@/lib/ids";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

export const languages = pgTable("language", {
  code: text("code").primaryKey(), // BCP-47 / ISO 639-1, e.g. "sv", "en"
  name: text("name").notNull(),
  nativeName: text("native_name").notNull(),
  active: boolean("active").notNull().default(true),
});

/** Hierarchical, database-driven domain taxonomy (materialized path). */
export const domains = pgTable(
  "domain",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    parentId: text("parent_id"),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    // Materialized path of slugs, e.g. "automotive/vehicle-repair/diagnostics"
    path: text("path").notNull(),
    depth: smallint("depth").notNull().default(0),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("domain_path_unique").on(t.path), index("domain_parent_idx").on(t.parentId)],
);

export const serviceCategories = pgTable(
  "service_category",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    kind: serviceKindEnum("kind").notNull().default("LANGUAGE"),
    // Which contribution role a signature under this category represents by default
    defaultContributionRole: text("default_contribution_role").notNull().default("AUTHOR"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("service_category_slug_unique").on(t.slug)],
);

/* ------------------------------------------------------------------ */
/* Professional identity                                               */
/* ------------------------------------------------------------------ */

export const professionalProfiles = pgTable(
  "professional_profile",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    title: text("title").notNull().default(""),
    bio: text("bio").notNull().default(""),
    country: text("country"),
    region: text("region"),
    photoAttachmentId: text("photo_attachment_id"),
    yearsExperience: smallint("years_experience"),
    availability: availabilityEnum("availability").notNull().default("AVAILABLE"),
    typicalTurnaroundDays: smallint("typical_turnaround_days"),
    externalUrls: jsonb("external_urls").$type<{ label: string; url: string }[]>().notNull().default([]),
    verificationStatus: verificationStatusEnum("verification_status").notNull().default("UNVERIFIED"),
    identityVerifiedAt: timestamp("identity_verified_at", { withTimezone: true }),
    credentialsVerifiedAt: timestamp("credentials_verified_at", { withTimezone: true }),
    professionalVerifiedAt: timestamp("professional_verified_at", { withTimezone: true }),
    verificationNote: text("verification_note"),
    // Explicit publication of the public profile (private by default)
    publishedAt: timestamp("published_at", { withTimezone: true }),
    confidentialityAgreementVersion: text("confidentiality_agreement_version"),
    // Denormalized reputation counters, refreshed by the reputation service
    completedAssignments: integer("completed_assignments").notNull().default(0),
    signedWorks: integer("signed_works").notNull().default(0),
    repeatCustomers: integer("repeat_customers").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    ratingAvgX100: integer("rating_avg_x100").notNull().default(0),
    onTimeRateX100: integer("on_time_rate_x100").notNull().default(0),
    revisionRateX100: integer("revision_rate_x100").notNull().default(0),
    disputeCount: integer("dispute_count").notNull().default(0),
    firstActiveAt: timestamp("first_active_at", { withTimezone: true }),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): ReturnType<typeof sql> =>
        sql`to_tsvector('simple', coalesce(display_name,'') || ' ' || coalesce(title,'') || ' ' || coalesce(bio,''))`,
    ),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("professional_profile_user_unique").on(t.userId),
    uniqueIndex("professional_profile_slug_unique").on(t.slug),
    index("professional_profile_search_idx").using("gin", t.searchVector),
    index("professional_profile_name_trgm_idx").using("gin", sql`${t.displayName} gin_trgm_ops`),
    index("professional_profile_status_idx").on(t.verificationStatus, t.publishedAt),
  ],
);

export const professionalLanguages = pgTable(
  "professional_language",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    profileId: text("profile_id")
      .notNull()
      .references(() => professionalProfiles.id, { onDelete: "cascade" }),
    languageCode: text("language_code")
      .notNull()
      .references(() => languages.code),
    level: languageLevelEnum("level").notNull(),
    // Speaking a language is not the same as being qualified to edit it professionally
    editorialCapable: boolean("editorial_capable").notNull().default(false),
    status: claimStatusEnum("status").notNull().default("SELF_DECLARED"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedByUserId: text("verified_by_user_id").references(() => users.id),
    ...timestamps,
  },
  (t) => [uniqueIndex("professional_language_unique").on(t.profileId, t.languageCode), index("professional_language_code_idx").on(t.languageCode)],
);

/** ExpertiseClaim: self-declared domain expertise, optionally verified. */
export const expertiseClaims = pgTable(
  "expertise_claim",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    profileId: text("profile_id")
      .notNull()
      .references(() => professionalProfiles.id, { onDelete: "cascade" }),
    domainId: text("domain_id")
      .notNull()
      .references(() => domains.id),
    yearsExperience: smallint("years_experience"),
    description: text("description").notNull().default(""),
    evidenceSummary: text("evidence_summary").notNull().default(""),
    status: claimStatusEnum("status").notNull().default("SELF_DECLARED"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedByUserId: text("verified_by_user_id").references(() => users.id),
    ...timestamps,
  },
  (t) => [uniqueIndex("expertise_claim_unique").on(t.profileId, t.domainId), index("expertise_claim_domain_idx").on(t.domainId, t.status)],
);

export const expertiseVerifications = pgTable("expertise_verification", {
  id: text("id").primaryKey().$defaultFn(newId),
  claimId: text("claim_id")
    .notNull()
    .references(() => expertiseClaims.id, { onDelete: "cascade" }),
  reviewerUserId: text("reviewer_user_id")
    .notNull()
    .references(() => users.id),
  decision: claimStatusEnum("decision").notNull(),
  notes: text("notes").notNull().default(""),
  evidenceAttachmentIds: jsonb("evidence_attachment_ids").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const credentials = pgTable(
  "credential",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    profileId: text("profile_id")
      .notNull()
      .references(() => professionalProfiles.id, { onDelete: "cascade" }),
    type: credentialTypeEnum("type").notNull(),
    title: text("title").notNull(),
    issuer: text("issuer").notNull().default(""),
    field: text("field").notNull().default(""),
    startYear: smallint("start_year"),
    endYear: smallint("end_year"),
    description: text("description").notNull().default(""),
    status: claimStatusEnum("status").notNull().default("SELF_DECLARED"),
    publicVisible: boolean("public_visible").notNull().default(true),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedByUserId: text("verified_by_user_id").references(() => users.id),
    ...timestamps,
  },
  (t) => [index("credential_profile_idx").on(t.profileId)],
);

export const credentialVerifications = pgTable("credential_verification", {
  id: text("id").primaryKey().$defaultFn(newId),
  credentialId: text("credential_id")
    .notNull()
    .references(() => credentials.id, { onDelete: "cascade" }),
  reviewerUserId: text("reviewer_user_id")
    .notNull()
    .references(() => users.id),
  decision: claimStatusEnum("decision").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Private link between a credential and its supporting document (never public). */
export const credentialDocuments = pgTable("credential_document", {
  id: text("id").primaryKey().$defaultFn(newId),
  credentialId: text("credential_id")
    .notNull()
    .references(() => credentials.id, { onDelete: "cascade" }),
  attachmentId: text("attachment_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Identity verification submissions (document reviewed by platform staff or a future KYC provider). */
export const identityVerifications = pgTable("identity_verification", {
  id: text("id").primaryKey().$defaultFn(newId),
  profileId: text("profile_id")
    .notNull()
    .references(() => professionalProfiles.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("manual"),
  providerRef: text("provider_ref"),
  documentAttachmentId: text("document_attachment_id"),
  legalName: text("legal_name"),
  status: claimStatusEnum("status").notNull().default("PENDING_REVIEW"),
  reviewerUserId: text("reviewer_user_id").references(() => users.id),
  notes: text("notes").notNull().default(""),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  retentionUntil: timestamp("retention_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const portfolioItems = pgTable("portfolio_item", {
  id: text("id").primaryKey().$defaultFn(newId),
  profileId: text("profile_id")
    .notNull()
    .references(() => professionalProfiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  url: text("url"),
  // When derived from platform work, the permission on that assignment governs display
  authorshipRecordId: text("authorship_record_id"),
  attachmentId: text("attachment_id"),
  publicVisible: boolean("public_visible").notNull().default(false),
  ...timestamps,
});

export const serviceListings = pgTable(
  "service_listing",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    profileId: text("profile_id")
      .notNull()
      .references(() => professionalProfiles.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => serviceCategories.id),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    languageCode: text("language_code").references(() => languages.code),
    domainId: text("domain_id").references(() => domains.id),
    pricingModel: pricingModelEnum("pricing_model").notNull().default("FIXED_PRICE"),
    basePriceMinor: integer("base_price_minor").notNull().default(0),
    currency: text("currency").notNull().default("SEK"),
    turnaroundDays: smallint("turnaround_days").notNull().default(3),
    revisionsIncluded: smallint("revisions_included").notNull().default(1),
    requirements: text("requirements").notNull().default(""),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("service_listing_profile_idx").on(t.profileId), index("service_listing_category_idx").on(t.categoryId, t.active)],
);
