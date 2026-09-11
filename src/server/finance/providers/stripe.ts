import type Stripe from "stripe";
import type { CheckoutRequest, CheckoutResult, PaymentProvider, PaymentWebhookEvent } from "./types";

export class StripePaymentProvider implements PaymentProvider {
  readonly name = "stripe";
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

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const stripe = await this.stripe();
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: req.customerEmail,
        line_items: [
          {
            quantity: 1,
            price_data: { currency: req.currency.toLowerCase(), unit_amount: req.amountMinor, product_data: { name: req.description } },
          },
        ],
        metadata: { paymentId: req.paymentId },
        payment_intent_data: { metadata: { paymentId: req.paymentId } },
        success_url: req.successUrl,
        cancel_url: req.cancelUrl,
      },
      { idempotencyKey: req.idempotencyKey },
    );
    return { providerRef: session.id, checkoutUrl: session.url, capturedImmediately: false };
  }

  async refund(providerRef: string, amountMinor: number, idempotencyKey: string): Promise<{ providerRef: string }> {
    const stripe = await this.stripe();
    const session = await stripe.checkout.sessions.retrieve(providerRef);
    const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!intent) throw new Error("No payment intent for session");
    const refund = await stripe.refunds.create({ payment_intent: intent, amount: amountMinor }, { idempotencyKey });
    return { providerRef: refund.id };
  }

  async parseWebhook(rawBody: string, signature: string | null): Promise<PaymentWebhookEvent[]> {
    if (!this.webhookSecret || !signature) throw new Error("Webhook signature verification is not configured");
    const stripe = await this.stripe();
    const event = stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.payment_status !== "paid") return [{ kind: "ignored" }];
        return [{ kind: "captured", providerRef: s.id, paymentId: s.metadata?.paymentId ?? null, amountMinor: s.amount_total ?? 0, currency: (s.currency ?? "").toUpperCase() }];
      }
      case "checkout.session.async_payment_failed": {
        const s = event.data.object as Stripe.Checkout.Session;
        return [{ kind: "failed", providerRef: s.id, paymentId: s.metadata?.paymentId ?? null, reason: "async payment failed" }];
      }
      case "charge.refunded": {
        const c = event.data.object as Stripe.Charge;
        return [{ kind: "refunded", providerRef: typeof c.payment_intent === "string" ? c.payment_intent : "", paymentId: c.metadata?.paymentId ?? null, amountMinor: c.amount_refunded }];
      }
      default:
        return [{ kind: "ignored" }];
    }
  }
}
