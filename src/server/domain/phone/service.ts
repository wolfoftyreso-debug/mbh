import { and, eq } from "drizzle-orm";
import { createHash, randomInt } from "node:crypto";
import { db } from "@/server/db";
import { users, verifications } from "@/server/db/schema";
import { newId } from "@/lib/ids";
import { getSmsProvider } from "@/server/sms";
import { rateLimit } from "@/server/security/rate-limit";
import { ValidationError } from "@/server/security/errors";
import { audit } from "@/server/audit/log";
import { env } from "@/lib/config/env";
import { logger } from "@/server/logger";
import { brand } from "@/lib/config/brand";

const CODE_TTL_MS = 10 * 60 * 1000;

function hashCode(userId: string, code: string): string {
  return createHash("sha256").update(`${env.BETTER_AUTH_SECRET}:${userId}:${code}`).digest("hex");
}

function normalizePhone(raw: string): string {
  const p = raw.replace(/[\s()-]/g, "");
  if (!/^\+[1-9]\d{6,14}$/.test(p)) throw new ValidationError("Enter the number in international format, e.g. +46701234567");
  return p;
}

/** Sends a one-time code by SMS. The code is stored hashed with a short expiry. */
export async function requestPhoneCode(userId: string, phone: string): Promise<{ devCode: string | null }> {
  const normalized = normalizePhone(phone);
  await rateLimit(`phone-code:${userId}`, 5, 3600);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const identifier = `phone:${userId}`;
  await db.delete(verifications).where(eq(verifications.identifier, identifier));
  await db.insert(verifications).values({ id: newId(), identifier, value: `${normalized}|${hashCode(userId, code)}`, expiresAt: new Date(Date.now() + CODE_TTL_MS) });
  await db.update(users).set({ phone: normalized, phoneVerified: false }).where(eq(users.id, userId));
  const provider = getSmsProvider();
  await provider.send(normalized, `${brand.name}: your verification code is ${code}. It expires in 10 minutes.`);
  if (provider.name === "noop" && !env.isProd) {
    logger.info("phone_code_dev", { userId });
    return { devCode: code };
  }
  return { devCode: null };
}

export async function verifyPhoneCode(userId: string, code: string): Promise<void> {
  await rateLimit(`phone-verify:${userId}`, 10, 3600);
  const identifier = `phone:${userId}`;
  const [row] = await db.select().from(verifications).where(and(eq(verifications.identifier, identifier))).limit(1);
  if (!row || row.expiresAt < new Date()) throw new ValidationError("The code has expired. Request a new one.");
  const [phone, expectedHash] = row.value.split("|");
  if (hashCode(userId, code.trim()) !== expectedHash) throw new ValidationError("Incorrect code");
  await db.update(users).set({ phone, phoneVerified: true }).where(eq(users.id, userId));
  await db.delete(verifications).where(eq(verifications.identifier, identifier));
  await audit({ actorType: "USER", actorUserId: userId, action: "PROFILE_UPDATED", entityType: "user", entityId: userId, metadata: { phoneVerified: true } });
}
