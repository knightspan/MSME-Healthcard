import { Router } from "express";
import { getDataSourceAdapter, getDataMode } from "../adapters/DataSourceFactory.js";
import { normalizeMSMEData } from "../normalization/normalize.js";
import { computeScore } from "../scoring/scoringEngine.js";
import { generateNarrative } from "../ai/narrative.js";
import { buildOcenPayload } from "../ocen/ocenAdapter.js";
import { getProfileMeta, MSME_PROFILES } from "../data/profiles.js";
import type { AssessmentResponse } from "../types/index.js";

export const msmeRouter = Router();

msmeRouter.get("/profiles", (_req, res) => {
  res.json({ profiles: MSME_PROFILES, data_mode: getDataMode() });
});

msmeRouter.get("/:id/ocen-payload", async (req, res) => {
  const { id } = req.params;
  const profile = getProfileMeta(id);
  if (!profile) {
    res.status(404).json({ error: `Unknown MSME id: ${id}` });
    return;
  }

  try {
    const adapter = getDataSourceAdapter();
    const normalized = await normalizeMSMEData(id, adapter);
    const score = computeScore(normalized);
    const ocen = buildOcenPayload(id, normalized.data_sources_available, score);
    res.json(ocen);
  } catch (err) {
    console.error(`[ocen-payload] failed for ${id}:`, err);
    res.status(500).json({ error: "Failed to build OCEN payload." });
  }
});

msmeRouter.post("/:id/assess", async (req, res) => {
  const startedAt = Date.now();
  const { id } = req.params;
  const profile = getProfileMeta(id);
  if (!profile) {
    res.status(404).json({ error: `Unknown MSME id: ${id}` });
    return;
  }

  try {
    const dataMode = getDataMode();
    const adapter = getDataSourceAdapter();

    const normalized = await normalizeMSMEData(id, adapter);
    const score = computeScore(normalized);
    const narrative = await generateNarrative(profile, normalized, score);
    const ocen = buildOcenPayload(id, normalized.data_sources_available, score);

    const response: AssessmentResponse = {
      profile,
      normalized,
      score,
      narrative,
      ocen,
      data_mode: dataMode,
      elapsed_ms: Date.now() - startedAt,
    };

    res.json(response);
  } catch (err) {
    console.error(`[assess] failed for ${id}:`, err);
    res.status(500).json({ error: "Assessment pipeline failed. Please try again." });
  }
});
