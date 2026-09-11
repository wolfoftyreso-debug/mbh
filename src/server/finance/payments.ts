import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { assignments, payments, payouts, users } from "@/server/db/schema";
import { env } from "@/lib/config/env";
import { formatMoney, platformFee } from "@/lib/money";
import { audit } from "@/server/audit/log";
import { ConflictError, ValidationError } from "@/server/security/errors";
import { notify } from "@/server/notifications/service";
import { getPaymentProvider, getPayoutProvider } from "./providers";
import { balance, capturePostings, payoutPostings, post, refundPostings, releasePostings } from "./ledger";
import { getPlatformSetting } from "@/server/domain/admin/settings";

/**
 * Initiates a checkout for an accepted assignment. Idempotent per assignment:
 * an existing pending/captured payment is returned instead of creating another.
 */
export async function startCheckout(input: { assignmentId: string; payerUserId: string; organizationId: string | null; email: string }): Promise<{ paymentId: string; checkoutUrl: string | null; status: string }> {
  const [assignment] = await db.select().from(assignments).where(eq(assignments.id, input.assignmentId)).limit(1);
  if (!assignment) throw new ValidationError("Assignment not found");
  if (!assignment.agreedPriceMinor || assignment.agreedPriceMinor <= 0) throw new ValidationError("There is no agreed price to pay yet");

  const existing = await db
    .select()
    .from(payments)
    .where(and(eq(payments.assignmentId, assignment.id), eq(payments.status, "CAPTURED")))
    .limit(1);
  if (existing[0]) return { paymentId: existing[0].id, checkoutUrl: null, status: "CAPTURED" };

  const pending = await db
    .select()
    .from(payments)
    .where(and(eq(payments.assignmentId, assignment.id), eq(payments.status, "PENDING")))
    .limit(1);
  if (pending[0]?.providerCheckoutUrl) return { paymentId: pending[0].id, checkoutUrl: pending[0].providerCheckoutUrl, status: "PENDING" };

  const commissionBps = Number((await getPlatformSetting("commission_bps")) ?? env.PLATFORM_COMMISSION_BPS);
  const amount = assignment.agreedPriceMinor;
  const fee = platformFee(amount, commissionBps);
  const idempotencyKey = `checkout:${assignment.id}:${amount}:${assignment.currency}`;

  const [payment] = await db
    .insert(payments)
    .values({
      assignmentId: assignment.id,
      payerUserId: input.payerUserId,
      organizationId: input.organizationId,
      provider: getPaymentProvider().name,
      amountMinor: amount,
      platformFeeMinor: fee,
      currency: assignment.currency,
      status: "PENDING",
      idempotencyKey,
    })
    .onConflictDoNothing({ target: payments.idempotencyKey })
    .returning();
  const row = payment ?? (await db.select().from(payments).where(eq(payments.idempotencyKey, idempotencyKey)).limit(1))[0];

  const provider = getPaymentProvider();
  const checkout = await provider.createCheckout({
    paymentId: row.id,
    amountMinor: amount,
    currency: assignment.currency,
    description: `Assignment: ${assignment.title.slice(0, 80)}`,
    customerEmail: input.email,
    successUrl: `${env.APP_URL}/assignments/${assignment.publicId}?payment=success`,
    cancelUrl: `${env.APP_URL}/assignments/${assignment.publicId}?payment=cancelled`,
    idempotencyKey,
  });

  await db.update(payments).set({ providerRef: checkout.providerRef, providerCheckoutUrl: checkout.checkoutUrl }).where(eq(payments.id, row.id));
  await audit({ actorType: "USER", actorUserId: input.payerUserId, action: "PAYMENT_INITIATED", entityType: "payment", entityId: row.id, assignmentId: assignment.id, metadata: { amountMinor: amount, currency: assignment.currency, provider: provider.name } });

  if (checkout.capturedImmediately) {
    await capturePayment(row.id, { actorType: "SYSTEM", actorUserId: null });
    return { paymentId: row.id, checkoutUrl: null, status: "CAPTURED" };
  }
  return { paymentId: row.id, checkoutUrl: checkout.checkoutUrl, status: "PENDING" };
}

