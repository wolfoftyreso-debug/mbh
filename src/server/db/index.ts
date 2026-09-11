import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@/lib/config/env";

/**
 * Single database client. On Vercel each serverless instance keeps a tiny pool;
 * Neon pooled connection strings are recommended in production.
 */
declare global {
  var __humanauthSql: ReturnType<typeof postgres> | undefined;
}

const sqlClient =
  globalThis.__humanauthSql ??
  postgres(env.DATABASE_URL, {
    max: env.NODE_ENV === "production" ? 5 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });

if (env.NODE_ENV !== "production") {
  globalThis.__humanauthSql = sqlClient;
}

export const db = drizzle(sqlClient, { schema, casing: "snake_case" });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
