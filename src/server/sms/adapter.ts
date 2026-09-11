export interface SmsProvider {
  readonly name: string;
  send(to: string, body: string): Promise<{ id: string | null }>;
}
