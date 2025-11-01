import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import authRoutes from "./routes/auth";
import { VoiceSession } from "./voice/session";

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes
  app.use("/api/v1/auth", authRoutes);

  const httpServer = createServer(app);

  // WebSocket server for voice agent
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: "/ws/voice"
  });

  wss.on("connection", (ws, req) => {
    console.log("New voice session connected");
    new VoiceSession(ws);
  });

  wss.on("error", (error) => {
    console.error("WebSocket server error:", error);
  });

  return httpServer;
}
