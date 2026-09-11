import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicRecord } from "@/server/domain/signing/service";
import { PUBLIC_RECORD_ID_PATTERN } from "@/lib/ids";
import { VerifyForm } from "@/components/records/verify-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify against record", robots: { index: false } };

export default async function VerifyPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const r = PUBLIC_RECORD_ID_PATTERN.test(publicId) ? await getPublicRecord(publicId) : null;
  if (!r) notFound();
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <p className="text-xs uppercase tracking-wider text-ink-3">Record <span className="mono">{r.publicId}</span></p>
      <h1 className="mt-2 text-2xl font-semibold">Check content against the signed version</h1>
      <p className="mt-3 text-sm text-ink-2">Paste the text or upload the file you have. We compute its fingerprint on the server and compare it with the hash stored at signing. Whitespace and line-ending differences are ignored; any change to the words is detected.</p>
      {r.contentHash ? <VerifyForm publicId={r.publicId} /> : <p className="mt-6 rounded-md bg-surface-2 px-4 py-3 text-sm text-ink-2">The customer has not made the fingerprint of this record public, so comparison is not available.</p>}
      <p className="mt-6 text-sm"><Link href={`/record/${r.publicId}`} className="text-accent underline-offset-4 hover:underline">← Back to record</Link></p>
    </div>
  );
}
