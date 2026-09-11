import { env } from "@/lib/config/env";
import type { EmailProvider } from "./adapter";
import { ConsoleEmailProvider } from "./console";
import { ResendEmailProvider } from "./resend";

let instance: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (instance) return instance;
  if (env.EMAIL_PROVIDER === "resend" && env.RESEND_API_KEY) {
    instance = new ResendEmailProvider(env.RESEND_API_KEY, env.EMAIL_FROM);
  } else {
    instance = new ConsoleEmailProvider();
  }
  return instance;
}
