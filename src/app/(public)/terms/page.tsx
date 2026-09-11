import { brand, AGREEMENT_VERSIONS } from "@/lib/config/brand";

export const metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-sm text-ink-2">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Terms of service</h1>
      <p className="mt-2 text-xs text-ink-3">Version {AGREEMENT_VERSIONS.TERMS_OF_SERVICE}</p>
      <p className="mt-6">{brand.name} is a marketplace that connects customers with verified human professionals. The platform provides the workspace, versioning, signing and record infrastructure. Professionals are independent and are responsible for genuinely performing the service they sign for.</p>
      <h2 className="mt-8 font-semibold text-ink">Authorship records</h2>
      <p className="mt-2">A record documents that a named professional performed a defined service on an exact artifact version at a given time. It is not a guarantee of factual accuracy, originality or fitness for any purpose.</p>
      <h2 className="mt-8 font-semibold text-ink">Payments</h2>
      <p className="mt-2">Customer payments are held by the platform until an assignment is completed. The platform retains a marketplace commission. Refunds and disputes are handled according to the dispute process.</p>
      <h2 className="mt-8 font-semibold text-ink">Prohibited use</h2>
      <p className="mt-2">The platform may not be used to disguise AI-generated content as human work, to circumvent plagiarism checks, to fabricate credentials or reviews, or to obtain sign-off for content the professional has not actually reviewed.</p>
      <p className="mt-8 text-xs text-ink-3">These terms will be replaced by the final legal text supplied with the public brand.</p>
    </div>
  );
}
