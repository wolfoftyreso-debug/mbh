import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { adminActions, assignmentParticipants, assignments, organizationMembers } from "@/server/db/schema";
import type { Viewer } from "@/server/auth/session";

/**
 * Authorization model: USER + ORGANIZATION + ASSIGNMENT + ROLE + RESOURCE + ACTION.
 *
 * Every request for assignment resources goes through `authorizeAssignment`.
 * Platform administrators do NOT get routine content access: they may see
 * metadata, and content only through an explicit, time-boxed, audited grant
 * (`ADMIN_CONTENT_ACCESS` admin action).
 */

export type AssignmentAction =
  | "view_metadata"
  | "view_content"
  | "edit_brief"
  | "invite_professional"
  | "make_offer"
  | "accept_offer"
  | "send_message"
  | "upload_file"
  | "submit_version"
  | "request_revision"
  | "review_comment"
  | "sign"
  | "approve"
  | "pay"
  | "cancel"
  | "open_dispute"
  | "manage_publication"
  | "manage_confidentiality"
  | "rate"
  | "admin_inspect";

export type AssignmentRole = "CUSTOMER" | "ORG_MEMBER" | "PROFESSIONAL" | "PROSPECT" | "ADMIN_OBSERVER" | "ADMIN" | "NONE";

export interface AssignmentAuthContext {
  viewer: Viewer;
  assignment: typeof assignments.$inferSelect;
  role: AssignmentRole;
  orgRole: "OWNER" | "ADMIN" | "MEMBER" | "BILLING" | null;
  participantRoles: string[];
  adminContentGrant: boolean;
}

export class AuthorizationError extends Error {
  status = 403;
  constructor(message = "Not authorized") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends Error {
  status = 404;
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Resolves how the viewer relates to an assignment. */
export async function resolveAssignmentContext(viewer: Viewer, assignment: typeof assignments.$inferSelect): Promise<AssignmentAuthContext> {
  const base: AssignmentAuthContext = {
    viewer,
    assignment,
    role: "NONE",
    orgRole: null,
    participantRoles: [],
    adminContentGrant: false,
  };

  if (assignment.customerUserId === viewer.userId) {
    base.role = "CUSTOMER";
  }

  if (assignment.organizationId) {
    const [membership] = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, assignment.organizationId), eq(organizationMembers.userId, viewer.userId), isNull(organizationMembers.removedAt)))
      .limit(1);
    if (membership) {
      base.orgRole = membership.role;
      if (base.role === "NONE") base.role = "ORG_MEMBER";
    }
  }

  const [participant] = await db
    .select({ role: assignmentParticipants.role, contributionRoles: assignmentParticipants.contributionRoles })
    .from(assignmentParticipants)
    .where(and(eq(assignmentParticipants.assignmentId, assignment.id), eq(assignmentParticipants.userId, viewer.userId), isNull(assignmentParticipants.removedAt)))
    .limit(1);
  if (participant) {
    base.participantRoles = participant.contributionRoles;
    if (participant.role === "PROFESSIONAL") base.role = base.role === "CUSTOMER" ? "CUSTOMER" : "PROFESSIONAL";
    else if (participant.role === "ADMIN_OBSERVER" && base.role === "NONE") base.role = "ADMIN_OBSERVER";
  }

  // Professionals browsing the marketplace may see the brief (metadata) of open
  // assignments, or of assignments they were invited to, in order to make an offer.
  if (base.role === "NONE" && viewer.professionalProfileId) {
    if (assignment.status === "OPEN" || assignment.status === "OFFER_RECEIVED") {
      base.role = "PROSPECT";
    } else if (assignment.status === "PROFESSIONAL_INVITED") {
      const { assignmentInvitations } = await import("@/server/db/schema");
      const [inv] = await db
        .select({ id: assignmentInvitations.id })
        .from(assignmentInvitations)
        .where(and(eq(assignmentInvitations.assignmentId, assignment.id), eq(assignmentInvitations.professionalUserId, viewer.userId)))
        .limit(1);
      if (inv) base.role = "PROSPECT";
    }
  }

  if (base.role === "NONE" && viewer.isAdmin) {
    base.role = "ADMIN";
    const [grant] = await db
      .select({ id: adminActions.id })
      .from(adminActions)
      .where(
        and(
          eq(adminActions.adminUserId, viewer.userId),
          eq(adminActions.action, "ADMIN_CONTENT_ACCESS"),
          eq(adminActions.assignmentId, assignment.id),
          gt(adminActions.expiresAt, new Date()),
        ),
      )
      .limit(1);
    base.adminContentGrant = Boolean(grant);
  }

  return base;
}

const CUSTOMER_SIDE: AssignmentRole[] = ["CUSTOMER", "ORG_MEMBER"];

