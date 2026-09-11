import type { EmailMessage, EmailProvider } from "./adapter";

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<{ id: string | null }> {
    const { Resend } = await import("resend");
    const client = new Resend(this.apiKey);
    const { data, error } = await client.emails.send({
      from: this.from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo,
      tags: message.tags ? Object.entries(message.tags).map(([name, value]) => ({ name, value })) : undefined,
    });
    if (error) throw new Error(`Resend error: ${error.message}`);
    return { id: data?.id ?? null };
  }
}
