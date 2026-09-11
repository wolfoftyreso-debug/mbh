import { getPublicRecord } from "@/server/domain/signing/service";
import { PUBLIC_RECORD_ID_PATTERN } from "@/lib/ids";
import { env } from "@/lib/config/env";
import { brand } from "@/lib/config/brand";
import { humanize } from "@/lib/utils";

export const runtime = "nodejs";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Minimal attribution embed for customer websites (iframe-able). Shows only
 * data the record already exposes publicly. A future JS component can reuse
 * the same data through a JSON endpoint.
 */
export async function GET(req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const wantsJson = new URL(req.url).searchParams.get("format") === "json";
  const record = PUBLIC_RECORD_ID_PATTERN.test(publicId) ? await getPublicRecord(publicId) : null;
  if (!record) return new Response(wantsJson ? JSON.stringify({ error: "not found" }) : "Not found", { status: 404, headers: { "content-type": wantsJson ? "application/json" : "text/plain" } });
  const recordUrl = `${env.APP_URL}/record/${record.publicId}`;
  if (wantsJson) {
    return Response.json({ publicId: record.publicId, status: record.status, professionalName: record.professionalName, servicePerformed: record.servicePerformed, contributionRole: record.contributionRole, signedAt: record.signedAt, verificationStatusAtSigning: record.verificationStatusAtSigning, recordUrl }, { headers: { "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
  }
  const roleLabel = record.contributionRole === "AUTHOR" ? "Written by" : record.contributionRole === "DOMAIN_REVIEWER" ? "Expert review by" : record.contributionRole === "FINAL_APPROVER" ? "Approved by" : `${humanize(record.contributionRole)} by`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(brand.name)} attribution</title>
<style>body{margin:0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:transparent}.card{display:flex;gap:12px;align-items:center;border:1px solid #e4e2db;border-radius:10px;padding:10px 14px;background:#fff;color:#17171a;max-width:420px}.mark{width:28px;height:28px;border-radius:7px;background:#145c3a;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex:none}.t{font-size:12px;color:#7c7c82;margin:0}.n{font-size:14px;font-weight:600;margin:1px 0}.v{font-size:12px;color:#145c3a;margin:0}.v.r{color:#9b2c2c}a{color:inherit;text-decoration:none}a:hover .n{text-decoration:underline}</style></head>
<body><a class="card" href="${esc(recordUrl)}" target="_top" rel="noopener"><span class="mark">${esc(brand.name.slice(0, 1))}</span><span><p class="t">${esc(roleLabel)}</p><p class="n">${esc(record.professionalName)}</p><p class="v${record.status !== "VALID" ? " r" : ""}">${record.status === "VALID" ? `${esc(humanize(record.verificationStatusAtSigning))} · View record` : "Record " + esc(record.status.toLowerCase())}</p></span></a></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors *" } });
}
