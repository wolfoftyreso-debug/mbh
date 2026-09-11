import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "@/server/db";
import { artifactVersions, authorshipRecords, publishedWorks } from "@/server/db/schema";
import { canonicalizeText } from "@/lib/hash";
import { logger } from "@/server/logger";

export type CheckState = "MATCHES" | "CHANGED" | "UNREACHABLE";

/** Strips markup and collapses whitespace so signed text can be located inside a rendered page. */
export function htmlToComparableText(html: string): string {
  return canonicalizeText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'"),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** A page "matches" when the signed text (whitespace-normalized) appears in it verbatim. */
export function pageContainsSignedText(pageHtml: string, signedText: string): boolean {
  const page = htmlToComparableText(pageHtml);
  const signed = canonicalizeText(signedText).replace(/\s+/g, " ").trim();
  return signed.length > 0 && page.includes(signed);
}

async function fetchPage(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    const res = await fetch(url, { signal: controller.signal, headers: { "user-agent": "HumanAuth-PublicationMonitor/1.0", accept: "text/html,*/*" }, redirect: "follow" });
    if (!res.ok) return null;
    const reader = res.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < 2_000_000) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
      }
    }
    await reader.cancel().catch(() => undefined);
    return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Checks published works whose last check is older than `intervalDays` (or never).
 * The original record is never modified; only the published_work check state.
 */
export async function runPublicationMonitor(opts: { intervalDays?: number; limit?: number; fetcher?: (url: string) => Promise<string | null> } = {}): Promise<{ checked: number; matches: number; changed: number; unreachable: number }> {
  const intervalDays = opts.intervalDays ?? 7;
  const cutoff = new Date(Date.now() - intervalDays * 86400000);
  const fetcher = opts.fetcher ?? fetchPage;
  const rows = await db
    .select({ work: publishedWorks, versionId: authorshipRecords.versionId, hashPublic: authorshipRecords.hashPublic, visibility: authorshipRecords.visibility })
    .from(publishedWorks)
    .innerJoin(authorshipRecords, eq(authorshipRecords.id, publishedWorks.recordId))
    .where(or(isNull(publishedWorks.lastCheckedAt), lt(publishedWorks.lastCheckedAt, cutoff)))
    .limit(opts.limit ?? 100);
  const stats = { checked: 0, matches: 0, changed: 0, unreachable: 0 };
  for (const r of rows) {
    const [version] = await db.select({ content: artifactVersions.content }).from(artifactVersions).where(and(eq(artifactVersions.id, r.versionId))).limit(1);
    let state: CheckState = "UNREACHABLE";
    if (version?.content) {
      const html = await fetcher(r.work.url);
      if (html !== null) state = pageContainsSignedText(html, version.content) ? "MATCHES" : "CHANGED";
    } else {
      // File-only or retention-cleared versions cannot be compared; record reachability only.
      const html = await fetcher(r.work.url);
      state = html === null ? "UNREACHABLE" : "CHANGED";
    }
    await db.update(publishedWorks).set({ lastCheckedAt: new Date(), lastVerifiedState: state }).where(eq(publishedWorks.id, r.work.id));
    stats.checked++;
    if (state === "MATCHES") stats.matches++;
    else if (state === "CHANGED") stats.changed++;
    else stats.unreachable++;
  }
  logger.info("publication_monitor_completed", { ...stats });
  return stats;
}
