/**
 * Gateway path codec.
 *
 * Every browser request is routed through the same-origin proxy at `/api/g/<token>`
 * (see src/app/api/g/[...seg]/route.ts). The real backend origin and the real REST
 * paths never appear in the browser: the client sends an opaque token, the proxy
 * decodes it server-side and forwards to the backend it alone knows about.
 *
 * The token is a lightly-obfuscated (XOR + base64url) form of the real path. This is
 * deliberately reversible so the SAME function runs on both sides; its job is to keep
 * literal paths and the backend URL out of the Network tab, console and any log
 * scraper - NOT to be a cryptographic secret. The real access controls are: the proxy
 * only ever forwards to the single configured backend host, only accepts decoded paths
 * under an allow-list prefix, and (optionally) stamps a server-only gateway secret the
 * backend can require. A public SPA can never hide which call does what from someone
 * reading its JS - so we lock the reachable surface instead of pretending to hide it.
 */

// Multi-byte rolling key. Changing it only re-obfuscates the wire form; both sides
// share it, so client and server stay in lock-step automatically.
const KEY = [0x5f, 0x1d, 0xa7, 0x36, 0xc2, 0x88, 0x4b, 0xe9, 0x71, 0x3a, 0x9c, 0x64];

/** A single unpredictable byte (0-255); rotates the key so identical paths differ each call. */
function nonceByte(): number {
  try {
    const b = new Uint8Array(1);
    globalThis.crypto.getRandomValues(b);
    return b[0];
  } catch {
    return Math.floor(Math.random() * 256) & 0xff;
  }
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  // btoa/atob exist in both the browser and the Node/Edge runtime Next uses.
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(token: string): Uint8Array {
  const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Encode a real path (e.g. "/api/jobs/123") into an opaque gateway token. */
export function encodePath(path: string): string {
  const bytes = new TextEncoder().encode(path);
  const nonce = nonceByte();
  const out = new Uint8Array(bytes.length + 1);
  out[0] = nonce ^ KEY[0]; // carry the (masked) nonce so the decoder can reproduce the offset
  for (let i = 0; i < bytes.length; i++) out[i + 1] = bytes[i] ^ KEY[(i + nonce) % KEY.length];
  return bytesToB64url(out);
}

/** Decode a gateway token back to the real path. Returns "" if the token is malformed. */
export function decodePath(token: string): string {
  try {
    const raw = b64urlToBytes(token);
    if (raw.length < 1) return "";
    const nonce = raw[0] ^ KEY[0];
    const bytes = new Uint8Array(raw.length - 1);
    for (let i = 0; i < bytes.length; i++) bytes[i] = raw[i + 1] ^ KEY[(i + nonce) % KEY.length];
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

/** The client-facing prefix all proxied requests use. */
export const GATEWAY_PREFIX = "/api/g/";

/**
 * Turn a real backend path into its client-facing gateway URL, preserving any inline
 * query string untouched (query values are not sensitive and stay readable).
 */
export function toGatewayUrl(path: string): string {
  const qIdx = path.indexOf("?");
  const pathname = qIdx === -1 ? path : path.slice(0, qIdx);
  const query = qIdx === -1 ? "" : path.slice(qIdx);
  return GATEWAY_PREFIX + encodePath(pathname) + query;
}
