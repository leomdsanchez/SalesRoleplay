import { openai } from "../services/openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

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

  try {
    const parsed = JSON.parse(content);
    let value = Number(parsed.confidence ?? parsed.score ?? 0);
    if (Number.isNaN(value)) value = 0;
    value = Math.min(1, Math.max(0, value));
    return {
      confidence: value,
      reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
    };
  } catch (error) {
    throw new Error(`Falha ao parsear confiança: ${error}`);
  }
}