export function can(ctx: AssignmentAuthContext, action: AssignmentAction): boolean {
  const { role, orgRole, assignment } = ctx;
  const isCustomerSide = CUSTOMER_SIDE.includes(role) && orgRole !== "BILLING";
  const isBilling = role === "ORG_MEMBER" && (orgRole === "BILLING" || orgRole === "OWNER" || orgRole === "ADMIN");
  const isProfessional = role === "PROFESSIONAL";
  const isAdmin = role === "ADMIN";
  const active = !["CANCELLED", "COMPLETED"].includes(assignment.status);

  switch (action) {
    case "view_metadata":
      return role !== "NONE";
    case "view_content":
      if (isAdmin) return ctx.adminContentGrant;
      if (role === "ADMIN_OBSERVER") return true;
      return isCustomerSide || isProfessional;
    case "edit_brief":
      return isCustomerSide && ["DRAFT", "OPEN", "PROFESSIONAL_INVITED", "OFFER_RECEIVED"].includes(assignment.status);
    case "invite_professional":
      return isCustomerSide && ["DRAFT", "OPEN", "PROFESSIONAL_INVITED", "OFFER_RECEIVED"].includes(assignment.status);
    case "make_offer":
      return role === "PROSPECT" && ["OPEN", "PROFESSIONAL_INVITED", "OFFER_RECEIVED"].includes(assignment.status);
    case "accept_offer":
      return isCustomerSide && ["OPEN", "PROFESSIONAL_INVITED", "OFFER_RECEIVED"].includes(assignment.status);
    case "send_message":
      return (isCustomerSide || isProfessional) && active;
    case "upload_file":
      return (isCustomerSide || isProfessional) && active;
    case "submit_version":
      return isProfessional && ["ACCEPTED", "IN_PROGRESS", "DELIVERED", "REVISION_REQUESTED", "FINAL_REVIEW"].includes(assignment.status);
    case "request_revision":
      return isCustomerSide && ["DELIVERED", "FINAL_REVIEW", "SIGNED"].includes(assignment.status);
    case "review_comment":
      return (isCustomerSide || isProfessional) && active;
    case "sign":
      return isProfessional && ["DELIVERED", "FINAL_REVIEW", "REVISION_REQUESTED", "IN_PROGRESS"].includes(assignment.status);
    case "approve":
      return isCustomerSide && ["SIGNED", "DELIVERED", "FINAL_REVIEW"].includes(assignment.status);
    case "pay":
      return (isCustomerSide || isBilling) && ["ACCEPTED", "IN_PROGRESS", "DELIVERED", "FINAL_REVIEW", "SIGNED", "CUSTOMER_APPROVED"].includes(assignment.status);
    case "cancel":
      return isCustomerSide && ["DRAFT", "OPEN", "PROFESSIONAL_INVITED", "OFFER_RECEIVED", "ACCEPTED"].includes(assignment.status);
    case "open_dispute":
      return (isCustomerSide || isProfessional) && ["IN_PROGRESS", "DELIVERED", "REVISION_REQUESTED", "FINAL_REVIEW", "SIGNED", "CUSTOMER_APPROVED", "COMPLETED"].includes(assignment.status);
    case "manage_publication":
      return isCustomerSide && ["SIGNED", "CUSTOMER_APPROVED", "COMPLETED"].includes(assignment.status);
    case "manage_confidentiality":
      return role === "CUSTOMER" || (role === "ORG_MEMBER" && (orgRole === "OWNER" || orgRole === "ADMIN"));
    case "rate":
      return isCustomerSide && assignment.status === "COMPLETED";
    case "admin_inspect":
      return isAdmin;
    default:
      return false;
  }
}

/**
 * Loads an assignment by public id and authorizes an action. Throws NotFoundError
 * for both "does not exist" and "not visible" to prevent enumeration.
 */
export async function authorizeAssignment(viewer: Viewer, publicId: string, action: AssignmentAction): Promise<AssignmentAuthContext> {
  const [assignment] = await db.select().from(assignments).where(eq(assignments.publicId, publicId)).limit(1);
  if (!assignment) throw new NotFoundError();
  const ctx = await resolveAssignmentContext(viewer, assignment);
  if (ctx.role === "NONE") throw new NotFoundError();
  if (!can(ctx, action)) throw new AuthorizationError(`Action '${action}' is not permitted in status ${assignment.status}`);
  return ctx;
}

export async function authorizeAssignmentById(viewer: Viewer, assignmentId: string, action: AssignmentAction): Promise<AssignmentAuthContext> {
  const [assignment] = await db.select().from(assignments).where(eq(assignments.id, assignmentId)).limit(1);
  if (!assignment) throw new NotFoundError();
  const ctx = await resolveAssignmentContext(viewer, assignment);
  if (ctx.role === "NONE") throw new NotFoundError();
  if (!can(ctx, action)) throw new AuthorizationError(`Action '${action}' is not permitted in status ${assignment.status}`);
  return ctx;
}

/** Organization-level permissions. */
export function canManageOrganization(viewer: Viewer, organizationId: string): boolean {
  const m = viewer.organizations.find((o) => o.organizationId === organizationId);
  return Boolean(m && (m.role === "OWNER" || m.role === "ADMIN"));
}

export function isOrganizationMember(viewer: Viewer, organizationId: string): boolean {
  return viewer.organizations.some((o) => o.organizationId === organizationId);
}
