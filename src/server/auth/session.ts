import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "./config";
import { db } from "@/server/db";
import { organizationMembers, professionalProfiles, users } from "@/server/db/schema";

export type PlatformRole = "USER" | "ADMIN" | "SUPER_ADMIN";

export interface Viewer {
  userId: string;
  sessionId: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  platformRole: PlatformRole;
  isAdmin: boolean;
  suspended: boolean;
  professionalProfileId: string | null;
  professionalSlug: string | null;
  professionalVerificationStatus: string | null;
  organizations: { organizationId: string; role: "OWNER" | "ADMIN" | "MEMBER" | "BILLING"; name: string }[];
}

/**
 * Loads the current viewer once per request (React cache). All authorization
 * decisions are made server-side from this object, never from client state.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const userId = session.user.id;

  const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!userRow || userRow.deletedAt) return null;

  const [profile] = await db
    .select({ id: professionalProfiles.id, slug: professionalProfiles.slug, status: professionalProfiles.verificationStatus })
    .from(professionalProfiles)
    .where(eq(professionalProfiles.userId, userId))
    .limit(1);

  const memberships = await db.query.organizationMembers.findMany({
    where: (m, { and, isNull }) => and(eq(m.userId, userId), isNull(m.removedAt)),
    with: { organization: { columns: { id: true, name: true } } },
  });

  return {
    userId,
    sessionId: session.session.id,
    name: userRow.name,
    email: userRow.email,
    emailVerified: userRow.emailVerified,
    image: userRow.image,
    platformRole: userRow.platformRole,
    isAdmin: userRow.platformRole === "ADMIN" || userRow.platformRole === "SUPER_ADMIN",
    suspended: Boolean(userRow.suspendedAt),
    professionalProfileId: profile?.id ?? null,
    professionalSlug: profile?.slug ?? null,
    professionalVerificationStatus: profile?.status ?? null,
    organizations: memberships
      .filter((m) => m.organization)
      .map((m) => ({ organizationId: m.organizationId, role: m.role, name: m.organization!.name })),
  };
});

export async function requireViewer(next?: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (viewer.suspended) redirect("/suspended");
  return viewer;
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer("/admin");
  if (!viewer.isAdmin) redirect("/dashboard?error=forbidden");
  return viewer;
}

export async function requireProfessional(): Promise<Viewer & { professionalProfileId: string }> {
  const viewer = await requireViewer("/professional");
  if (!viewer.professionalProfileId) redirect("/professional/onboarding");
  return viewer as Viewer & { professionalProfileId: string };
}

export { organizationMembers };
