/**
 * Identity verification abstraction. The manual provider is the platform's
 * own document-review queue; hosted providers (e.g. Stripe Identity) redirect
 * the professional to the provider and report back through a webhook.
 */
export interface IdentityStartResult {
  provider: string;
  providerRef: string;
  redirectUrl: string | null; // null → manual document upload flow
}

export type IdentityWebhookEvent =
  | { kind: "verified"; providerRef: string; legalName: string | null }
  | { kind: "failed"; providerRef: string; reason: string }
  | { kind: "ignored" };

export interface IdentityVerificationProvider {
  readonly name: string;
  readonly hosted: boolean;
  start(input: { userId: string; profileId: string; email: string; returnUrl: string }): Promise<IdentityStartResult>;
  parseWebhook(rawBody: string, signature: string | null): Promise<IdentityWebhookEvent[]>;
}
