export const metadata = { title: "How it works" };

const STEPS = [
  ["Describe what you need", "Choose a service, add your source material — text, documents, a URL or a voice recording — and set the confidentiality level. The form only asks what is necessary."],
  ["Find the right competence", "Search or get matched. The platform distinguishes language competence from domain expertise and never recommends more competence than the work needs."],
  ["Work together in one place", "Each assignment has a private workspace: conversation, files and versions side by side. Every delivery creates a new version. Nothing is overwritten."],
  ["Review, comment, revise", "Reviewers anchor structured comments to the text: language, factual, terminology, domain, legal risk. Domain reviewers use explicit verdicts such as incorrect, misleading or imprecise."],
  ["Final human sign-off", "The professional deliberately signs the exact version shown, including its cryptographic fingerprint. The signed version becomes immutable."],
  ["Publish with a record", "A permanent authorship record is created. You decide whether it is private, anonymized or public, and whether to embed an attribution on your site."],
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">How it works</h1>
      <p className="mt-4 text-ink-2">AI may assist the workflow. AI never impersonates the professional. The professional must genuinely perform the service that the record claims.</p>
      <ol className="mt-10 space-y-8">
        {STEPS.map(([t, d], i) => (
          <li key={t} className="flex gap-5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">{i + 1}</span>
            <div>
              <h2 className="font-semibold">{t}</h2>
              <p className="mt-1 text-sm text-ink-2">{d}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-12 rounded-lg border border-line bg-surface p-6">
        <h2 className="font-semibold">What a record does not claim</h2>
        <p className="mt-2 text-sm text-ink-2">A record establishes who performed a defined service on an exact version, when, and what their verification status was. It does not claim that the text is factually true, original, free of AI assistance in the source material, or that the platform owns copyright. Those concepts are never conflated.</p>
      </div>
    </div>
  );
}
