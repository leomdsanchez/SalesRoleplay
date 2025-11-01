import type { Express, Request, Response } from "express";
import { requireAuth } from "../config/auth";
import { settingsStorage } from "../storage/settings";
import { defaultSettings, voiceSettingsSchema } from "@shared/settings-schema";
import { validate } from "../middlewares/validate";

export function setupVoiceSettingsRoutes(app: Express) {
  // Get settings
  app.get("/api/voice/settings", requireAuth, (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const settings = settingsStorage.get(userId);
      res.json(settings);
    } catch (error) {
      console.error("[API] Get settings error:", error);
      res.status(500).json({ message: "Failed to load settings" });
    }
  });

  // Update settings
  app.put("/api/voice/settings", requireAuth, validate(voiceSettingsSchema), (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      settingsStorage.save(userId, req.body);
      
      res.json({ message: "Settings saved successfully" });
    } catch (error) {
      console.error("[API] Save settings error:", error);
      res.status(500).json({ message: "Failed to save settings" });
    }
  });

  // Reset to defaults
  app.post("/api/voice/settings/reset", requireAuth, (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      settingsStorage.save(userId, defaultSettings);
      res.json(defaultSettings);
    } catch (error) {
      console.error("[API] Reset settings error:", error);
      res.status(500).json({ message: "Failed to reset settings" });
    }
  });
}
