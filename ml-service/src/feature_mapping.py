"""
feature_mapping.py

THE HONESTY LAYER OF THIS ML PIPELINE — READ THIS BEFORE TOUCHING THE MODEL.

We do not have a labelled dataset of (GST/UPI/AA/EPFO alt-data) -> (actual
loan default outcome) for Indian MSMEs. No such dataset is publicly
available, and fabricating one would make the model scientifically
worthless and indefensible in front of banking judges.

So instead we do the honest thing:
  1. Train XGBoost on a REAL, public, labelled credit-risk dataset —
     "Give Me Some Credit" (Kaggle, 2011), 150k borrowers, features are
     classic bureau-style variables (utilization, delinquency counts,
     debt ratio, income, credit lines, dependents), label = serious
     delinquency within 2 years.
  2. Because our production input is alt-data (GST/UPI/AA/EPFO), NOT
     bureau data, we need a bridge: a documented, deterministic function
     that maps our NormalizedMSMEData fields into proxies for the GMSC
     feature space the model was actually trained on.
  3. This bridge is a heuristic, not a learned mapping. It is disclosed
     everywhere the PD number is shown ("demonstration model — bridge
     mapping from alt-data to bureau-style proxy features; production
     deployment would retrain directly on IDBI's historical repayment
     and alternate-data records").

Bridge mapping (alt-data field -> GMSC-style proxy, rationale):

  monthly_revenue                  -> MonthlyIncome
      Direct analog: both represent the entity's monthly cash inflow.

  avg_bank_balance / monthly_revenue (cash cushion ratio)
      -> DebtRatio (inverted, rescaled to MSME norms)
      MSMEs structurally hold a much smaller cash buffer relative to
      turnover than a personal DebtRatio distribution assumes (high
      revenue velocity, thin margins) — a raw 1:1 inversion would make
      every MSME look maximally debt-stressed regardless of quality. We
      rescale against 0.5 (a buffer equal to half a month's revenue is
      treated as "no stress") before inverting: debt_ratio_proxy =
      clamp(1 - min(cash_ratio / 0.5, 1), 0, 1).

  bounced_payment_count             -> NumberOfTime30-59DaysPastDueNotWorse,
                                        NumberOfTime60-89DaysPastDueNotWorse,
                                        NumberOfTimes90DaysLate
      A single bounced UPI payment over a year is not equivalent to
      missing a loan installment — bounces are tiered in groups of 3
      before they count as a delinquency-bucket increment, so 1-2 bounces
      (isolated, plausible) reads as zero delinquency, while a sustained
      pattern (9+) reads as severe.

  bounced_payment_count (rate)     -> RevolvingUtilizationOfUnsecuredLines
      Frequent bounces relative to the observation window behave like
      high utilization of a credit facility: usage is pressing against
      the entity's headroom. utilization_proxy = clamp(bounces /
      months_of_data_available, 0, 1.3).

  months_of_data_available         -> age (business "credit history
                                       length" proxy)
      GMSC's `age` field is protective (older borrowers = lower risk)
      largely because it proxies for a longer, more observable track
      record — which is exactly what months_of_data_available measures
      for an MSME. We linearly rescale the typical 3-36 month observation
      window onto the 23-65 age range the model was trained on.

  data_sources_available (count)   -> NumberOfOpenCreditLinesAndLoans
      More independent formal data footprints (GST + UPI + AA + EPFO)
      is treated as an analog for a broader, more diversified formal
      financial footprint.

  payroll_headcount_trend_pct      -> NumberRealEstateLoansOrLines
      (registered, stable/growing payroll -> 1, else 0)
      A weak proxy for "has a formal, registered fixed asset base" —
      EPFO registration + stable headcount is the closest signal we have
      to formal balance-sheet permanence.

  NumberOfDependents                -> not observable from GST/UPI/AA/EPFO.
      Defaulted to 0 for every profile. Documented as a zero-signal
      passthrough field, not inferred.

This mapping is intentionally simple, deterministic, and fully documented
so it can be defended line-by-line. It is NOT presented as bureau-grade
accuracy — it is presented as a working hybrid-architecture demonstration
that shows exactly what production retraining would replace.
"""

