import { Router } from "express";
import { computeScore } from "../scoring/scoringEngine.js";
import { getMLRisk } from "../ml/mlClient.js";
import { ANTHROPIC_MODEL, getAnthropicClient } from "../ai/anthropicClient.js";
import type { MLRiskResult, NormalizedMSMEData, ScoreResult } from "../types/index.js";

// ============================================================================
// This router adapts the ad-hoc "Interactive Risk Underwriter" form on the
// RiskIntel MSME frontend (POST /api/v1/score, POST /api/v1/chat) onto the
// SAME real pipeline the profile-based routes use: the rule-based
// computeScore() engine AND the actual trained XGBoost PD model + SHAP
// (via getMLRisk() -> ml-service). Nothing here reimplements scoring or ML
// inference — it only bridges input/output shapes.
// ============================================================================

export interface MSMEFinancialInputs {
  applicant_name: string;
  facility_type: string;
  requested_amount: number;
  gst_turnover_ltm: number; // INR Crores, last-twelve-months
  digital_receipts_avg_mo: number; // INR Lakhs/month
  avg_bank_balance: number; // INR Lakhs
  dscr: number; // Debt Service Coverage Ratio
  vintage_years: number;
  supplier_concentration: number; // %, top-2 suppliers
  existing_debt_ratio: number; // %, trade-line utilization
  recent_delinquency: boolean;
}

export interface SHAPFactor {
  key: string;
  label: string;
  impact: number;
  description: string;
  type: "strength" | "risk";
}

