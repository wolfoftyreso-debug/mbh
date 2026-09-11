import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getPaymentProvider } from "@/server/finance/providers";
import { capturePayment, failPayment } from "@/server/finance/payments";
import { db } from "@/server/db";
import { payments } from "@/server/db/schema";
import { logger } from "@/server/logger";

export const runtime = "nodejs";

/** Provider webhooks. Signature verification is delegated to the provider adapter. */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("stripe-signature") ?? req.headers.get("x-signature");
  let events;
  try {
    events = await getPaymentProvider().parseWebhook(raw, signature);
  } catch (err) {
    logger.warn("webhook_rejected", { error: (err as Error).message });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  for (const ev of events) {
    if (ev.kind === "ignored") continue;
    let paymentId = ev.paymentId;
    if (!paymentId && ev.providerRef) {
      const [p] = await db.select({ id: payments.id }).from(payments).where(eq(payments.providerRef, ev.providerRef)).limit(1);
      paymentId = p?.id ?? null;
    }
    if (!paymentId) continue;
    try {
      if (ev.kind === "captured") await capturePayment(paymentId, { actorType: "SYSTEM", actorUserId: null });
      else if (ev.kind === "failed") await failPayment(paymentId, ev.reason);
      else if (ev.kind === "refunded") logger.info("webhook_refund_seen", { paymentId });
    } catch (err) {
      logger.error("webhook_processing_failed", { paymentId, kind: ev.kind, error: (err as Error).message });
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  }
  return NextResponse.json({ received: true });
}
