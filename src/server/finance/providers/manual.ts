import type { CheckoutRequest, CheckoutResult, InvoiceProvider, PaymentProvider, PaymentWebhookEvent, PayoutProvider, PayoutRequest } from "./types";

/**
 * Manual provider: used for development, tests and for deployments that settle
 * invoices outside the platform. Payments are marked captured by an authorized
 * action (customer confirmation in non-production, admin confirmation always).
 */
export class ManualPaymentProvider implements PaymentProvider {
  readonly name = "manual";
  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    return { providerRef: `manual_${req.paymentId}`, checkoutUrl: null, capturedImmediately: false };
  }
  async refund(providerRef: string): Promise<{ providerRef: string }> {
    return { providerRef: `${providerRef}_refund` };
  }
  async parseWebhook(): Promise<PaymentWebhookEvent[]> {
    return [{ kind: "ignored" }];
  }
}

export class ManualPayoutProvider implements PayoutProvider {
  readonly name = "manual";
  async createPayout(req: PayoutRequest): Promise<{ providerRef: string; status: "PROCESSING" | "PAID" }> {
    return { providerRef: `manual_payout_${req.payoutId}`, status: "PROCESSING" };
  }
}

export class NoopInvoiceProvider implements InvoiceProvider {
  readonly name = "noop";
  async createReceipt(): Promise<{ receiptRef: string | null }> {
    return { receiptRef: null };
  }
}
