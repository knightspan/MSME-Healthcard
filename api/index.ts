/**
 * Vercel serverless entry for the Express API.
 *
 * All `/api/*` browser requests are rewritten here (see root vercel.json).
 * Dynamic import keeps this compatible with the backend's ESM build output.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

type ExpressApp = (req: VercelRequest, res: VercelResponse) => unknown;

let cachedApp: ExpressApp | null = null;

async function loadApp(): Promise<ExpressApp> {
  if (cachedApp) return cachedApp;
  const mod = await import("../backend/dist/app.js");
  cachedApp = (mod.default ?? mod) as ExpressApp;
  return cachedApp;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await loadApp();
  return app(req, res);
}
