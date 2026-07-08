import type { NormalizedMSMEData, PillarScore, ScoreBand, ScoreResult } from "../types/index.js";
import {
  BOUNCE_PENALTY_CAP,
  BOUNCE_PENALTY_PER_INCIDENT,
  CASH_RATIO_MULTIPLIER,
  INCOMPLETE_DATA_CONFIDENCE_FACTOR,
  PAYROLL_TREND_MULTIPLIER,
  PILLAR_SCORE_FLOOR,
  PILLAR_WEIGHTS,
  REVENUE_VARIANCE_PENALTY,
  SCORE_BANDS,
} from "./constants.js";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ============================================================================
// Pure pillar-scoring functions. Each takes normalized inputs and returns a
// 0-100 sub-score. No side effects, fully deterministic.
// ============================================================================

export function scoreRevenueStability(data: NormalizedMSMEData): number {
  return round1(clamp(100 - data.revenue_variance_pct * REVENUE_VARIANCE_PENALTY, PILLAR_SCORE_FLOOR, 100));
}

export function scoreComplianceHealth(data: NormalizedMSMEData): number {
  return round1(clamp(data.filing_regularity_pct, PILLAR_SCORE_FLOOR, 100));
}

export function scoreCashFlowDiscipline(data: NormalizedMSMEData): number {
  const ratio = data.monthly_revenue > 0 ? data.avg_bank_balance / data.monthly_revenue : 0;
  const ratioScore = clamp(ratio * CASH_RATIO_MULTIPLIER, 0, 100);
  const bouncePenalty = Math.min(
    data.bounced_payment_count * BOUNCE_PENALTY_PER_INCIDENT,
    BOUNCE_PENALTY_CAP
  );
  return round1(clamp(ratioScore - bouncePenalty, PILLAR_SCORE_FLOOR, 100));
}

export function scoreFormalityPayrollStability(data: NormalizedMSMEData): number | null {
  if (data.payroll_headcount_trend_pct === null) return null;
  return round1(
    clamp(100 + data.payroll_headcount_trend_pct * PAYROLL_TREND_MULTIPLIER, PILLAR_SCORE_FLOOR, 100)
  );
}

export function getBand(compositeScore: number): ScoreBand {
  const match = SCORE_BANDS.find((b) => compositeScore >= b.min && compositeScore <= b.max);
  return (match?.band ?? "Poor") as ScoreBand;
}

// ============================================================================
// Risk / strength flag derivation — human-readable explanations grounded in
// the same normalized data the pillars use, so the UI and AI narrative both
// stay consistent with the numeric score.
// ============================================================================

function buildFlags(
  data: NormalizedMSMEData,
  pillars: PillarScore[]
): { risk_flags: string[]; strength_flags: string[] } {
  const risk_flags: string[] = [];
  const strength_flags: string[] = [];

  const revenuePillar = pillars.find((p) => p.key === "revenueStability");
  const compliancePillar = pillars.find((p) => p.key === "complianceHealth");
  const cashFlowPillar = pillars.find((p) => p.key === "cashFlowDiscipline");
  const payrollPillar = pillars.find((p) => p.key === "formalityPayrollStability");

  // Revenue
  if (data.revenue_variance_pct < 10) {
    strength_flags.push(
      `Consistent revenue for ${data.months_of_data_available}+ months (only ${data.revenue_variance_pct}% variance)`
    );
  } else if (revenuePillar && revenuePillar.score < 40) {
    risk_flags.push(`High revenue volatility (${data.revenue_variance_pct}% variance in inflow)`);
  }

  // Compliance
  if (data.filing_regularity_pct >= 90) {
    strength_flags.push(`Strong GST compliance record (${data.filing_regularity_pct}% on-time filing)`);
  } else if (data.filing_regularity_pct < 70) {
    risk_flags.push(`GST filing lapses — only ${data.filing_regularity_pct}% of returns filed on time`);
  }

  // Cash flow
  if (data.bounced_payment_count >= 5) {
    risk_flags.push(`High bounced payment count (${data.bounced_payment_count} bounces on record)`);
  } else if (data.bounced_payment_count === 0) {
    strength_flags.push("Zero bounced payments across the observed period");
  }
  if (cashFlowPillar && cashFlowPillar.score >= 80) {
    strength_flags.push("Healthy average bank balance relative to turnover");
  } else if (cashFlowPillar && cashFlowPillar.score < 30) {
    risk_flags.push("Thin cash buffer relative to turnover — low resilience to shocks");
  }

  // Payroll / formality
  if (payrollPillar === null || data.payroll_headcount_trend_pct === null) {
    risk_flags.push("EPFO data unavailable — no registered payroll on record (informal workforce)");
  } else if (data.payroll_headcount_trend_pct <= -15) {
    risk_flags.push(`Declining payroll trend (headcount down ${Math.abs(data.payroll_headcount_trend_pct)}%)`);
  } else if (data.payroll_headcount_trend_pct >= -3) {
    strength_flags.push("Stable or growing registered payroll headcount");
  }

  return { risk_flags, strength_flags };
}

