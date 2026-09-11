import type Stripe from "stripe";
import type { IdentityVerificationProvider, IdentityStartResult, IdentityWebhookEvent } from "./provider";

/** Stripe Identity: hosted document + selfie verification. */
export class StripeIdentityProvider implements IdentityVerificationProvider {
  readonly name = "stripe";
  readonly hosted = true;
  private client: Stripe | null = null;

  constructor(
    private readonly secretKey: string,
    private readonly webhookSecret: string | undefined,
  ) {}

  private async stripe(): Promise<Stripe> {
    if (this.client) return this.client;
    const mod = await import("stripe");
    this.client = new mod.default(this.secretKey);
    return this.client;
  }

  async start(input: { userId: string; profileId: string; email: string; returnUrl: string }): Promise<IdentityStartResult> {
    const stripe = await this.stripe();
    const session = await stripe.identity.verificationSessions.create({
      type: "document",
      metadata: { userId: input.userId, profileId: input.profileId },
      provided_details: { email: input.email },
      return_url: input.returnUrl,
      options: { document: { require_matching_selfie: true, require_live_capture: true } },
    });
    return { provider: this.name, providerRef: session.id, redirectUrl: session.url ?? null };
  }

  async parseWebhook(rawBody: string, signature: string | null): Promise<IdentityWebhookEvent[]> {
    if (!this.webhookSecret || !signature) throw new Error("Identity webhook signature verification is not configured");
    const stripe = await this.stripe();
    const event = stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    switch (event.type) {
      case "identity.verification_session.verified": {
        const s = event.data.object as Stripe.Identity.VerificationSession;
        const full = await stripe.identity.verificationSessions.retrieve(s.id, { expand: ["verified_outputs"] });
        const name = full.verified_outputs ? [full.verified_outputs.first_name, full.verified_outputs.last_name].filter(Boolean).join(" ") : null;
        return [{ kind: "verified", providerRef: s.id, legalName: name || null }];
      }
      case "identity.verification_session.requires_input": {
        const s = event.data.object as Stripe.Identity.VerificationSession;
        return [{ kind: "failed", providerRef: s.id, reason: s.last_error?.reason ?? s.last_error?.code ?? "requires input" }];
      }
      case "identity.verification_session.canceled": {
        const s = event.data.object as Stripe.Identity.VerificationSession;
        return [{ kind: "failed", providerRef: s.id, reason: "canceled" }];
      }
      default:
        return [{ kind: "ignored" }];
    }
  }
}
