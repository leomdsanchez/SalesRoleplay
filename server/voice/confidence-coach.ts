import { openai } from "../services/openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { logger } from "@shared/logger";

interface ConfidenceResult {
  confidence: number;
  reason?: string;
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
  logger.info("[ConfidenceCoach] Avaliando confiança", {
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
  logger.info("[ConfidenceCoach] Resposta do coach", content);

  try {
    const parsed = JSON.parse(content);
    let value = Number(
      parsed.trust_level ??
        parsed.confidence ??
        parsed.score ??
        parsed.value ??
        0
    );
    if (Number.isNaN(value)) value = 0;
    value = Math.min(1, Math.max(-1, value));
    const reason =
      typeof parsed.reason === "string"
        ? parsed.reason
        : typeof parsed.explanation === "string"
          ? parsed.explanation
          : undefined;

    logger.info("[ConfidenceCoach] Resultado parseado", {
      value,
      reason,
    });

    return {
      confidence: value,
      reason,
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
