import { bigint, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { disputeStatusEnum, ledgerAccountEnum, ledgerEntryTypeEnum, paymentStatusEnum, payoutStatusEnum } from "./enums";
import { organizations, users } from "./core";
import { assignments } from "./assignment";
import { newId } from "@/lib/ids";

/** All amounts are integer minor units (öre, cents). Currency is explicit. Never floats. */

export const payments = pgTable(
  "payment",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignments.id),
    payerUserId: text("payer_user_id")
      .notNull()
      .references(() => users.id),
    organizationId: text("organization_id").references(() => organizations.id),
    provider: text("provider").notNull(),
    providerRef: text("provider_ref"),
    providerCheckoutUrl: text("provider_checkout_url"),
    amountMinor: integer("amount_minor").notNull(),
    platformFeeMinor: integer("platform_fee_minor").notNull(),
    currency: text("currency").notNull(),
    status: paymentStatusEnum("status").notNull().default("PENDING"),
    idempotencyKey: text("idempotency_key").notNull(),
    refundedMinor: integer("refunded_minor").notNull().default(0),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("payment_idempotency_unique").on(t.idempotencyKey), index("payment_assignment_idx").on(t.assignmentId), uniqueIndex("payment_provider_ref_unique").on(t.provider, t.providerRef)],
);

/** Append-only ledger. Balances are derived by summing entries, never from mutable fields. */
export const ledgerEntries = pgTable(
  "ledger_entry",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    type: ledgerEntryTypeEnum("type").notNull(),
    account: ledgerAccountEnum("account").notNull(),
    // Reference of the account holder: user id for CUSTOMER/PROFESSIONAL, "platform" otherwise
    accountRef: text("account_ref").notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(), // signed
    currency: text("currency").notNull(),
    assignmentId: text("assignment_id").references(() => assignments.id),
    paymentId: text("payment_id").references(() => payments.id),
    payoutId: text("payout_id"),
    description: text("description").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ledger_idempotency_unique").on(t.idempotencyKey),
    index("ledger_account_idx").on(t.account, t.accountRef, t.currency),
    index("ledger_assignment_idx").on(t.assignmentId),
  ],
);

export const payouts = pgTable(
  "payout",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    professionalUserId: text("professional_user_id")
      .notNull()
      .references(() => users.id),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    provider: text("provider").notNull(),
    providerRef: text("provider_ref"),
    status: payoutStatusEnum("status").notNull().default("PENDING"),
    requestedByUserId: text("requested_by_user_id").references(() => users.id),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [index("payout_professional_idx").on(t.professionalUserId, t.status)],
);

export const disputes = pgTable(
  "dispute",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignments.id),
    openedByUserId: text("opened_by_user_id")
      .notNull()
      .references(() => users.id),
    reason: text("reason").notNull(),
    status: disputeStatusEnum("status").notNull().default("OPEN"),
    resolutionNotes: text("resolution_notes"),
    resolvedByUserId: text("resolved_by_user_id").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("dispute_assignment_idx").on(t.assignmentId), index("dispute_status_idx").on(t.status)],
);
