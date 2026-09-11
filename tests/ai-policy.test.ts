import { describe, expect, it } from "vitest";
import { assertAiAllowed, defaultAiPolicyFor, isAiAllowed, maxAiPolicyFor, AiPolicyError } from "@/server/ai/policy";

describe("AI processing policy", () => {
  it("blocks content when disabled and allows metadata only when configured", () => {
    expect(isAiAllowed("AI_DISABLED", "CONTENT")).toBe(false);
    expect(isAiAllowed("AI_DISABLED", "METADATA")).toBe(false);
    expect(isAiAllowed("AI_METADATA_ONLY", "METADATA")).toBe(true);
    expect(isAiAllowed("AI_METADATA_ONLY", "CONTENT")).toBe(false);
    expect(isAiAllowed("AI_ALLOWED", "CONTENT")).toBe(true);
    expect(isAiAllowed("AI_DISABLED", "NONE")).toBe(true);
  });

  it("defaults conservatively by confidentiality", () => {
    expect(defaultAiPolicyFor("STRICT_CONFIDENTIAL")).toBe("AI_DISABLED");
    expect(defaultAiPolicyFor("PRIVATE")).toBe("AI_METADATA_ONLY");
    expect(maxAiPolicyFor("STRICT_CONFIDENTIAL")).not.toContain("AI_ALLOWED");
  });

  it("throws a policy error for blocked processing", () => {
    expect(() => assertAiAllowed({ aiPolicy: "AI_DISABLED", confidentiality: "STRICT_CONFIDENTIAL" }, "CONTENT")).toThrow(AiPolicyError);
  });
});
