import type { MLRiskResult, MSMEProfileMeta, NarrativeResult, NormalizedMSMEData, ScoreResult } from "../types/index.js";
import { ANTHROPIC_MODEL, getAnthropicClient } from "./anthropicClient.js";

const ANTHROPIC_TIMEOUT_MS = 4500; // keeps the overall /assess endpoint close to the <5s target

const SYSTEM_PROMPT = `You are an experienced bank credit underwriter reviewing an MSME's alternate-data financial health assessment (built from GST filings, UPI transactions, Account Aggregator bank statement data, and EPFO payroll records) for a loan eligibility review.

Respond ONLY with valid JSON, no markdown fences, no commentary, matching exactly this schema:
{"strength": string, "risk": string, "improvement_tips": [string, string]}

Strict rules:
- "strength" must name exactly ONE specific strength and MUST include a specific number or fact drawn from the data provided (e.g. a percentage, a rupee amount, a count, a duration in months).
- "risk" must name exactly ONE specific risk and MUST include a specific number or fact drawn from the data provided.
- "improvement_tips" must contain EXACTLY 2 specific, actionable recommendations the MSME could realistically take to raise their score.
- The combined content across all fields should read like a concise 3-5 sentence underwriting memo — no more.
- Do not use generic filler language such as "this business shows promise" or "further review is recommended".
- Base every claim strictly on the data provided below. Never invent numbers or facts not present in the data.
- If an ML probability-of-default figure is present in the data, you may reference it alongside the rule-based score, but always describe it as a demonstration model (bureau-style public dataset, alt-data bridged into its feature space) rather than a certified production PD.`;

function buildUserPrompt(
  profile: MSMEProfileMeta,
  normalized: NormalizedMSMEData,
  score: ScoreResult,
  mlRisk: MLRiskResult
): string {
  const payload = {
    business_name: profile.name,
    business_type: profile.businessType,
    composite_score: score.composite_score,
    band: score.band,
    pillar_breakdown: score.pillars.map((p) => ({
      pillar: p.label,
      score: p.score,
      weight_pct: Math.round(p.weight * 100),
      applied: p.applied,
    })),
    reweighted: score.reweighted,
    reweight_note: score.reweight_note,
    normalized_data: normalized,
    risk_flags: score.risk_flags,
    strength_flags: score.strength_flags,
    ml_probability_of_default: mlRisk.available ? mlRisk.probability_of_default_pct : null,
    ml_risk_band: mlRisk.available ? mlRisk.risk_band : null,
    ml_top_risk_drivers: mlRisk.available ? mlRisk.top_risk_increasing_features.map((f) => f.feature) : [],
  };
  return `Here is the MSME's financial health assessment data:\n\n${JSON.stringify(payload, null, 2)}\n\nWrite the underwriting memo JSON now.`;
}

function buildFallback(score: ScoreResult): NarrativeResult {
  const strength =
    score.strength_flags[0] ??
    `Composite health score of ${score.composite_score}/100 places this business in the "${score.band}" band.`;
  const risk =
    score.risk_flags[0] ?? "No major automated risk flags were raised, but limited data breadth warrants manual review.";
  return {
    strength,
    risk,
    improvement_tips: [
      "Maintain consistent, on-time GST filings every month to strengthen the Compliance Health pillar.",
      "Build a higher average bank balance relative to monthly turnover to improve Cash Flow Discipline.",
    ],
    source: "fallback",
  };
}

function tryParseNarrative(raw: string): NarrativeResult | null {
  try {
    // Strip accidental markdown code fences if the model adds them anyway.
    const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
    const parsed = JSON.parse(cleaned);
    if (
      typeof parsed.strength === "string" &&
      typeof parsed.risk === "string" &&
      Array.isArray(parsed.improvement_tips) &&
      parsed.improvement_tips.length > 0
    ) {
      return {
        strength: parsed.strength,
        risk: parsed.risk,
        improvement_tips: parsed.improvement_tips.slice(0, 2),
        source: "anthropic",
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generates a short, grounded underwriting narrative via the Anthropic API.
 * Never throws — falls back to a locally-derived narrative built from the
 * score's own risk/strength flags if the API key is missing, the call
 * errors, or times out, so the assessment pipeline never breaks.
 */
export async function generateNarrative(
  profile: MSMEProfileMeta,
  normalized: NormalizedMSMEData,
  score: ScoreResult,
  mlRisk: MLRiskResult
): Promise<NarrativeResult> {
  const anthropic = getAnthropicClient(ANTHROPIC_TIMEOUT_MS);
  if (!anthropic) {
    return buildFallback(score);
  }

  try {
    const message = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(profile, normalized, score, mlRisk) }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return buildFallback(score);
    }

    const parsed = tryParseNarrative(textBlock.text);
    return parsed ?? buildFallback(score);
  } catch (err) {
    console.error("[narrative] Anthropic API call failed, using fallback:", (err as Error).message);
    return buildFallback(score);
  }
}
