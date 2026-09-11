import { describe, expect, it } from "vitest";
import { can, type AssignmentAuthContext } from "@/server/authz/policy";

function ctx(overrides: Partial<AssignmentAuthContext> & { status: string; role: AssignmentAuthContext["role"] }): AssignmentAuthContext {
  return {
    viewer: { userId: "u", isAdmin: overrides.role === "ADMIN" } as AssignmentAuthContext["viewer"],
    assignment: { status: overrides.status, customerUserId: "c" } as AssignmentAuthContext["assignment"],
    role: overrides.role,
    orgRole: overrides.orgRole ?? null,
    participantRoles: [],
    adminContentGrant: overrides.adminContentGrant ?? false,
  };
}

describe("assignment authorization", () => {
  it("denies admins content without an explicit grant", () => {
    expect(can(ctx({ status: "IN_PROGRESS", role: "ADMIN" }), "view_content")).toBe(false);
    expect(can(ctx({ status: "IN_PROGRESS", role: "ADMIN", adminContentGrant: true }), "view_content")).toBe(true);
    expect(can(ctx({ status: "IN_PROGRESS", role: "ADMIN" }), "view_metadata")).toBe(true);
  });

  it("lets only professionals sign and only customers approve", () => {
    expect(can(ctx({ status: "DELIVERED", role: "PROFESSIONAL" }), "sign")).toBe(true);
    expect(can(ctx({ status: "DELIVERED", role: "CUSTOMER" }), "sign")).toBe(false);
    expect(can(ctx({ status: "SIGNED", role: "CUSTOMER" }), "approve")).toBe(true);
    expect(can(ctx({ status: "SIGNED", role: "PROFESSIONAL" }), "approve")).toBe(false);
  });

  it("limits billing members to payment and metadata", () => {
    const billing = ctx({ status: "ACCEPTED", role: "ORG_MEMBER", orgRole: "BILLING" });
    expect(can(billing, "pay")).toBe(true);
    expect(can(billing, "view_content")).toBe(false);
    expect(can(billing, "send_message")).toBe(false);
  });

  it("denies everything to non-participants", () => {
    const none = ctx({ status: "OPEN", role: "NONE" });
    expect(can(none, "view_metadata")).toBe(false);
    expect(can(none, "make_offer")).toBe(false);
  });

  it("only allows publication management once signed", () => {
    expect(can(ctx({ status: "IN_PROGRESS", role: "CUSTOMER" }), "manage_publication")).toBe(false);
    expect(can(ctx({ status: "COMPLETED", role: "CUSTOMER" }), "manage_publication")).toBe(true);
  });
});
