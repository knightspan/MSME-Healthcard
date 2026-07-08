// ============================================================================
// Tunable constants for the weighted-rules scoring engine. Centralized here
// so the model's behavior is auditable and adjustable without touching the
// scoring logic itself — this is the "explainability surface" of the engine.
// ============================================================================

export const PILLAR_WEIGHTS = {
  revenueStability: 0.3,
  complianceHealth: 0.25,
  cashFlowDiscipline: 0.25,
  formalityPayrollStability: 0.2,
} as const;

/** Applied to the reweighted composite when a pillar (EPFO) has no data at
 * all. Reflects conservative underwriting principle: a strong score built
 * on fewer independent data sources carries more uncertainty than one
 * corroborated across all four, even if every available signal is healthy. */
export const INCOMPLETE_DATA_CONFIDENCE_FACTOR = 0.87;

export const REVENUE_VARIANCE_PENALTY = 6; // points lost per 1% coefficient of variation

export const CASH_RATIO_MULTIPLIER = 280; // avg_bank_balance / monthly_revenue -> score scale
export const BOUNCE_PENALTY_PER_INCIDENT = 8;
export const BOUNCE_PENALTY_CAP = 35;

export const PAYROLL_TREND_MULTIPLIER = 2; // points lost per 1% headcount decline

/** No pillar is ever scored as an absolute zero — real credit signals are
 * rarely truly binary, and a hard zero on one dimension shouldn't be able
 * to single-handedly erase every other positive signal in the composite. */
export const PILLAR_SCORE_FLOOR = 8;

export const SCORE_BANDS: { band: string; min: number; max: number }[] = [
  { band: "Poor", min: 0, max: 20 },
  { band: "Bad", min: 21, max: 40 },
  { band: "Average", min: 41, max: 60 },
  { band: "Good", min: 61, max: 80 },
  { band: "Excellent", min: 81, max: 100 },
];
