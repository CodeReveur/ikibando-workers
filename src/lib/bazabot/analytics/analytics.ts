/**
 * Lightweight, in-memory analytics. Tracks the signals that help improve the
 * assistant: intent distribution, tool usage, knowledge search hit/miss,
 * fallback rate, latency and completion. No PII — messages are never stored,
 * only derived counters.
 *
 * Swap this for a persistent sink (DB / metrics pipeline) by implementing the
 * same `track*` surface; the agent depends only on these functions.
 */

interface Counters {
  totalTurns: number;
  bySource: Record<string, number>;   // ai | rules | knowledge | escalation
  byIntent: Record<string, number>;
  toolCalls: Record<string, number>;
  toolFailures: Record<string, number>;
  knowledgeHits: number;
  knowledgeMisses: number;
  fallbacks: number;                  // times AI was unavailable → rules
  escalations: number;
  latencySumMs: number;
  latencyCount: number;
}

const counters: Counters = {
  totalTurns: 0,
  bySource: {},
  byIntent: {},
  toolCalls: {},
  toolFailures: {},
  knowledgeHits: 0,
  knowledgeMisses: 0,
  fallbacks: 0,
  escalations: 0,
  latencySumMs: 0,
  latencyCount: 0,
};

const inc = (map: Record<string, number>, key: string) => { map[key] = (map[key] ?? 0) + 1; };

export const analytics = {
  turn(source: string, intent: string, latencyMs: number, escalated: boolean) {
    counters.totalTurns++;
    inc(counters.bySource, source);
    inc(counters.byIntent, intent);
    counters.latencySumMs += latencyMs;
    counters.latencyCount++;
    if (escalated) counters.escalations++;
  },
  tool(name: string, ok: boolean) {
    inc(counters.toolCalls, name);
    if (!ok) inc(counters.toolFailures, name);
  },
  knowledge(hit: boolean) {
    if (hit) counters.knowledgeHits++; else counters.knowledgeMisses++;
  },
  fallback() {
    counters.fallbacks++;
  },
  /** Snapshot for an admin endpoint / dashboard. */
  snapshot() {
    const avgLatency = counters.latencyCount ? Math.round(counters.latencySumMs / counters.latencyCount) : 0;
    const kbTotal = counters.knowledgeHits + counters.knowledgeMisses;
    return {
      totalTurns: counters.totalTurns,
      bySource: { ...counters.bySource },
      byIntent: { ...counters.byIntent },
      toolCalls: { ...counters.toolCalls },
      toolFailures: { ...counters.toolFailures },
      knowledge: {
        hits: counters.knowledgeHits,
        misses: counters.knowledgeMisses,
        successRate: kbTotal ? +(counters.knowledgeHits / kbTotal).toFixed(3) : 0,
      },
      fallbackRate: counters.totalTurns ? +(counters.fallbacks / counters.totalTurns).toFixed(3) : 0,
      escalationRate: counters.totalTurns ? +(counters.escalations / counters.totalTurns).toFixed(3) : 0,
      avgLatencyMs: avgLatency,
    };
  },
};
