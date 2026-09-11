import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/server/db";
import { accounts, sessions, users, verifications } from "@/server/db/schema";
import { env } from "@/lib/config/env";
import { brand } from "@/lib/config/brand";
import { onUserCreated } from "./hooks";

/**
 * Provider-based authentication. No custom password cryptography: Google, Apple
 * and X are the required providers; additional providers are added here.
 * A development-only email+password login exists for local testing and is
 * compiled out in production builds.
 */
const socialProviders: Record<string, unknown> = {};

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  };
}
if (env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET) {
  socialProviders.apple = {
    clientId: env.APPLE_CLIENT_ID,
    clientSecret: env.APPLE_CLIENT_SECRET,
    appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER,
  };
}
if (env.X_CLIENT_ID && env.X_CLIENT_SECRET) {
  socialProviders.twitter = {
    clientId: env.X_CLIENT_ID,
    clientSecret: env.X_CLIENT_SECRET,
  };
}

export const enabledProviders = {
  google: Boolean(socialProviders.google),
  apple: Boolean(socialProviders.apple),
  x: Boolean(socialProviders.twitter),
  devLogin: env.devLoginEnabled,
};

export const auth = betterAuth({
  appName: brand.name,
  baseURL: env.BETTER_AUTH_URL ?? env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: users, session: sessions, account: accounts, verification: verifications },
  }),
  socialProviders: socialProviders as never,
  emailAndPassword: {
    enabled: env.devLoginEnabled,
    minPasswordLength: 8,
  },
  account: {
    accountLinking: {
      enabled: true,
      // Only link automatically for providers that return verified e-mails.
      trustedProviders: ["google", "apple"],
    },
  },
  user: {
    additionalFields: {
      platformRole: { type: "string", required: false, defaultValue: "USER", input: false },
      locale: { type: "string", required: false, defaultValue: "en", input: true },
      timezone: { type: "string", required: false, defaultValue: "Europe/Stockholm", input: true },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14, // 14 days
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  advanced: {
    useSecureCookies: env.isProd,
    cookiePrefix: "ha",
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await onUserCreated(user.id, user.email);
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
