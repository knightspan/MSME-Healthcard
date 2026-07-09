import type {
  ChatMessage,
  ChatResponse,
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
  score: ScoreResult
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
  };

  return `${COPILOT_INSTRUCTIONS}

Here is the complete, up-to-date financial health assessment for this MSME. Treat this as the entire universe of facts you know about the business — do not reference anything outside of it:

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
      system: buildCopilotSystemPrompt(profile, normalized, score),
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
