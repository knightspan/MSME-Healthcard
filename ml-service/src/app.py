"""
app.py

Small FastAPI microservice that sits alongside the existing Express/Node
backend as the ML intelligence layer:

    Express backend  --HTTP POST /predict-->  this FastAPI service

Kept as a separate Python process (not ported into Node) because XGBoost +
SHAP are Python-native — this is the standard, defensible pattern for a
hybrid TS-app + Python-ML architecture rather than fighting the ecosystem.

Run:
    cd ml-service && uvicorn src.app:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from feature_mapping import NormalizedMSMEData
from predict import predict_pd, _metadata

app = FastAPI(title="MSME Health Card — ML Risk Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class NormalizedMSMEDataIn(BaseModel):
    monthly_revenue: float
    revenue_variance_pct: float
    filing_regularity_pct: float
    avg_bank_balance: float
    bounced_payment_count: int
    payroll_headcount_trend_pct: Optional[float] = None
    months_of_data_available: int
    data_sources_available: list[str]


@app.get("/health")
def health():
    return {"status": "ok", "model_version": _metadata["model_version"]}


@app.get("/model-info")
def model_info():
    return _metadata


@app.post("/predict")
def predict(body: NormalizedMSMEDataIn):
    try:
        data = NormalizedMSMEData(
            monthly_revenue=body.monthly_revenue,
            revenue_variance_pct=body.revenue_variance_pct,
            filing_regularity_pct=body.filing_regularity_pct,
            avg_bank_balance=body.avg_bank_balance,
            bounced_payment_count=body.bounced_payment_count,
            payroll_headcount_trend_pct=body.payroll_headcount_trend_pct,
            months_of_data_available=body.months_of_data_available,
            data_sources_available=body.data_sources_available,
        )
        return predict_pd(data)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc
