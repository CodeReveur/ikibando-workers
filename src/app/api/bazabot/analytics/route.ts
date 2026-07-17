/**
 * GET /api/bazabot/analytics
 *
 * Returns the in-memory analytics snapshot (intent distribution, tool usage,
 * knowledge success rate, fallback/escalation rates, latency). Contains no PII.
 * Protect behind an admin gate in production via BAZABOT_ANALYTICS_TOKEN.
 */
import { analytics } from "@/lib/bazabot/analytics/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const required = process.env.BAZABOT_ANALYTICS_TOKEN;
  if (required) {
    const auth = request.headers.get("authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (token !== required) return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json(analytics.snapshot());
}
