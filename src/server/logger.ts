/**
 * Structured logger. Only identifiers and operational metadata may be logged;
 * never content bodies, tokens, documents or signed URLs.
 */
type Level = "debug" | "info" | "warn" | "error";

const FORBIDDEN_KEYS = /(content|body|token|secret|password|authorization|cookie|url_signed|document)/i;

function scrub(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (FORBIDDEN_KEYS.test(k)) {
      out[k] = "[redacted]";
    } else if (typeof v === "string" && v.length > 500) {
      out[k] = v.slice(0, 200) + `…[${v.length} chars]`;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function emit(level: Level, event: string, meta: Record<string, unknown> = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...scrub(meta) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== "production") emit("debug", event, meta);
  },
  info: (event: string, meta?: Record<string, unknown>) => emit("info", event, meta),
  warn: (event: string, meta?: Record<string, unknown>) => emit("warn", event, meta),
  error: (event: string, meta?: Record<string, unknown>) => emit("error", event, meta),
};
