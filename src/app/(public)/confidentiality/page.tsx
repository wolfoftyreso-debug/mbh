import { CONFIDENTIALITY_COPY } from "@/server/ai/policy";

export const metadata = { title: "Confidentiality" };

export default function ConfidentialityPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Confidentiality</h1>
      <p className="mt-4 text-ink-2">Everything customer-specific is private by default. Publication requires an explicit, authorized action. Every assignment carries a confidentiality level and an AI-processing policy that the platform enforces server-side.</p>
      <div className="mt-10 space-y-4">
        {(Object.keys(CONFIDENTIALITY_COPY) as (keyof typeof CONFIDENTIALITY_COPY)[]).map((k) => (
          <div key={k} className="rounded-lg border border-line bg-surface p-5">
            <h2 className="font-semibold">{CONFIDENTIALITY_COPY[k].label}</h2>
            <p className="mt-1 text-sm">{CONFIDENTIALITY_COPY[k].short}</p>
            <p className="mt-2 text-sm text-ink-2">{CONFIDENTIALITY_COPY[k].detail}</p>
          </div>
        ))}
      </div>
      <h2 className="mt-12 text-xl font-semibold">Principles</h2>
      <ul className="mt-4 space-y-2 text-sm text-ink-2">
        {["Private by default", "Public by explicit intent", "AI processing by policy", "Access by authorization", "Attribution by consent", "Signature by deliberate human action"].map((p) => (
          <li key={p} className="flex gap-2"><span className="text-accent">—</span>{p}</li>
        ))}
      </ul>
      <h2 className="mt-12 text-xl font-semibold">Professionals and third-party tools</h2>
      <p className="mt-3 text-sm text-ink-2">Professionals accept a confidentiality agreement before they can make offers. Customer material may not be disclosed, sold, published, copied unnecessarily, used to train external systems, uploaded to unauthorized third-party services (including external AI assistants, translation or grammar tools) or added to portfolios without permission. Where AI assistance is permitted, it runs through the platform so processing stays governed by your policy.</p>
      <h2 className="mt-12 text-xl font-semibold">Platform staff</h2>
      <p className="mt-3 text-sm text-ink-2">Administrators do not have routine access to customer work. Content access requires a documented reason (support request, dispute, abuse investigation, legal requirement, security incident), is time-limited, creates an audit event and is visible in the assignment&apos;s history.</p>
    </div>
  );
}
