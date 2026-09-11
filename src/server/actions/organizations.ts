"use server";
import { revalidatePath } from "next/cache";
import { requireViewer } from "@/server/auth/session";
import { safeAction, type ActionResult } from "@/server/security/errors";
import * as orgs from "@/server/domain/organizations/service";

export async function createOrganizationAction(input: { name: string; country: string | null; billingEmail: string | null; website: string | null }): Promise<ActionResult<{ id: string }>> {
  const viewer = await requireViewer();
  return safeAction("createOrganization", async () => {
    const id = await orgs.createOrganization(viewer, input);
    revalidatePath("/organizations");
    return { id };
  });
}

export async function addMemberAction(organizationId: string, email: string, role: "ADMIN" | "MEMBER" | "BILLING"): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("addMember", async () => {
    await orgs.addMember(viewer, organizationId, email, role);
    revalidatePath(`/organizations/${organizationId}`);
    return undefined;
  });
}

export async function removeMemberAction(organizationId: string, memberId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("removeMember", async () => {
    await orgs.removeMember(viewer, organizationId, memberId);
    revalidatePath(`/organizations/${organizationId}`);
    return undefined;
  });
}

export async function updateMemberRoleAction(organizationId: string, memberId: string, role: "ADMIN" | "MEMBER" | "BILLING"): Promise<ActionResult> {
  const viewer = await requireViewer();
  return safeAction("updateMemberRole", async () => {
    await orgs.updateMemberRole(viewer, organizationId, memberId, role);
    revalidatePath(`/organizations/${organizationId}`);
    return undefined;
  });
}
