/**
 * Security guard: input sanitization, prompt-injection dampening, and a simple
 * per-session sliding-window rate limiter. Defence in depth — the tool registry
 * already validates args and enforces auth; this stops abusive input before it
 * reaches the model.
 */

const MAX_INPUT_CHARS = 2000;

/** Phrases that try to hijack the system instructions. Neutralised, not blocked. */
const INJECTION_PATTERNS = [
  /ignore (all )?(previous|prior|above) (instructions|prompts)/i,
  /disregard (the )?(system|previous) (prompt|message|instructions)/i,
  /you are now [a-z ]+ (mode|assistant|ai)/i,
  /reveal (your )?(system prompt|instructions|hidden)/i,
  /print (your )?(system prompt|instructions)/i,
];

/**
 * Replace control characters with spaces, keeping tab/newline/carriage-return.
 * Done by codepoint check to avoid embedding raw control chars in source.
 */
function stripControlChars(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    const isAllowedWhitespace = c === 9 || c === 10 || c === 13;
    const isControl = c < 32 || c === 127;
    out += isControl && !isAllowedWhitespace ? " " : ch;
  }
  return out;
}

export interface SanitizeResult {
  clean: string;
  /** True if injection-looking content was detected (still processed, but flagged). */
  suspectedInjection: boolean;
}

/** Trim, cap length, strip control chars, and flag injection attempts. */
export function sanitizeInput(raw: string): SanitizeResult {
  let clean = stripControlChars((raw ?? "").normalize("NFC")).trim();
  if (clean.length > MAX_INPUT_CHARS) clean = clean.slice(0, MAX_INPUT_CHARS);
  const suspectedInjection = INJECTION_PATTERNS.some(p => p.test(clean));
  return { clean, suspectedInjection };
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

/** Returns true if the session is within its per-minute budget. */
export function checkRateLimit(sessionId: string, limitPerMinute: number): boolean {
  const now = Date.now();
  const arr = (hits.get(sessionId) ?? []).filter(t => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(sessionId, arr);
  // Opportunistic cleanup to bound the map.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some(t => now - t < WINDOW_MS)) hits.delete(k);
  }
  return arr.length <= limitPerMinute;
}
