import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/config/env";
import { runRetention } from "@/server/jobs/retention";
import { runPublicationMonitor } from "@/server/jobs/publication-monitor";
import { runHousekeeping } from "@/server/jobs/housekeeping";
import { logger } from "@/server/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Scheduled jobs, invoked by Vercel Cron (see vercel.json) or any scheduler
 * that presents `Authorization: Bearer $CRON_SECRET`.
 */
function authorized(req: Request): boolean {
  if (!env.CRON_SECRET) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.CRON_SECRET}`;
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

export async function GET(req: Request, { params }: { params: Promise<{ job: string }> }) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { job } = await params;
  try {
    switch (job) {
      case "retention":
        return NextResponse.json({ ok: true, job, result: await runRetention() });
      case "publication-monitor":
        return NextResponse.json({ ok: true, job, result: await runPublicationMonitor() });
      case "housekeeping":
        return NextResponse.json({ ok: true, job, result: await runHousekeeping() });
      default:
        return NextResponse.json({ error: "Unknown job" }, { status: 404 });
    }
  } catch (err) {
    logger.error("cron_job_failed", { job, error: (err as Error).message });
    return NextResponse.json({ ok: false, job }, { status: 500 });
  }
}
