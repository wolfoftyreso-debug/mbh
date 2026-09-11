import { z } from "zod";

/**
 * Centralized, validated environment configuration. Secrets never leave the
 * server; only NEXT_PUBLIC_* values are exposed to the browser.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(16).default("insecure-development-secret-change-me"),
  BETTER_AUTH_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_SECRET: z.string().optional(),
  APPLE_APP_BUNDLE_IDENTIFIER: z.string().optional(),
  X_CLIENT_ID: z.string().optional(),
  X_CLIENT_SECRET: z.string().optional(),
  AUTH_DEV_LOGIN: z.string().optional(),
  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("HumanAuth <no-reply@example.com>"),
  SMS_PROVIDER: z.enum(["noop", "twilio"]).default("noop"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  STORAGE_PROVIDER: z.enum(["database", "local", "vercel-blob"]).default("database"),
  STORAGE_LOCAL_DIR: z.string().default(".data/storage"),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),
  MAX_AUDIO_UPLOAD_BYTES: z.coerce.number().int().positive().default(200 * 1024 * 1024),
  PAYMENT_PROVIDER: z.enum(["manual", "stripe"]).default("manual"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PLATFORM_COMMISSION_BPS: z.coerce.number().int().min(0).max(10000).default(1500),
  DEFAULT_CURRENCY: z.string().length(3).default("SEK"),
  AI_GATEWAY_URL: z.string().optional(),
  AI_GATEWAY_API_KEY: z.string().optional(),
  AI_DEFAULT_MODEL: z.string().optional(),
  AI_TRANSCRIPTION_MODEL: z.string().optional(),
  IP_HASH_SALT: z.string().default("development-salt"),
  BOOTSTRAP_ADMIN_EMAILS: z.string().default(""),
  RECORD_ID_PREFIX: z.string().default("HA"),
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Fail loudly at boot rather than at the first request.
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const e = parsed.data;
  return {
    ...e,
    isProd: e.NODE_ENV === "production",
    devLoginEnabled: e.NODE_ENV !== "production" && e.AUTH_DEV_LOGIN === "true",
    bootstrapAdminEmails: e.BOOTSTRAP_ADMIN_EMAILS.split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    aiConfigured: Boolean(e.AI_GATEWAY_URL && e.AI_GATEWAY_API_KEY),
  };
}

export const env = load();
export type Env = typeof env;
