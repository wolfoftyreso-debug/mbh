import type { EmailMessage, EmailProvider } from "./adapter";
import { logger } from "@/server/logger";

/** Development provider: logs the subject only (never the body). */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  async send(message: EmailMessage): Promise<{ id: string | null }> {
    logger.info("email_would_send", { to: message.to, subject: message.subject });
    return { id: null };
  }
}
