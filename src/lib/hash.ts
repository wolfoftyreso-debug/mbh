import { createHash } from "node:crypto";

/**
 * Canonicalization ensures that trivial differences (line endings, trailing
 * whitespace, Unicode normalization form) do not change the fingerprint of a
 * signed artifact. The canonical form is documented in docs/ARCHITECTURE.md.
 */
export function canonicalizeText(input: string): string {
  return input
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n+$/g, "");
}

export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export function hashText(text: string): string {
  return sha256Hex(canonicalizeText(text));
}

/**
 * Content hash of a version: sha256 over the canonical text plus the sorted
 * hashes of attached files, so that a file-only or mixed version is also
 * uniquely fingerprinted.
 */
export function hashVersion(text: string | null | undefined, fileHashes: string[] = []): string {
  const parts = [`text:${text ? hashText(text) : "none"}`, ...[...fileHashes].sort().map((h) => `file:${h}`)];
  return sha256Hex(parts.join("\n"));
}

export { fingerprint } from "./fingerprint";

export function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  const m = text.trim().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return m ? m.length : 0;
}

export function hashIp(ip: string | null | undefined, salt: string): string | null {
  if (!ip) return null;
  return sha256Hex(`${salt}:${ip}`).slice(0, 32);
}
