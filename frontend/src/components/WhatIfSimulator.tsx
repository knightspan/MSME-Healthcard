import { useEffect, useMemo, useState } from "react";
import type { NormalizedMSMEData, ScoreResult } from "../types";
import { simulateScore } from "../lib/api";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { ScoreGauge } from "./ScoreGauge";
import { PillarRadarChart } from "./PillarRadarChart";

interface WhatIfSimulatorProps {
  msmeId: string;
  baselineNormalized: NormalizedMSMEData;
  baselineScore: ScoreResult;
}

interface SliderConfig {
  key: keyof NormalizedMSMEData;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  format?: (n: number) => string;
}

function currency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function buildSliderConfigs(baseline: NormalizedMSMEData): SliderConfig[] {
  const revenueMax = Math.max(baseline.monthly_revenue * 2.5, 100000);
  const balanceMax = Math.max(baseline.avg_bank_balance * 3, 50000);

  return [
    {
      key: "monthly_revenue",
      label: "Monthly Revenue",
      min: 0,
      max: Math.round(revenueMax),
      step: Math.max(Math.round(revenueMax / 200), 500),
      unit: "",
      format: currency,
    },
    {
      key: "revenue_variance_pct",
      label: "Revenue Variance",
      min: 0,
      max: 100,
      step: 0.5,
      unit: "%",
    },
    {
      key: "filing_regularity_pct",
      label: "Filing Regularity",
      min: 0,
      max: 100,
      step: 1,
      unit: "%",
    },
    {
      key: "avg_bank_balance",
      label: "Avg Bank Balance",
      min: 0,
      max: Math.round(balanceMax),
      step: Math.max(Math.round(balanceMax / 200), 500),
      unit: "",
      format: currency,
    },
    {
      key: "bounced_payment_count",
      label: "Bounced Payment Count",
      min: 0,
      max: 20,
      step: 1,
      unit: "",
    },
    {
      key: "payroll_headcount_trend_pct",
      label: "Payroll Headcount Trend",
      min: -50,
      max: 50,
      step: 0.5,
      unit: "%",
    },
  ];
}

export function WhatIfSimulator({ msmeId, baselineNormalized, baselineScore }: WhatIfSimulatorProps) {
  const [overrides, setOverrides] = useState<NormalizedMSMEData>(baselineNormalized);
  const [simulatedScore, setSimulatedScore] = useState<ScoreResult>(baselineScore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sliderConfigs = useMemo(() => buildSliderConfigs(baselineNormalized), [baselineNormalized]);
  const debouncedOverrides = useDebouncedValue(overrides, 400);

  // New MSME/baseline selected — reseed sliders and reset the simulated result.
  useEffect(() => {
    setOverrides(baselineNormalized);
    setSimulatedScore(baselineScore);
    setError(null);
  }, [msmeId, baselineNormalized, baselineScore]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    simulateScore(msmeId, debouncedOverrides)
      .then((score) => {
        if (!cancelled) {
          setSimulatedScore(score);
          setError(null);
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedOverrides, msmeId]);

  function handleSliderChange(key: keyof NormalizedMSMEData, value: number) {
    setOverrides((prev) => ({ ...prev, [key]: value }));
  }

  function handleReset() {
    setOverrides(baselineNormalized);
  }

  const delta = Math.round((simulatedScore.composite_score - baselineScore.composite_score) * 10) / 10;
  const deltaLabel = delta === 0 ? "±0.0" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`;
  const deltaColor = delta > 0 ? "text-green-600" : delta < 0 ? "text-red-600" : "text-slate-400";

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            What-If Scenario Simulator
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Adjust the inputs below to see how the composite score would react — computed live by the same scoring
            engine, with no changes to real data.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="flex-none rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          Reset to actual values
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          {sliderConfigs.map((cfg) => {
            const rawValue = overrides[cfg.key];
            const disabled = rawValue === null;
            const value = typeof rawValue === "number" ? rawValue : 0;
            return (
              <div key={cfg.key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{cfg.label}</span>
                  <span className="tabular-nums text-slate-600">
                    {disabled ? "N/A (no EPFO data)" : cfg.format ? cfg.format(value) : `${value}${cfg.unit}`}
                  </span>
                </div>
                <input
                  type="range"
                  min={cfg.min}
                  max={cfg.max}
                  step={cfg.step}
                  value={value}
                  disabled={disabled}
                  onChange={(e) => handleSliderChange(cfg.key, Number(e.target.value))}
                  className="w-full accent-teal-700 disabled:opacity-40"
                />
              </div>
            );
          })}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex flex-col items-center">
          <div className="relative w-full">
            <ScoreGauge score={simulatedScore.composite_score} band={simulatedScore.band} />
            <div className="mt-1 flex items-center justify-center gap-2">
              <span className={`text-sm font-bold tabular-nums ${deltaColor}`}>{deltaLabel}</span>
              <span className="text-xs text-slate-400">vs. actual ({baselineScore.composite_score.toFixed(1)})</span>
              {loading && <span className="text-xs text-slate-400">updating…</span>}
            </div>
          </div>
          <div className="mt-4 w-full">
            <PillarRadarChart pillars={simulatedScore.pillars} />
          </div>
        </div>
      </div>
    </section>
  );
}
