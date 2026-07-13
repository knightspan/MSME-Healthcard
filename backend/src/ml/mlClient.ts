import type { MLRiskResult, NormalizedMSMEData } from "../types/index.js";

const configuredUrl = process.env.ML_SERVICE_URL?.trim();
// On Vercel (or any cloud host) never silently fall back to localhost — that
// just burns the request timeout. Prefer an explicit unset → graceful fallback.
const ML_SERVICE_URL = (
  configuredUrl && configuredUrl.length > 0
    ? configuredUrl
    : process.env.VERCEL
      ? ""
      : "http://localhost:8000"
).replace(/\/$/, "");

const ML_TIMEOUT_MS = 4000;

function buildFallback(reason: string): MLRiskResult {
  return {
    available: false,
    probability_of_default_pct: null,
    risk_band: null,
    confidence_pct: null,
    top_risk_increasing_features: [],
    top_risk_reducing_features: [],
    model_version: null,
    fallback_reason: reason,
  };
}

/**
 * Calls the Python FastAPI ML microservice (XGBoost PD model + SHAP) for a
 * given normalized MSME profile. Mirrors the resilience pattern used by
 * narrative.ts/copilot.ts for the Anthropic calls: this NEVER throws — if
 * the ML service is down, unreachable, or slow, the pipeline degrades to
 * the rule-based score alone rather than failing the whole assessment.
 */
export async function getMLRisk(normalized: NormalizedMSMEData): Promise<MLRiskResult> {
  if (!ML_SERVICE_URL) {
    return buildFallback(
      "ML_SERVICE_URL is not configured (set it to your hosted ml-service URL for PD/SHAP on Vercel)"
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);

  try {
    const res = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalized),
      signal: controller.signal,
    });

    if (!res.ok) {
      return buildFallback(`ML service responded with status ${res.status}`);
    }

    const data = (await res.json()) as {
      probability_of_default_pct: number;
      risk_band: string;
      confidence_pct: number;
      top_risk_increasing_features: { feature: string; shap_value: number; feature_value: number }[];
      top_risk_reducing_features: { feature: string; shap_value: number; feature_value: number }[];
      model_version: string;
    };

    return {
      available: true,
      probability_of_default_pct: data.probability_of_default_pct,
      risk_band: data.risk_band as MLRiskResult["risk_band"],
      confidence_pct: data.confidence_pct,
      top_risk_increasing_features: data.top_risk_increasing_features,
      top_risk_reducing_features: data.top_risk_reducing_features,
      model_version: data.model_version,
      fallback_reason: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[mlClient] ML service call failed, degrading to rule-based score only:", message);
    return buildFallback(
      message.includes("abort")
        ? "ML service did not respond in time"
        : "ML service unreachable (is ml-service running on ML_SERVICE_URL?)"
    );
  } finally {
    clearTimeout(timeout);
  }
}
