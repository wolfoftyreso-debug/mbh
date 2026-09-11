import { describe, expect, it } from "vitest";
import { formatMoney, platformFee, toMinor } from "@/lib/money";
import { capturePostings, payoutPostings, refundPostings, releasePostings, sumEntries } from "@/server/finance/ledger";

describe("money", () => {
  it("uses integer minor units", () => {
    expect(toMinor("1234,56", "SEK")).toBe(123456);
    expect(toMinor(10, "SEK")).toBe(1000);
    expect(platformFee(123456, 1500)).toBe(18518);
    expect(formatMoney(123456, "SEK", "en-GB")).toContain("1,234.56");
  });
});

describe("ledger postings", () => {
  const base = { paymentId: "p1", assignmentId: "a1", payerUserId: "cust", amountMinor: 100000, currency: "SEK" };

  it("balances escrow across capture, release and payout", () => {
    const capture = capturePostings(base);
    const release = releasePostings({ ...base, professionalUserId: "pro", feeMinor: 15000 });
    const payout = payoutPostings({ payoutId: "po1", professionalUserId: "pro", amountMinor: 85000, currency: "SEK" });
    const all = [...capture, ...release, ...payout];
    const bal = (account: string, ref: string) => sumEntries(all.filter((e) => e.account === account && e.accountRef === ref));
    expect(bal("PLATFORM_ESCROW", "platform")).toBe(0);
    expect(bal("PLATFORM_REVENUE", "platform")).toBe(15000);
    expect(bal("PROFESSIONAL", "pro")).toBe(0);
    expect(bal("CUSTOMER", "cust")).toBe(-100000);
    expect(sumEntries(all.filter((e) => e.type !== "PAYOUT"))).toBe(0);
  });

  it("refunds reduce escrow and credit the customer", () => {
    const all = [...capturePostings(base), ...refundPostings({ ...base, amountMinor: 40000, refundRef: "r1" })];
    expect(sumEntries(all.filter((e) => e.account === "PLATFORM_ESCROW"))).toBe(60000);
    expect(sumEntries(all.filter((e) => e.account === "CUSTOMER"))).toBe(-60000);
  });

  it("uses deterministic idempotency keys", () => {
    const keys = capturePostings(base).map((e) => e.idempotencyKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(capturePostings(base).map((e) => e.idempotencyKey)).toEqual(keys);
  });
});