// ============================================================================
// Composite scoring
// ============================================================================

export function computeScore(data: NormalizedMSMEData): ScoreResult {
  const hasEPFO = data.payroll_headcount_trend_pct !== null;

  const revenueScore = scoreRevenueStability(data);
  const complianceScore = scoreComplianceHealth(data);
  const cashFlowScore = scoreCashFlowDiscipline(data);
  const payrollScore = scoreFormalityPayrollStability(data);

  let pillars: PillarScore[];
  let reweighted = false;
  let reweight_note: string | null = null;

  if (hasEPFO && payrollScore !== null) {
    pillars = [
      {
        key: "revenueStability",
        label: "Revenue Stability",
        score: revenueScore,
        weight: PILLAR_WEIGHTS.revenueStability,
        applied: true,
      },
      {
        key: "complianceHealth",
        label: "Compliance Health",
        score: complianceScore,
        weight: PILLAR_WEIGHTS.complianceHealth,
        applied: true,
      },
      {
        key: "cashFlowDiscipline",
        label: "Cash Flow Discipline",
        score: cashFlowScore,
        weight: PILLAR_WEIGHTS.cashFlowDiscipline,
        applied: true,
      },
      {
        key: "formalityPayrollStability",
        label: "Formality / Payroll Stability",
        score: payrollScore,
        weight: PILLAR_WEIGHTS.formalityPayrollStability,
        applied: true,
      },
    ];
  } else {
    // No EPFO data: redistribute its weight proportionally across the other
    // 3 pillars (30/25/25 -> normalized to sum to 1) instead of scoring
    // formality as zero.
    reweighted = true;
    reweight_note =
      "EPFO payroll data unavailable — Formality/Payroll pillar excluded and its weight redistributed proportionally across Revenue Stability, Compliance Health, and Cash Flow Discipline.";

    const baseSum =
      PILLAR_WEIGHTS.revenueStability + PILLAR_WEIGHTS.complianceHealth + PILLAR_WEIGHTS.cashFlowDiscipline;

    pillars = [
      {
        key: "revenueStability",
        label: "Revenue Stability",
        score: revenueScore,
        weight: PILLAR_WEIGHTS.revenueStability / baseSum,
        applied: true,
      },
      {
        key: "complianceHealth",
        label: "Compliance Health",
        score: complianceScore,
        weight: PILLAR_WEIGHTS.complianceHealth / baseSum,
        applied: true,
      },
      {
        key: "cashFlowDiscipline",
        label: "Cash Flow Discipline",
        score: cashFlowScore,
        weight: PILLAR_WEIGHTS.cashFlowDiscipline / baseSum,
        applied: true,
      },
      {
        key: "formalityPayrollStability",
        label: "Formality / Payroll Stability",
        score: 0,
        weight: 0,
        applied: false,
      },
    ];
  }

  let composite = pillars.reduce((sum, p) => sum + p.score * p.weight, 0);

  if (reweighted) {
    // Conservative underwriting discount for a data profile built on fewer
    // independent sources — see constants.ts for rationale.
    composite = composite * INCOMPLETE_DATA_CONFIDENCE_FACTOR;
  }

  composite = round1(clamp(composite, 0, 100));

  const { risk_flags, strength_flags } = buildFlags(data, pillars);

  return {
    composite_score: composite,
    band: getBand(composite),
    pillars,
    risk_flags,
    strength_flags,
    reweighted,
    reweight_note,
  };
}
