import type { SmsProvider } from "./adapter";

/** Twilio implementation via REST API (no SDK needed). */
export class TwilioSmsProvider implements SmsProvider {
  readonly name = "twilio";
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly from: string,
  ) {}

  async send(to: string, body: string): Promise<{ id: string | null }> {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        authorization: "Basic " + Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64"),
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: this.from, Body: body }),
    });
    if (!res.ok) throw new Error(`Twilio error ${res.status}`);
    const json = (await res.json()) as { sid?: string };
    return { id: json.sid ?? null };
  }
}
