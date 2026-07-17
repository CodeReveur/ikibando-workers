/**
 * KnowledgeSearcher — semantic search over the platform corpus with automatic
 * keyword fallback.
 *
 * Order of preference:
 *  1. Semantic (embedding cosine) when an embedding model is configured and the
 *     provider can embed. Best for paraphrased questions.
 *  2. Keyword (token-overlap BM25-lite) otherwise. Always available, no model.
 *
 * Query results are cached briefly so repeated questions in one session are free.
 */
import type { BazaBotConfig } from "../config";
import type { AIProvider } from "../providers";
import { knowledgeCorpus, type KnowledgeDoc } from "./sources";
import { ensureCorpusEmbeddings, rankByVector } from "./embeddings";
import { log } from "../logger";

export interface KnowledgeHit {
  title: string;
  text: string;
  score: number;
  category: KnowledgeDoc["category"];
  method: "semantic" | "keyword";
}

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are", "how", "what", "do",
  "does", "can", "i", "my", "me", "you", "your", "it", "this", "that", "with", "from", "at", "by",
]);

function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w));
}

/** Lightweight token-overlap scoring with inverse-frequency weighting. */
function keywordRank(docs: KnowledgeDoc[], query: string, limit: number): Array<{ doc: KnowledgeDoc; score: number }> {
  const q = tokenize(query);
  if (!q.length) return [];
  // Document frequency of each query term across the corpus.
  const df = new Map<string, number>();
  for (const term of new Set(q)) {
    let n = 0;
    for (const d of docs) if ((`${d.title} ${d.text}`).toLowerCase().includes(term)) n++;
    df.set(term, n);
  }
  const N = docs.length;
  return docs
    .map(doc => {
      const hay = tokenize(`${doc.title} ${doc.title} ${doc.text}`); // title weighted x2
      const set = new Set(hay);
      let score = 0;
      for (const term of q) {
        if (set.has(term)) {
          const idf = Math.log(1 + N / (1 + (df.get(term) ?? 0)));
          score += idf;
        }
      }
      return { doc, score };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export class KnowledgeSearcher {
  private queryCache = new Map<string, KnowledgeHit[]>();

  constructor(private cfg: BazaBotConfig, private provider: AIProvider | null) {}

  async search(query: string, limit = 3): Promise<KnowledgeHit[]> {
    const key = `${limit}:${query.toLowerCase().trim()}`;
    const cached = this.queryCache.get(key);
    if (cached) return cached;

    const docs = knowledgeCorpus();
    let hits: KnowledgeHit[] = [];

    // 1) Semantic
    if (this.provider && this.cfg.semanticSearch && this.cfg.embeddingModel) {
      try {
        const corpus = await ensureCorpusEmbeddings(this.provider, docs);
        if (corpus) {
          const [qVec] = await this.provider.embed([query]);
          hits = rankByVector(corpus, qVec, limit).map(r => ({
            title: r.doc.title, text: r.doc.text, score: r.score,
            category: r.doc.category, method: "semantic" as const,
          }));
        }
      } catch (e) {
        log.warn("semantic search failed, falling back to keyword", { message: (e as Error)?.message });
      }
    }

    // 2) Keyword fallback (also used to backfill if semantic returned weak hits)
    if (!hits.length || hits[0].score < 0.35) {
      const kw = keywordRank(docs, query, limit).map(r => ({
        title: r.doc.title, text: r.doc.text, score: r.score,
        category: r.doc.category, method: "keyword" as const,
      }));
      if (kw.length) hits = kw;
    }

    // Keep the cache small.
    if (this.queryCache.size > 200) this.queryCache.clear();
    this.queryCache.set(key, hits);
    return hits;
  }
}
