import type { Express, Request, Response } from "express";
import { requireAuth } from "../config/auth";
import { settingsStorage } from "../storage/settings";
import { resolveRealtimeSttCapability } from "../voice/realtime-config";
import { logger } from "@shared/logger";
import { env } from "../config/env";

interface OpenAIRealtimeSession {
  id: string;
  object: string;
  type?: string;
  model?: string;
  created_at?: number;
  expires_at?: number;
  client_secret?: {
    value?: string;
    expires_at?: number;
  };
}

export function setupRealtimeSttRoutes(app: Express) {
  app.post("/api/realtime/stt-session", requireAuth, async (req: Request, res: Response) => {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const settings = settingsStorage.get(userId);
      const capability = resolveRealtimeSttCapability(settings);

      if (!capability.requested) {
        return res.status(400).json({ message: "Realtime STT não está habilitado para este usuário." });
      }

      if (!capability.isSupported || !capability.config) {
        return res.status(400).json({
          message: "Configuração atual não é compatível com Realtime STT.",
          blockers: capability.blockers,
        });
      }

      const include: string[] = [];
      if (capability.config.includeLogProbs) {
        include.push("item.input_audio_transcription.logprobs");
      }

      const transcriptionPayload: Record<string, string> = {
        model: capability.config.model,
      };
      if (capability.config.language) {
        transcriptionPayload.language = capability.config.language;
      }
      if (capability.config.prompt) {
        transcriptionPayload.prompt = capability.config.prompt;
      }

      const payload = {
        model: capability.config.model,
        input_audio_format: "pcm16",
        audio: {
          input: {
            format: { type: "audio/pcm", rate: 24000 },
            noise_reduction: capability.config.noiseReduction
              ? { type: capability.config.noiseReduction }
              : null,
            transcription: transcriptionPayload,
            turn_detection: capability.config.turnDetection === "manual" ? null : {
              type: capability.config.turnDetection,
              threshold: 0.5,
            },
          },
        },
        include,
      };

      const response = await fetch("https://api.openai.com/v1/realtime/transcription_sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          "OpenAI-Beta": "realtime=v1",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("[RealtimeSTT] Failed to create session", response.status, errorText);
        return res.status(502).json({ message: "Failed to create realtime session" });
      }

      const session = (await response.json()) as OpenAIRealtimeSession;
      const clientSecret = session.client_secret?.value;
      if (!clientSecret) {
        logger.error("[RealtimeSTT] API response missing client_secret", session);
        return res.status(502).json({ message: "Realtime session incomplete" });
      }

      return res.json({
        session: {
          id: session.id,
          object: session.object,
          type: session.type,
          model: session.model ?? capability.config.model,
          createdAt: session.created_at ?? null,
          expiresAt: session.client_secret?.expires_at ?? session.expires_at ?? null,
        },
        clientSecret,
        wsUrl: "wss://api.openai.com/v1/realtime?intent=transcription",
        effectiveConfig: {
          model: capability.config.model,
          language: capability.config.language ?? null,
          includeLogProbs: capability.config.includeLogProbs,
          turnDetection: capability.config.turnDetection,
        },
        warnings: capability.warnings,
      });
    } catch (error) {
      logger.error("[RealtimeSTT] Unexpected error", error);
      return res.status(500).json({ message: "Failed to create realtime session" });
    }
  });
}
