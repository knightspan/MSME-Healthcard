"""
predict.py

Loads the trained XGBoost PD model + builds a SHAP TreeExplainer once at
import time, then exposes predict_pd() which:
  1. Bridges alt-data (NormalizedMSMEData) -> GMSC feature space
  2. Runs the model -> probability of default
  3. Runs SHAP -> per-feature contribution for THIS specific prediction
  4. Maps top positive/negative contributors to business-readable labels
  5. Derives a heuristic confidence score (model certainty + data depth)
"""

from __future__ import annotations
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap

from feature_mapping import (
    FEATURE_BUSINESS_LABELS,
    GMSC_FEATURE_ORDER,
    NormalizedMSMEData,
    map_to_gmsc_features,
)

ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = ROOT / "model" / "xgb_pd_model.joblib"
METADATA_PATH = ROOT / "model" / "model_metadata.json"

_model = joblib.load(MODEL_PATH)
_explainer = shap.TreeExplainer(_model)
with open(METADATA_PATH) as f:
    _metadata = json.load(f)


def _risk_band(pd_pct: float) -> str:
    cuts = _metadata.get("risk_band_cuts_pct")
    if not cuts:
        # Fallback if metadata predates calibration — shouldn't happen once
        # train.py has been re-run.
        cuts = {"low_max_pct": 16.4, "moderate_max_pct": 41.6, "elevated_max_pct": 73.5}
    if pd_pct < cuts["low_max_pct"]:
        return "Low"
    if pd_pct < cuts["moderate_max_pct"]:
        return "Moderate"
    if pd_pct < cuts["elevated_max_pct"]:
        return "Elevated"
    return "High"


def _confidence(pd_prob: float, data: NormalizedMSMEData) -> float:
    """
    Heuristic confidence blend (0-100), documented explicitly as heuristic:
      - model certainty: how far the predicted probability sits from the
        0.5 decision boundary (a prediction of 3% or 92% is more decisive
        than one of 48%)
      - source_factor: how many of the 4 alt-data sources were available
      - months_factor: how much observation history backs the assessment
    This is NOT a calibrated statistical confidence interval — it is a
    transparent, explainable proxy so credit officers get a sense of how
    much to trust a given PD number, same spirit as the rule engine's
    reweight/data-completeness discount.
    """
    model_certainty = 1 - 2 * min(pd_prob, 1 - pd_prob)  # 0..1
    n_sources = len(data.data_sources_available)
    source_factor = min(1.0, 0.6 + 0.1 * n_sources)
    months_factor = min(1.0, data.months_of_data_available / 12)

    confidence = model_certainty * 0.6 + source_factor * 0.25 + months_factor * 0.15
    return round(max(0.0, min(1.0, confidence)) * 100, 1)


def predict_pd(data: NormalizedMSMEData, top_k: int = 3) -> dict:
    bridged = map_to_gmsc_features(data)
    X = pd.DataFrame([bridged])[GMSC_FEATURE_ORDER]

    prob = float(_model.predict_proba(X)[0, 1])
    pd_pct = round(prob * 100, 1)

    shap_values = _explainer.shap_values(X)
    row = shap_values[0] if shap_values.ndim == 2 else shap_values

    contributions = list(zip(GMSC_FEATURE_ORDER, row, [bridged[f] for f in GMSC_FEATURE_ORDER]))
    # Positive SHAP value = pushes PD UP (riskier). Negative = pushes PD DOWN.
    positives = sorted([c for c in contributions if c[1] > 0], key=lambda c: -c[1])[:top_k]
    negatives = sorted([c for c in contributions if c[1] < 0], key=lambda c: c[1])[:top_k]

    def fmt(entries):
        return [
            {
                "feature": FEATURE_BUSINESS_LABELS.get(name, name),
                "raw_feature": name,
                "shap_value": round(float(val), 4),
                "feature_value": round(float(fv), 2) if isinstance(fv, (int, float)) else fv,
            }
            for name, val, fv in entries
        ]

    return {
        "probability_of_default_pct": pd_pct,
        "risk_band": _risk_band(pd_pct),
        "confidence_pct": _confidence(prob, data),
        "top_risk_increasing_features": fmt(positives),
        "top_risk_reducing_features": fmt(negatives),
        "model_version": _metadata["model_version"],
        "bridged_features": bridged,
        "disclaimer": _metadata["disclaimer"],
    }
