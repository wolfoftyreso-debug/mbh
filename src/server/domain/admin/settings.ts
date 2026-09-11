import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { platformSettings } from "@/server/db/schema";
import { env } from "@/lib/config/env";

export const SETTING_KEYS = ["commission_bps", "default_currency", "min_offer_minor", "content_access_grant_minutes", "strict_confidential_retention_days"] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

const DEFAULTS: Record<SettingKey, unknown> = {
  commission_bps: env.PLATFORM_COMMISSION_BPS,
  default_currency: env.DEFAULT_CURRENCY,
  min_offer_minor: 10000,
  content_access_grant_minutes: 60,
  strict_confidential_retention_days: 90,
};

export async function getPlatformSetting(key: SettingKey): Promise<unknown> {
  const [row] = await db.select({ value: platformSettings.value }).from(platformSettings).where(eq(platformSettings.key, key)).limit(1);
  return row ? row.value : DEFAULTS[key];
}

export async function getAllSettings(): Promise<{ key: SettingKey; value: unknown; isDefault: boolean }[]> {
  const rows = await db.select().from(platformSettings);
  return SETTING_KEYS.map((key) => {
    const row = rows.find((r) => r.key === key);
    return { key, value: row ? row.value : DEFAULTS[key], isDefault: !row };
  });
}

export async function setPlatformSetting(key: SettingKey, value: unknown, userId: string): Promise<void> {
  await db
    .insert(platformSettings)
    .values({ key, value, updatedByUserId: userId, updatedAt: new Date() })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedByUserId: userId, updatedAt: new Date() } });
}
