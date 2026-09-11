import type { IdentityVerificationProvider, IdentityStartResult, IdentityWebhookEvent } from "./provider";

/** Platform staff review an uploaded identity document (default). */
export class ManualIdentityProvider implements IdentityVerificationProvider {
  readonly name = "manual";
  readonly hosted = false;
  async start(): Promise<IdentityStartResult> {
    return { provider: this.name, providerRef: "", redirectUrl: null };
  }
  async parseWebhook(): Promise<IdentityWebhookEvent[]> {
    return [{ kind: "ignored" }];
  }
}
