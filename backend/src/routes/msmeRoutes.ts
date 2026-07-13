import { Router } from "express";
import { getDataSourceAdapter, getDataMode } from "../adapters/DataSourceFactory.js";
import { normalizeMSMEData } from "../normalization/normalize.js";
import { computeScore } from "../scoring/scoringEngine.js";
import { generateNarrative } from "../ai/narrative.js";
import { generateCopilotReply } from "../ai/copilot.js";
import { buildCreditMemoDoc } from "../pdf/creditMemoPdf.js";
import { buildOcenPayload } from "../ocen/ocenAdapter.js";
import { getProfileMeta, MSME_PROFILES } from "../data/profiles.js";
import { getMLRisk } from "../ml/mlClient.js";
import type {
  AssessmentResponse,
  ChatMessage,
  MLRiskBand,
  NormalizedMSMEData,
  PortfolioMsmeSummary,
  PortfolioSummary,
  ScoreBand,
} from "../types/index.js";

function isValidNormalizedInput(body: unknown): body is NormalizedMSMEData {
  if (!body || typeof body !== "object") return false;
  const d = body as Record<string, unknown>;
  const numericFields = [
    "monthly_revenue",
    "revenue_variance_pct",
    "filing_regularity_pct",
    "avg_bank_balance",
    "bounced_payment_count",
    "months_of_data_available",
  ];
  const allNumbersValid = numericFields.every((key) => typeof d[key] === "number" && Number.isFinite(d[key]));
  const payrollValid = d.payroll_headcount_trend_pct === null || typeof d.payroll_headcount_trend_pct === "number";
  const sourcesValid = Array.isArray(d.data_sources_available);
  return allNumbersValid && payrollValid && sourcesValid;
}

export const msmeRouter = Router();

msmeRouter.get("/profiles", (_req, res) => {
  res.json({ profiles: MSME_PROFILES, data_mode: getDataMode() });
});

