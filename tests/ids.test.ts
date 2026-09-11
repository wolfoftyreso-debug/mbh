import { describe, expect, it } from "vitest";
import { newAssignmentPublicId, newPublicRecordId, PUBLIC_RECORD_ID_PATTERN, ulid } from "@/lib/ids";

describe("identifiers", () => {
  it("generates ULIDs that sort by time", () => {
    const a = ulid(1000);
    const b = ulid(2000);
    expect(a.length).toBe(26);
    expect(a < b).toBe(true);
  });

  it("generates opaque public record ids with the configured prefix", () => {
    const id = newPublicRecordId("HA");
    expect(id.startsWith("HA-")).toBe(true);
    expect(PUBLIC_RECORD_ID_PATTERN.test(id)).toBe(true);
    expect(newPublicRecordId("HA")).not.toBe(id);
  });

  it("generates unpredictable assignment ids", () => {
    const ids = new Set(Array.from({ length: 100 }, () => newAssignmentPublicId()));
    expect(ids.size).toBe(100);
    expect([...ids][0]).toMatch(/^[0-9A-Z]{20}$/);
  });
});
