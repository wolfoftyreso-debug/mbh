import { randomBytes, randomUUID } from "node:crypto";

/**
 * ULID implementation (Crockford base32, 26 chars, time-sortable). No external
 * dependency so the ID format is fully under our control.
 */
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeTime(now: number, len: number): string {
  let str = "";
  for (let i = len - 1; i >= 0; i--) {
    const mod = now % 32;
    str = ENCODING[mod] + str;
    now = (now - mod) / 32;
  }
  return str;
}

function encodeRandom(len: number): string {
  const bytes = randomBytes(len);
  let str = "";
  for (let i = 0; i < len; i++) {
    str += ENCODING[bytes[i] % 32];
  }
  return str;
}

export function ulid(now: number = Date.now()): string {
  return encodeTime(now, 10) + encodeRandom(16);
}

/** Primary key generator for domain tables. */
export function newId(): string {
  return ulid();
}

/** Public, opaque record identifier such as HA-01JZ.... Never sequential. */
export function newPublicRecordId(prefix = process.env.RECORD_ID_PREFIX || "HA"): string {
  return `${prefix}-${ulid()}`;
}

/** Short unpredictable public id for assignments (URL-safe, 20 chars). */
export function newAssignmentPublicId(): string {
  return encodeRandom(20);
}

export function uuid(): string {
  return randomUUID();
}

/** Unpredictable storage key for private file storage. */
export function newStorageKey(ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 8);
  return `${ulid()}-${randomBytes(12).toString("hex")}${safeExt ? "." + safeExt : ""}`;
}

export const PUBLIC_RECORD_ID_PATTERN = /^[A-Z]{1,6}-[0-9A-HJKMNP-TV-Z]{26}$/;
