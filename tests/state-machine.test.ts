import { describe, expect, it } from "vitest";
import { assertTransition, availableTransitions, canTransition, InvalidTransitionError } from "@/server/domain/assignments/state-machine";

describe("assignment state machine", () => {
  it("allows the happy path", () => {
    const path: [string, string, string][] = [
      ["DRAFT", "OPEN", "CUSTOMER"],
      ["OPEN", "OFFER_RECEIVED", "PROFESSIONAL"],
      ["OFFER_RECEIVED", "ACCEPTED", "CUSTOMER"],
      ["ACCEPTED", "IN_PROGRESS", "SYSTEM"],
      ["IN_PROGRESS", "DELIVERED", "PROFESSIONAL"],
      ["DELIVERED", "REVISION_REQUESTED", "CUSTOMER"],
      ["REVISION_REQUESTED", "DELIVERED", "PROFESSIONAL"],
      ["DELIVERED", "SIGNED", "PROFESSIONAL"],
      ["SIGNED", "CUSTOMER_APPROVED", "CUSTOMER"],
      ["CUSTOMER_APPROVED", "COMPLETED", "SYSTEM"],
    ];
    for (const [from, to, actor] of path) {
      expect(canTransition(from as never, to as never, actor as never)).toBe(true);
    }
  });

  it("rejects customers signing and professionals approving", () => {
    expect(canTransition("DELIVERED", "SIGNED", "CUSTOMER")).toBe(false);
    expect(canTransition("SIGNED", "CUSTOMER_APPROVED", "PROFESSIONAL")).toBe(false);
    expect(() => assertTransition("SIGNED", "CUSTOMER_APPROVED", "PROFESSIONAL")).toThrow(InvalidTransitionError);
  });

  it("makes cancelled terminal and completed only disputable", () => {
    expect(availableTransitions("CANCELLED", "ADMIN")).toEqual([]);
    expect(availableTransitions("COMPLETED", "CUSTOMER")).toEqual(["DISPUTED"]);
  });

  it("does not let a customer cancel work in progress", () => {
    expect(canTransition("IN_PROGRESS", "CANCELLED", "CUSTOMER")).toBe(false);
    expect(canTransition("IN_PROGRESS", "CANCELLED", "ADMIN")).toBe(true);
  });
});
