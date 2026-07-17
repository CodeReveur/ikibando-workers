/**
 * GET /api/bazabot/health
 *
 * Reports whether AI mode is active and reachable, without leaking secrets.
 * The UI uses `mode` to badge the assistant ("AI" vs "Assistant"); ops can use
 * `providerReachable` to confirm the inference server is up.
 */
import { loadConfig, isAiConfigured } from "@/lib/bazabot/config";
import { createProvider } from "@/lib/bazabot/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const cfg = loadConfig();
  const aiConfigured = isAiConfigured(cfg);

  let providerReachable = false;
  if (aiConfigured) {
    try { providerReachable = await createProvider(cfg).health(); } catch { providerReachable = false; }
  }

  return Response.json({
    mode: aiConfigured && providerReachable ? "ai" : "rules",
    engine: cfg.engine,
    model: cfg.model || null,
    embeddingModel: cfg.embeddingModel || null,
    semanticSearch: cfg.semanticSearch && !!cfg.embeddingModel,
    aiConfigured,
    providerReachable,
  });
}
