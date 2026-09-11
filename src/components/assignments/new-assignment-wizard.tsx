"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createAssignmentAction, inviteProfessionalAction, suggestBriefAction, type CreateAssignmentPayload } from "@/server/actions/assignments";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/form";
import { Alert } from "@/components/ui/card";
import { FileUpload, formatBytes, type UploadedFile } from "@/components/upload/file-upload";
import { Recorder } from "@/components/upload/recorder";
import { cn } from "@/lib/utils";
import { CONFIDENTIALITY_COPY } from "@/server/ai/policy";

type Template = "STANDARD" | "EXPERT_BRAIN_DUMP" | "DOMAIN_REVIEW" | "MULTI_STAGE";
type Level = keyof typeof CONFIDENTIALITY_COPY;

const TEMPLATES: { key: Template; title: string; description: string; recommends: string }[] = [
  { key: "EXPERT_BRAIN_DUMP", title: "Tell us what you know", description: "You have the knowledge. Record yourself or drop rough notes, and a language professional turns it into professional text.", recommends: "Language professional" },
  { key: "STANDARD", title: "Rewrite, edit or write from material", description: "Human rewrite, editorial review, proofreading, language review or writing from documents and URLs.", recommends: "Language professional" },
  { key: "DOMAIN_REVIEW", title: "Expert review of existing text", description: "A verified subject-matter expert checks facts and terminology and marks what is incorrect, imprecise or misleading.", recommends: "Domain reviewer" },
  { key: "MULTI_STAGE", title: "Writer plus domain expert", description: "A writer produces the text, an expert reviews it, the writer corrects, an editor finalizes and signs.", recommends: "Two professionals" },
];

const LEVELS: Level[] = ["STANDARD", "PRIVATE", "CONFIDENTIAL", "STRICT_CONFIDENTIAL"];

