import { VerificationBadge } from "@/components/ui/status-badge";

export const metadata = { title: "What verification means" };

const LEVELS: { status: string; means: string; notMeans: string }[] = [
  { status: "UNVERIFIED", means: "The profile exists and its information is self-declared by the professional.", notMeans: "No checks have been performed by the platform. Treat every claim as unverified." },
  { status: "IDENTITY_VERIFIED", means: "The platform reviewed an identity document and confirmed the professional's legal name matches the account.", notMeans: "Nothing about qualifications, expertise or quality of work has been checked." },
  { status: "CREDENTIALS_VERIFIED", means: "Identity is verified and at least one credential (education, certification, membership, employment) has been reviewed against documentation.", notMeans: "Only credentials individually marked 'Verified' were reviewed. Other claims on the profile remain self-declared." },
  { status: "PROFESSIONAL_VERIFIED", means: "Identity and credentials are verified, and the platform has reviewed evidence for the professional's declared expertise or language competence.", notMeans: "Verification is evidence of checks performed on documents. It is not a guarantee that any specific piece of work is accurate." },
  { status: "SUSPENDED", means: "The platform has temporarily suspended the professional. They cannot make offers or sign work.", notMeans: "Existing signed records remain visible with their status at signing time." },
  { status: "REVOKED", means: "Verification was withdrawn after review. Existing records keep the status that applied when they were signed.", notMeans: "Revocation does not retroactively change signed records; it is shown on the profile." },
];

export default function VerificationPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">What verification means</h1>
      <p className="mt-4 text-ink-2">Verification is evidence of checks performed by the platform on documents supplied by the professional. It is not a guarantee of accuracy, quality or truth. Self-declared information is always visually distinct from verified information.</p>
      <div className="mt-10 space-y-6">
        {LEVELS.map((l) => (
          <div key={l.status} className="rounded-lg border border-line bg-surface p-5">
            <VerificationBadge status={l.status} withLink={false} />
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-ink-3">What it means</p>
                <p className="mt-1 text-sm">{l.means}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-ink-3">What it does not mean</p>
                <p className="mt-1 text-sm text-ink-2">{l.notMeans}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <h2 className="mt-12 text-xl font-semibold">Claims versus verified claims</h2>
      <p className="mt-3 text-sm text-ink-2">A professional may list “Swedish teacher” on their profile. That is a claim. After the platform reviews documentation, the specific credential is marked verified. Expertise works the same way: a self-declared claim can become platform-verified only after evidence is reviewed. The platform never pretends to certify expertise it has not actually checked.</p>
      <h2 className="mt-10 text-xl font-semibold">Records and hashes</h2>
      <p className="mt-3 text-sm text-ink-2">A signed record contains a SHA-256 fingerprint of the exact signed version. The hash establishes the integrity of that artifact. It does not establish factual truth, originality, human authorship by itself, or copyright ownership.</p>
    </div>
  );
}
