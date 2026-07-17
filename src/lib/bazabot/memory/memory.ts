/**
 * Conversation memory.
 *
 * Holds short-lived per-session state: recent turns, the last tool results, and
 * the current task. Storage is pluggable via the MemoryStore interface; the
 * default is an in-process LRU with TTL — no database, nothing sensitive
 * persisted to disk. Tokens are never stored here.
 */
import type { ChatMessage } from "../types";

export interface SessionMemory {
  sessionId: string;
  /** Rolling window of turns (user + assistant), newest last. */
  turns: ChatMessage[];
  /** Summaries of the most recent tool observations, for cross-turn context. */
  recentToolResults: string[];
  /** A short description of the task in progress, if any. */
  currentTask?: string;
  updatedAt: number;
}

export interface MemoryStore {
  get(sessionId: string): SessionMemory;
  save(mem: SessionMemory): void;
}

const MAX_TURNS = 12;
const MAX_TOOL_RESULTS = 6;
const TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_SESSIONS = 1000;

/** Default store: bounded in-memory map with TTL eviction. */
export class InMemoryStore implements MemoryStore {
  private map = new Map<string, SessionMemory>();

  get(sessionId: string): SessionMemory {
    this.evict();
    const existing = this.map.get(sessionId);
    if (existing) return existing;
    const fresh: SessionMemory = { sessionId, turns: [], recentToolResults: [], updatedAt: Date.now() };
    this.map.set(sessionId, fresh);
    return fresh;
  }

  save(mem: SessionMemory): void {
    mem.updatedAt = Date.now();
    mem.turns = mem.turns.slice(-MAX_TURNS);
    mem.recentToolResults = mem.recentToolResults.slice(-MAX_TOOL_RESULTS);
    this.map.set(mem.sessionId, mem);
  }

  private evict(): void {
    const now = Date.now();
    for (const [k, v] of this.map) if (now - v.updatedAt > TTL_MS) this.map.delete(k);
    // Hard cap: drop oldest if we somehow blow past the ceiling.
    if (this.map.size > MAX_SESSIONS) {
      const oldest = [...this.map.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt);
      for (let i = 0; i < oldest.length - MAX_SESSIONS; i++) this.map.delete(oldest[i][0]);
    }
  }
}

/** Process-wide singleton (per server instance). */
export const defaultMemoryStore: MemoryStore = new InMemoryStore();

export function recordTurn(mem: SessionMemory, turn: ChatMessage): void {
  mem.turns.push(turn);
}
export function recordToolResult(mem: SessionMemory, summary: string): void {
  mem.recentToolResults.push(summary);
}
