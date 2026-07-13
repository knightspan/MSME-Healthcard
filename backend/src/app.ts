import "dotenv/config";
import express from "express";
import cors from "cors";
import { msmeRouter } from "./routes/msmeRoutes.js";
import { scoreRouter } from "./routes/scoreRoutes.js";
import { getDataMode } from "./adapters/DataSourceFactory.js";

/**
 * Shared Express application — used by both the local `server.ts` listener
 * and the Vercel serverless entry (`/api/index.ts`). Do not call `listen`
 * here; that keeps the app portable to serverless runtimes.
 */
export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", data_mode: getDataMode(), runtime: process.env.VERCEL ? "vercel" : "node" });
  });

  app.use("/api/msme", msmeRouter);
  app.use("/api/v1", scoreRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  return app;
}

const app = createApp();
export default app;
