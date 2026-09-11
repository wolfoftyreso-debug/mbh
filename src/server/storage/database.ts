import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { fileBlobs } from "@/server/db/schema";
import type { StorageProvider } from "./provider";

/**
 * Stores file bytes in Postgres. Zero-configuration option that works on any
 * host (including Vercel + Neon) for modest file sizes. Larger deployments
 * should switch to the Vercel Blob provider.
 */
export class DatabaseStorage implements StorageProvider {
  readonly name = "database";

  async put(key: string, data: Uint8Array): Promise<void> {
    await db
      .insert(fileBlobs)
      .values({ key, data: Buffer.from(data).toString("base64") })
      .onConflictDoUpdate({ target: fileBlobs.key, set: { data: Buffer.from(data).toString("base64") } });
  }

  async get(key: string): Promise<Uint8Array | null> {
    const [row] = await db.select({ data: fileBlobs.data }).from(fileBlobs).where(eq(fileBlobs.key, key)).limit(1);
    return row ? new Uint8Array(Buffer.from(row.data, "base64")) : null;
  }

  async delete(key: string): Promise<void> {
    await db.delete(fileBlobs).where(eq(fileBlobs.key, key));
  }
}
