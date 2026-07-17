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
      const texts = docs.map(d => `${d.title}\n${d.text}`);
      // Embed in modest batches to keep memory low on small servers.
      const vectors: number[][] = [];
      const BATCH = 16;
      for (let i = 0; i < texts.length; i += BATCH) {
        const chunk = texts.slice(i, i + BATCH);
        const embedded = await provider.embed(chunk);
        vectors.push(...embedded);
      }
      corpusVectors = docs.map((doc, i) => ({ doc, vector: vectors[i] }));
      log.info(`Embedded knowledge corpus`, { docs: corpusVectors.length });
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
