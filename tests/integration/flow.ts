/**
 * End-to-end domain flow against a real database (run with: npx tsx tests/integration/flow.ts).
 * Exercises: assignment creation → invite → offer → accept → checkout/capture → deliver →
 * revision → deliver → sign → approve → complete → review → record publication → verification,
 * plus authorization boundaries and the immutability trigger.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { artifactVersions, users, professionalProfiles, organizationMembers } from "@/server/db/schema";
import type { Viewer } from "@/server/auth/session";
import { authorizeAssignment, resolveAssignmentContext, can, NotFoundError } from "@/server/authz/policy";
import * as assignments from "@/server/domain/assignments/service";
import * as artifacts from "@/server/domain/artifacts/service";
import * as signing from "@/server/domain/signing/service";
import { submitReview, reputationSummary } from "@/server/domain/reviews/service";
import { matchProfessionals, searchProfessionals } from "@/server/domain/matching/service";
import { startCheckout, capturePayment, assignmentPaymentState } from "@/server/finance/payments";
import { balance } from "@/server/finance/ledger";
import { sendMessage, listMessages } from "@/server/domain/messages/service";
import { grantContentAccess } from "@/server/domain/admin/service";
import { aiService } from "@/server/ai/service";
import { AiPolicyError } from "@/server/ai/policy";
import { runRetention } from "@/server/jobs/retention";
import { runHousekeeping } from "@/server/jobs/housekeeping";
import { runPublicationMonitor } from "@/server/jobs/publication-monitor";
import { attachments, publishedWorks, offers } from "@/server/db/schema";
import { getStorage } from "@/server/storage";

async function viewerFor(email: string): Promise<Viewer> {
  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!u) throw new Error(`no user ${email}`);
  const [p] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, u.id)).limit(1);
  const memberships = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, u.id));
  return {
    userId: u.id,
    sessionId: "test-session",
    name: u.name,
    email: u.email,
    emailVerified: true,
    image: null,
    platformRole: u.platformRole,
    isAdmin: u.platformRole !== "USER",
    suspended: false,
    professionalProfileId: p?.id ?? null,
    professionalSlug: p?.slug ?? null,
    professionalVerificationStatus: p?.verificationStatus ?? null,
    organizations: memberships.map((m) => ({ organizationId: m.organizationId, role: m.role, name: "" })),
  };
}

async function main() {
  const customer = await viewerFor("customer@example.com");
  const eva = await viewerFor("eva@example.com");
  const anna = await viewerFor("anna@example.com");
  const admin = await viewerFor("admin@example.com");

  const { serviceCategories, languages } = await import("@/server/db/schema");
  const [cat] = await db.select().from(serviceCategories).where(eq(serviceCategories.slug, "rewriting")).limit(1);
  const [sv] = await db.select().from(languages).where(eq(languages.code, "sv")).limit(1);

  // 1. Create assignment (brain dump style, customer knows the subject)
  const created = await assignments.createAssignment(customer, {
    template: "EXPERT_BRAIN_DUMP",
    title: "How DSG servicing actually works",
    description: "Founder explains DSG servicing intervals and common mistakes.",
    serviceCategoryId: cat.id,
    languageCode: sv.code,
    requiredLanguageLevel: "PROFESSIONAL",
    editorialRequired: true,
    domainId: null,
    domainRequirement: "NOT_REQUIRED",
    targetAudience: "Workshop customers",
    intendedPublication: "Website",
    wordCount: 800,
    deadline: new Date(Date.now() + 7 * 86400000),
    sourceUrls: [],
    attributionRequirements: "",
    additionalInstructions: "",
    knowledgeSourceType: "FOUNDER_EXPERTISE",
    knowledgeProvidedByName: "Erik Svensson",
    knowledgeProvidedByTitle: "Founder",
    confidentiality: "PRIVATE",
    aiPolicy: null,
    budgetMinor: 500000,
    currency: "SEK",
    organizationId: null,
    sourceText: "byt olja i dsg lådan var 6000 mil annars går mekatroniken sönder\r\nfolk tror det är livstidsolja  ",
    attachmentIds: [],
    openImmediately: true,
  });
  console.log("assignment", created.publicId);

  // Authorization: Anna (not a participant) sees OPEN assignment as PROSPECT, no content
  const annaCtx = await authorizeAssignment(anna, created.publicId, "view_metadata");
  assert.equal(annaCtx.role, "PROSPECT");
  assert.equal(can(annaCtx, "view_content"), false);
  // Admin: metadata yes, content no
  const adminCtx = await authorizeAssignment(admin, created.publicId, "view_metadata");
  assert.equal(adminCtx.role, "ADMIN");
  assert.equal(can(adminCtx, "view_content"), false);

  // AI policy: PRIVATE defaults to metadata only → content processing must be blocked
  const [aRow] = await db.select().from((await import("@/server/db/schema")).assignments).where(eq((await import("@/server/db/schema")).assignments.publicId, created.publicId)).limit(1);
  assert.equal(aRow.aiPolicy, "AI_METADATA_ONLY");
  await assert.rejects(() => aiService.qualityHints(eva.userId, aRow, "text"), AiPolicyError);
  const meta = await aiService.categorizeMetadata(customer.userId, aRow, { domainPaths: ["automotive"] });
  assert.equal(meta, null, "gateway not configured → graceful null");

  // 2. Matching: Eva (native sv, editorial) should be first; Johan (no editorial) excluded
  const matches = await matchProfessionals(aRow, 5);
  assert.ok(matches.length >= 1);
  assert.equal(matches[0].slug, "eva-svensson");
  assert.ok(!matches.some((m) => m.slug === "johan-karlsson"), "non-editorial professional excluded");

  // 3. Invite Eva, Eva offers, customer accepts
  const cctx = await authorizeAssignment(customer, created.publicId, "invite_professional");
  await assignments.inviteProfessional(cctx, eva.userId, "Would love your help");
  const ectx = await authorizeAssignment(eva, created.publicId, "make_offer");
  assert.equal(ectx.role, "PROSPECT");
  const offerId = await assignments.createOffer(eva, ectx.assignment, { priceMinor: 450000, currency: "SEK", pricingModel: "FIXED_PRICE", turnaroundDays: 5, message: "I can do this.", listingId: null, contributionRole: "AUTHOR" });
  const cctx2 = await authorizeAssignment(customer, created.publicId, "accept_offer");
  assert.equal(cctx2.assignment.status, "OFFER_RECEIVED");
  await assignments.acceptOffer(cctx2, offerId);

  // 4. Payment (manual provider) → capture → IN_PROGRESS
  const checkout = await startCheckout({ assignmentId: cctx2.assignment.id, payerUserId: customer.userId, organizationId: null, email: customer.email });
  await capturePayment(checkout.paymentId, { actorType: "USER", actorUserId: customer.userId });
  const pay = await assignmentPaymentState(cctx2.assignment.id);
  assert.equal(pay.captured, true);
  assert.equal(await balance("PLATFORM_ESCROW", "platform", "SEK") >= 450000, true);
  let ctx = await authorizeAssignment(eva, created.publicId, "view_content");
  assert.equal(ctx.assignment.status, "IN_PROGRESS");
  assert.equal(ctx.role, "PROFESSIONAL");

  // Messaging
  await sendMessage({ assignmentId: ctx.assignment.id, senderUserId: eva.userId, senderName: eva.name, body: "Starting now." });
  const msgs = await listMessages(ctx.assignment.id);
  assert.ok(msgs.some((m) => m.kind === "TEXT" && m.body === "Starting now."));
  assert.ok(msgs.some((m) => m.kind === "SYSTEM"));

  // 5. Deliver V2, customer requests revision, deliver V3
  ctx = await authorizeAssignment(eva, created.publicId, "submit_version");
  const v2 = await artifacts.createVersion(ctx, { content: "Byt olja i DSG-lådan var 6 000 mil.", attachmentIds: [], label: "Professional rewrite", submit: true });
  assert.equal(v2.versionNumber, 2);
  ctx = await authorizeAssignment(customer, created.publicId, "request_revision");
  assert.equal(ctx.assignment.status, "DELIVERED");
  await artifacts.requestRevision(ctx, v2.id, "Please mention the mechatronic unit.");
  ctx = await authorizeAssignment(eva, created.publicId, "submit_version");
  assert.equal(ctx.assignment.status, "REVISION_REQUESTED");
  const v3 = await artifacts.createVersion(ctx, { content: "Byt olja i DSG-lådan var 6 000 mil, annars riskerar mekatroniken att skadas.\n", attachmentIds: [], label: "Final professional version", submit: true });

  // Review comment by customer on V3
  ctx = await authorizeAssignment(customer, created.publicId, "review_comment");
  await artifacts.addReviewComment(ctx, { versionId: v3.id, type: "TERMINOLOGY", domainVerdict: "CORRECT", anchorStart: 0, anchorEnd: 8, quotedText: "Byt olja", body: "Good.", suggestion: "" });

  // 6. Sign V3 (must reject wrong confirmation, old version)
  ctx = await authorizeAssignment(eva, created.publicId, "sign");
  await assert.rejects(() => signing.signVersion(ctx, { versionId: v3.id, confirmed: true, typedConfirmation: "nope" }));
  await assert.rejects(() => signing.signVersion(ctx, { versionId: v2.id, confirmed: true, typedConfirmation: "SIGN" }), /latest|submitted/);
  const signed = await signing.signVersion(ctx, { versionId: v3.id, confirmed: true, typedConfirmation: "SIGN" });
  console.log("record", signed.recordPublicId);
  assert.match(signed.recordPublicId, /^HA-[0-9A-HJKMNP-TV-Z]{26}$/);

  // Immutability trigger
  await assert.rejects(() => db.update(artifactVersions).set({ content: "tampered" }).where(eq(artifactVersions.id, v3.id)), (err: Error & { cause?: Error }) => /immutable/.test(err.cause?.message ?? err.message));
  const [unchanged] = await db.select({ content: artifactVersions.content, immutable: artifactVersions.immutable }).from(artifactVersions).where(eq(artifactVersions.id, v3.id));
  assert.equal(unchanged.immutable, true);
  assert.notEqual(unchanged.content, "tampered");

  // Record is private → public lookup returns null
  assert.equal(await signing.getPublicRecord(signed.recordPublicId), null);

  // 7. Customer approves → completes (payment captured)
  const evaBefore = await balance("PROFESSIONAL", eva.userId, "SEK");
  const revenueBefore = await balance("PLATFORM_REVENUE", "platform", "SEK");
  ctx = await authorizeAssignment(customer, created.publicId, "approve");
  assert.equal(ctx.assignment.status, "SIGNED");
  await signing.approveSignedVersion(ctx);
  ctx = await authorizeAssignment(customer, created.publicId, "view_metadata");
  assert.equal(ctx.assignment.status, "COMPLETED");
  assert.equal((await balance("PROFESSIONAL", eva.userId, "SEK")) - evaBefore, 450000 - Math.round(450000 * 0.15));
  assert.equal((await balance("PLATFORM_REVENUE", "platform", "SEK")) - revenueBefore, Math.round(450000 * 0.15));

  // 8. Review + reputation
  ctx = await authorizeAssignment(customer, created.publicId, "rate");
  await submitReview(ctx, { professionalUserId: eva.userId, rating: 5, onTime: true, comment: "Excellent.", dimensions: { QUALITY: 5 }, anonymized: true });
  const rep = await reputationSummary(eva.userId);
  assert.ok((rep?.completedAssignments ?? 0) >= 1);
  assert.equal(rep?.ratingAvg, 5);

  // 9. Publish record, verify hash
  ctx = await authorizeAssignment(customer, created.publicId, "manage_publication");
  const [rec] = await signing.listRecordsForAssignment(ctx.assignment.id);
  await signing.setRecordVisibility(ctx, rec.id, { visibility: "PUBLIC", customerDisplay: "PRIVATE_ORGANIZATION", titlePublic: true, hashPublic: true, publicationUrl: "https://example.com/dsg" });
  const pub = await signing.getPublicRecord(signed.recordPublicId);
  assert.ok(pub && pub.workTitle === "How DSG servicing actually works" && pub.contentHash);
  assert.ok(pub!.otherContributions.some((c) => c.role === "KNOWLEDGE_SOURCE"), "knowledge source appears in provenance");
  const match = await signing.verifyAgainstRecord(signed.recordPublicId, { text: "Byt olja i DSG-lådan var 6 000 mil, annars riskerar mekatroniken att skadas.\r\n\r\n" });
  assert.equal(match.result, "MATCH", "canonicalization ignores line endings");
  const mismatch = await signing.verifyAgainstRecord(signed.recordPublicId, { text: "Byt fälgar." });
  assert.equal(mismatch.result, "NO_MATCH");

  // 10. Admin content access grant
  const before = await resolveAssignmentContext(admin, ctx.assignment);
  assert.equal(can(before, "view_content"), false);
  await grantContentAccess(admin, ctx.assignment.id, "Support ticket #123: customer asked for help");
  const after = await resolveAssignmentContext(admin, ctx.assignment);
  assert.equal(can(after, "view_content"), true);

  // 11. Non-participant on a completed assignment → not found
  await assert.rejects(() => authorizeAssignment(anna, created.publicId, "view_metadata"), NotFoundError);

  // 12. Search
  const search = await searchProfessionals({ language: "sv", verified: "professional" });
  assert.ok(search.items.some((i) => i.slug === "eva-svensson"));
  const domainSearch = await searchProfessionals({ domain: "automotive" });
  assert.ok(domainSearch.items.some((i) => i.slug === "johan-karlsson"));

  // 13. Jobs: publication monitor with a fake fetcher, housekeeping expiry, retention of expired files
  const [work] = await db.select().from(publishedWorks).where(eq(publishedWorks.url, "https://example.com/dsg"));
  assert.ok(work);
  const monitor = await runPublicationMonitor({ intervalDays: 0, fetcher: async () => "<html><body><p>Byt olja i DSG-lådan var 6 000 mil, annars riskerar mekatroniken att skadas.</p></body></html>" });
  assert.ok(monitor.checked >= 1);
  const [checked] = await db.select().from(publishedWorks).where(eq(publishedWorks.id, work.id));
  assert.equal(checked.lastVerifiedState, "MATCHES");
  const changed = await runPublicationMonitor({ intervalDays: 0, fetcher: async () => "<p>something else</p>" });
  assert.ok(changed.changed >= 1);

  await db.update(offers).set({ expiresAt: new Date(Date.now() - 1000), status: "PENDING" }).where(eq(offers.id, offerId));
  const hk = await runHousekeeping();
  assert.ok(hk.offersExpired >= 1);
  const [expiredOffer] = await db.select({ status: offers.status }).from(offers).where(eq(offers.id, offerId));
  assert.equal(expiredOffer.status, "EXPIRED");

  const storage = getStorage();
  const retentionKey = `retention-test-${Date.now()}`;
  await storage.put(retentionKey, new Uint8Array([1, 2, 3]), "application/octet-stream");
  const [att] = await db.insert(attachments).values({ ownerUserId: customer.userId, purpose: "VERIFICATION_DOCUMENT", storageProvider: storage.name, storageKey: retentionKey, filename: "id.pdf", mimeType: "application/pdf", sizeBytes: 3, sha256: "abc", retentionUntil: new Date(Date.now() - 1000) }).returning({ id: attachments.id });
  const ret = await runRetention();
  assert.ok(ret.filesDeleted >= 1);
  const [deleted] = await db.select({ deletedAt: attachments.deletedAt }).from(attachments).where(eq(attachments.id, att.id));
  assert.ok(deleted.deletedAt);
  assert.equal(await storage.get(retentionKey), null);

  console.log("FLOW OK");
  process.exit(0);
}

main().catch((err) => {
  console.error("FLOW FAILED", err);
  process.exit(1);
});