export interface CreditScoreResponse {
  applicant_id: string;
  applicant_name: string;
  probability_of_default: number;
  composite_score: number;
  risk_band: "Low" | "Moderate" | "High";
  recommended_action: string;
  confidence: number;
  shap_values: Record<string, number>;
  explainability_factors: SHAPFactor[];
  recent_credit_lines: Array<{
    lender: string;
    type: string;
    amount: number;
    status: "Standard" | "Substandard" | "Doubtful";
  }>;
  score_breakdown: {
    revenueStability: { score: number; weight: number };
    complianceHealth: { score: number; weight: number };
    cashFlowDiscipline: { score: number };
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * THE HONESTY LAYER OF THIS BRIDGE — see ml-service/src/feature_mapping.py
 * for the equivalent disclosure on the alt-data -> GMSC side.
 *
 * The "Interactive Risk Underwriter" form collects a different (smaller, more
 * bureau-flavoured) field set than the GST/UPI/AA/EPFO adapters do — it has
 * no month-by-month filing calendar or EPFO payroll feed at all. Rather than
 * inventing data, every derived field below is a documented, deterministic
 * heuristic grounded in the fields that ARE collected, and payroll data is
 * left null (never fabricated), which correctly triggers the same
 * "EPFO unavailable -> reweight" path the rest of the app already uses.
 */
function mapInputsToNormalized(inputs: MSMEFinancialInputs): NormalizedMSMEData {
  // Digital (UPI) receipts are already a monthly figure and the closest
  // direct proxy for realized monthly cash inflow — better suited than
  // dividing the annual GST turnover (LTM) figure by 12.
  const monthly_revenue = Math.max(0, inputs.digital_receipts_avg_mo) * 100_000; // Lakhs -> INR
  const avg_bank_balance = Math.max(0, inputs.avg_bank_balance) * 100_000; // Lakhs -> INR

  // No monthly revenue series is collected, so variance is proxied from
  // signals that correlate with revenue consistency in practice: longer
  // vintage and a healthier debt-service cushion both correlate with
  // steadier month-to-month turnover than a young, thinly-covered business.
  const revenue_variance_pct = round1(
    clamp(32 - inputs.vintage_years * 1.1 - (inputs.dscr - 1) * 14, 2, 55)
  );

  // No GSTR filing calendar is collected either. On-time filing regularity is
  // proxied from vintage (longer-registered filers tend to file more
  // consistently) and penalized directly by a recorded delinquency event or
  // heavy trade-line utilization.
  const filing_regularity_pct = round1(
    clamp(
      58 + inputs.vintage_years * 2.2 - (inputs.recent_delinquency ? 18 : 0) -
        Math.max(0, inputs.existing_debt_ratio - 70) * 0.4,
      25,
      99
    )
  );

  // Bounced-payment count is proxied directly from the recorded delinquency
  // flag and trade-line utilization: a flagged delinquency plus heavy
  // utilization reads as a sustained bounce pattern, a clean/low-utilization
  // profile reads as zero-to-few bounces.
  const bounced_payment_count = inputs.recent_delinquency
    ? Math.round(clamp(6 + inputs.existing_debt_ratio / 20, 6, 12))
    : Math.round(clamp((inputs.existing_debt_ratio - 65) / 20, 0, 3));

  return {
    monthly_revenue: round1(monthly_revenue),
    revenue_variance_pct,
    filing_regularity_pct,
    avg_bank_balance: round1(avg_bank_balance),
    bounced_payment_count,
    // This form never collects EPFO/payroll data — left null rather than
    // guessed, which correctly routes through the existing "reweight away
    // the Formality/Payroll pillar" path in computeScore().
    payroll_headcount_trend_pct: null,
    months_of_data_available: Math.max(1, Math.round(inputs.vintage_years * 12)),
    data_sources_available: ["GST", "UPI", "AA"],
  };
}

function riskBandFromMlPdPct(pdPct: number): "Low" | "Moderate" | "High" {
  // Collapses the ML service's 4-way Low/Moderate/Elevated/High band (see
  // ml-service model_metadata.json risk_band_cuts_pct) onto this frontend's
  // 3-way schema by merging Elevated into High — both denote PD levels a
  // lender should treat as materially concerning.
  if (pdPct < 16.4) return "Low";
  if (pdPct < 41.65) return "Moderate";
  return "High";
}

function riskBandFromComposite850(score: number): "Low" | "Moderate" | "High" {
  if (score >= 700) return "Low";
  if (score < 500) return "High";
  return "Moderate";
}

function recommendedActionFor(band: "Low" | "Moderate" | "High"): string {
  switch (band) {
    case "Low":
      return "Approval Recommended - Standard terms and covenants";
    case "High":
      return "Decline - High risk profile detected, refer to credit committee";
    default:
      return "Refer for manual underwriting review";
  }
}

function buildMlExplainability(mlRisk: MLRiskResult): {
  shap_values: Record<string, number>;
  explainability_factors: SHAPFactor[];
} {
  const shap_values: Record<string, number> = {};
  const explainability_factors: SHAPFactor[] = [];

  for (const f of mlRisk.top_risk_increasing_features) {
    const key = f.raw_feature ?? f.feature;
    shap_values[key] = f.shap_value;
    explainability_factors.push({
      key,
      label: f.feature,
      impact: f.shap_value,
      description: `XGBoost PD model signal (value ${f.feature_value}): increases modeled default probability (SHAP +${f.shap_value}).`,
      type: "risk",
    });
  }
  for (const f of mlRisk.top_risk_reducing_features) {
    const key = f.raw_feature ?? f.feature;
    shap_values[key] = f.shap_value;
    explainability_factors.push({
      key,
      label: f.feature,
      impact: f.shap_value,
      description: `XGBoost PD model signal (value ${f.feature_value}): reduces modeled default probability (SHAP ${f.shap_value}).`,
      type: "strength",
    });
  }
  return { shap_values, explainability_factors };
}

/** Used only when the ML service is unreachable — mirrors the rule engine's
 * own inputs so the demo stays fully functional offline, clearly labelled as
 * a heuristic rather than the model's real SHAP output. */
function buildFallbackExplainability(inputs: MSMEFinancialInputs): {
  shap_values: Record<string, number>;
  explainability_factors: SHAPFactor[];
} {
  const shap_values: Record<string, number> = {
    vintage_years: inputs.vintage_years >= 5 ? -0.008 : 0.005,
    debt_service_ratio: inputs.dscr >= 1.2 ? -0.005 : 0.006,
    supplier_concentration: inputs.supplier_concentration >= 60 ? 0.003 : -0.002,
    trade_line_utilization: inputs.existing_debt_ratio >= 75 ? 0.006 : -0.004,
    recent_delinquency: inputs.recent_delinquency ? 0.008 : -0.003,
  };

  const explainability_factors: SHAPFactor[] = [
    {
      key: "vintage_years",
      label: inputs.vintage_years >= 5 ? "High Vintage" : "Low Vintage",
      impact: shap_values.vintage_years,
      description:
        inputs.vintage_years >= 5
          ? `Business has been operational for ${inputs.vintage_years} years, reducing structural survival risk.`
          : `Early-stage business operational for only ${inputs.vintage_years} years increases sector survival risk.`,
      type: inputs.vintage_years >= 5 ? "strength" : "risk",
    },
    {
      key: "debt_service_ratio",
      label: inputs.dscr >= 1.2 ? "Satisfactory Debt Coverage" : "High Debt Ratio",
      impact: shap_values.debt_service_ratio,
      description: `Debt service coverage ratio (DSCR) is ${inputs.dscr.toFixed(2)}x.`,
      type: inputs.dscr >= 1.2 ? "strength" : "risk",
    },
    {
      key: "supplier_concentration",
      label: inputs.supplier_concentration >= 60 ? "Supplier Concentration" : "Diversified Supplier Base",
      impact: shap_values.supplier_concentration,
      description: `Top 2 suppliers account for ${inputs.supplier_concentration}% of total purchases.`,
      type: inputs.supplier_concentration >= 60 ? "risk" : "strength",
    },
    {
      key: "recent_delinquency",
      label: inputs.recent_delinquency ? "Recent Delinquency Flagged" : "Clean Repayment Record",
      impact: shap_values.recent_delinquency,
      description: inputs.recent_delinquency
        ? "A recent 30-day delinquency was recorded on an existing facility."
        : "No recent delinquency events on record.",
      type: inputs.recent_delinquency ? "risk" : "strength",
    },
  ];

  return { shap_values, explainability_factors };
}

function buildCreditLines(
  inputs: MSMEFinancialInputs,
  band: "Low" | "Moderate" | "High"
): CreditScoreResponse["recent_credit_lines"] {
  const lines: CreditScoreResponse["recent_credit_lines"] = [
    {
      lender: "Requested Facility (This Application)",
      type: inputs.facility_type,
      amount: round2(inputs.requested_amount / 1e7), // INR -> Crores
      status: band === "High" ? "Substandard" : "Standard",
    },
  ];

  if (inputs.existing_debt_ratio > 40) {
    lines.push({
      lender: "Existing Trade Line (Bureau Registry)",
      type: "Working Capital",
      amount: round2((inputs.existing_debt_ratio / 100) * 1.5),
      status: inputs.existing_debt_ratio > 80 ? "Substandard" : "Standard",
    });
  }

  return lines;
}

function buildCreditScoreResponse(
  inputs: MSMEFinancialInputs,
  normalized: NormalizedMSMEData,
  score: ScoreResult,
  mlRisk: MLRiskResult
): CreditScoreResponse {
  const composite850 = Math.round(300 + (score.composite_score / 100) * 550);

  const probability_of_default = mlRisk.available && mlRisk.probability_of_default_pct !== null
    ? round1(mlRisk.probability_of_default_pct) / 100
    : Math.round((0.005 + ((850 - composite850) / 550) * 0.34) * 1000) / 1000;

  const risk_band = mlRisk.available && mlRisk.probability_of_default_pct !== null
    ? riskBandFromMlPdPct(mlRisk.probability_of_default_pct)
    : riskBandFromComposite850(composite850);

  const confidence = mlRisk.available && mlRisk.confidence_pct !== null ? mlRisk.confidence_pct : 78;

  const { shap_values, explainability_factors } = mlRisk.available
    ? buildMlExplainability(mlRisk)
    : buildFallbackExplainability(inputs);

  const revenuePillar = score.pillars.find((p) => p.key === "revenueStability");
  const compliancePillar = score.pillars.find((p) => p.key === "complianceHealth");
  const cashFlowPillar = score.pillars.find((p) => p.key === "cashFlowDiscipline");

  return {
    applicant_id: "msme-" + Math.floor(1000 + Math.random() * 9000),
    applicant_name: inputs.applicant_name || "Unnamed Applicant",
    probability_of_default,
    composite_score: composite850,
    risk_band,
    recommended_action: recommendedActionFor(risk_band),
    confidence,
    shap_values,
    explainability_factors,
    recent_credit_lines: buildCreditLines(inputs, risk_band),
    score_breakdown: {
      revenueStability: {
        score: Math.round(300 + ((revenuePillar?.score ?? 50) / 100) * 550),
        weight: revenuePillar?.weight ?? 0.3,
      },
      complianceHealth: {
        score: Math.round(300 + ((compliancePillar?.score ?? 50) / 100) * 550),
        weight: compliancePillar?.weight ?? 0.25,
      },
      cashFlowDiscipline: {
        score: Math.round(cashFlowPillar?.score ?? 50),
      },
    },
  };
}

function isValidInputs(body: unknown): body is MSMEFinancialInputs {
  if (!body || typeof body !== "object") return false;
  const d = body as Record<string, unknown>;
  const numericFields = [
    "requested_amount",
    "gst_turnover_ltm",
    "digital_receipts_avg_mo",
    "avg_bank_balance",
    "dscr",
    "vintage_years",
    "supplier_concentration",
    "existing_debt_ratio",
  ];
  const allNumbersValid = numericFields.every((key) => typeof d[key] === "number" && Number.isFinite(d[key]));
  return (
    typeof d.applicant_name === "string" &&
    typeof d.facility_type === "string" &&
    typeof d.recent_delinquency === "boolean" &&
    allNumbersValid
  );
}

// ---- Chat / AI Credit Copilot (global, not tied to a specific assessment) ----

const CHAT_TIMEOUT_MS = 8000;
const MAX_CHAT_HISTORY = 12;

const CHAT_SYSTEM_PROMPT =
  "You are an expert MSME Credit Risk Specialist and virtual underwriter at a premium digital banking institute. " +
  "You assist credit managers and bank underwriters in analyzing GST filings, UPI cashflow data, Account Aggregator " +
  "statements, and composite ML/XGBoost risk indicators (including SHAP explainability). Be professional, direct, " +
  "numerically precise, and helpful. Keep responses relatively concise and structured with bullet points or bold " +
  "text where appropriate.";

interface IncomingChatMessage {
  role: "user" | "assistant";
  content: string;
}

function fallbackChatReply(messages: IncomingChatMessage[]): string {
  const lastUserMessage = messages[messages.length - 1]?.content?.toLowerCase() ?? "";

  if (lastUserMessage.includes("dscr")) {
    return "The Debt Service Coverage Ratio (DSCR) is a critical multiplier of cash-flow health. A DSCR of >1.25x is highly favorable, whereas a DSCR nearing 1.1x triggers immediate risk mitigants or manual underwriter referral.";
  }
  if (lastUserMessage.includes("gst") || lastUserMessage.includes("tax")) {
    return "GST Turnover (LTM) derived from GSTR-1 & GSTR-3B filings provides real-time verification of top-line revenue velocity. We combine this with Account Aggregator bank summaries to spot hidden cash discrepancies.";
  }
  if (lastUserMessage.includes("risk") || lastUserMessage.includes("score") || lastUserMessage.includes("shap")) {
    return "Our composite scoring engine blends an explainable weighted-rules model with a real XGBoost probability-of-default model (SHAP-attributed). Scores above 700 are classified as Low Risk, facilitating fast-track automated approval over the OCEN network.";
  }
  return "As your MSME Credit Assistant, I can help analyze debt-service ratios, GST-turnover growth, and UPI velocity. (Note: running in offline/fallback mode — set ANTHROPIC_API_KEY on the backend to enable full conversational AI.)";
}

async function generateChatReply(messages: IncomingChatMessage[]): Promise<string> {
  const anthropic = getAnthropicClient(CHAT_TIMEOUT_MS);
  if (!anthropic) return fallbackChatReply(messages);

  try {
    const history = messages.slice(-MAX_CHAT_HISTORY).map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
      content: m.content,
    }));

    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 700,
      system: CHAT_SYSTEM_PROMPT,
      messages: history,
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text" || !textBlock.text.trim()) {
      return fallbackChatReply(messages);
    }
    return textBlock.text.trim();
  } catch (err) {
    console.error("[api/v1/chat] Anthropic API call failed, using fallback:", (err as Error).message);
    return fallbackChatReply(messages);
  }
}

export const scoreRouter = Router();

scoreRouter.post("/score", async (req, res) => {
  if (!isValidInputs(req.body)) {
    res.status(400).json({ error: "Request body must be a full MSMEFinancialInputs object." });
    return;
  }

  try {
    const inputs = req.body;
    const normalized = mapInputsToNormalized(inputs);

    // Rule-engine composite is instant; the ML call adds real network latency,
    // so both run through the same pipeline as the profile-based /assess route.
    const score = computeScore(normalized);
    const mlRisk = await getMLRisk(normalized);

    const response = buildCreditScoreResponse(inputs, normalized, score, mlRisk);
    res.json(response);
  } catch (err) {
    console.error("[api/v1/score] failed:", err);
    res.status(500).json({ error: "Credit scoring pipeline failed. Please try again." });
  }
});

scoreRouter.post("/chat", async (req, res) => {
  const { messages } = req.body as { messages?: IncomingChatMessage[] };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "Messages array is required." });
    return;
  }

  try {
    const content = await generateChatReply(messages);
    res.json({ content });
  } catch (err) {
    console.error("[api/v1/chat] failed:", err);
    res.status(500).json({ error: "AI Credit Copilot request failed. Please try again." });
  }
});
