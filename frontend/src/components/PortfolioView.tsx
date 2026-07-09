import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PortfolioSummary } from "../types";
import { fetchPortfolioSummary } from "../lib/api";
import { BAND_BG_CLASSES, BAND_COLORS, BAND_ORDER } from "../lib/bandColors";

interface PortfolioViewProps {
  onSelectMsme: (id: string) => void;
}

type SortDirection = "asc" | "desc";

export function PortfolioView({ onSelectMsme }: PortfolioViewProps) {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPortfolioSummary()
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const chartData = useMemo(() => {
    if (!summary) return [];
    return BAND_ORDER.map((band) => ({ band, count: summary.band_counts[band] }));
  }, [summary]);

  const sortedMsmes = useMemo(() => {
    if (!summary) return [];
    const copy = [...summary.msmes];
    copy.sort((a, b) => (sortDir === "asc" ? a.composite_score - b.composite_score : b.composite_score - a.composite_score));
    return copy;
  }, [summary, sortDir]);

  if (loading) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-10 text-center text-sm text-slate-400">
        Loading portfolio summary…
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        <span className="font-semibold">Could not load portfolio summary:</span> {error ?? "Unknown error"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Average Composite Score" value={summary.average_composite_score.toFixed(1)} suffix="/ 100" />
        <StatCard label="High-Risk Share (Poor + Bad)" value={summary.high_risk_pct.toFixed(1)} suffix="%" />
        <StatCard label="Total MSMEs Assessed" value={String(summary.total_assessed)} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Score Distribution Across Bands
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="band" tick={{ fill: "#475569", fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} width={28} />
            <Tooltip
              formatter={(value) => [`${value} MSME(s)`, "Count"]}
              contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 13 }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.band} fill={BAND_COLORS[entry.band]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {Object.entries(summary.business_type_counts).map(([type, count]) => (
            <span
              key={type}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
            >
              {type}: {count}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Portfolio Detail</h2>
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Sort by score: {sortDir === "asc" ? "Low → High" : "High → Low"}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4">MSME</th>
                <th className="py-2 pr-4">Business Type</th>
                <th className="py-2 pr-4">Score</th>
                <th className="py-2 pr-4">Band</th>
                <th className="py-2 pr-4">Top Risk Flag</th>
              </tr>
            </thead>
            <tbody>
              {sortedMsmes.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => onSelectMsme(m.id)}
                  className="cursor-pointer border-b border-slate-100 transition hover:bg-teal-50/60"
                >
                  <td className="py-3 pr-4 font-medium text-slate-900">{m.name}</td>
                  <td className="py-3 pr-4 text-slate-600">{m.businessType}</td>
                  <td className="py-3 pr-4 tabular-nums text-slate-800">{m.composite_score.toFixed(1)}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${BAND_BG_CLASSES[m.band]}`}
                    >
                      {m.band}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-500">{m.top_risk_flag ?? "None flagged"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-400">Click any row to open that MSME's full assessment view.</p>
      </section>
    </div>
  );
}

function StatCard({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value}
        {suffix && <span className="ml-1 text-sm font-medium text-slate-400">{suffix}</span>}
      </p>
    </div>
  );
}
