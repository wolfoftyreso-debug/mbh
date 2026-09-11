import { logger } from "@/server/logger";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string; code?: string };

/**
 * Wraps a server action so that domain errors surface as safe messages and
 * unexpected errors never leak internals to the client.
 */
export async function safeAction<T>(name: string, fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    const e = err as Error & { status?: number; digest?: string };
    // Next.js redirect()/notFound() throw special errors that must propagate.
    if (typeof e.digest === "string" && (e.digest.startsWith("NEXT_REDIRECT") || e.digest === "NEXT_NOT_FOUND")) throw err;
    if (e.status && e.status < 500) {
      return { ok: false, error: e.message, code: e.name };
    }
    logger.error("action_failed", { action: name, error: e.message });
    return { ok: false, error: "Something went wrong. Please try again.", code: "INTERNAL" };
  }
}

export class ValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ConflictError extends Error {
  status = 409;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
