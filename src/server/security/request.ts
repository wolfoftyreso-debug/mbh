import { headers } from "next/headers";
import { env } from "@/lib/config/env";
import { hashIp } from "@/lib/hash";

/** Request metadata safe to store in audit / signature records (hashed IP, UA). */
export async function requestContext(): Promise<{ ipHash: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    return { ipHash: hashIp(ip, env.IP_HASH_SALT), userAgent: h.get("user-agent")?.slice(0, 250) ?? null };
  } catch {
    return { ipHash: null, userAgent: null };
  }
}
