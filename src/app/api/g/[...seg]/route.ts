/**
 * Same-origin backend gateway (BFF proxy).
 *
 * This is the ONLY place in the app that knows the real backend origin. The browser
 * talks exclusively to this route on our own origin ("/api/g/<token>"); we decode the
 * token to the real REST path server-side and forward the call. As a result the
 * backend URL and the real endpoint paths never appear in the Network tab, the console,
 * client bundles, or any analytics/log scraper.
 *
 * Hardening:
 *  - Forwards ONLY to the single configured backend host - never an arbitrary URL.
 *  - Accepts only decoded paths under an allow-list prefix ("/api/"), with no traversal,
 *    so a crafted token can't be used to reach non-API surfaces (e.g. /actuator).
 *  - Optionally stamps a server-only secret header (GATEWAY_SECRET) the backend can
 *    require, so a leaked backend URL still can't be hit directly.
 *  - Fails silently: on any transport error it returns a generic 502 and logs nothing
 *    that reveals the backend URL, path, or a stack trace.
 */
import { decodePath } from "@/lib/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND =
  (process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8088").replace(/\/+$/, "");
const GATEWAY_SECRET = process.env.GATEWAY_SECRET ?? "";

// Only paths under these prefixes may be reached through the gateway.
const ALLOW_PREFIXES = ["/api/"];

// Request headers we must not copy through (hop-by-hop / recomputed by fetch).
const STRIP_REQUEST = new Set([
  "host", "connection", "content-length", "transfer-encoding", "keep-alive",
  "upgrade", "expect", "te", "trailer", "accept-encoding",
]);

// Response headers we must not copy back (fetch already decoded the body).
const STRIP_RESPONSE = new Set([
  "content-encoding", "content-length", "transfer-encoding", "connection",
  "keep-alive", "trailer",
]);

function badGateway(): Response {
  // Deliberately opaque: no backend URL, no path, no reason string.
  return new Response(JSON.stringify({ message: "Service temporarily unavailable" }), {
    status: 502,
    headers: { "content-type": "application/json" },
  });
}

async function handle(req: Request, seg: string[]): Promise<Response> {
  // The token is the (single) path segment after /api/g/.
  const token = Array.isArray(seg) ? seg.join("/") : "";
  const path = decodePath(token);

  // Reject anything that isn't a clean, allow-listed backend API path.
  if (
    !path ||
    !path.startsWith("/") ||
    path.includes("..") ||
    path.includes("://") ||
    !ALLOW_PREFIXES.some(p => path.startsWith(p))
  ) {
    return new Response(JSON.stringify({ message: "Not found" }), {
      status: 404, headers: { "content-type": "application/json" },
    });
  }

  const incoming = new URL(req.url);
  const target = `${BACKEND}${path}${incoming.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!STRIP_REQUEST.has(key.toLowerCase())) headers.set(key, value);
  });
  if (GATEWAY_SECRET) headers.set("x-gateway-key", GATEWAY_SECRET);

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    // Network/DNS/timeout - stay silent, reveal nothing.
    return badGateway();
  }

  const respHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIP_RESPONSE.has(key.toLowerCase())) respHeaders.set(key, value);
  });

  const buf = await upstream.arrayBuffer();
  return new Response(buf, { status: upstream.status, headers: respHeaders });
}

type Ctx = { params: Promise<{ seg: string[] }> };

async function route(req: Request, ctx: Ctx): Promise<Response> {
  const { seg } = await ctx.params;
  return handle(req, seg);
}

export { route as GET, route as POST, route as PUT, route as PATCH, route as DELETE, route as HEAD };
