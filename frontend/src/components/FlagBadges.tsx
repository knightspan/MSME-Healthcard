interface FlagBadgesProps {
  riskFlags: string[];
  strengthFlags: string[];
}

export function FlagBadges({ riskFlags, strengthFlags }: FlagBadgesProps) {
  if (riskFlags.length === 0 && strengthFlags.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Risk &amp; Strength Signals
      </h3>
      <div className="flex flex-wrap gap-2">
        {strengthFlags.map((flag, i) => (
          <span
            key={`s-${i}`}
            className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-800"
          >
            {flag}
          </span>
        ))}
        {riskFlags.map((flag, i) => (
          <span
            key={`r-${i}`}
            className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700"
          >
            {flag}
          </span>
        ))}
      </div>
    </div>
  );
}