/** Marks a payment captured and posts ledger entries. Idempotent. */
export async function capturePayment(paymentId: string, actor: { actorType: "USER" | "ADMIN" | "SYSTEM"; actorUserId: string | null }): Promise<void> {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment) throw new ValidationError("Payment not found");
  if (payment.status === "CAPTURED") return;
  if (payment.status !== "PENDING" && payment.status !== "AUTHORIZED") throw new ConflictError(`Payment is ${payment.status}`);

  await db.transaction(async (tx) => {
    await tx.update(payments).set({ status: "CAPTURED", capturedAt: new Date() }).where(eq(payments.id, paymentId));
    await post(capturePostings({ paymentId, assignmentId: payment.assignmentId, payerUserId: payment.payerUserId, amountMinor: payment.amountMinor, currency: payment.currency }), tx);
    await audit({ ...actor, action: "PAYMENT_CAPTURED", entityType: "payment", entityId: paymentId, assignmentId: payment.assignmentId, metadata: { amountMinor: payment.amountMinor, currency: payment.currency } }, tx);
  });

  const [assignment] = await db.select().from(assignments).where(eq(assignments.id, payment.assignmentId)).limit(1);
  if (assignment) {
    await notify(payment.payerUserId, "PAYMENT_RECEIPT", { title: assignment.title, publicId: assignment.publicId, amount: formatMoney(payment.amountMinor, payment.currency), reference: paymentId });
    // Move the assignment forward if it was waiting for payment
    if (assignment.status === "ACCEPTED") {
      const { transitionAssignment } = await import("@/server/domain/assignments/service");
      await transitionAssignment(assignment.id, "IN_PROGRESS", "SYSTEM", null, "Payment secured");
    }
    if (assignment.status === "CUSTOMER_APPROVED") {
      const { completeAssignment } = await import("@/server/domain/assignments/service");
      await completeAssignment(assignment.id, "SYSTEM", null);
    }
  }
}

export async function failPayment(paymentId: string, reason: string): Promise<void> {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment || payment.status === "CAPTURED") return;
  await db.update(payments).set({ status: "FAILED", failureReason: reason.slice(0, 200) }).where(eq(payments.id, paymentId));
  await audit({ actorType: "SYSTEM", action: "PAYMENT_FAILED", entityType: "payment", entityId: paymentId, assignmentId: payment.assignmentId, metadata: { reason } });
}

/** Releases escrow to platform revenue and professional balance on completion. Idempotent. */
export async function releaseEscrow(assignmentId: string): Promise<void> {
  const [assignment] = await db.select().from(assignments).where(eq(assignments.id, assignmentId)).limit(1);
  if (!assignment?.primaryProfessionalUserId) return;
  const captured = await db
    .select()
    .from(payments)
    .where(and(eq(payments.assignmentId, assignmentId), eq(payments.status, "CAPTURED")));
  for (const p of captured) {
    const refundable = p.amountMinor - p.refundedMinor;
    if (refundable <= 0) continue;
    const fee = Math.min(p.platformFeeMinor, refundable);
    await post(releasePostings({ paymentId: p.id, assignmentId, professionalUserId: assignment.primaryProfessionalUserId, amountMinor: refundable, feeMinor: fee, currency: p.currency }));
  }
}

