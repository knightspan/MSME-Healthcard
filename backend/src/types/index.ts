// ============================================================================
// Shared type definitions used across adapters, normalization, scoring,
// the AI narrative layer, and the OCEN output formatter.
// ============================================================================

/** ---- Raw per-source data shapes (as would be returned by a real provider) ---- */

export interface GSTMonthlyFiling {
  month: string; // "2025-06"
  filed: boolean;
  filedOnTime: boolean;
  gstr3bTurnover: number; // reported turnover for the month, INR
}

export interface RawGSTData {
  gstin: string | null;
  registrationAgeMonths: number;
  monthlyFilings: GSTMonthlyFiling[];
}

export interface UPIMonthlyTxn {
  month: string;
  inflowAmount: number; // total UPI inflow for the month, INR
  txnCount: number;
}

export interface RawUPIData {
  vpa: string | null;
  monthlyTransactions: UPIMonthlyTxn[];
}

export interface AAMonthlyStatement {
  month: string;
  avgBalance: number;
  closingBalance: number;
  bouncedPayments: number;
}

export interface RawAAData {
  consentGranted: boolean;
  bankName: string | null;
  monthlyStatements: AAMonthlyStatement[];
}

export interface EPFOMonthlyRecord {
  month: string;
  headcount: number;
  totalWageBill: number;
}

export interface RawEPFOData {
  establishmentRegistered: boolean;
  monthlyRecords: EPFOMonthlyRecord[];
}

/** ---- Raw bundle for one MSME (what an adapter assembles internally) ---- */

export interface MSMEProfileMeta {
  id: string;
  name: string;
  businessType: string;
  shortDescription: string;
}

/** ---- Unified normalized schema (source-agnostic) ---- */

export interface NormalizedMSMEData {
  monthly_revenue: number;
  revenue_variance_pct: number;
  filing_regularity_pct: number;
  avg_bank_balance: number;
  bounced_payment_count: number;
  payroll_headcount_trend_pct: number | null; // null when EPFO unavailable
  months_of_data_available: number;
  data_sources_available: string[]; // e.g. ["GST", "UPI", "AA"]
}

/** ---- Scoring engine output ---- */

export type ScoreBand = "Poor" | "Bad" | "Average" | "Good" | "Excellent";

export interface PillarScore {
  key: "revenueStability" | "complianceHealth" | "cashFlowDiscipline" | "formalityPayrollStability";
  label: string;
  score: number; // 0-100
  weight: number; // effective weight used in composite (0-1), after any reweighting
  applied: boolean; // false if this pillar was skipped due to missing data (reweighted away)
}

export interface ScoreResult {
  composite_score: number; // 0-100
  band: ScoreBand;
  pillars: PillarScore[];
  risk_flags: string[];
  strength_flags: string[];
  reweighted: boolean; // true if a pillar's weight was redistributed (e.g. missing EPFO)
  reweight_note: string | null;
}

/** ---- AI narrative layer output ---- */

export interface NarrativeResult {
  strength: string;
  risk: string;
  improvement_tips: string[];
  source: "anthropic" | "fallback";
}

/** ---- OCEN-style structured output ---- */

export interface OCENPayload {
  applicant_id: string;
  assessment_timestamp: string;
  composite_score: number;
  risk_band: ScoreBand;
  recommended_action: "eligible_for_review" | "requires_manual_review" | "not_recommended";
  score_breakdown: {
    pillar: string;
    score: number;
    weight: number;
  }[];
  data_sources_used: string[];
  risk_flags: string[];
  strength_flags: string[];
  format: "OCEN-compatible-v1";
}

/** ---- Full assessment response returned by POST /api/msme/:id/assess ---- */

export interface AssessmentResponse {
  profile: MSMEProfileMeta;
  normalized: NormalizedMSMEData;
  score: ScoreResult;
  narrative: NarrativeResult;
  ocen: OCENPayload;
  data_mode: "mock" | "live";
  elapsed_ms: number;
}
