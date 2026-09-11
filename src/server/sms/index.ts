import { env } from "@/lib/config/env";
import type { SmsProvider } from "./adapter";
import { TwilioSmsProvider } from "./twilio";
import { logger } from "@/server/logger";

class NoopSmsProvider implements SmsProvider {
  readonly name = "noop";
  async send(to: string): Promise<{ id: string | null }> {
    logger.info("sms_skipped_no_provider", { to: to.slice(0, 4) + "…" });
    return { id: null };
  }
}

let instance: SmsProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (instance) return instance;
  if (env.SMS_PROVIDER === "twilio" && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER) {
    instance = new TwilioSmsProvider(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, env.TWILIO_FROM_NUMBER);
  } else {
    instance = new NoopSmsProvider();
  }
  return instance;
}
