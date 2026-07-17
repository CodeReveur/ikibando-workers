/**
 * Analytics, backed by the shared KV store.
 *
 * Tracks the signals that help improve the assistant: intent distribution, tool
 * usage, knowledge hit/miss, fallback + escalation rates, latency, completion.
 * No PII — messages are never stored, only derived counters. Because it uses the
 * KV store, counters aggregate across instances when Redis is enabled.
 *
 * Track methods are fire-and-forget (call sites use `void analytics.x(...)`) so
 * they never add latency to a user turn.
 */
import { getKV } from "../store/kv";

const H_META = "an:meta";
const H_SOURCE = "an:source";
const H_INTENT = "an:intent";
const H_TOOLS = "an:tools";
const H_TOOL_FAIL = "an:toolfail";

async function inc(hash: string, field: string, by = 1): Promise<void> {
  try { (await getKV()).hincr(hash, field, by); } catch { /* analytics must never throw */ }
}

export const analytics = {
  async turn(source: string, intent: string, latencyMs: number, escalated: boolean): Promise<void> {
    await Promise.all([
      inc(H_META, "totalTurns"),
      inc(H_SOURCE, source),
      inc(H_INTENT, intent),
      inc(H_META, "latencySumMs", Math.round(latencyMs)),
      inc(H_META, "latencyCount"),
      escalated ? inc(H_META, "escalations") : Promise.resolve(),
    ]);
  },
  async tool(name: string, ok: boolean): Promise<void> {
    await inc(H_TOOLS, name);
    if (!ok) await inc(H_TOOL_FAIL, name);
  },
  async knowledge(hit: boolean): Promise<void> {
    await inc(H_META, hit ? "knowledgeHits" : "knowledgeMisses");
  },
  async fallback(): Promise<void> {
    await inc(H_META, "fallbacks");
  },
  /** Snapshot for the admin dashboard. Aggregates across instances via KV. */
  async snapshot() {
    const kv = await getKV();
    const [meta, bySource, byIntent, toolCalls, toolFailures] = await Promise.all([
      kv.hgetallNum(H_META), kv.hgetallNum(H_SOURCE), kv.hgetallNum(H_INTENT),
      kv.hgetallNum(H_TOOLS), kv.hgetallNum(H_TOOL_FAIL),
    ]);
    const totalTurns = meta.totalTurns ?? 0;
    const latencyCount = meta.latencyCount ?? 0;
    const kbHits = meta.knowledgeHits ?? 0;
    const kbMisses = meta.knowledgeMisses ?? 0;
    const kbTotal = kbHits + kbMisses;
    return {
      totalTurns,
      bySource, byIntent, toolCalls, toolFailures,
      knowledge: {
        hits: kbHits, misses: kbMisses,
        successRate: kbTotal ? +(kbHits / kbTotal).toFixed(3) : 0,
      },
      fallbackRate: totalTurns ? +((meta.fallbacks ?? 0) / totalTurns).toFixed(3) : 0,
      escalationRate: totalTurns ? +((meta.escalations ?? 0) / totalTurns).toFixed(3) : 0,
      avgLatencyMs: latencyCount ? Math.round((meta.latencySumMs ?? 0) / latencyCount) : 0,
    };
  },
};