from __future__ import annotations
from dataclasses import dataclass

GMSC_FEATURE_ORDER = [
    "RevolvingUtilizationOfUnsecuredLines",
    "age",
    "NumberOfTime30-59DaysPastDueNotWorse",
    "DebtRatio",
    "MonthlyIncome",
    "NumberOfOpenCreditLinesAndLoans",
    "NumberOfTimes90DaysLate",
    "NumberRealEstateLoansOrLines",
    "NumberOfTime60-89DaysPastDueNotWorse",
    "NumberOfDependents",
]

# Human-readable business labels for SHAP output — shown to credit officers
# instead of raw bureau-style column names.
FEATURE_BUSINESS_LABELS = {
    "RevolvingUtilizationOfUnsecuredLines": "Cash-flow pressure (bounce rate vs. history)",
    "age": "Length of observable track record",
    "NumberOfTime30-59DaysPastDueNotWorse": "Mild payment irregularities",
    "DebtRatio": "Thin cash buffer relative to turnover",
    "MonthlyIncome": "Monthly revenue level",
    "NumberOfOpenCreditLinesAndLoans": "Breadth of formal data footprint (GST/UPI/AA/EPFO)",
    "NumberOfTimes90DaysLate": "Severe bounced-payment incidents",
    "NumberRealEstateLoansOrLines": "Formal, registered payroll stability",
    "NumberOfTime60-89DaysPastDueNotWorse": "Moderate payment irregularities",
    "NumberOfDependents": "Dependents (not observable from alt-data — neutral)",
}


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


@dataclass
class NormalizedMSMEData:
    monthly_revenue: float
    revenue_variance_pct: float
    filing_regularity_pct: float
    avg_bank_balance: float
    bounced_payment_count: int
    payroll_headcount_trend_pct: float | None
    months_of_data_available: int
    data_sources_available: list[str]


def map_to_gmsc_features(data: NormalizedMSMEData) -> dict:
    """Deterministically bridges alt-data -> GMSC-style proxy feature dict."""
    months = max(1, data.months_of_data_available)

    cash_ratio = (data.avg_bank_balance / data.monthly_revenue) if data.monthly_revenue > 0 else 0.0
    debt_ratio_proxy = _clamp(1 - min(cash_ratio / 0.5, 1), 0.0, 1.0)

    bounces = max(0, data.bounced_payment_count)
    mild_dpd = _clamp(bounces // 3, 0, 2)
    moderate_dpd = _clamp(max(0, bounces - 6) // 3, 0, 2)
    severe_dpd = 1 if bounces >= 9 else 0

    utilization_proxy = _clamp(bounces / months, 0.0, 1.3)

    # Rescale months_of_data_available (typical 3-36) onto age-like 23-65.
    age_proxy = _clamp(23 + (months / 36) * (65 - 23), 23, 75)

    open_lines_proxy = len(data.data_sources_available) * 2

    payroll_ok = (
        1
        if (data.payroll_headcount_trend_pct is not None and data.payroll_headcount_trend_pct >= -3)
        else 0
    )

    return {
        "RevolvingUtilizationOfUnsecuredLines": utilization_proxy,
        "age": age_proxy,
        "NumberOfTime30-59DaysPastDueNotWorse": mild_dpd,
        "DebtRatio": debt_ratio_proxy,
        "MonthlyIncome": max(0.0, data.monthly_revenue),
        "NumberOfOpenCreditLinesAndLoans": open_lines_proxy,
        "NumberOfTimes90DaysLate": severe_dpd,
        "NumberRealEstateLoansOrLines": payroll_ok,
        "NumberOfTime60-89DaysPastDueNotWorse": moderate_dpd,
        "NumberOfDependents": 0,
    }
