import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { requireViewer } from "@/server/auth/session";
import { authorizeAssignment, can } from "@/server/authz/policy";
import { db } from "@/server/db";
import { assignmentInvitations, assignmentParticipants, assignmentStages, assignmentStatusHistory, contributions, domains, languages, offers, organizations, reviews, serviceCategories, serviceListings, users } from "@/server/db/schema";
import { listMessages } from "@/server/domain/messages/service";
import { listVersions, listRevisionRequests } from "@/server/domain/artifacts/service";
import { listRecordsForAssignment } from "@/server/domain/signing/service";
import { listAssignmentFiles } from "@/server/domain/files/service";
import { assignmentPaymentState } from "@/server/finance/payments";
import { matchProfessionals, recommendCompetence } from "@/server/domain/matching/service";
import { hasAcceptedConfidentialityAgreement } from "@/server/domain/assignments/service";
import { STATUS_DESCRIPTIONS, STATUS_LABELS } from "@/server/domain/assignments/state-machine";
import { CONFIDENTIALITY_COPY } from "@/server/ai/policy";
import { StatusBadge, ConfidentialityBadge, Badge } from "@/components/ui/badge";
import { Alert, DescriptionList } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { formatDate, formatDateTime, humanize } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { formatBytes } from "@/components/upload/file-upload";
import { Conversation } from "@/components/workspace/conversation";
import { VersionPanel } from "@/components/workspace/version-panel";
import { OfferForm, OffersList } from "@/components/workspace/offers";
import { CustomerActions, ProfessionalActions, ProspectActions } from "@/components/workspace/actions";
import { ConfidentialityForm } from "@/components/workspace/confidentiality-form";
import { RecordsPanel } from "@/components/workspace/records-panel";
import { ReviewForm } from "@/components/workspace/review-form";
import { InviteButton } from "@/components/workspace/invite-button";
import { ProfessionalCard } from "@/components/marketplace/professional-card";
import { env } from "@/lib/config/env";
import { getPaymentProvider } from "@/server/finance/providers";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({ params, searchParams }: { params: Promise<{ publicId: string }>; searchParams: Promise<{ payment?: string }> }) {
  const { publicId } = await params;
  const sp = await searchParams;
  const viewer = await requireViewer();
  let ctx;
  try {
    ctx = await authorizeAssignment(viewer, publicId, "view_metadata");
  } catch {
    notFound();
  }
  const a = ctx.assignment;
  const canContent = can(ctx, "view_content");
  const isCustomerSide = ctx.role === "CUSTOMER" || (ctx.role === "ORG_MEMBER" && ctx.orgRole !== "BILLING");
  const isProfessional = ctx.role === "PROFESSIONAL";
  const isProspect = ctx.role === "PROSPECT";

  const [category] = a.serviceCategoryId ? await db.select().from(serviceCategories).where(eq(serviceCategories.id, a.serviceCategoryId)).limit(1) : [];
  const [language] = a.languageCode ? await db.select().from(languages).where(eq(languages.code, a.languageCode)).limit(1) : [];
  const [domain] = a.domainId ? await db.select().from(domains).where(eq(domains.id, a.domainId)).limit(1) : [];
  const [customer] = await db.select({ name: users.name }).from(users).where(eq(users.id, a.customerUserId)).limit(1);
  const [org] = a.organizationId ? await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, a.organizationId)).limit(1) : [];
  const participants = await db
    .select({ userId: assignmentParticipants.userId, role: assignmentParticipants.role, contributionRoles: assignmentParticipants.contributionRoles, name: users.name, image: users.image })
    .from(assignmentParticipants)
    .innerJoin(users, eq(users.id, assignmentParticipants.userId))
    .where(and(eq(assignmentParticipants.assignmentId, a.id), isNull(assignmentParticipants.removedAt)));
  const stages = await db.select().from(assignmentStages).where(eq(assignmentStages.assignmentId, a.id)).orderBy(asc(assignmentStages.position));
  const history = await db.select({ h: assignmentStatusHistory, actorName: users.name }).from(assignmentStatusHistory).leftJoin(users, eq(users.id, assignmentStatusHistory.actorUserId)).where(eq(assignmentStatusHistory.assignmentId, a.id)).orderBy(desc(assignmentStatusHistory.createdAt)).limit(30);
  const contribs = await db.select().from(contributions).where(eq(contributions.assignmentId, a.id)).orderBy(asc(contributions.createdAt));
  const offerRows = await db
    .select({ o: offers, name: users.name })
    .from(offers)
    .innerJoin(users, eq(users.id, offers.professionalUserId))
    .where(isCustomerSide || ctx.role === "ADMIN" ? eq(offers.assignmentId, a.id) : and(eq(offers.assignmentId, a.id), eq(offers.professionalUserId, viewer.userId)))
    .orderBy(desc(offers.createdAt));
  const pendingInvitation = isProspect ? (await db.select().from(assignmentInvitations).where(and(eq(assignmentInvitations.assignmentId, a.id), eq(assignmentInvitations.professionalUserId, viewer.userId), eq(assignmentInvitations.status, "PENDING"))).limit(1))[0] ?? null : null;

  const [messages, versions, files, records, revisionRequests, pay, ownReview] = canContent
    ? await Promise.all([listMessages(a.id), listVersions(a.id), listAssignmentFiles(a.id), listRecordsForAssignment(a.id), listRevisionRequests(a.id), assignmentPaymentState(a.id), db.select().from(reviews).where(and(eq(reviews.assignmentId, a.id), eq(reviews.reviewerUserId, viewer.userId))).limit(1)])
    : [[], [], [], [], [], { captured: false, pending: false, payment: null }, []];

  const showMatches = isCustomerSide && !a.primaryProfessionalUserId && ["DRAFT", "OPEN", "PROFESSIONAL_INVITED", "OFFER_RECEIVED"].includes(a.status);
  const matches = showMatches ? await matchProfessionals(a, 6) : [];
  const invited = showMatches ? (await db.select({ professionalUserId: assignmentInvitations.professionalUserId }).from(assignmentInvitations).where(eq(assignmentInvitations.assignmentId, a.id))).map((i) => i.professionalUserId) : [];
  const ownListings = isProspect && viewer.professionalProfileId ? await db.select({ id: serviceListings.id, title: serviceListings.title, pricingModel: serviceListings.pricingModel, basePriceMinor: serviceListings.basePriceMinor, currency: serviceListings.currency, turnaroundDays: serviceListings.turnaroundDays }).from(serviceListings).where(and(eq(serviceListings.profileId, viewer.professionalProfileId), eq(serviceListings.active, true))) : [];
  const agreementAccepted = isProspect ? await hasAcceptedConfidentialityAgreement(viewer.userId) : true;
  const recommendation = recommendCompetence({ knowledgeSourceType: a.knowledgeSourceType, domainRequirement: a.domainRequirement, template: a.template });
  const professionals = participants.filter((p) => p.role === "PROFESSIONAL");
  const latestSigned = versions.filter((v) => v.status === "SIGNED").at(-1) ?? null;
  const latestSubmitted = [...versions].reverse().find((v) => v.status === "SUBMITTED" && !(v.label === "Customer source")) ?? null;
  const paymentProviderName = getPaymentProvider().name;

  return (
    <div className="-mx-4 -my-8 md:-mx-8">
      <div className="border-b border-line bg-surface px-4 py-4 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-ink-3"><Link href="/assignments" className="hover:underline">Assignments</Link> / <span className="mono">{a.publicId}</span></p>
            <h1 className="mt-1 truncate text-xl font-semibold tracking-tight md:text-2xl">{a.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2"><StatusBadge status={a.status} /><ConfidentialityBadge level={a.confidentiality} /><Badge>{humanize(a.template)}</Badge>{language ? <Badge>{language.name}</Badge> : null}{category ? <Badge>{category.name}</Badge> : null}{ctx.role === "ADMIN" ? <Badge tone="danger">Admin view{ctx.adminContentGrant ? " · content access granted" : " · metadata only"}</Badge> : null}</div>
          </div>
          <p className="max-w-sm text-sm text-ink-2">{STATUS_DESCRIPTIONS[a.status]}</p>
        </div>
        {sp.payment === "success" ? <div className="mt-3"><Alert tone="success">Payment received. Thank you.</Alert></div> : sp.payment === "cancelled" ? <div className="mt-3"><Alert tone="warn">Payment was cancelled. You can try again below.</Alert></div> : null}
      </div>

      <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[240px_1fr_340px]">
        {/* LEFT: navigation / history */}
        <aside className="border-b border-line bg-surface/60 p-4 text-sm lg:border-b-0 lg:border-r">
          <h2 className="text-xs font-medium uppercase tracking-wider text-ink-3">Stages</h2>
          <ol className="mt-2 space-y-1.5">
            {stages.map((s) => {
              const assignee = participants.find((p) => p.userId === s.assigneeUserId);
              return (
                <li key={s.id} className="flex items-start gap-2">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${s.status === "COMPLETED" ? "bg-accent" : s.status === "ACTIVE" ? "bg-warn" : "bg-line-strong"}`} />
                  <span><span className={s.status === "ACTIVE" ? "font-medium" : ""}>{s.title}</span>{assignee ? <span className="block text-xs text-ink-3">{assignee.name}</span> : null}</span>
                </li>
              );
            })}
          </ol>
          <h2 className="mt-6 text-xs font-medium uppercase tracking-wider text-ink-3">Participants</h2>
          <ul className="mt-2 space-y-1.5">
            {participants.map((p) => (
              <li key={p.userId}><span className="font-medium">{p.name}</span><span className="block text-xs text-ink-3">{p.role === "PROFESSIONAL" ? p.contributionRoles.map(humanize).join(", ") || "Professional" : p.role === "CUSTOMER" ? (org ? `Customer · ${org.name}` : "Customer") : humanize(p.role)}</span></li>
            ))}
          </ul>
          <h2 className="mt-6 text-xs font-medium uppercase tracking-wider text-ink-3">History</h2>
          <ul className="mt-2 space-y-1.5 text-xs text-ink-2">
            {history.map((h) => (
              <li key={h.h.id}><span className="font-medium text-ink">{STATUS_LABELS[h.h.toStatus]}</span> · {formatDateTime(h.h.createdAt)}{h.actorName ? ` · ${h.actorName}` : ""}</li>
            ))}
          </ul>
        </aside>

        {/* CENTER: conversation + work */}
        <section className="min-w-0 p-4 md:p-6">
          {isProspect ? (
            <div className="space-y-6">
              {pendingInvitation ? <Alert tone="success" title="You were invited">{pendingInvitation.message || "The customer invited you to this assignment."}</Alert> : null}
              <div className="rounded-lg border border-line bg-surface p-5">
                <h2 className="font-semibold">Brief</h2>
                <p className="prose-plain mt-2 text-sm text-ink-2">{a.description || "No description provided."}</p>
                <DescriptionList className="mt-4" items={[{ label: "Service", value: category?.name }, { label: "Language", value: language ? `${language.name} · ${humanize(a.requiredLanguageLevel)}${a.editorialRequired ? " · editorial" : ""}` : "—" }, { label: "Domain", value: domain ? `${domain.name} · ${humanize(a.domainRequirement)}` : "Not required" }, { label: "Knowledge source", value: humanize(a.knowledgeSourceType) }, { label: "Word count", value: a.wordCount ?? "—" }, { label: "Deadline", value: formatDate(a.deadline) }, { label: "Budget", value: a.budgetMinor ? formatMoney(a.budgetMinor, a.currency) : "Not stated" }, { label: "Customer", value: org?.name ?? customer?.name }]} />
                <p className="mt-4 text-xs text-ink-3">Source material and files become visible after your offer is accepted. Confidentiality: {CONFIDENTIALITY_COPY[a.confidentiality].short} AI policy: {humanize(a.aiPolicy)}.</p>
              </div>
              {offerRows.length ? <OffersList publicId={a.publicId} offers={offerRows.map((r) => ({ ...r.o, name: r.name }))} viewerRole="PROFESSIONAL" viewerId={viewer.userId} /> : null}
              {!offerRows.some((r) => r.o.status === "PENDING") ? <OfferForm publicId={a.publicId} currency={a.currency} listings={ownListings} agreementAccepted={agreementAccepted} defaultRole={(category?.defaultContributionRole as "AUTHOR") ?? "AUTHOR"} /> : null}
              <ProspectActions publicId={a.publicId} hasInvitation={Boolean(pendingInvitation)} />
            </div>
          ) : canContent ? (
            <div className="space-y-6">
              {isCustomerSide && showMatches ? (
                <div className="space-y-3">
                  <Alert tone="info" title={`Recommended: ${recommendation.headline}`}>{recommendation.detail}</Alert>
                  {a.status === "DRAFT" ? <Alert tone="warn">This assignment is a draft. Open it for offers or invite a professional.</Alert> : null}
                  {matches.length ? (
                    <div>
                      <h2 className="text-sm font-semibold">Suggested professionals</h2>
                      <div className="mt-2 grid gap-3 md:grid-cols-2">
                        {matches.map((m) => (
                          <ProfessionalCard key={m.id} p={m} action={<InviteButton publicId={a.publicId} professionalUserId={m.userId} invited={invited.includes(m.userId)} />} />
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-ink-3"><Link href={`/professionals?language=${a.languageCode ?? ""}${domain ? `&domain=${domain.path}` : ""}`} className="underline">Browse all professionals</Link></p>
                    </div>
                  ) : (
                    <p className="text-sm text-ink-3">No matching professionals yet. <Link href="/professionals" className="underline">Browse all</Link> or wait for offers.</p>
                  )}
                </div>
              ) : null}
              {offerRows.length && ["OPEN", "PROFESSIONAL_INVITED", "OFFER_RECEIVED", "ACCEPTED"].includes(a.status) ? <OffersList publicId={a.publicId} offers={offerRows.map((r) => ({ ...r.o, name: r.name }))} viewerRole={isCustomerSide ? "CUSTOMER" : "PROFESSIONAL"} viewerId={viewer.userId} /> : null}
              {revisionRequests.filter((r) => r.r.status === "OPEN").map((r) => (
                <Alert key={r.r.id} tone="warn" title={`Revision requested on Version ${r.versionNumber} by ${r.userName}`}>{r.r.message}</Alert>
              ))}
              <Conversation publicId={a.publicId} messages={messages} viewerId={viewer.userId} canSend={can(ctx, "send_message")} />
            </div>
          ) : (
            <Alert tone="info" title="Content access is restricted">{ctx.role === "ADMIN" ? "Administrators see metadata only. Request a time-limited, audited content access grant from the admin console if operationally necessary." : "Your role on this assignment does not include content access."}</Alert>
          )}
        </section>

        {/* RIGHT: details, files, versions, status */}
        <aside className="space-y-6 border-t border-line bg-surface/60 p-4 text-sm lg:border-l lg:border-t-0">
          {isCustomerSide ? <CustomerActions publicId={a.publicId} status={a.status} latestSubmittedVersionId={latestSubmitted?.id ?? null} hasSigned={Boolean(latestSigned)} paymentCaptured={pay.captured} paymentPending={pay.pending} agreedPriceMinor={a.agreedPriceMinor} currency={a.currency} paymentProvider={paymentProviderName} manualConfirmAllowed={paymentProviderName === "manual" && (!env.isProd || viewer.isAdmin)} canPay={can(ctx, "pay")} canCancel={can(ctx, "cancel")} canDispute={can(ctx, "open_dispute")} /> : null}
          {isProfessional ? <ProfessionalActions publicId={a.publicId} status={a.status} latestSubmittedVersionId={latestSubmitted?.id ?? null} canSign={can(ctx, "sign")} canSubmit={can(ctx, "submit_version")} canDispute={can(ctx, "open_dispute")} /> : null}

          <div>
            <h2 className="text-xs font-medium uppercase tracking-wider text-ink-3">Details</h2>
            <DescriptionList className="mt-2 sm:grid-cols-1" items={[{ label: "Service", value: category?.name }, { label: "Language", value: language ? `${language.name} · ${humanize(a.requiredLanguageLevel)}${a.editorialRequired ? " · editorial" : ""}` : "—" }, { label: "Domain", value: domain ? `${domain.name} · ${humanize(a.domainRequirement)}` : "Not required" }, { label: "Knowledge source", value: humanize(a.knowledgeSourceType) }, { label: "Deadline", value: formatDate(a.deadline) }, { label: "Price", value: a.agreedPriceMinor != null ? `${formatMoney(a.agreedPriceMinor, a.currency)}${pay.captured ? " · paid" : ""}` : a.budgetMinor ? `Budget ${formatMoney(a.budgetMinor, a.currency)}` : "—" }, { label: "Customer", value: org?.name ?? customer?.name }, { label: "AI policy", value: humanize(a.aiPolicy) }, { label: "Portfolio permission", value: humanize(a.portfolioPermission) }]} />
            {a.description && canContent ? <details className="mt-3"><summary className="cursor-pointer text-xs text-ink-3">Brief and instructions</summary><p className="prose-plain mt-2 text-ink-2">{a.description}</p>{a.additionalInstructions ? <p className="prose-plain mt-2 text-ink-2">{a.additionalInstructions}</p> : null}{a.sourceUrls.length ? <ul className="mt-2 space-y-1">{a.sourceUrls.map((u) => <li key={u}><a href={u} target="_blank" rel="noopener nofollow" className="break-all text-accent underline">{u}</a></li>)}</ul> : null}</details> : null}
          </div>

          {canContent ? (
            <>
              <VersionPanel publicId={a.publicId} versions={versions} canSubmit={can(ctx, "submit_version")} canSign={can(ctx, "sign")} viewerId={viewer.userId} />
              <div>
                <h2 className="text-xs font-medium uppercase tracking-wider text-ink-3">Files</h2>
                {files.length ? (
                  <ul className="mt-2 space-y-1">
                    {files.map((f) => (
                      <li key={f.id} className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5"><a href={`/api/files/${f.id}`} target="_blank" rel="noopener" className="truncate hover:underline">{f.filename}</a><span className="shrink-0 text-xs text-ink-3">{humanize(f.purpose)} · {formatBytes(f.sizeBytes)}</span></li>
                    ))}
                  </ul>
                ) : <p className="mt-2 text-xs text-ink-3">No files.</p>}
                {a.confidentiality === "STRICT_CONFIDENTIAL" ? <p className="mt-2 text-xs text-warn">Strictly confidential: do not export or share files outside the platform.</p> : null}
              </div>
              {contribs.length ? (
                <div>
                  <h2 className="text-xs font-medium uppercase tracking-wider text-ink-3">Provenance</h2>
                  <ul className="mt-2 space-y-1.5">
                    {contribs.map((c) => (
                      <li key={c.id} className="rounded-md border border-line bg-surface px-2.5 py-1.5"><span className="font-medium">{c.displayName ?? participants.find((p) => p.userId === c.userId)?.name ?? "Contributor"}</span>{c.displayTitle ? <span className="text-ink-3"> · {c.displayTitle}</span> : null}<span className="block text-xs text-ink-3">{humanize(c.role)} · {c.scope}{c.signedAt ? ` · signed ${formatDate(c.signedAt)}` : c.status === "COMPLETED" ? " · completed" : ""}</span></li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {records.length ? <RecordsPanel publicId={a.publicId} records={records.map((r) => ({ id: r.id, publicId: r.publicId, visibility: r.visibility, customerDisplay: r.customerDisplay, titlePublic: r.titlePublic, hashPublic: r.hashPublic, publicationUrl: r.publicationUrl, status: r.status, versionNumber: r.versionNumber, professionalPublicName: r.professionalPublicName, signedAt: r.signedAt }))} canManage={can(ctx, "manage_publication")} confidentiality={a.confidentiality} /> : null}
              {isCustomerSide && a.status === "COMPLETED" && professionals.length && !ownReview.length ? <ReviewForm publicId={a.publicId} professionals={professionals.map((p) => ({ userId: p.userId, name: p.name }))} /> : null}
              {can(ctx, "manage_confidentiality") ? <ConfidentialityForm publicId={a.publicId} level={a.confidentiality} aiPolicy={a.aiPolicy} portfolioPermission={a.portfolioPermission} /> : null}
            </>
          ) : null}
          {ctx.role === "ADMIN" ? <LinkButton href={`/admin/assignments/${a.id}`} variant="outline" size="sm">Open in admin console</LinkButton> : null}
        </aside>
      </div>
    </div>
  );
}
