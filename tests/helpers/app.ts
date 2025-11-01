import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "../../server/routes";
import { setupAuth } from "../../server/config/auth";

export async function createTestApp() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Setup authentication
  setupAuth(app);

  // Register routes
  await registerRoutes(app);

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  return app;
}
