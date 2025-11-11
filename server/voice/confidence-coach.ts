import { openai } from "../services/openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { logger } from "@shared/logger";

interface ConfidenceResult {
  confidence: number;
  fillerRate?: number | null;
  speechNotes?: string | null;
}

interface ConfidenceOptions {
  model: string;
  prompt: string;
  messages: ChatCompletionMessageParam[];
}

export async function evaluateConfidence({
  model,
  prompt,
  messages,
}: ConfidenceOptions): Promise<ConfidenceResult> {
  logger.debug("[ConfidenceCoach] Avaliando confiança", {
    model,
    messages: messages.length,
  });

  const completion = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: prompt },
      ...messages,
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Confidence coach retornou vazio");
  }
  logger.debug("[ConfidenceCoach] Resposta do coach", content);

  try {
    const parsed = JSON.parse(content);
    let value = Number(parsed.confidence ?? parsed.trust_level ?? parsed.score ?? parsed.value ?? 0);
    if (Number.isNaN(value)) value = 0;
    value = Math.min(1, Math.max(-1, value));
    const fillerRate = normalizeFillerRate(
      firstNumber([
        parsed.filler_rate,
        parsed.fillerRate,
        parsed.fillers_rate,
        parsed.filler_percentage,
        parsed.fillerPercent,
      ])
    );

    const speechNotes =
      typeof parsed.speech_notes === "string"
        ? parsed.speech_notes
        : typeof parsed.reason === "string"
          ? parsed.reason
          : undefined;

    logger.debug("[ConfidenceCoach] Resultado parseado", {
      value,
      fillerRate,
      speechNotes,
    });

    return {
      confidence: value,
      fillerRate,
      speechNotes: speechNotes ?? null,
    };
  } catch (error) {
    logger.error(
      "[ConfidenceCoach] Falha ao parsear",
      error instanceof Error ? error.message : String(error),
      content
    );
    throw new Error(`Falha ao parsear confiança: ${error}`);
  }
}

function firstNumber(values: unknown[]): number | undefined {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const num = Number(value);
    if (!Number.isNaN(num)) {
      return num;
    }
  }
  return undefined;
}

function normalizeFillerRate(value?: number | null): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  const normalized = value > 1 ? value / 100 : value;
  return Math.min(1, Math.max(0, normalized));
}
