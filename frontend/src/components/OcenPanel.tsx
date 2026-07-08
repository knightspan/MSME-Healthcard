import { useState } from "react";
import type { OCENPayload } from "../types";

interface OcenPanelProps {
  payload: OCENPayload;
}

export function OcenPanel({ payload }: OcenPanelProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const json = JSON.stringify(payload, null, 2);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable — fail silently, non-critical for the demo.
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <h3 className="text-sm font-semibold text-slate-900">OCEN-Compatible Output</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Structured JSON ready for handoff to a Loan Service Provider (LSP) via ULI/OCEN/AA rails.
          </p>
        </div>
        <span className="ml-3 flex-none text-slate-400">
          <svg
            className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-4">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              {copied ? "Copied!" : "Copy to clipboard"}
            </button>
          </div>
          <pre className="max-h-96 overflow-auto rounded-md bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
            {json}
          </pre>
        </div>
      )}
    </div>
  );
}
