/**
 * Pluggable key-value store used by memory + analytics.
 *
 * Two backends behind one interface:
 *  - InMemoryKV  (default): process-local; perfect for a single instance.
 *  - RedisKV     (opt-in):  shared across instances; activated by setting
 *                           BAZABOT_REDIS_URL. `ioredis` is imported lazily via
 *                           a non-literal specifier so it is NOT a hard
 *                           dependency — install it only if you enable Redis.
 *
 * This is what "move analytics + memory to a shared store for multiple
 * instances" resolves to: flip one env var, run `npm i ioredis`, done.
 */
import { log } from "../logger";

export interface KV {
  /** Read a JSON value. */
  getJSON<T>(key: string): Promise<T | null>;
  /** Write a JSON value with optional TTL (seconds). */
  setJSON(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  /** Atomically increment a hash field, returning nothing. */
  hincr(hash: string, field: string, by?: number): Promise<void>;
  /** Read all fields of a hash as numbers. */
  hgetallNum(hash: string): Promise<Record<string, number>>;
}

// ── In-memory backend ───────────────────────────────────────────────────────
class InMemoryKV implements KV {
  private kv = new Map<string, { v: unknown; exp: number }>();
  private hashes = new Map<string, Map<string, number>>();

  async getJSON<T>(key: string): Promise<T | null> {
    const e = this.kv.get(key);
    if (!e) return null;
    if (e.exp && e.exp < Date.now()) { this.kv.delete(key); return null; }
    return e.v as T;
  }
  async setJSON(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    this.kv.set(key, { v: value, exp: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0 });
    if (this.kv.size > 5000) this.gc();
  }
  async hincr(hash: string, field: string, by = 1): Promise<void> {
    let h = this.hashes.get(hash);
    if (!h) { h = new Map(); this.hashes.set(hash, h); }
    h.set(field, (h.get(field) ?? 0) + by);
  }
  async hgetallNum(hash: string): Promise<Record<string, number>> {
    return Object.fromEntries(this.hashes.get(hash) ?? new Map());
  }
  private gc() {
    const now = Date.now();
    for (const [k, e] of this.kv) if (e.exp && e.exp < now) this.kv.delete(k);
  }
}

// ── Redis backend (opt-in, lazy) ────────────────────────────────────────────
class RedisKV implements KV {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;
  private prefix = "bazabot:";
  constructor(client: unknown) { this.client = client; }

  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(this.prefix + key);
    return raw ? (JSON.parse(raw) as T) : null;
  }
  async setJSON(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const k = this.prefix + key;
    const v = JSON.stringify(value);
    if (ttlSeconds) await this.client.set(k, v, "EX", ttlSeconds);
    else await this.client.set(k, v);
  }
  async hincr(hash: string, field: string, by = 1): Promise<void> {
    await this.client.hincrby(this.prefix + hash, field, by);
  }
  async hgetallNum(hash: string): Promise<Record<string, number>> {
    const raw: Record<string, string> = await this.client.hgetall(this.prefix + hash);
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw ?? {})) out[k] = Number(v) || 0;
    return out;
  }
}

// Pin the singleton on globalThis. Next.js does NOT guarantee that a plain
// module-level singleton is shared across different route handlers (each can get
// its own module instance), so in-memory counters/sessions would otherwise
// diverge per route. globalThis is shared within the server process.
interface KvGlobal { instance: KV | null; initPromise: Promise<KV> | null }
const g = globalThis as unknown as { __bazabotKv?: KvGlobal };
const store: KvGlobal = g.__bazabotKv ?? (g.__bazabotKv = { instance: null, initPromise: null });

async function build(): Promise<KV> {
  const url = process.env.BAZABOT_REDIS_URL;
  if (!url) return new InMemoryKV();
  try {
    // Optional dependency. `new Function` hides the import from the bundler
    // (webpack/Turbopack) entirely, so ioredis is never resolved at build time —
    // it stays a true opt-in, loaded from node_modules only at runtime when
    // Redis is enabled. Install it (`npm i ioredis`) to use a shared store.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const importOptional = new Function("m", "return import(m)") as (m: string) => Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await importOptional("ioredis");
    const Redis = mod.default ?? mod;
    const client = new Redis(url);
    log.info("BazaBot using Redis shared store");
    return new RedisKV(client);
  } catch (e) {
    log.warn("Redis unavailable, using in-memory store", { message: (e as Error)?.message });
    return new InMemoryKV();
  }
}

/** Process-wide KV singleton (shared across route handlers via globalThis). */
export async function getKV(): Promise<KV> {
  if (store.instance) return store.instance;
  if (!store.initPromise) store.initPromise = build().then(kv => (store.instance = kv));
  return store.initPromise;
}
