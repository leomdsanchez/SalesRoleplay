import type { Express, Request, Response } from "express";
import { requireAuth } from "../config/auth";
import { ingestTranscript, ragSearch } from "../rag/service";
import { listRagChunks, clearRagChunks } from "../storage/rag";

export function setupRagRoutes(app: Express) {
  app.post("/api/rag/upload", requireAuth, async (req: Request, res: Response) => {
    try {
      const { source, content } = req.body ?? {};
      if (!content || typeof content !== "string") {
        return res.status(400).json({ message: "Conteúdo inválido" });
      }

      const origin = typeof source === "string" && source.trim().length > 0
        ? source.trim()
        : `transcricao-${Date.now()}`;

      const { chunksCreated } = await ingestTranscript(origin, content);
      res.json({ message: "Transcrição processada", chunksCreated });
    } catch (error) {
      console.error("[RAG] Upload error:", error);
      res.status(500).json({ message: "Falha ao processar transcrição" });
    }
  });

  app.get("/api/rag/chunks", requireAuth, (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit ?? 50);
      const offset = Number(req.query.offset ?? 0);
      const chunks = listRagChunks({ limit, offset });
      res.json(chunks);
    } catch (error) {
      console.error("[RAG] List error:", error);
      res.status(500).json({ message: "Falha ao carregar RAG" });
    }
  });

  app.post("/api/rag/search", requireAuth, async (req: Request, res: Response) => {
    try {
      const { query, limit } = req.body ?? {};
      if (!query || typeof query !== "string") {
        return res.status(400).json({ message: "Query inválida" });
      }
      const results = await ragSearch(query, Number(limit) || 3);
      res.json(results);
    } catch (error) {
      console.error("[RAG] Search error:", error);
      res.status(500).json({ message: "Falha na busca RAG" });
    }
  });

  app.post("/api/rag/clear", requireAuth, (_req: Request, res: Response) => {
    try {
      clearRagChunks();
      res.json({ message: "RAG limpo com sucesso" });
    } catch (error) {
      console.error("[RAG] Clear error:", error);
      res.status(500).json({ message: "Falha ao limpar RAG" });
    }
  });
}
