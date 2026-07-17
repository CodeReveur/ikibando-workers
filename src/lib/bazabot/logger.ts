/**
 * Tiny structured logger. Server-side only. Silent unless BAZABOT_DEBUG is on,
 * except for warnings/errors which always surface. Never logs raw user tokens.
 */

type Level = "debug" | "info" | "warn" | "error";

function redact(meta: unknown): unknown {
  if (!meta || typeof meta !== "object") return meta;
  const clone: Record<string, unknown> = { ...(meta as Record<string, unknown>) };
  for (const k of Object.keys(clone)) {
    if (/token|password|secret|authorization|apikey|api_key/i.test(k)) clone[k] = "[redacted]";
  }
  return clone;
}

function emit(level: Level, msg: string, meta?: unknown) {
  const debug = /^(1|true|yes|on)$/i.test(process.env.BAZABOT_DEBUG ?? "");
  if (level === "debug" && !debug) return;
  const line = `[bazabot:${level}] ${msg}`;
  const payload = meta === undefined ? "" : redact(meta);
  // eslint-disable-next-line no-console
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (payload === "") fn(line); else fn(line, payload);
}

export const log = {
  debug: (m: string, meta?: unknown) => emit("debug", m, meta),
  info: (m: string, meta?: unknown) => emit("info", m, meta),
  warn: (m: string, meta?: unknown) => emit("warn", m, meta),
  error: (m: string, meta?: unknown) => emit("error", m, meta),
};
