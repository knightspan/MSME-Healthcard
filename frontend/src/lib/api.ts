import type {
  AssessmentResponse,
  ChatMessage,
  ChatResponse,
  MSMEProfileMeta,
  NormalizedMSMEData,
  OCENPayload,
  PortfolioSummary,
  ScoreResult,
} from "../types";

const BASE = "/api/msme";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore parse failure, use default message
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function fetchProfiles(): Promise<{ profiles: MSMEProfileMeta[]; data_mode: "mock" | "live" }> {
  const res = await fetch(`${BASE}/profiles`);
  return handle(res);
}

export async function runAssessment(id: string): Promise<AssessmentResponse> {
  const res = await fetch(`${BASE}/${id}/assess`, { method: "POST" });
  return handle(res);
}

export async function fetchOcenPayload(id: string): Promise<OCENPayload> {
  const res = await fetch(`${BASE}/${id}/ocen-payload`);
  return handle(res);
}

export async function sendChatMessage(
  id: string,
  message: string,
  conversationHistory: ChatMessage[]
): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/${id}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversationHistory }),
  });
  return handle(res);
}

export async function fetchPortfolioSummary(): Promise<PortfolioSummary> {
  const res = await fetch(`${BASE}/portfolio/summary`);
  return handle(res);
}

export async function simulateScore(id: string, normalized: NormalizedMSMEData): Promise<ScoreResult> {
  const res = await fetch(`${BASE}/${id}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(normalized),
  });
  return handle(res);
}

export async function downloadCreditMemo(id: string, filenameHint: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}/memo`);
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore parse failure, use default message
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `credit-memo-${filenameHint}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
