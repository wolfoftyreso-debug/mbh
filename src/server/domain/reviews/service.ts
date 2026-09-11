import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { assignmentParticipants, assignments, disputes, professionalProfiles, ratings, reviews, revisionRequests, users } from "@/server/db/schema";
import { audit } from "@/server/audit/log";
import { ConflictError, ValidationError } from "@/server/security/errors";
import type { AssignmentAuthContext } from "@/server/authz/policy";

import { RATING_DIMENSIONS } from "@/lib/constants";
export { RATING_DIMENSIONS };

/**
 * Only eligible completed transactions produce verified marketplace reviews:
 * the assignment must be COMPLETED and the reviewer must be on the customer side.
 */
export async function submitReview(ctx: AssignmentAuthContext, input: { professionalUserId: string; rating: number; onTime: boolean; comment: string; dimensions: Partial<Record<(typeof RATING_DIMENSIONS)[number], number>>; anonymized: boolean }): Promise<void> {
  if (ctx.assignment.status !== "COMPLETED") throw new ConflictError("Reviews can only be submitted for completed assignments");
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new ValidationError("Rating must be between 1 and 5");
  const [participant] = await db
    .select({ id: assignmentParticipants.id })
    .from(assignmentParticipants)
    .where(and(eq(assignmentParticipants.assignmentId, ctx.assignment.id), eq(assignmentParticipants.userId, input.professionalUserId), eq(assignmentParticipants.role, "PROFESSIONAL")))
    .limit(1);
  if (!participant) throw new ValidationError("That professional did not work on this assignment");
  const [existing] = await db.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.assignmentId, ctx.assignment.id), eq(reviews.reviewerUserId, ctx.viewer.userId))).limit(1);
  if (existing) throw new ConflictError("You have already reviewed this assignment");

  await db.transaction(async (tx) => {
    const [r] = await tx
      .insert(reviews)
      .values({
        assignmentId: ctx.assignment.id,
        reviewerUserId: ctx.viewer.userId,
        professionalUserId: input.professionalUserId,
        rating: input.rating,
        onTime: input.onTime,
        comment: input.comment.slice(0, 3000),
        anonymized: input.anonymized || ctx.assignment.confidentiality !== "STANDARD",
        displayName: input.anonymized ? null : ctx.viewer.name,
        verifiedTransaction: true,
      })
      .returning({ id: reviews.id });
    const dims = Object.entries(input.dimensions).filter(([, s]) => Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 5);
    if (dims.length) await tx.insert(ratings).values(dims.map(([dimension, score]) => ({ reviewId: r.id, dimension, score: score as number })));
    await audit({ actorType: "USER", actorUserId: ctx.viewer.userId, action: "REVIEW_SUBMITTED", entityType: "review", entityId: r.id, assignmentId: ctx.assignment.id, metadata: { rating: input.rating, professionalUserId: input.professionalUserId } }, tx);
  });
  await refreshReputation(input.professionalUserId);
}

/**
 * Reputation is structured data derived from real workflow events. The
 * denormalized counters on the profile are refreshed here.
 */
export async function refreshReputation(professionalUserId: string): Promise<void> {
  const [profile] = await db.select({ id: professionalProfiles.id }).from(professionalProfiles).where(eq(professionalProfiles.userId, professionalUserId)).limit(1);
  if (!profile) return;

  const completed = await db
    .select({ id: assignments.id, customerUserId: assignments.customerUserId, organizationId: assignments.organizationId, deadline: assignments.deadline, deliveredAt: assignments.deliveredAt, completedAt: assignments.completedAt })
    .from(assignmentParticipants)
    .innerJoin(assignments, eq(assignments.id, assignmentParticipants.assignmentId))
    .where(and(eq(assignmentParticipants.userId, professionalUserId), eq(assignmentParticipants.role, "PROFESSIONAL"), eq(assignments.status, "COMPLETED")));

  const customerKeys = completed.map((a) => a.organizationId ?? a.customerUserId);
  const counts = new Map<string, number>();
  for (const k of customerKeys) counts.set(k, (counts.get(k) ?? 0) + 1);
  const repeatCustomers = [...counts.values()].filter((n) => n > 1).length;

  const withDeadline = completed.filter((a) => a.deadline && a.deliveredAt);
  const onTime = withDeadline.filter((a) => a.deliveredAt! <= a.deadline!).length;
  const onTimeRateX100 = withDeadline.length ? Math.round((onTime / withDeadline.length) * 10000) : 0;

  const [rev] = await db.select({ n: count(), avg: sql<string>`coalesce(avg(${reviews.rating}), 0)` }).from(reviews).where(and(eq(reviews.professionalUserId, professionalUserId), isNull(reviews.hiddenByAdminAt)));
  const completedIds = completed.map((c) => c.id);
  const [revisions] = completedIds.length
    ? await db.select({ n: sql<string>`count(distinct ${revisionRequests.assignmentId})` }).from(revisionRequests).where(inArray(revisionRequests.assignmentId, completedIds))
    : [{ n: "0" }];
  const [disputeCount] = await db
    .select({ n: count() })
    .from(disputes)
    .innerJoin(assignments, eq(assignments.id, disputes.assignmentId))
    .where(eq(assignments.primaryProfessionalUserId, professionalUserId));
  const [first] = await db
    .select({ at: sql<Date | null>`min(${assignments.acceptedAt})` })
    .from(assignmentParticipants)
    .innerJoin(assignments, eq(assignments.id, assignmentParticipants.assignmentId))
    .where(and(eq(assignmentParticipants.userId, professionalUserId), eq(assignmentParticipants.role, "PROFESSIONAL")));

  await db
    .update(professionalProfiles)
    .set({
      completedAssignments: completed.length,
      repeatCustomers,
      ratingCount: Number(rev?.n ?? 0),
      ratingAvgX100: Math.round(Number(rev?.avg ?? 0) * 100),
      onTimeRateX100,
      revisionRateX100: completed.length ? Math.round((Number(revisions?.n ?? 0) / completed.length) * 10000) : 0,
      disputeCount: Number(disputeCount?.n ?? 0),
      firstActiveAt: first?.at ? new Date(first.at) : null,
    })
    .where(eq(professionalProfiles.id, profile.id));
}

