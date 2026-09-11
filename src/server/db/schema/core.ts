import { sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { orgRoleEnum, platformRoleEnum } from "./enums";
import { newId } from "@/lib/ids";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ------------------------------------------------------------------ */
/* Authentication core (Better Auth compatible)                        */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    // Platform-level role. Only used for platform administration, never for content access.
    platformRole: platformRoleEnum("platform_role").notNull().default("USER"),
    phone: text("phone"),
    phoneVerified: boolean("phone_verified").notNull().default(false),
    locale: text("locale").notNull().default("en"),
    timezone: text("timezone").notNull().default("Europe/Stockholm"),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    suspendedReason: text("suspended_reason"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("user_email_unique").on(t.email)],
);

export const sessions = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("session_token_unique").on(t.token), index("session_user_idx").on(t.userId)],
);

export const accounts = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_idx").on(t.userId), uniqueIndex("account_provider_unique").on(t.providerId, t.accountId)],
);

export const verifications = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/* ------------------------------------------------------------------ */
/* Organizations                                                       */
/* ------------------------------------------------------------------ */

export const organizations = pgTable(
  "organization",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    country: text("country"),
    vatNumber: text("vat_number"),
    billingEmail: text("billing_email"),
    website: text("website"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("organization_slug_unique").on(t.slug)],
);

export const organizationMembers = pgTable(
  "organization_member",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // Either a user (active member) or an invited e-mail (pending)
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    invitedEmail: text("invited_email"),
    role: orgRoleEnum("role").notNull().default("MEMBER"),
    invitedByUserId: text("invited_by_user_id").references(() => users.id),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("org_member_org_idx").on(t.organizationId),
    index("org_member_user_idx").on(t.userId),
    uniqueIndex("org_member_user_unique")
      .on(t.organizationId, t.userId)
      .where(sql`${t.userId} is not null and ${t.removedAt} is null`),
  ],
);
