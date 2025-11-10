import { openai } from "../services/openai";
import { insertRagChunks, searchRagChunks } from "../storage/rag";

interface Turn {
  speaker: string;
  text: string;
}

interface InteractionPair {
  prompt: string;
  promptSpeaker: string;
  response: string;
  responseSpeaker: string;
  order: number;
}

export async function ingestTranscript(source: string, rawContent: string) {
  const turns = parseTranscript(rawContent);
  if (!turns.length) {
    return { chunksCreated: 0 };
  }

  const pairs = buildInteractionPairs(turns);
  if (!pairs.length) {
    return { chunksCreated: 0 };
  }

  const promptEmbeddings = await embedBatch(
    pairs.map((pair) => pair.prompt),
    "text-embedding-3-large"
  );

  await insertRagChunks(
    pairs.map((pair, index) => ({
      source,
      order: pair.order,
      speaker: pair.responseSpeaker,
      text: pair.response,
      metadata: {
        prompt: pair.prompt,
        promptSpeaker: pair.promptSpeaker,
      },
      embedding: promptEmbeddings[index],
    }))
  );

  return { chunksCreated: pairs.length };
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
  let order = 0;

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
      prompt: `${current.speaker}: ${current.text.trim()}`,
      promptSpeaker: current.speaker,
      response: `${next.speaker}: ${next.text.trim()}`,
      responseSpeaker: next.speaker,
      order: order++,
    });
  }

  return pairs;
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
