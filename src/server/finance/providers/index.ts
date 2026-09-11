import { env } from "@/lib/config/env";
import type { InvoiceProvider, PaymentProvider, PayoutProvider } from "./types";
import { ManualPaymentProvider, ManualPayoutProvider, NoopInvoiceProvider } from "./manual";
import { StripePaymentProvider } from "./stripe";

let payment: PaymentProvider | null = null;
let payout: PayoutProvider | null = null;
let invoice: InvoiceProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (payment) return payment;
  if (env.PAYMENT_PROVIDER === "stripe" && env.STRIPE_SECRET_KEY) {
    payment = new StripePaymentProvider(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET);
  } else {
    payment = new ManualPaymentProvider();
  }
  return payment;
}

export function getPayoutProvider(): PayoutProvider {
  if (payout) return payout;
  payout = new ManualPayoutProvider();
  return payout;
}

export function getInvoiceProvider(): InvoiceProvider {
  if (invoice) return invoice;
  invoice = new NoopInvoiceProvider();
  return invoice;
}

export type { PaymentProvider, PayoutProvider, InvoiceProvider };
