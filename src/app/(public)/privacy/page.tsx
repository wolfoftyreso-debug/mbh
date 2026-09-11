import { brand } from "@/lib/config/brand";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-sm text-ink-2">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Privacy</h1>
      <p className="mt-6">{brand.name} separates public profile data, private account data, verification documents, customer work, financial data and audit data. Verification documents are never public, are retained for a limited period and are accessible only to reviewers with a documented reason.</p>
      <h2 className="mt-8 font-semibold text-ink">Your rights</h2>
      <p className="mt-2">You can export your data and request deletion from your settings. Some records must be retained for legitimate financial, legal or security reasons; in that case content is removed and only minimal transactional metadata is kept.</p>
      <h2 className="mt-8 font-semibold text-ink">AI processing</h2>
      <p className="mt-2">Assignment content is only sent to AI providers when the assignment&apos;s AI policy permits it. Every AI request is logged with the policy that applied at the time.</p>
      <p className="mt-8 text-xs text-ink-3">This page will be replaced by the final privacy notice supplied with the public brand.</p>
    </div>
  );
}
