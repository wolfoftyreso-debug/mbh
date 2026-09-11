import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { rateLimitBuckets } from "@/server/db/schema";

export class RateLimitError extends Error {
  status = 429;
  constructor(public retryAfterSeconds: number) {
    super("Too many requests. Please slow down.");
    this.name = "RateLimitError";
  }
}

/**
 * Database-backed fixed-window rate limiter. Works across serverless instances
 * without an additional dependency. Keys should be scoped, e.g. "msg:<userId>".
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();
  const cutoffIso = new Date(now.getTime() - windowSeconds * 1000).toISOString();
  const rows = await db
    .insert(rateLimitBuckets)
    .values({ key, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: rateLimitBuckets.key,
      set: {
        count: sql`case when ${rateLimitBuckets.windowStart} < ${cutoffIso}::timestamptz then 1 else ${rateLimitBuckets.count} + 1 end`,
        windowStart: sql`case when ${rateLimitBuckets.windowStart} < ${cutoffIso}::timestamptz then ${nowIso}::timestamptz else ${rateLimitBuckets.windowStart} end`,
      },
    })
    .returning({ count: rateLimitBuckets.count, windowStart: rateLimitBuckets.windowStart });
  const row = rows[0];
  if (row && row.count > limit) {
    const retry = Math.max(1, Math.ceil((row.windowStart.getTime() + windowSeconds * 1000 - now.getTime()) / 1000));
    throw new RateLimitError(retry);
  }
}
