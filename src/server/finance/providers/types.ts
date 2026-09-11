/**
 * Payment abstractions. Domain logic depends only on these interfaces; the
 * configured provider is selected at runtime.
 */
export interface CheckoutRequest {
  paymentId: string;
  amountMinor: number;
  currency: string;
  description: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}

export interface CheckoutResult {
  providerRef: string;
  checkoutUrl: string | null;
  // Manual/test providers may capture immediately
  capturedImmediately: boolean;
}

export type PaymentWebhookEvent =
  | { kind: "captured"; providerRef: string; paymentId: string | null; amountMinor: number; currency: string }
  | { kind: "failed"; providerRef: string; paymentId: string | null; reason: string }
  | { kind: "refunded"; providerRef: string; paymentId: string | null; amountMinor: number }
  | { kind: "ignored" };

export interface PaymentProvider {
  readonly name: string;
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
  refund(providerRef: string, amountMinor: number, idempotencyKey: string): Promise<{ providerRef: string }>;
  parseWebhook(rawBody: string, signature: string | null): Promise<PaymentWebhookEvent[]>;
}

export interface PayoutRequest {
  payoutId: string;
  professionalUserId: string;
  amountMinor: number;
  currency: string;
}

export interface PayoutProvider {
  readonly name: string;
  createPayout(req: PayoutRequest): Promise<{ providerRef: string; status: "PROCESSING" | "PAID" }>;
}

export interface InvoiceProvider {
  readonly name: string;
  createReceipt(input: { paymentId: string; amountMinor: number; currency: string; customerEmail: string; description: string }): Promise<{ receiptRef: string | null }>;
}
