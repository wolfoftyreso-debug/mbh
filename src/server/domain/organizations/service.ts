import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { organizationMembers, organizations, users } from "@/server/db/schema";
import { slugify } from "@/lib/utils";
import { audit } from "@/server/audit/log";
import { notify } from "@/server/notifications/service";
import { ConflictError, ValidationError } from "@/server/security/errors";
import type { Viewer } from "@/server/auth/session";
import { AuthorizationError, canManageOrganization } from "@/server/authz/policy";

type OrgRole = "OWNER" | "ADMIN" | "MEMBER" | "BILLING";

export async function createOrganization(viewer: Viewer, input: { name: string; country: string | null; billingEmail: string | null; website: string | null }): Promise<string> {
  if (input.name.trim().length < 2) throw new ValidationError("Organization name is required");
  let slug = slugify(input.name);
  const [existing] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, slug)).limit(1);
  if (existing) slug = `${slug}-${Date.now().toString(36)}`;
  return db.transaction(async (tx) => {
    const [org] = await tx.insert(organizations).values({ name: input.name.trim(), slug, country: input.country?.toUpperCase() ?? null, billingEmail: input.billingEmail, website: input.website, createdByUserId: viewer.userId }).returning({ id: organizations.id });
    await tx.insert(organizationMembers).values({ organizationId: org.id, userId: viewer.userId, role: "OWNER", acceptedAt: new Date() });
    await audit({ actorType: "USER", actorUserId: viewer.userId, action: "ORGANIZATION_CREATED", entityType: "organization", entityId: org.id }, tx);
    return org.id;
  });
}

export async function addMember(viewer: Viewer, organizationId: string, email: string, role: OrgRole): Promise<void> {
  if (!canManageOrganization(viewer, organizationId)) throw new AuthorizationError("Only organization owners and admins can add members");
  const normalized = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) throw new ValidationError("Invalid e-mail address");
  const [user] = await db.select({ id: users.id, emailVerified: users.emailVerified }).from(users).where(eq(users.email, normalized)).limit(1);
  const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (user) {
    const [existing] = await db.select({ id: organizationMembers.id }).from(organizationMembers).where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, user.id), isNull(organizationMembers.removedAt))).limit(1);
    if (existing) throw new ConflictError("That person is already a member");
    await db.insert(organizationMembers).values({ organizationId, userId: user.id, role, invitedByUserId: viewer.userId, acceptedAt: new Date() });
    await notify(user.id, "ORGANIZATION_INVITE", { organizationName: org?.name ?? "an organization", inviterName: viewer.name });
    await audit({ actorType: "USER", actorUserId: viewer.userId, action: "ORGANIZATION_MEMBER_ADDED", entityType: "organization", entityId: organizationId, metadata: { userId: user.id, role } });
  } else {
    // Pending membership: attaches automatically when that verified e-mail signs in.
    await db.insert(organizationMembers).values({ organizationId, invitedEmail: normalized, role, invitedByUserId: viewer.userId });
    await audit({ actorType: "USER", actorUserId: viewer.userId, action: "ORGANIZATION_MEMBER_ADDED", entityType: "organization", entityId: organizationId, metadata: { pending: true, role } });
  }
}

export async function removeMember(viewer: Viewer, organizationId: string, memberId: string): Promise<void> {
  if (!canManageOrganization(viewer, organizationId)) throw new AuthorizationError("Not permitted");
  const [m] = await db.select().from(organizationMembers).where(and(eq(organizationMembers.id, memberId), eq(organizationMembers.organizationId, organizationId))).limit(1);
  if (!m) throw new ValidationError("Member not found");
  if (m.role === "OWNER") throw new ValidationError("The owner cannot be removed");
  await db.update(organizationMembers).set({ removedAt: new Date() }).where(eq(organizationMembers.id, memberId));
  await audit({ actorType: "USER", actorUserId: viewer.userId, action: "ORGANIZATION_MEMBER_REMOVED", entityType: "organization", entityId: organizationId, metadata: { memberId } });
}

export async function updateMemberRole(viewer: Viewer, organizationId: string, memberId: string, role: OrgRole): Promise<void> {
  if (!canManageOrganization(viewer, organizationId)) throw new AuthorizationError("Not permitted");
  if (role === "OWNER") throw new ValidationError("Ownership transfer is not supported yet");
  const [m] = await db.select().from(organizationMembers).where(and(eq(organizationMembers.id, memberId), eq(organizationMembers.organizationId, organizationId))).limit(1);
  if (!m || m.role === "OWNER") throw new ValidationError("Member not found");
  await db.update(organizationMembers).set({ role }).where(eq(organizationMembers.id, memberId));
}

/** Attaches pending e-mail memberships when a user with that verified e-mail exists. */
export async function attachPendingMemberships(userId: string, email: string, emailVerified: boolean): Promise<void> {
  if (!emailVerified) return;
  await db.update(organizationMembers).set({ userId, acceptedAt: new Date(), invitedEmail: null }).where(and(eq(organizationMembers.invitedEmail, email.toLowerCase()), isNull(organizationMembers.userId), isNull(organizationMembers.removedAt)));
}

export async function listOrganizationsForViewer(viewer: Viewer) {
  const ids = viewer.organizations.map((o) => o.organizationId);
  if (!ids.length) return [];
  const orgs = await db.select().from(organizations).where(isNull(organizations.deletedAt));
  return orgs.filter((o) => ids.includes(o.id)).map((o) => ({ ...o, role: viewer.organizations.find((m) => m.organizationId === o.id)?.role ?? "MEMBER" }));
}

export async function getOrganizationWithMembers(viewer: Viewer, organizationId: string) {
  if (!viewer.organizations.some((o) => o.organizationId === organizationId)) throw new AuthorizationError("Not a member");
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!org) throw new ValidationError("Organization not found");
  const members = await db
    .select({ m: organizationMembers, name: users.name, email: users.email })
    .from(organizationMembers)
    .leftJoin(users, eq(users.id, organizationMembers.userId))
    .where(and(eq(organizationMembers.organizationId, organizationId), isNull(organizationMembers.removedAt)));
  return { org, members: members.map((r) => ({ id: r.m.id, role: r.m.role, name: r.name, email: r.email ?? r.m.invitedEmail, pending: !r.m.userId })) };
}
