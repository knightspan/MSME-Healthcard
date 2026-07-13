import { MSMEFinancialInputs, CreditScoreResponse } from "../types";

// Base URL configuration - check localStorage or default to the real backend.
// "/api/v1/score" is proxied by Vite's dev server (see vite.config.ts) to the
// Express + ML backend on :4000; the absolute URL is a direct fallback for
// when the app isn't served through the Vite dev proxy (e.g. a static build).
const STORAGE_KEY = "msme_api_url";
export const DEFAULT_BUILTIN_URL = "/api/v1/score";
export const DEFAULT_EXTERNAL_URL = "http://localhost:4000/api/v1/score";

export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_BUILTIN_URL;
  }
  return DEFAULT_BUILTIN_URL;
}

export function setApiUrl(url: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, url);
  }
}

/** Derives the chat endpoint from whatever scoring endpoint is configured,
 * so pointing the app at a different backend host also redirects chat. */
export function getChatApiUrl(): string {
  const scoreUrl = getApiUrl();
  return scoreUrl.endsWith("/score") ? scoreUrl.replace(/\/score$/, "/chat") : "/api/v1/chat";
}

/**
 * Sends financial inputs to the credit scoring endpoint and returns the computed score and SHAP values.
 */
export async function scoreMSMECredit(inputs: MSMEFinancialInputs): Promise<CreditScoreResponse> {
  const url = getApiUrl();
  console.log(`Sending credit score request to: ${url}`, inputs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(inputs),
    });

    if (!response.ok) {
      throw new Error(`API returned error status: ${response.status}`);
    }

    const data: CreditScoreResponse = await response.json();
    return data;
  } catch (error) {
    console.error(`Failed to fetch credit score from ${url}:`, error);
    
    // If a custom/external URL failed (e.g. wrong host or the backend isn't
    // running there), fall back to the dev-proxied built-in endpoint so the
    // app degrades gracefully instead of hard-failing.
    if (url !== DEFAULT_BUILTIN_URL) {
      console.warn("Attempting to fall back to built-in scoring sandbox...");
      const response = await fetch(DEFAULT_BUILTIN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(inputs),
      });
      if (response.ok) {
        return await response.json();
      }
    }
    throw error;
  }
}
