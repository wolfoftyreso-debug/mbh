import { describe, expect, it } from "vitest";
import { canonicalizeText, countWords, fingerprint, hashText, hashVersion, sha256Hex } from "@/lib/hash";

describe("content hashing", () => {
  it("normalizes line endings, trailing whitespace and unicode form", () => {
    const a = "Hej världen  \r\nRad två\t\r\n\r\n";
    const b = "Hej världen\nRad två";
    expect(canonicalizeText(a)).toBe(canonicalizeText(b));
    expect(hashText(a)).toBe(hashText(b));
  });

  it("changes when content materially changes", () => {
    expect(hashText("Byt däck när mönstret är slitet.")).not.toBe(hashText("Byt fälgar när mönstret är slitet."));
  });

  it("includes file hashes independent of order", () => {
    const h1 = hashVersion("text", ["aaa", "bbb"]);
    const h2 = hashVersion("text", ["bbb", "aaa"]);
    expect(h1).toBe(h2);
    expect(hashVersion("text", ["aaa"])).not.toBe(h1);
    expect(hashVersion(null, ["aaa"])).not.toBe(hashVersion("text", ["aaa"]));
  });

  it("produces sha256 hex and a readable fingerprint", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(fingerprint(sha256Hex("abc"))).toBe("BA78 16BF 8F01 CFEA");
  });

  it("counts words across scripts", () => {
    expect(countWords("Det här är fem ord.")).toBe(5);
    expect(countWords("")).toBe(0);
    expect(countWords(null)).toBe(0);
  });
});