export interface ReputationSummary {
  completedAssignments: number;
  signedWorks: number;
  repeatCustomers: number;
  ratingCount: number;
  ratingAvg: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  dimensionAverages: Record<string, number>;
  onTimeRate: number;
  revisionRate: number;
  disputeCount: number;
  yearsActive: number;
}

export async function reputationSummary(professionalUserId: string): Promise<ReputationSummary | null> {
  const [p] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, professionalUserId)).limit(1);
  if (!p) return null;
  const dist = await db.select({ rating: reviews.rating, n: count() }).from(reviews).where(and(eq(reviews.professionalUserId, professionalUserId), isNull(reviews.hiddenByAdminAt))).groupBy(reviews.rating);
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const d of dist) distribution[d.rating as 1 | 2 | 3 | 4 | 5] = Number(d.n);
  const dims = await db
    .select({ dimension: ratings.dimension, avg: sql<string>`avg(${ratings.score})` })
    .from(ratings)
    .innerJoin(reviews, eq(reviews.id, ratings.reviewId))
    .where(and(eq(reviews.professionalUserId, professionalUserId), isNull(reviews.hiddenByAdminAt)))
    .groupBy(ratings.dimension);
  const dimensionAverages: Record<string, number> = {};
  for (const d of dims) dimensionAverages[d.dimension] = Math.round(Number(d.avg) * 10) / 10;
  return {
    completedAssignments: p.completedAssignments,
    signedWorks: p.signedWorks,
    repeatCustomers: p.repeatCustomers,
    ratingCount: p.ratingCount,
    ratingAvg: p.ratingAvgX100 / 100,
    distribution,
    dimensionAverages,
    onTimeRate: p.onTimeRateX100 / 100,
    revisionRate: p.revisionRateX100 / 100,
    disputeCount: p.disputeCount,
    yearsActive: p.firstActiveAt ? Math.max(0, Math.floor((Date.now() - p.firstActiveAt.getTime()) / (365.25 * 86400000))) : 0,
  };
}

export interface PublicReview {
  id: string;
  rating: number;
  comment: string;
  displayName: string;
  createdAt: Date;
  context: string;
}

export async function publicReviews(professionalUserId: string, limit = 20): Promise<PublicReview[]> {
  const rows = await db
    .select({ r: reviews, languageCode: assignments.languageCode, template: assignments.template, reviewerName: users.name })
    .from(reviews)
    .innerJoin(assignments, eq(assignments.id, reviews.assignmentId))
    .innerJoin(users, eq(users.id, reviews.reviewerUserId))
    .where(and(eq(reviews.professionalUserId, professionalUserId), eq(reviews.publicVisible, true), isNull(reviews.hiddenByAdminAt)))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.r.id,
    rating: row.r.rating,
    comment: row.r.comment,
    displayName: row.r.anonymized ? "Verified customer" : (row.r.displayName ?? row.reviewerName),
    createdAt: row.r.createdAt,
    context: [row.languageCode ? row.languageCode.toUpperCase() : null, row.template === "DOMAIN_REVIEW" ? "domain review" : row.template === "EXPERT_BRAIN_DUMP" ? "knowledge-to-text" : "assignment"].filter(Boolean).join(" · "),
  }));
}
