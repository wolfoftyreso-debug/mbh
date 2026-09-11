import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import {
  actorTypeEnum,
  agreementTypeEnum,
  aiPolicyEnum,
  aiUsageStatusEnum,
  notificationChannelEnum,
  notificationStatusEnum,
  privacyRequestStatusEnum,
  privacyRequestTypeEnum,
} from "./enums";
import { users } from "./core";
import { newId } from "@/lib/ids";

export const notifications = pgTable(
  "notification",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // e.g. ASSIGNMENT_ACCEPTED
    channel: notificationChannelEnum("channel").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    link: text("link"),
    status: notificationStatusEnum("status").notNull().default("PENDING"),
    essential: boolean("essential").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    readAt: timestamp("read_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notification_user_idx").on(t.userId, t.channel, t.readAt)],
);

export const notificationPreferences = pgTable(
  "notification_preference",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    channel: notificationChannelEnum("channel").notNull(),
    enabled: boolean("enabled").notNull().default(true),
  },
  (t) => [uniqueIndex("notification_pref_unique").on(t.userId, t.type, t.channel)],
);

/** Append-only audit log. Metadata must never contain secrets or content bodies. */
export const auditEvents = pgTable(
  "audit_event",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorUserId: text("actor_user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    assignmentId: text("assignment_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_entity_idx").on(t.entityType, t.entityId),
    index("audit_assignment_idx").on(t.assignmentId, t.createdAt),
    index("audit_actor_idx").on(t.actorUserId, t.createdAt),
    index("audit_action_idx").on(t.action, t.createdAt),
  ],
);

/** Sensitive administrative actions (content access, suspension, verification changes). */
export const adminActions = pgTable(
  "admin_action",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    adminUserId: text("admin_user_id")
      .notNull()
      .references(() => users.id),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    assignmentId: text("assignment_id"),
    reason: text("reason").notNull(),
    // Time-boxed content access grants expire
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_action_target_idx").on(t.targetType, t.targetId), index("admin_action_admin_idx").on(t.adminUserId, t.createdAt)],
);

export const aiUsageEvents = pgTable(
  "ai_usage_event",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    userId: text("user_id"),
    assignmentId: text("assignment_id"),
    feature: text("feature").notNull(),
    model: text("model"),
    policyAtTime: aiPolicyEnum("policy_at_time"),
    dataClass: text("data_class").notNull(), // METADATA | CONTENT | NONE
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    status: aiUsageStatusEnum("status").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_usage_assignment_idx").on(t.assignmentId), index("ai_usage_user_idx").on(t.userId, t.createdAt)],
);

export const agreementAcceptances = pgTable(
  "agreement_acceptance",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agreementType: agreementTypeEnum("agreement_type").notNull(),
    agreementVersion: text("agreement_version").notNull(),
    assignmentId: text("assignment_id"),
    ipHash: text("ip_hash"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("agreement_user_idx").on(t.userId, t.agreementType)],
);

export const privacyRequests = pgTable("privacy_request", {
  id: text("id").primaryKey().$defaultFn(newId),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: privacyRequestTypeEnum("type").notNull(),
  status: privacyRequestStatusEnum("status").notNull().default("PENDING"),
  notes: text("notes"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const rateLimitBuckets = pgTable("rate_limit_bucket", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});

export const platformSettings = pgTable("platform_setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedByUserId: text("updated_by_user_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
