import { and, eq, sql } from "drizzle-orm";
import { db, type Tx } from "@/server/db";
import { ledgerEntries } from "@/server/db/schema";

export type LedgerEntryType = "CUSTOMER_PAYMENT" | "PLATFORM_FEE" | "PROFESSIONAL_EARNING" | "REFUND" | "PAYOUT" | "ADJUSTMENT";
export type LedgerAccount = "CUSTOMER" | "PLATFORM_ESCROW" | "PLATFORM_REVENUE" | "PROFESSIONAL";

export interface LedgerPosting {
  type: LedgerEntryType;
  account: LedgerAccount;
  accountRef: string;
  amountMinor: number; // signed integer
  currency: string;
  assignmentId?: string | null;
  paymentId?: string | null;
  payoutId?: string | null;
  description: string;
  idempotencyKey: string;
  createdByUserId?: string | null;
}

/**
 * Append-only ledger. Entries are idempotent by key so webhooks and retries
 * never double-post. Balances are always derived by summation.
 */
export async function post(entries: LedgerPosting[], tx?: Tx): Promise<void> {
  const executor = tx ?? db;
  for (const e of entries) {
    if (!Number.isInteger(e.amountMinor)) throw new Error("Ledger amounts must be integers in minor units");
    if (!/^[A-Z]{3}$/.test(e.currency)) throw new Error("Currency must be an ISO 4217 code");
  }
  await executor
    .insert(ledgerEntries)
    .values(
      entries.map((e) => ({
        type: e.type,
        account: e.account,
        accountRef: e.accountRef,
        amountMinor: e.amountMinor,
        currency: e.currency,
        assignmentId: e.assignmentId ?? null,
        paymentId: e.paymentId ?? null,
        payoutId: e.payoutId ?? null,
        description: e.description,
        idempotencyKey: e.idempotencyKey,
        createdByUserId: e.createdByUserId ?? null,
      })),
    )
    .onConflictDoNothing({ target: ledgerEntries.idempotencyKey });
}

export async function balance(account: LedgerAccount, accountRef: string, currency: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${ledgerEntries.amountMinor}), 0)` })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.account, account), eq(ledgerEntries.accountRef, accountRef), eq(ledgerEntries.currency, currency)));
  return Number(row?.total ?? 0);
}

export async function balancesByCurrency(account: LedgerAccount, accountRef: string): Promise<{ currency: string; amountMinor: number }[]> {
  const rows = await db
    .select({ currency: ledgerEntries.currency, total: sql<string>`coalesce(sum(${ledgerEntries.amountMinor}), 0)` })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.account, account), eq(ledgerEntries.accountRef, accountRef)))
    .groupBy(ledgerEntries.currency);
  return rows.map((r) => ({ currency: r.currency, amountMinor: Number(r.total) }));
}

/** Pure helper used by tests and reporting: derive a balance from entries in memory. */
export function sumEntries(entries: { amountMinor: number }[]): number {
  return entries.reduce((acc, e) => acc + e.amountMinor, 0);
}

/**
 * Postings for a captured customer payment: money enters platform escrow.
 * Fee and earnings are released on completion (see releasePostings).
 */
export function capturePostings(p: { paymentId: string; assignmentId: string; payerUserId: string; amountMinor: number; currency: string }): LedgerPosting[] {
  return [
    {
      type: "CUSTOMER_PAYMENT",
      account: "CUSTOMER",
      accountRef: p.payerUserId,
      amountMinor: -p.amountMinor,
      currency: p.currency,
      assignmentId: p.assignmentId,
      paymentId: p.paymentId,
      description: "Customer payment",
      idempotencyKey: `payment:${p.paymentId}:customer`,
    },
    {
      type: "CUSTOMER_PAYMENT",
      account: "PLATFORM_ESCROW",
      accountRef: "platform",
      amountMinor: p.amountMinor,
      currency: p.currency,
      assignmentId: p.assignmentId,
      paymentId: p.paymentId,
      description: "Customer payment held in escrow",
      idempotencyKey: `payment:${p.paymentId}:escrow`,
    },
  ];
}

export function releasePostings(p: { paymentId: string; assignmentId: string; professionalUserId: string; amountMinor: number; feeMinor: number; currency: string }): LedgerPosting[] {
  const earning = p.amountMinor - p.feeMinor;
  return [
    {
      type: "PLATFORM_FEE",
      account: "PLATFORM_ESCROW",
      accountRef: "platform",
      amountMinor: -p.amountMinor,
      currency: p.currency,
      assignmentId: p.assignmentId,
      paymentId: p.paymentId,
      description: "Escrow released on completion",
      idempotencyKey: `release:${p.paymentId}:escrow`,
    },
    {
      type: "PLATFORM_FEE",
      account: "PLATFORM_REVENUE",
      accountRef: "platform",
      amountMinor: p.feeMinor,
      currency: p.currency,
      assignmentId: p.assignmentId,
      paymentId: p.paymentId,
      description: "Marketplace commission",
      idempotencyKey: `release:${p.paymentId}:fee`,
    },
    {
      type: "PROFESSIONAL_EARNING",
      account: "PROFESSIONAL",
      accountRef: p.professionalUserId,
      amountMinor: earning,
      currency: p.currency,
      assignmentId: p.assignmentId,
      paymentId: p.paymentId,
      description: "Professional earning",
      idempotencyKey: `release:${p.paymentId}:earning`,
    },
  ];
}

export function refundPostings(p: { paymentId: string; assignmentId: string; payerUserId: string; amountMinor: number; currency: string; refundRef: string }): LedgerPosting[] {
  return [
    {
      type: "REFUND",
      account: "PLATFORM_ESCROW",
      accountRef: "platform",
      amountMinor: -p.amountMinor,
      currency: p.currency,
      assignmentId: p.assignmentId,
      paymentId: p.paymentId,
      description: "Refund to customer",
      idempotencyKey: `refund:${p.refundRef}:escrow`,
    },
    {
      type: "REFUND",
      account: "CUSTOMER",
      accountRef: p.payerUserId,
      amountMinor: p.amountMinor,
      currency: p.currency,
      assignmentId: p.assignmentId,
      paymentId: p.paymentId,
      description: "Refund received",
      idempotencyKey: `refund:${p.refundRef}:customer`,
    },
  ];
}

export function payoutPostings(p: { payoutId: string; professionalUserId: string; amountMinor: number; currency: string }): LedgerPosting[] {
  return [
    {
      type: "PAYOUT",
      account: "PROFESSIONAL",
      accountRef: p.professionalUserId,
      amountMinor: -p.amountMinor,
      currency: p.currency,
      payoutId: p.payoutId,
      description: "Payout to professional",
      idempotencyKey: `payout:${p.payoutId}`,
    },
  ];
}
