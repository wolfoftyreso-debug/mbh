import { NextResponse } from "next/server";
import { getIdentityProvider } from "@/server/identity";
import { applyHostedIdentityResult } from "@/server/identity/service";
import { logger } from "@/server/logger";

export const runtime = "nodejs";

/** Hosted identity provider webhooks (signature verified by the adapter). */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("stripe-signature") ?? req.headers.get("x-signature");
  let events;
  try {
    events = await getIdentityProvider().parseWebhook(raw, signature);
  } catch (err) {
    logger.warn("identity_webhook_rejected", { error: (err as Error).message });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  for (const ev of events) {
    if (ev.kind === "ignored") continue;
    try {
      if (ev.kind === "verified") await applyHostedIdentityResult(ev.providerRef, { verified: true, legalName: ev.legalName });
      else await applyHostedIdentityResult(ev.providerRef, { verified: false, reason: ev.reason });
    } catch (err) {
      logger.error("identity_webhook_failed", { kind: ev.kind, error: (err as Error).message });
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  }
  return NextResponse.json({ received: true });
}
