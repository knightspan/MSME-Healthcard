import type { PillarScore } from "../types";
import { BAND_COLORS } from "../lib/bandColors";
import type { ScoreBand } from "../types";

function scoreToImpliedBand(score: number): ScoreBand {
  if (score <= 20) return "Poor";
  if (score <= 40) return "Bad";
  if (score <= 60) return "Average";
  if (score <= 80) return "Good";
  return "Excellent";
}

interface PillarBreakdownProps {
  pillars: PillarScore[];
  reweighted: boolean;
  reweightNote: string | null;
}

export function PillarBreakdown({ pillars, reweighted, reweightNote }: PillarBreakdownProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        4-Pillar Score Breakdown
      </h3>
      <div className="space-y-4">
        {pillars.map((p) => (
          <div key={p.key} className={p.applied ? "" : "opacity-50"}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-800">
                {p.label}
                {!p.applied && <span className="ml-1.5 text-xs font-normal text-slate-400">(not applied)</span>}
              </span>
              <span className="tabular-nums text-slate-600">
                {p.applied ? `${p.score}/100` : "—"}{" "}
                <span className="text-xs text-slate-400">({Math.round(p.weight * 100)}% weight)</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${p.applied ? p.score : 0}%`,
                  backgroundColor: BAND_COLORS[scoreToImpliedBand(p.score)],
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {reweighted && reweightNote && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="font-semibold">Note: </span>
          {reweightNote}
        </div>
      )}
    </div>
  );
}