export async function refundPayment(paymentId: string, amountMinor: number, actor: { actorUserId: string; reason: string }): Promise<void> {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment) throw new ValidationError("Payment not found");
  if (payment.status !== "CAPTURED" && payment.status !== "PARTIALLY_REFUNDED") throw new ConflictError("Only captured payments can be refunded");
  if (!Number.isInteger(amountMinor) || amountMinor <= 0 || amountMinor > payment.amountMinor - payment.refundedMinor) throw new ValidationError("Invalid refund amount");
  const key = `refund:${paymentId}:${payment.refundedMinor + amountMinor}`;
  const result = await getPaymentProvider().refund(payment.providerRef ?? paymentId, amountMinor, key);
  const newRefunded = payment.refundedMinor + amountMinor;
  await db.transaction(async (tx) => {
    await tx.update(payments).set({ refundedMinor: newRefunded, status: newRefunded >= payment.amountMinor ? "REFUNDED" : "PARTIALLY_REFUNDED" }).where(eq(payments.id, paymentId));
    await post(refundPostings({ paymentId, assignmentId: payment.assignmentId, payerUserId: payment.payerUserId, amountMinor, currency: payment.currency, refundRef: result.providerRef }), tx);
    await audit({ actorType: "ADMIN", actorUserId: actor.actorUserId, action: "REFUND_CREATED", entityType: "payment", entityId: paymentId, assignmentId: payment.assignmentId, metadata: { amountMinor, currency: payment.currency, reason: actor.reason } }, tx);
  });
}

export async function createPayout(professionalUserId: string, currency: string, actorUserId: string | null): Promise<string> {
  const available = await balance("PROFESSIONAL", professionalUserId, currency);
  if (available <= 0) throw new ValidationError("No balance available for payout");
  const [row] = await db
    .insert(payouts)
    .values({ professionalUserId, amountMinor: available, currency, provider: getPayoutProvider().name, status: "PENDING", requestedByUserId: actorUserId })
    .returning();
  const result = await getPayoutProvider().createPayout({ payoutId: row.id, professionalUserId, amountMinor: available, currency });
  await db.transaction(async (tx) => {
    await tx.update(payouts).set({ providerRef: result.providerRef, status: result.status, paidAt: result.status === "PAID" ? new Date() : null }).where(eq(payouts.id, row.id));
    await post(payoutPostings({ payoutId: row.id, professionalUserId, amountMinor: available, currency }), tx);
    await audit({ actorType: actorUserId ? "ADMIN" : "SYSTEM", actorUserId, action: "PAYOUT_CREATED", entityType: "payout", entityId: row.id, metadata: { amountMinor: available, currency } }, tx);
  });
  await notify(professionalUserId, "PAYOUT_NOTIFICATION", { amount: formatMoney(available, currency), status: result.status === "PAID" ? "paid" : "being processed" });
  return row.id;
}

export async function markPayoutPaid(payoutId: string, actorUserId: string): Promise<void> {
  const [row] = await db.select().from(payouts).where(eq(payouts.id, payoutId)).limit(1);
  if (!row) throw new ValidationError("Payout not found");
  if (row.status === "PAID") return;
  await db.update(payouts).set({ status: "PAID", paidAt: new Date() }).where(eq(payouts.id, payoutId));
  await audit({ actorType: "ADMIN", actorUserId, action: "PAYOUT_PAID", entityType: "payout", entityId: payoutId, metadata: { amountMinor: row.amountMinor, currency: row.currency } });
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, row.professionalUserId)).limit(1);
  if (u) await notify(u.id, "PAYOUT_NOTIFICATION", { amount: formatMoney(row.amountMinor, row.currency), status: "paid" });
}

export async function assignmentPaymentState(assignmentId: string): Promise<{ captured: boolean; pending: boolean; payment: typeof payments.$inferSelect | null }> {
  const rows = await db.select().from(payments).where(eq(payments.assignmentId, assignmentId));
  const captured = rows.find((p) => p.status === "CAPTURED" || p.status === "PARTIALLY_REFUNDED");
  const pending = rows.find((p) => p.status === "PENDING");
  return { captured: Boolean(captured), pending: Boolean(pending), payment: captured ?? pending ?? null };
}
