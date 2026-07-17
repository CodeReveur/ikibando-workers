/**
 * Embedding cache. Embedding the corpus is the expensive part of semantic search,
 * so vectors are computed lazily, once, and kept in module memory for the life of
 * the server process. Query embeddings are computed per request (cheap: one text).
 *
 * If the provider can't embed (no embedding model, server down), callers fall
 * back to keyword search — see knowledge.ts.
 */
import type { AIProvider } from "../providers";
import type { KnowledgeDoc } from "./sources";
import { log } from "../logger";

interface EmbeddedDoc {
  doc: KnowledgeDoc;
  vector: number[];
}

let corpusVectors: EmbeddedDoc[] | null = null;
let building: Promise<EmbeddedDoc[] | null> | null = null;

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Ensure the corpus is embedded. Returns null if embeddings are unavailable, so
 * the caller can degrade to keyword search. Concurrent callers share one build.
 */
export async function ensureCorpusEmbeddings(
  provider: AIProvider,
  docs: KnowledgeDoc[]
): Promise<EmbeddedDoc[] | null> {
  if (corpusVectors) return corpusVectors;
  if (building) return building;

  building = (async () => {
    try {
      const started = Date.now();
      const texts = docs.map(d => `${d.title}\n${d.text}`);
      // Embed with limited concurrency: fast enough to finish in the background,
      // gentle enough not to overwhelm a small local server.
      const vectors: number[][] = new Array(texts.length);
      const CONCURRENCY = 6;
      let cursor = 0;
      const worker = async () => {
        for (;;) {
          const i = cursor++;
          if (i >= texts.length) return;
          const [vec] = await provider.embed([texts[i]]);
          vectors[i] = vec;
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      corpusVectors = docs.map((doc, i) => ({ doc, vector: vectors[i] }));
      log.info(`Embedded knowledge corpus`, { docs: corpusVectors.length, ms: Date.now() - started });
      return corpusVectors;
    } catch (e) {
      log.warn(`Embedding unavailable, keyword search will be used`, { message: (e as Error)?.message });
      return null;
    } finally {
      building = null;
    }
  })();

  return building;
}

/**
 * Non-blocking accessor: returns the embedded corpus if it's ready, otherwise
 * null and kicks off the build in the background. This keeps the very first
 * knowledge query fast (it uses keyword search) while semantic search warms up.
 */
export function corpusEmbeddingsOrWarm(provider: AIProvider, docs: KnowledgeDoc[]): EmbeddedDoc[] | null {
  if (corpusVectors) return corpusVectors;
  if (!building) void ensureCorpusEmbeddings(provider, docs);
  return null;
}

/** Rank the embedded corpus against a query vector. */
export function rankByVector(
  corpus: EmbeddedDoc[],
  queryVec: number[],
  limit: number
): Array<{ doc: KnowledgeDoc; score: number }> {
  return corpus
    .map(e => ({ doc: e.doc, score: cosine(queryVec, e.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Test seam: drop cached vectors (e.g. after a corpus change). */
export function resetEmbeddingCache(): void {
  corpusVectors = null;
  building = null;
}
