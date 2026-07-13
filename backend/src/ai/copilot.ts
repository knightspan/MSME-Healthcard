import type {
  ChatMessage,
  ChatResponse,
  MLRiskResult,
  MSMEProfileMeta,
  NormalizedMSMEData,
  ScoreResult,
} from "../types/index.js";
import { ANTHROPIC_MODEL, getAnthropicClient } from "./anthropicClient.js";

const COPILOT_TIMEOUT_MS = 12000; // conversational call, not on the tight /assess latency budget
const MAX_HISTORY_MESSAGES = 12; // bound token usage / cost per turn

const COPILOT_INSTRUCTIONS =
  'You are a credit copilot for a bank underwriter. Answer ONLY using the data provided. If asked for a recommendation, give a specific one (approve/conditional approve/decline) with a suggested loan amount range and monitoring conditions, grounded in the actual risk flags. Never invent data not present in the context.';

/**
 * Builds the system prompt for a single chat turn. Includes the full,
 * freshly-computed score object and normalized data as grounded context so
 * the model never has to (and is instructed not to) invent figures.
 */
export function buildCopilotSystemPrompt(
  profile: MSMEProfileMeta,
  normalized: NormalizedMSMEData,
  score: ScoreResult,
  mlRisk: MLRiskResult
): string {
  const context = {
    business_name: profile.name,
    business_type: profile.businessType,
    short_description: profile.shortDescription,
    composite_score: score.composite_score,
    band: score.band,
    pillars: score.pillars,
    reweighted: score.reweighted,
    reweight_note: score.reweight_note,
    risk_flags: score.risk_flags,
    strength_flags: score.strength_flags,
    normalized_data: normalized,
    ml_risk_assessment: mlRisk.available
      ? {
          probability_of_default_pct: mlRisk.probability_of_default_pct,
          risk_band: mlRisk.risk_band,
          confidence_pct: mlRisk.confidence_pct,
          model_version: mlRisk.model_version,
          top_risk_increasing_features: mlRisk.top_risk_increasing_features,
          top_risk_reducing_features: mlRisk.top_risk_reducing_features,
          note: "This is a demonstration XGBoost model trained on a public bureau-style dataset (Give Me Some Credit) with alt-data mapped into its feature space via a documented heuristic bridge — not trained on IDBI's own repayment history. Present it as directional ML signal, not certified bureau-grade PD.",
        }
      : { available: false, note: "ML risk service was unavailable for this assessment; rely on the rule-based score and flags only." },
  };

  return `${COPILOT_INSTRUCTIONS}

Here is the complete, up-to-date financial health assessment for this MSME, including the explainable rule-based score AND the XGBoost probability-of-default model's output with SHAP feature attributions. Treat this as the entire universe of facts you know about the business — do not reference anything outside of it. When asked "why shouldn't I approve" or similar, ground your answer in the specific risk_flags, top_risk_increasing_features, and pillar scores — never a generic answer:

${JSON.stringify(context, null, 2)}`;
}

function sanitizeHistory(history: ChatMessage[] | undefined): ChatMessage[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (m): m is ChatMessage =>
        !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0
    )
    .slice(-MAX_HISTORY_MESSAGES);
}

function buildFallbackReply(score: ScoreResult): ChatResponse {
  const topRisk = score.risk_flags[0] ?? "No major automated risk flags were raised.";
  const topStrength = score.strength_flags[0] ?? "No standout strength signal was flagged.";
  return {
    reply:
      `AI Credit Copilot is currently running in local fallback mode (ANTHROPIC_API_KEY is not configured or the API call failed), so this is a data-only summary rather than a conversational answer.\n\n` +
      `Composite score: ${score.composite_score}/100 (${score.band} band).\n` +
      `Top strength: ${topStrength}\n` +
      `Top risk: ${topRisk}\n\n` +
      `Set ANTHROPIC_API_KEY on the backend to enable full conversational answers grounded in this data.`,
    source: "fallback",
  };
}

/**
 * Generates a grounded conversational reply for the AI Credit Copilot.
 * Never throws — falls back to a deterministic, score-derived summary if the
 * API key is missing, the call errors, or times out.
 */
export async function generateCopilotReply(
  profile: MSMEProfileMeta,
  normalized: NormalizedMSMEData,
  score: ScoreResult,
  mlRisk: MLRiskResult,
  message: string,
  conversationHistory: ChatMessage[] | undefined
): Promise<ChatResponse> {
  const anthropic = getAnthropicClient(COPILOT_TIMEOUT_MS);
  if (!anthropic) {
    return buildFallbackReply(score);
  }

  try {
    const history = sanitizeHistory(conversationHistory);
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 800,
      system: buildCopilotSystemPrompt(profile, normalized, score, mlRisk),
      messages: [...history, { role: "user" as const, content: message }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text" || !textBlock.text.trim()) {
      return buildFallbackReply(score);
    }

    return { reply: textBlock.text.trim(), source: "anthropic" };
  } catch (err) {
    console.error("[copilot] Anthropic API call failed, using fallback:", (err as Error).message);
    return buildFallbackReply(score);
  }
}
