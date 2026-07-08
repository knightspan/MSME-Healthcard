import type { AssessmentResponse, MSMEProfileMeta, OCENPayload } from "../types";

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