export function NewAssignmentWizard({ languages, categories, domains, organizations, initialTemplate, invitedProfessional, aiAvailable, defaultCurrency }: {
  languages: { code: string; name: string }[];
  categories: { id: string; slug: string; name: string; description: string; kind: string }[];
  domains: { id: string; name: string; path: string; depth: number }[];
  organizations: { id: string; name: string }[];
  initialTemplate: Template | null;
  invitedProfessional: { userId: string; displayName: string } | null;
  aiAvailable: boolean;
  defaultCurrency: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1 | 2 | 3>(initialTemplate ? 1 : 0);
  const [template, setTemplate] = useState<Template>(initialTemplate ?? "STANDARD");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [languageCode, setLanguageCode] = useState("sv");
  const [categoryId, setCategoryId] = useState("");
  const [domainId, setDomainId] = useState("");
  const [domainRequirement, setDomainRequirement] = useState<"NOT_REQUIRED" | "PREFERRED" | "REQUIRED" | "VERIFIED_REQUIRED">("NOT_REQUIRED");
  const [knowledgeSourceType, setKnowledgeSourceType] = useState<NonNullable<CreateAssignmentPayload["knowledgeSourceType"]>>("MIXED");
  const [knowledgeName, setKnowledgeName] = useState("");
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [urls, setUrls] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [wordCount, setWordCount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [intendedPublication, setIntendedPublication] = useState("");
  const [attribution, setAttribution] = useState("");
  const [instructions, setInstructions] = useState("");
  const [budget, setBudget] = useState("");
  const [confidentiality, setConfidentiality] = useState<Level>("PRIVATE");
  const [aiPolicy, setAiPolicy] = useState<"" | "AI_DISABLED" | "AI_METADATA_ONLY" | "AI_ALLOWED">("");
  const [organizationId, setOrganizationId] = useState("");
  const [openImmediately, setOpenImmediately] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const catForTemplate = useMemo(() => {
    if (template === "DOMAIN_REVIEW") return categories.filter((c) => c.kind !== "LANGUAGE");
    return categories;
  }, [template, categories]);

  const customerKnows = ["CUSTOMER_EXPERTISE", "FOUNDER_EXPERTISE", "EMPLOYEE_EXPERTISE", "VOICE_RECORDING", "INTERVIEW"].includes(knowledgeSourceType);
  const recommendation = template === "DOMAIN_REVIEW" ? "A domain reviewer with verified expertise. Add a language editor afterwards only if needed." : customerKnows && domainRequirement === "NOT_REQUIRED" ? "A language professional. You provide the subject knowledge, so no separate domain expert is needed." : domainRequirement === "VERIFIED_REQUIRED" ? "Only professionals with platform-verified expertise in this domain." : domainRequirement === "REQUIRED" ? "A writer with domain expertise, or a writer plus a domain reviewer." : "A language professional; domain background ranks higher but is not required.";

  function chooseTemplate(t: Template) {
    setTemplate(t);
    if (t === "EXPERT_BRAIN_DUMP") {
      setKnowledgeSourceType("FOUNDER_EXPERTISE");
      setCategoryId(categories.find((c) => c.slug === "writing")?.id ?? "");
      setDomainRequirement("NOT_REQUIRED");
    } else if (t === "DOMAIN_REVIEW") {
      setKnowledgeSourceType("EXTERNAL_SOURCES");
      setCategoryId(categories.find((c) => c.slug === "subject-matter-review")?.id ?? "");
      setDomainRequirement("VERIFIED_REQUIRED");
    } else if (t === "MULTI_STAGE") {
      setKnowledgeSourceType("MIXED");
      setCategoryId(categories.find((c) => c.slug === "writing")?.id ?? "");
      setDomainRequirement("REQUIRED");
    } else {
      setKnowledgeSourceType("MIXED");
      setCategoryId(categories.find((c) => c.slug === "rewriting")?.id ?? "");
      setDomainRequirement("NOT_REQUIRED");
    }
    setStep(1);
  }

  async function suggest() {
    setBusy(true);
    setSuggestion(null);
    const res = await suggestBriefAction(description);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    if (!res.data) return setSuggestion("AI suggestions are unavailable right now; continue manually.");
    const s = res.data;
    if (!title && s.title) setTitle(s.title);
    const cat = categories.find((c) => c.slug === s.suggestedService);
    if (cat) setCategoryId(cat.id);
    if (s.suggestedLanguage && languages.some((l) => l.code === s.suggestedLanguage)) setLanguageCode(s.suggestedLanguage);
    const dom = s.suggestedDomainPath ? domains.find((d) => d.path === s.suggestedDomainPath) : null;
    if (dom) setDomainId(dom.id);
    setDomainRequirement(s.domainRequirement);
    setSuggestion(s.rationale);
  }

  async function submit() {
    setError(null);
    setBusy(true);
    const payload: CreateAssignmentPayload = {
      template,
      title,
      description,
      serviceCategoryId: categoryId || null,
      languageCode: languageCode || null,
      requiredLanguageLevel: "PROFESSIONAL",
      editorialRequired: template !== "DOMAIN_REVIEW",
      domainId: domainId || null,
      domainRequirement: domainId ? domainRequirement : "NOT_REQUIRED",
      targetAudience,
      intendedPublication,
      wordCount: wordCount ? Number(wordCount) : null,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      sourceUrls: urls.split(/\s+/).map((u) => u.trim()).filter(Boolean),
      attributionRequirements: attribution,
      additionalInstructions: instructions,
      knowledgeSourceType,
      knowledgeProvidedByName: knowledgeName || null,
      knowledgeProvidedByTitle: knowledgeTitle || null,
      confidentiality,
      aiPolicy: aiPolicy || null,
      budget: budget || null,
      currency: defaultCurrency,
      organizationId: organizationId || null,
      sourceText: sourceText || null,
      attachmentIds: files.map((f) => f.id),
      openImmediately,
    };
    const res = await createAssignmentAction(payload);
    if (!res.ok) {
      setBusy(false);
      return setError(res.error);
    }
    const publicId = res.data!.publicId;
    if (invitedProfessional) await inviteProfessionalAction(publicId, invitedProfessional.userId, "");
    router.push(`/assignments/${publicId}`);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-ink-3">New assignment · step {step + 1} of 4</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{step === 0 ? "What do you need?" : step === 1 ? "Your material" : step === 2 ? "Requirements" : "Confidentiality and publish"}</h1>
        {invitedProfessional ? <p className="mt-1 text-sm text-ink-2">{invitedProfessional.displayName} will be invited when you publish.</p> : null}
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {step === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {TEMPLATES.map((t) => (
            <button key={t.key} type="button" onClick={() => chooseTemplate(t.key)} className={cn("rounded-lg border bg-surface p-5 text-left transition-colors hover:border-accent", template === t.key ? "border-accent" : "border-line")}>
              <p className="font-semibold">{t.title}</p>
              <p className="mt-1 text-sm text-ink-2">{t.description}</p>
              <p className="mt-3 text-xs text-accent">Recommended: {t.recommends}</p>
            </button>
          ))}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-6">
          {template === "EXPERT_BRAIN_DUMP" ? (
            <div className="rounded-lg border border-accent/30 bg-accent-soft/40 p-5">
              <p className="font-medium">Tell us what you know.</p>
              <p className="mt-1 text-sm text-ink-2">Do not worry about grammar, structure or wording. Record yourself explaining what this is, how it works, what matters, what customers misunderstand, what makes your company different, technical details, examples and common questions.</p>
              <div className="mt-4"><Recorder onUploaded={(f) => setFiles((prev) => [...prev, f])} /></div>
            </div>
          ) : null}
          <Field label="Title" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={template === "DOMAIN_REVIEW" ? "Technical review of 12 workshop articles" : "Homepage copy for our DSG servicing"} maxLength={160} />
          </Field>
          <Field label={template === "DOMAIN_REVIEW" ? "What should be checked?" : "Describe the assignment"} hint="A few sentences are enough. Who is it for, what should it achieve, what is important.">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
          </Field>
          {aiAvailable && description.length > 40 ? (
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={suggest} disabled={busy}>{busy ? "Thinking…" : "Suggest service and language"}</Button>
              {suggestion ? <p className="text-xs text-ink-3">{suggestion}</p> : null}
            </div>
          ) : null}
          <Field label={template === "DOMAIN_REVIEW" ? "Text to review" : "Source text"} hint="Paste existing text, a draft, notes or an AI-generated draft. This becomes Version 1 (customer source).">
            <Textarea value={sourceText} onChange={(e) => setSourceText(e.target.value)} rows={8} />
          </Field>
          <Field label="URLs" hint="One per line.">
            <Textarea value={urls} onChange={(e) => setUrls(e.target.value)} rows={2} className="min-h-16" />
          </Field>
          <div>
            <p className="text-sm font-medium">Files and recordings</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <FileUpload purpose="SOURCE_MATERIAL" accept=".pdf,.doc,.docx,.odt,.txt,.md,.rtf,.png,.jpg,.jpeg,.webp" onUploaded={(f) => setFiles((p) => [...p, ...f])} label="Add documents" compact />
              <FileUpload purpose="AUDIO_RECORDING" accept="audio/*,video/mp4,video/webm" onUploaded={(f) => setFiles((p) => [...p, ...f])} label="Upload audio" compact />
              {template !== "EXPERT_BRAIN_DUMP" ? <Recorder onUploaded={(f) => setFiles((p) => [...p, f])} /> : null}
            </div>
            {files.length ? (
              <ul className="mt-3 space-y-1 text-sm">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center justify-between rounded-md border border-line bg-surface px-3 py-1.5">
                    <span className="truncate">{f.filename} <span className="text-ink-3">· {formatBytes(f.sizeBytes)}</span></span>
                    <button type="button" className="text-xs text-ink-3 hover:text-danger" onClick={() => setFiles((p) => p.filter((x) => x.id !== f.id))}>Remove</button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" type="button" onClick={() => setStep(0)}>Back</Button>
            <Button type="button" onClick={() => (title.trim().length < 3 ? setError("Give the assignment a title") : (setError(null), setStep(2)))}>Continue</Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Service" required>
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Choose…</option>
                {catForTemplate.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </Select>
            </Field>
            <Field label="Language" required>
              <Select value={languageCode} onChange={(e) => setLanguageCode(e.target.value)}>
                {languages.map((l) => (<option key={l.code} value={l.code}>{l.name}</option>))}
              </Select>
            </Field>
          </div>
          <Field label="Where does the subject knowledge come from?" hint="This is recorded as provenance and decides whether a domain expert is needed.">
            <Select value={knowledgeSourceType} onChange={(e) => { const v = e.target.value as NonNullable<CreateAssignmentPayload["knowledgeSourceType"]>; setKnowledgeSourceType(v); if (["CUSTOMER_EXPERTISE", "FOUNDER_EXPERTISE", "EMPLOYEE_EXPERTISE", "VOICE_RECORDING", "INTERVIEW"].includes(v) && template !== "DOMAIN_REVIEW") setDomainRequirement("NOT_REQUIRED"); }}>
              <option value="FOUNDER_EXPERTISE">Me — I am the founder / owner and know the subject</option>
              <option value="EMPLOYEE_EXPERTISE">One of our employees knows the subject</option>
              <option value="CUSTOMER_EXPERTISE">Our organization&apos;s own expertise</option>
              <option value="VOICE_RECORDING">A voice recording I provide</option>
              <option value="INTERVIEW">An interview</option>
              <option value="DOCUMENTATION">Existing documentation</option>
              <option value="TRANSCRIPT">A transcript</option>
              <option value="EXTERNAL_SOURCES">External sources — the professional must supply the expertise</option>
              <option value="PROFESSIONAL_EXPERTISE">The professional&apos;s own expertise</option>
              <option value="MIXED">Mixed</option>
            </Select>
          </Field>
          {customerKnows ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Knowledge provided by (name)" hint="Shown on the record only if you allow it."><Input value={knowledgeName} onChange={(e) => setKnowledgeName(e.target.value)} placeholder="Erik Svensson" /></Field>
              <Field label="Their role"><Input value={knowledgeTitle} onChange={(e) => setKnowledgeTitle(e.target.value)} placeholder="Founder, workshop owner" /></Field>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Subject domain" hint="Optional. Used for matching and for domain-review requirements.">
              <Select value={domainId} onChange={(e) => setDomainId(e.target.value)}>
                <option value="">None / general</option>
                {domains.map((d) => (<option key={d.id} value={d.id}>{" ".repeat(d.depth * 3)}{d.name}</option>))}
              </Select>
            </Field>
            <Field label="Domain expertise is…">
              <Select value={domainRequirement} onChange={(e) => setDomainRequirement(e.target.value as typeof domainRequirement)} disabled={!domainId}>
                <option value="NOT_REQUIRED">Not required (I provide the knowledge)</option>
                <option value="PREFERRED">Preferred</option>
                <option value="REQUIRED">Required</option>
                <option value="VERIFIED_REQUIRED">Required and platform-verified</option>
              </Select>
            </Field>
          </div>
          <Alert tone="info" title="Recommended competence">{recommendation}</Alert>
          <button type="button" className="text-sm text-accent underline-offset-4 hover:underline" onClick={() => setMore(!more)}>{more ? "Fewer options" : "More options (audience, deadline, budget, attribution…)"}</button>
          {more ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Target audience"><Input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} /></Field>
              <Field label="Intended publication"><Input value={intendedPublication} onChange={(e) => setIntendedPublication(e.target.value)} placeholder="Website, print, internal…" /></Field>
              <Field label="Approximate word count"><Input type="number" min={0} value={wordCount} onChange={(e) => setWordCount(e.target.value)} /></Field>
              <Field label="Deadline"><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
              <Field label={`Budget (${defaultCurrency})`} hint="Optional guidance for professionals."><Input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} /></Field>
              {organizations.length ? (
                <Field label="On behalf of organization">
                  <Select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>
                    <option value="">Myself</option>
                    {organizations.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
                  </Select>
                </Field>
              ) : null}
              <Field label="Attribution requirements" hint="How should the professional be credited, if at all?"><Textarea value={attribution} onChange={(e) => setAttribution(e.target.value)} rows={2} className="min-h-16" /></Field>
              <Field label="Additional instructions"><Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} className="min-h-20" /></Field>
            </div>
          ) : null}
          <div className="flex justify-between">
            <Button variant="ghost" type="button" onClick={() => setStep(1)}>Back</Button>
            <Button type="button" onClick={() => (!categoryId ? setError("Choose a service") : (setError(null), setStep(3)))}>Continue</Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-6">
          <div className="space-y-2">
            {LEVELS.map((l) => (
              <label key={l} className={cn("flex cursor-pointer gap-3 rounded-lg border bg-surface p-4", confidentiality === l ? "border-accent" : "border-line")}>
                <input type="radio" name="level" className="mt-1" checked={confidentiality === l} onChange={() => { setConfidentiality(l); setAiPolicy(""); }} />
                <span>
                  <span className="font-medium">{CONFIDENTIALITY_COPY[l].label}</span>
                  <span className="block text-sm text-ink-2">{CONFIDENTIALITY_COPY[l].short}</span>
                </span>
              </label>
            ))}
          </div>
          <Field label="AI processing" hint="Assignment content is never sent to AI providers unless this policy allows it. Professionals see the policy and must respect it.">
            <Select value={aiPolicy} onChange={(e) => setAiPolicy(e.target.value as typeof aiPolicy)}>
              <option value="">Default for this level</option>
              <option value="AI_DISABLED">Disabled — no content or metadata to AI</option>
              <option value="AI_METADATA_ONLY">Metadata only — title and category for matching</option>
              {confidentiality !== "STRICT_CONFIDENTIAL" ? <option value="AI_ALLOWED">Allowed — platform AI assistance permitted</option> : null}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={openImmediately} onChange={(e) => setOpenImmediately(e.target.checked)} /> Open for offers immediately (otherwise saved as a draft)</label>
          <div className="flex justify-between">
            <Button variant="ghost" type="button" onClick={() => setStep(2)}>Back</Button>
            <Button type="button" onClick={submit} disabled={busy}>{busy ? "Creating…" : openImmediately ? "Publish assignment" : "Save draft"}</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
