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
import { useT } from "@/components/i18n/provider";

type Template = "STANDARD" | "EXPERT_BRAIN_DUMP" | "DOMAIN_REVIEW" | "MULTI_STAGE";
type Level = "STANDARD" | "PRIVATE" | "CONFIDENTIAL" | "STRICT_CONFIDENTIAL";

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
  const { t } = useT();
  const TEMPLATES: { key: Template; title: string; description: string; recommends: string }[] = [
    { key: "EXPERT_BRAIN_DUMP", title: t("wiz.tpl.brainDump.title"), description: t("wiz.tpl.brainDump.body"), recommends: t("wiz.tpl.brainDump.rec") },
    { key: "STANDARD", title: t("wiz.tpl.standard.title"), description: t("wiz.tpl.standard.body"), recommends: t("wiz.tpl.standard.rec") },
    { key: "DOMAIN_REVIEW", title: t("wiz.tpl.domain.title"), description: t("wiz.tpl.domain.body"), recommends: t("wiz.tpl.domain.rec") },
    { key: "MULTI_STAGE", title: t("wiz.tpl.multi.title"), description: t("wiz.tpl.multi.body"), recommends: t("wiz.tpl.multi.rec") },
  ];
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
  const recommendation = template === "DOMAIN_REVIEW" ? t("wiz.rec.domainReview") : customerKnows && domainRequirement === "NOT_REQUIRED" ? t("wiz.rec.language") : domainRequirement === "VERIFIED_REQUIRED" ? t("wiz.rec.verified") : domainRequirement === "REQUIRED" ? t("wiz.rec.required") : t("wiz.rec.preferred");

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
    if (!res.data) return setSuggestion(t("wiz.aiUnavailable"));
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
        <p className="text-xs font-medium uppercase tracking-wider text-ink-3">{t("wiz.eyebrow", { step: step + 1 })}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{step === 0 ? t("wiz.step0") : step === 1 ? t("wiz.step1") : step === 2 ? t("wiz.step2") : t("wiz.step3")}</h1>
        {invitedProfessional ? <p className="mt-1 text-sm text-ink-2">{t("wiz.willInvite", { name: invitedProfessional.displayName })}</p> : null}
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {step === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {TEMPLATES.map((tpl) => (
            <button key={tpl.key} type="button" onClick={() => chooseTemplate(tpl.key)} className={cn("rounded-lg border bg-surface p-5 text-left transition-colors hover:border-accent", template === tpl.key ? "border-accent" : "border-line")}>
              <p className="font-semibold">{tpl.title}</p>
              <p className="mt-1 text-sm text-ink-2">{tpl.description}</p>
              <p className="mt-3 text-xs text-accent">{t("wiz.recommended", { what: tpl.recommends })}</p>
            </button>
          ))}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-6">
          {template === "EXPERT_BRAIN_DUMP" ? (
            <div className="rounded-lg border border-accent/30 bg-accent-soft/40 p-5">
              <p className="font-medium">{t("wiz.brainDump.title")}</p>
              <p className="mt-1 text-sm text-ink-2">{t("wiz.brainDump.body")}</p>
              <div className="mt-4"><Recorder onUploaded={(f) => setFiles((prev) => [...prev, f])} /></div>
            </div>
          ) : null}
          <Field label={t("wiz.title")} required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={template === "DOMAIN_REVIEW" ? t("wiz.title.phDomain") : t("wiz.title.ph")} maxLength={160} />
          </Field>
          <Field label={template === "DOMAIN_REVIEW" ? t("wiz.describeDomain") : t("wiz.describe")} hint={t("wiz.describe.hint")}>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
          </Field>
          {aiAvailable && description.length > 40 ? (
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={suggest} disabled={busy}>{busy ? t("wiz.thinking") : t("wiz.suggest")}</Button>
              {suggestion ? <p className="text-xs text-ink-3">{suggestion}</p> : null}
            </div>
          ) : null}
          <Field label={template === "DOMAIN_REVIEW" ? t("wiz.textToReview") : t("wiz.sourceText")} hint={t("wiz.sourceText.hint")}>
            <Textarea value={sourceText} onChange={(e) => setSourceText(e.target.value)} rows={8} />
          </Field>
          <Field label={t("wiz.urls")} hint={t("wiz.urls.hint")}>
            <Textarea value={urls} onChange={(e) => setUrls(e.target.value)} rows={2} className="min-h-16" />
          </Field>
          <div>
            <p className="text-sm font-medium">{t("wiz.files")}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <FileUpload purpose="SOURCE_MATERIAL" accept=".pdf,.doc,.docx,.odt,.txt,.md,.rtf,.png,.jpg,.jpeg,.webp" onUploaded={(f) => setFiles((p) => [...p, ...f])} label={t("wiz.addDocuments")} compact />
              <FileUpload purpose="AUDIO_RECORDING" accept="audio/*,video/mp4,video/webm" onUploaded={(f) => setFiles((p) => [...p, ...f])} label={t("wiz.uploadAudio")} compact />
              {template !== "EXPERT_BRAIN_DUMP" ? <Recorder onUploaded={(f) => setFiles((p) => [...p, f])} /> : null}
            </div>
            {files.length ? (
              <ul className="mt-3 space-y-1 text-sm">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center justify-between rounded-md border border-line bg-surface px-3 py-1.5">
                    <span className="truncate">{f.filename} <span className="text-ink-3">· {formatBytes(f.sizeBytes)}</span></span>
                    <button type="button" className="text-xs text-ink-3 hover:text-danger" onClick={() => setFiles((p) => p.filter((x) => x.id !== f.id))}>{t("wiz.remove")}</button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" type="button" onClick={() => setStep(0)}>{t("wiz.back")}</Button>
            <Button type="button" onClick={() => (title.trim().length < 3 ? setError(t("wiz.err.title")) : (setError(null), setStep(2)))}>{t("wiz.continue")}</Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("wiz.service")} required>
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">{t("wiz.choose")}</option>
                {catForTemplate.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </Select>
            </Field>
            <Field label={t("wiz.language")} required>
              <Select value={languageCode} onChange={(e) => setLanguageCode(e.target.value)}>
                {languages.map((l) => (<option key={l.code} value={l.code}>{l.name}</option>))}
              </Select>
            </Field>
          </div>
          <Field label={t("wiz.knowledge")} hint={t("wiz.knowledge.hint")}>
            <Select value={knowledgeSourceType} onChange={(e) => { const v = e.target.value as NonNullable<CreateAssignmentPayload["knowledgeSourceType"]>; setKnowledgeSourceType(v); if (["CUSTOMER_EXPERTISE", "FOUNDER_EXPERTISE", "EMPLOYEE_EXPERTISE", "VOICE_RECORDING", "INTERVIEW"].includes(v) && template !== "DOMAIN_REVIEW") setDomainRequirement("NOT_REQUIRED"); }}>
              <option value="FOUNDER_EXPERTISE">{t("wiz.ks.FOUNDER_EXPERTISE")}</option>
              <option value="EMPLOYEE_EXPERTISE">{t("wiz.ks.EMPLOYEE_EXPERTISE")}</option>
              <option value="CUSTOMER_EXPERTISE">{t("wiz.ks.CUSTOMER_EXPERTISE")}</option>
              <option value="VOICE_RECORDING">{t("wiz.ks.VOICE_RECORDING")}</option>
              <option value="INTERVIEW">{t("wiz.ks.INTERVIEW")}</option>
              <option value="DOCUMENTATION">{t("wiz.ks.DOCUMENTATION")}</option>
              <option value="TRANSCRIPT">{t("wiz.ks.TRANSCRIPT")}</option>
              <option value="EXTERNAL_SOURCES">{t("wiz.ks.EXTERNAL_SOURCES")}</option>
              <option value="PROFESSIONAL_EXPERTISE">{t("wiz.ks.PROFESSIONAL_EXPERTISE")}</option>
              <option value="MIXED">{t("wiz.ks.MIXED")}</option>
            </Select>
          </Field>
          {customerKnows ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("wiz.knowledgeName")} hint={t("wiz.knowledgeName.hint")}><Input value={knowledgeName} onChange={(e) => setKnowledgeName(e.target.value)} placeholder={t("wiz.knowledgeName.ph")} /></Field>
              <Field label={t("wiz.knowledgeRole")}><Input value={knowledgeTitle} onChange={(e) => setKnowledgeTitle(e.target.value)} placeholder={t("wiz.knowledgeRole.ph")} /></Field>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("wiz.domain")} hint={t("wiz.domain.hint")}>
              <Select value={domainId} onChange={(e) => setDomainId(e.target.value)}>
                <option value="">{t("wiz.domain.none")}</option>
                {domains.map((d) => (<option key={d.id} value={d.id}>{" ".repeat(d.depth * 3)}{d.name}</option>))}
              </Select>
            </Field>
            <Field label={t("wiz.domainReq")}>
              <Select value={domainRequirement} onChange={(e) => setDomainRequirement(e.target.value as typeof domainRequirement)} disabled={!domainId}>
                <option value="NOT_REQUIRED">{t("wiz.req.NOT_REQUIRED")}</option>
                <option value="PREFERRED">{t("wiz.req.PREFERRED")}</option>
                <option value="REQUIRED">{t("wiz.req.REQUIRED")}</option>
                <option value="VERIFIED_REQUIRED">{t("wiz.req.VERIFIED_REQUIRED")}</option>
              </Select>
            </Field>
          </div>
          <Alert tone="info" title={t("wiz.recommendedCompetence")}>{recommendation}</Alert>
          <button type="button" className="text-sm text-accent underline-offset-4 hover:underline" onClick={() => setMore(!more)}>{more ? t("wiz.fewer") : t("wiz.more")}</button>
          {more ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("wiz.audience")}><Input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} /></Field>
              <Field label={t("wiz.publication")}><Input value={intendedPublication} onChange={(e) => setIntendedPublication(e.target.value)} placeholder={t("wiz.publication.ph")} /></Field>
              <Field label={t("wiz.wordCount")}><Input type="number" min={0} value={wordCount} onChange={(e) => setWordCount(e.target.value)} /></Field>
              <Field label={t("wiz.deadline")}><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
              <Field label={t("wiz.budget", { currency: defaultCurrency })} hint={t("wiz.budget.hint")}><Input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} /></Field>
              {organizations.length ? (
                <Field label={t("wiz.onBehalf")}>
                  <Select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>
                    <option value="">{t("wiz.myself")}</option>
                    {organizations.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
                  </Select>
                </Field>
              ) : null}
              <Field label={t("wiz.attribution")} hint={t("wiz.attribution.hint")}><Textarea value={attribution} onChange={(e) => setAttribution(e.target.value)} rows={2} className="min-h-16" /></Field>
              <Field label={t("wiz.instructions")}><Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} className="min-h-20" /></Field>
            </div>
          ) : null}
          <div className="flex justify-between">
            <Button variant="ghost" type="button" onClick={() => setStep(1)}>{t("wiz.back")}</Button>
            <Button type="button" onClick={() => (!categoryId ? setError(t("wiz.err.service")) : (setError(null), setStep(3)))}>{t("wiz.continue")}</Button>
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
                  <span className="font-medium">{t(`conf.${l}.label`)}</span>
                  <span className="block text-sm text-ink-2">{t(`conf.${l}.short`)}</span>
                </span>
              </label>
            ))}
          </div>
          <Field label={t("wiz.ai")} hint={t("wiz.ai.hint")}>
            <Select value={aiPolicy} onChange={(e) => setAiPolicy(e.target.value as typeof aiPolicy)}>
              <option value="">{t("wiz.ai.default")}</option>
              <option value="AI_DISABLED">{t("wiz.ai.disabled")}</option>
              <option value="AI_METADATA_ONLY">{t("wiz.ai.metadata")}</option>
              {confidentiality !== "STRICT_CONFIDENTIAL" ? <option value="AI_ALLOWED">{t("wiz.ai.allowed")}</option> : null}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={openImmediately} onChange={(e) => setOpenImmediately(e.target.checked)} /> {t("wiz.openImmediately")}</label>
          <div className="flex justify-between">
            <Button variant="ghost" type="button" onClick={() => setStep(2)}>{t("wiz.back")}</Button>
            <Button type="button" onClick={submit} disabled={busy}>{busy ? t("wiz.creating") : openImmediately ? t("wiz.publish") : t("wiz.saveDraft")}</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
