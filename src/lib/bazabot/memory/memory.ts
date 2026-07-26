/**
 * Conversation memory.
 *
 * Holds short-lived per-session state: recent turns, the last tool results, and
 * the current task. Backed by the shared KV store, so it is process-local by
 * default and automatically shared across instances when BAZABOT_REDIS_URL is
 * set. Tokens are never stored here; sessions carry a TTL and self-expire.
 */
import type { ChatMessage } from "../types";
import { getKV } from "../store/kv";

export interface SessionMemory {
  sessionId: string;
  /** Rolling window of turns (user + assistant), newest last. */
  turns: ChatMessage[];
  /** Summaries of the most recent tool observations, for cross-turn context. */
  recentToolResults: string[];
  /**
   * Learned facts about this user, accumulated across turns - e.g.
   * { category: "Electrical", location: "Rwanda", role: "worker", name: "Eric" }.
   * Injected into the prompt so the bot "remembers" and personalises answers.
   */
  profile: Record<string, string | number>;
  /** A short description of the task in progress, if any. */
  currentTask?: string;
  updatedAt: number;
}

export interface MemoryStore {
  get(sessionId: string): Promise<SessionMemory>;
  save(mem: SessionMemory): Promise<void>;
}

const MAX_TURNS = 12;
const MAX_TOOL_RESULTS = 6;
const TTL_SECONDS = 60 * 60; // 1 hour

/** Default store: KV-backed (in-memory or Redis) with TTL. */
export class KvMemoryStore implements MemoryStore {
  async get(sessionId: string): Promise<SessionMemory> {
    const kv = await getKV();
    const existing = await kv.getJSON<SessionMemory>(`sess:${sessionId}`);
    if (existing) return { ...existing, profile: existing.profile ?? {} };
    return { sessionId, turns: [], recentToolResults: [], profile: {}, updatedAt: Date.now() };
  }

  async save(mem: SessionMemory): Promise<void> {
    const kv = await getKV();
    mem.updatedAt = Date.now();
    mem.turns = mem.turns.slice(-MAX_TURNS);
    mem.recentToolResults = mem.recentToolResults.slice(-MAX_TOOL_RESULTS);
    await kv.setJSON(`sess:${mem.sessionId}`, mem, TTL_SECONDS);
  }
}

/** Process-wide singleton. */
export const defaultMemoryStore: MemoryStore = new KvMemoryStore();

export function recordTurn(mem: SessionMemory, turn: ChatMessage): void {
  mem.turns.push(turn);
}
export function recordToolResult(mem: SessionMemory, summary: string): void {
  mem.recentToolResults.push(summary);
}

/** Merge newly-learned facts into the session profile (new values win). */
export function mergeProfile(mem: SessionMemory, facts: Record<string, string | number>): void {
  for (const [k, v] of Object.entries(facts)) {
    if (v !== undefined && v !== null && v !== "") mem.profile[k] = v;
  }
}

/** One-line, human-readable summary of what we remember - for prompt injection. */
export function profileSummary(mem: SessionMemory): string {
  const entries = Object.entries(mem.profile);
  if (!entries.length) return "";
  return entries.map(([k, v]) => `${k}=${v}`).join(", ");
}
