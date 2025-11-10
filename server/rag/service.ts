import { openai } from "../services/openai";
import { insertRagChunks, searchRagChunks } from "../storage/rag";

interface Turn {
  speaker: string;
  text: string;
}

interface InteractionPair {
  prompt: string;
  response: string;
}

interface InteractionChunk {
  promptText: string;
  responseText: string;
  order: number;
}

const PAIRS_PER_CHUNK = 3;

export async function ingestTranscript(source: string, rawContent: string) {
  const turns = parseTranscript(rawContent);
  if (!turns.length) {
    return { chunksCreated: 0 };
  }

  const chunks = buildInteractionChunks(turns, PAIRS_PER_CHUNK);
  if (!chunks.length) {
    return { chunksCreated: 0 };
  }

  const promptEmbeddings = await embedBatch(
    chunks.map((chunk) => chunk.promptText),
    "text-embedding-3-large"
  );

  await insertRagChunks(
    chunks.map((chunk, index) => ({
      source,
      order: chunk.order,
      speaker: "cliente",
      text: chunk.responseText,
      metadata: { prompt: chunk.promptText },
      embedding: promptEmbeddings[index],
    }))
  );

  return { chunksCreated: chunks.length };
}

export async function ragSearch(query: string, topK = 3) {
  if (!query?.trim()) {
    return [];
  }
  const embedding = await embedBatch([query], "text-embedding-3-large");
  const matches = await searchRagChunks(embedding[0], topK);
  return matches.map((match) => ({
    id: match.chunk.id,
    source: match.chunk.source,
    text: match.chunk.text,
    speaker: match.chunk.speaker,
    metadata: match.chunk.metadata ? JSON.parse(match.chunk.metadata) : null,
    score: match.score,
  }));
}

function parseTranscript(raw: string): Turn[] {
  const content = raw.trim();
  if (!content) return [];

  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed.map((item, idx) => {
        if (typeof item === "string") {
          return { speaker: "desconhecido", text: item };
        }
        if (item && typeof item === "object") {
          return {
            speaker: (item.speaker || item.role || `parte-${idx + 1}`).toString(),
            text: (item.text || item.content || "").toString(),
          };
        }
        return { speaker: `parte-${idx + 1}`, text: String(item ?? "") };
      });
    }

    if (parsed?.turns && Array.isArray(parsed.turns)) {
      return parsed.turns.map((turn: any, idx: number) => ({
        speaker: (turn.speaker || turn.role || `parte-${idx + 1}`).toString(),
        text: (turn.text || turn.content || "").toString(),
      }));
    }
  } catch {
    // Not JSON, fallback to plain text
  }

  const lines = content.split(/\r?\n/).map((line) => line.trim());
  const turns: Turn[] = [];
  for (const line of lines) {
    if (!line) continue;
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0 && colonIndex < 40) {
      const speaker = line.slice(0, colonIndex).trim();
      const text = line.slice(colonIndex + 1).trim();
      turns.push({ speaker: speaker || "desconhecido", text });
    } else if (turns.length > 0) {
      turns[turns.length - 1].text += ` ${line}`;
    } else {
      turns.push({ speaker: "desconhecido", text: line });
    }
  }
  return turns;
}

function buildInteractionPairs(turns: Turn[]): InteractionPair[] {
  const pairs: InteractionPair[] = [];

  for (let i = 0; i < turns.length - 1; i++) {
    const current = turns[i];
    const next = turns[i + 1];
    if (!current.text.trim() || !next.text.trim()) {
      continue;
    }
    if (current.speaker === next.speaker) {
      continue;
    }

    pairs.push({
      prompt: current.text.trim(),
      response: next.text.trim(),
    });
  }

  return pairs;
}

function buildInteractionChunks(turns: Turn[], windowSize: number): InteractionChunk[] {
  const pairs = buildInteractionPairs(turns);
  if (!pairs.length) return [];

  const chunks: InteractionChunk[] = [];
  let order = 0;

  for (let i = 0; i < pairs.length; i += windowSize) {
    const group = pairs.slice(i, i + windowSize);
    const promptText = group.map((pair) => pair.prompt).join("\n");
    const responseText = group.map((pair) => pair.response).join("\n");
    chunks.push({
      promptText,
      responseText,
      order: order++,
    });
  }

  return chunks;
}

async function embedBatch(
  input: string[],
  model: string,
  batchSize = 50,
  concurrency = 10
): Promise<number[][]> {
  if (!input.length) return [];
  const slices: Array<{ start: number; items: string[] }> = [];
  for (let i = 0; i < input.length; i += batchSize) {
    slices.push({
      start: i,
      items: input.slice(i, i + batchSize),
    });
  }

  const result: number[][] = Array(input.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, slices.length);

  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const slice = slices[nextIndex++];
      if (!slice) break;
      const response = await openai.embeddings.create({
        model,
        input: slice.items,
      });
      response.data.forEach((item, idx) => {
        result[slice.start + idx] = item.embedding;
      });
    }
  });

  await Promise.all(workers);
  return result;
}
