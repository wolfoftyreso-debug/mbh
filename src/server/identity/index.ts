import { env } from "@/lib/config/env";
import type { IdentityVerificationProvider } from "./provider";
import { ManualIdentityProvider } from "./manual";
import { StripeIdentityProvider } from "./stripe";

let instance: IdentityVerificationProvider | null = null;

export function getIdentityProvider(): IdentityVerificationProvider {
  if (instance) return instance;
  if (env.IDENTITY_PROVIDER === "stripe" && env.STRIPE_SECRET_KEY) {
    instance = new StripeIdentityProvider(env.STRIPE_SECRET_KEY, env.STRIPE_IDENTITY_WEBHOOK_SECRET ?? env.STRIPE_WEBHOOK_SECRET);
  } else {
    instance = new ManualIdentityProvider();
  }
  return instance;
}

export type { IdentityVerificationProvider };
