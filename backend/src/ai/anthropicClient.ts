import Anthropic from "@anthropic-ai/sdk";

export const ANTHROPIC_MODEL = "claude-sonnet-4-6";

const clients = new Map<number, Anthropic>();

/**
 * Returns a shared Anthropic client for the given timeout, or null if
 * ANTHROPIC_API_KEY is not configured. Clients are cached per timeout value
 * so different call sites (narrative generation, copilot chat) can each use
 * a timeout appropriate to their latency budget without re-instantiating the
 * SDK on every request.
 */
export function getAnthropicClient(timeoutMs: number): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  let client = clients.get(timeoutMs);
  if (!client) {
    client = new Anthropic({ apiKey, timeout: timeoutMs });
    clients.set(timeoutMs, client);
  }
  return client;
}
