import { randomUUID } from "crypto";
import { db } from "../db/sqlite";
import { ragChunks, type RagChunk } from "@shared/schema";
import { desc } from "drizzle-orm";

export interface RagChunkInput {
  source: string;
  order: number;
  speaker: string;
  text: string;
  metadata?: Record<string, unknown>;
  embedding: number[];
}

type CachedChunk = RagChunk & {
  embeddingVector: number[];
};

let cache: CachedChunk[] | null = null;

function invalidateCache() {
  cache = null;
}

async function ensureCache(): Promise<CachedChunk[]> {
  if (cache) return cache;
  const rows = db.select().from(ragChunks).all();
  cache = rows.map((row) => ({
    ...row,
    embeddingVector: JSON.parse(row.embedding) as number[],
  }));
  return cache;
}

export async function insertRagChunks(chunks: RagChunkInput[]) {
  if (!chunks.length) return;
  const now = Date.now();
  db.insert(ragChunks)
    .values(
      chunks.map((chunk, idx) => ({
        id: randomUUID(),
        source: chunk.source,
        order: chunk.order,
        speaker: chunk.speaker,
        text: chunk.text,
        metadata: chunk.metadata ? JSON.stringify(chunk.metadata) : null,
        embedding: JSON.stringify(chunk.embedding),
        createdAt: now + idx,
      }))
    )
    .run();
  invalidateCache();
}

export interface RagChunkListOptions {
  limit?: number;
  offset?: number;
}

export function listRagChunks(options: RagChunkListOptions = {}) {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  return db
    .select()
    .from(ragChunks)
    .limit(limit)
    .offset(offset)
    .orderBy(desc(ragChunks.createdAt))
    .all();
}

export async function searchRagChunks(
  queryEmbedding: number[],
  topK = 3
): Promise<Array<{ chunk: RagChunk; score: number }>> {
  const chunks = await ensureCache();
  if (!chunks.length) return [];
  const queryNorm = vectorNorm(queryEmbedding);

  const scored = chunks
    .map((chunk) => {
      const score = cosineSimilarity(
        queryEmbedding,
        chunk.embeddingVector,
        queryNorm
      );
      return { chunk, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

export function clearRagChunks() {
  db.delete(ragChunks).run();
  invalidateCache();
}

function vectorNorm(vec: number[]): number {
  return Math.sqrt(vec.reduce((sum, value) => sum + value * value, 0));
}

function cosineSimilarity(
  a: number[],
  b: number[],
  normA = vectorNorm(a)
): number {
  const normB = vectorNorm(b);
  if (normA === 0 || normB === 0) return 0;
  const length = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < length; i++) {
    dot += a[i] * b[i];
  }
  return dot / (normA * normB);
}
