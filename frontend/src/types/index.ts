export interface MSMEProfileMeta {
  id: string;
  name: string;
  businessType: string;
  shortDescription: string;
}

export interface NormalizedMSMEData {
  monthly_revenue: number;
  revenue_variance_pct: number;
  filing_regularity_pct: number;
  avg_bank_balance: number;
  bounced_payment_count: number;
  payroll_headcount_trend_pct: number | null;
  months_of_data_available: number;
  data_sources_available: string[];
}

export type ScoreBand = "Poor" | "Bad" | "Average" | "Good" | "Excellent";

export interface PillarScore {
  key: "revenueStability" | "complianceHealth" | "cashFlowDiscipline" | "formalityPayrollStability";
  label: string;
  score: number;
  weight: number;
  applied: boolean;
}

export interface ScoreResult {
  composite_score: number;
  band: ScoreBand;
  pillars: PillarScore[];
  risk_flags: string[];
  strength_flags: string[];
  reweighted: boolean;
  reweight_note: string | null;
}

export interface NarrativeResult {
  strength: string;
  risk: string;
  improvement_tips: string[];
  source: "anthropic" | "fallback";
}

export interface OCENPayload {
  applicant_id: string;
  assessment_timestamp: string;
  composite_score: number;
  risk_band: ScoreBand;
  recommended_action: "eligible_for_review" | "requires_manual_review" | "not_recommended";
  score_breakdown: { pillar: string; score: number; weight: number }[];
  data_sources_used: string[];
  risk_flags: string[];
  strength_flags: string[];
  format: "OCEN-compatible-v1";
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  source: "anthropic" | "fallback";
}

export interface PortfolioMsmeSummary {
  id: string;
  name: string;
  businessType: string;
  composite_score: number;
  band: ScoreBand;
  top_risk_flag: string | null;
}

export interface PortfolioSummary {
  total_assessed: number;
  average_composite_score: number;
  high_risk_pct: number;
  band_counts: Record<ScoreBand, number>;
  business_type_counts: Record<string, number>;
  msmes: PortfolioMsmeSummary[];
}

export interface AssessmentResponse {
  profile: MSMEProfileMeta;
  normalized: NormalizedMSMEData;
  score: ScoreResult;
  narrative: NarrativeResult;
  ocen: OCENPayload;
  data_mode: "mock" | "live";
  elapsed_ms: number;
}
