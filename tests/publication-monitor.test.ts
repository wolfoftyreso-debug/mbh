import { describe, expect, it } from "vitest";
import { htmlToComparableText, pageContainsSignedText } from "@/server/jobs/publication-monitor";

describe("publication monitor", () => {
  const signed = "Byt olja i DSG-lådan var 6 000 mil,\nannars riskerar mekatroniken att skadas.";
  it("finds the signed text inside rendered HTML regardless of markup and whitespace", () => {
    const html = `<html><head><style>p{}</style><script>x()</script></head><body><h1>DSG</h1><p>Byt olja i   DSG-lådan var 6&nbsp;000 mil,</p><p>annars riskerar mekatroniken att skadas.</p></body></html>`;
    expect(pageContainsSignedText(html, signed)).toBe(true);
  });
  it("detects changed content", () => {
    expect(pageContainsSignedText("<p>Byt fälgar var 6 000 mil.</p>", signed)).toBe(false);
  });
  it("strips scripts and entities", () => {
    expect(htmlToComparableText("<script>evil()</script><p>a &amp; b</p>")).toBe("a & b");
  });
});
