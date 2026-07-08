import type { OCENPayload, ScoreBand, ScoreResult } from "../types/index.js";

function recommendAction(band: ScoreBand): OCENPayload["recommended_action"] {
  switch (band) {
    case "Excellent":
    case "Good":
      return "eligible_for_review";
    case "Average":
      return "requires_manual_review";
    case "Bad":
    case "Poor":
    default:
      return "not_recommended";
  }
}

/**
 * Reformats an internal ScoreResult into an OCEN-style structured payload
 * suitable for handoff to a Loan Service Provider (LSP) in the ULI/OCEN
 * ecosystem. This is a demo-credibility stub: the field names mirror the
 * spirit of OCEN's account-aggregator-driven credit assessment exchange,
 * not a certified schema.
 */
export function buildOcenPayload(
  applicantId: string,
  dataSourcesUsed: string[],
  score: ScoreResult
): OCENPayload {
  return {
    applicant_id: applicantId,
    assessment_timestamp: new Date().toISOString(),
    composite_score: score.composite_score,
    risk_band: score.band,
    recommended_action: recommendAction(score.band),
    score_breakdown: score.pillars.map((p) => ({
      pillar: p.label,
      score: p.score,
      weight: Math.round(p.weight * 1000) / 1000,
    })),
    data_sources_used: dataSourcesUsed,
    risk_flags: score.risk_flags,
    strength_flags: score.strength_flags,
    format: "OCEN-compatible-v1",
  };
}
