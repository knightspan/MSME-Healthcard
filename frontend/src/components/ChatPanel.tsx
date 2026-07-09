import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../types";
import { sendChatMessage } from "../lib/api";

interface ChatPanelProps {
  msmeId: string | null;
  msmeName: string | null;
}

const STARTER_QUESTIONS = [
  "Why is this MSME risky?",
  "Should we approve this loan?",
  "What's the biggest strength here?",
  "What would improve this score fastest?",
];

interface DisplayMessage extends ChatMessage {
  source?: "anthropic" | "fallback";
}

export function ChatPanel({ msmeId, msmeName }: ChatPanelProps) {
  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fresh MSME selection means fresh grounded data — don't carry over a
  // conversation that was grounded in a different business.
  useEffect(() => {
    setMessages([]);
    setInput("");
    setError(null);
  }, [msmeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !msmeId || sending) return;

    const history: ChatMessage[] = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const res = await sendChatMessage(msmeId, trimmed, history);
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply, source: res.source }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The AI Credit Copilot request failed.");
    } finally {
      setSending(false);
    }
  }

  if (!msmeId) return null;

  if (!open) {
    return (
      <div className="flex-none">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-full flex-col items-center gap-3 rounded-lg border border-slate-200 bg-white px-2 py-4 text-slate-500 transition hover:border-teal-300 hover:text-teal-700"
        >
          <svg className="h-4 w-4 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ writingMode: "vertical-rl" }}
          >
            AI Credit Copilot
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-none flex-col rounded-lg border border-slate-200 bg-white lg:w-96">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">AI Credit Copilot</h3>
          <p className="text-xs text-slate-500">Grounded in {msmeName ?? "the selected MSME"}'s live assessment</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-none rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Collapse chat panel"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div ref={scrollRef} className="max-h-[26rem] min-h-[16rem] flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Ask a question about this MSME's assessment, or try one of these:
            </p>
            <div className="flex flex-col gap-2">
              {STARTER_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleSend(q)}
                  disabled={sending}
                  className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-left text-xs font-medium text-teal-800 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user" ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-800"
              }`}
            >
              {m.content}
              {m.role === "assistant" && m.source && (
                <div className="mt-1.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      m.source === "anthropic" ? "bg-teal-600 text-white" : "bg-slate-300 text-slate-700"
                    }`}
                  >
                    {m.source === "anthropic" ? "Generated by Claude" : "Local fallback"}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-400">Thinking…</div>
          </div>
        )}
      </div>

      {error && <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-600">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
        className="flex items-center gap-2 border-t border-slate-100 px-3 py-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
          placeholder="Ask the copilot about this assessment…"
          className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 disabled:bg-slate-50"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="flex-none rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Send
        </button>
      </form>
    </div>
  );
}