msmeRouter.get("/portfolio/summary", async (_req, res) => {
  try {
    const adapter = getDataSourceAdapter();

    const entries = await Promise.all(
      MSME_PROFILES.map(async (profile) => {
        const normalized = await normalizeMSMEData(profile.id, adapter);
        const score = computeScore(normalized);
        const mlRisk = await getMLRisk(normalized);
        return { profile, score, mlRisk };
      })
    );

    const bandCounts: Record<ScoreBand, number> = {
      Poor: 0,
      Bad: 0,
      Average: 0,
      Good: 0,
      Excellent: 0,
    };
    const businessTypeCounts: Record<string, number> = {};

    const msmes: PortfolioMsmeSummary[] = entries.map(({ profile, score, mlRisk }) => {
      bandCounts[score.band] += 1;
      businessTypeCounts[profile.businessType] = (businessTypeCounts[profile.businessType] ?? 0) + 1;
      return {
        id: profile.id,
        name: profile.name,
        businessType: profile.businessType,
        composite_score: score.composite_score,
        band: score.band,
        top_risk_flag: score.risk_flags[0] ?? null,
        probability_of_default_pct: mlRisk.probability_of_default_pct,
        ml_risk_band: mlRisk.risk_band,
      };
    });

    const totalAssessed = entries.length;
    const averageScore =
      totalAssessed > 0
        ? Math.round((entries.reduce((sum, e) => sum + e.score.composite_score, 0) / totalAssessed) * 10) / 10
        : 0;
    const highRiskCount = bandCounts.Poor + bandCounts.Bad;
    const highRiskPct = totalAssessed > 0 ? Math.round((highRiskCount / totalAssessed) * 1000) / 10 : 0;

    // ML aggregates are computed only over MSMEs where the ML service was
    // actually reachable, so a partial outage doesn't silently skew the
    // portfolio-wide numbers.
    const withPd = entries.filter((e) => e.mlRisk.available && e.mlRisk.probability_of_default_pct !== null);
    const averagePd =
      withPd.length > 0
        ? Math.round(
            (withPd.reduce((sum, e) => sum + (e.mlRisk.probability_of_default_pct ?? 0), 0) / withPd.length) * 10
          ) / 10
        : null;
    const mlHighRiskBands: MLRiskBand[] = ["Elevated", "High"];
    const mlHighRiskCount = withPd.filter((e) => mlHighRiskBands.includes(e.mlRisk.risk_band as MLRiskBand)).length;
    const mlHighRiskPct = withPd.length > 0 ? Math.round((mlHighRiskCount / withPd.length) * 1000) / 10 : null;

    const summary: PortfolioSummary = {
      total_assessed: totalAssessed,
      average_composite_score: averageScore,
      high_risk_pct: highRiskPct,
      average_pd_pct: averagePd,
      ml_high_risk_pct: mlHighRiskPct,
      band_counts: bandCounts,
      business_type_counts: businessTypeCounts,
      msmes,
    };

    res.json(summary);
  } catch (err) {
    console.error("[portfolio/summary] failed:", err);
    res.status(500).json({ error: "Failed to build portfolio summary." });
  }
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

msmeRouter.post("/:id/simulate", async (req, res) => {
  const { id } = req.params;
  const profile = getProfileMeta(id);
  if (!profile) {
    res.status(404).json({ error: `Unknown MSME id: ${id}` });
    return;
  }

  if (!isValidNormalizedInput(req.body)) {
    res.status(400).json({ error: "Request body must be a full NormalizedMSMEData object." });
    return;
  }

  try {
    // computeScore() is pure/instant. The ML call adds real network
    // latency, so it runs alongside it rather than blocking on it — the
    // frontend can render the rule-engine score immediately and let the
    // PD figure settle a beat later.
    const score = computeScore(req.body);
    const mlRisk = await getMLRisk(req.body);
    res.json({ score, ml_risk: mlRisk });
  } catch (err) {
    console.error(`[simulate] failed for ${id}:`, err);
    res.status(500).json({ error: "Failed to simulate scenario." });
  }
});

msmeRouter.get("/:id/memo", async (req, res) => {
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
    const mlRisk = await getMLRisk(normalized);
    const narrative = await generateNarrative(profile, normalized, score, mlRisk);

    const doc = buildCreditMemoDoc(profile, normalized, score, narrative, mlRisk);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="credit-memo-${id}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (err) {
    console.error(`[memo] failed for ${id}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate credit memo PDF." });
    } else {
      res.end();
    }
  }
});

msmeRouter.post("/:id/chat", async (req, res) => {
  const { id } = req.params;
  const profile = getProfileMeta(id);
  if (!profile) {
    res.status(404).json({ error: `Unknown MSME id: ${id}` });
    return;
  }

  const { message, conversationHistory } = req.body as {
    message?: unknown;
    conversationHistory?: ChatMessage[];
  };

  if (typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "Request body must include a non-empty 'message' string." });
    return;
  }

  try {
    // Re-run the pipeline so the copilot always answers against fresh,
    // grounded data rather than a potentially stale client-side snapshot.
    const adapter = getDataSourceAdapter();
    const normalized = await normalizeMSMEData(id, adapter);
    const score = computeScore(normalized);
    const mlRisk = await getMLRisk(normalized);

    const chatResponse = await generateCopilotReply(profile, normalized, score, mlRisk, message, conversationHistory);
    res.json(chatResponse);
  } catch (err) {
    console.error(`[chat] failed for ${id}:`, err);
    res.status(500).json({ error: "AI Credit Copilot request failed. Please try again." });
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

    // ML risk resolves first (bounded by its own short timeout) because the
    // narrative prompt is grounded on the PD + SHAP output — Claude should
    // be able to reference the same numbers a credit officer sees.
    const mlRisk = await getMLRisk(normalized);
    const narrative = await generateNarrative(profile, normalized, score, mlRisk);
    const ocen = buildOcenPayload(id, normalized.data_sources_available, score);

    const response: AssessmentResponse = {
      profile,
      normalized,
      score,
      ml_risk: mlRisk,
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
