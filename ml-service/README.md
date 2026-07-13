# MSME Health Card — ML Risk Service

Python microservice that adds a genuine ML layer on top of the existing
explainable rule-based scoring engine: an **XGBoost Probability-of-Default
(PD) model** with **SHAP** feature attribution, served over HTTP for the
Express backend to call.

```
Express backend  --POST /predict-->  FastAPI (this service)  -->  XGBoost + SHAP
```

## Why a separate Python service?

XGBoost + SHAP are Python-native. Rather than fighting the ecosystem (WASM
ports, half-supported Node bindings), this keeps the ML layer in its native
language as a small, independently deployable service — the standard,
defensible pattern for hybrid TS-app + Python-ML architectures. If the
service is down or slow, `mlClient.ts` on the Node side degrades gracefully
(`ml_risk.available = false`) rather than breaking the whole assessment.

## What this model is — and isn't

We do **not** have a labelled dataset of (GST/UPI/AA/EPFO alt-data) →
(actual MSME loan default outcome). No such dataset exists publicly, and
synthesizing one would make the model scientifically worthless.

So the model is trained on a real, public, labelled credit-risk dataset —
**"Give Me Some Credit"** (Kaggle, 2011 competition, 150,000 borrowers,
real 2-year delinquency outcomes) — using its own bureau-style features
(utilization, delinquency counts, debt ratio, income, credit lines,
dependents).

Because production input here is alt-data, not bureau data, a documented
**bridge function** (`src/feature_mapping.py`) deterministically maps
`NormalizedMSMEData` → the GMSC feature space at inference time. Every
mapping decision is commented with its rationale in that file. This is
disclosed everywhere the PD number surfaces (API response, PDF memo,
Copilot grounding): *"demonstration model, alt-data bridged into a public
bureau-style feature space — production would retrain directly on IDBI's
own historical repayment + alternate-data records."*

This is the same honesty standard the rest of the project already holds
itself to (see `PROJECT_CONTEXT` in the repo root) — the goal is a
technically real, defensible ML pipeline, not a rubber-stamped "AI/ML"
checkbox.

## Setup

```bash
cd ml-service
pip install -r requirements.txt --break-system-packages   # or use a venv
```

Dataset (`data/cs-training.csv`) is included/fetched separately — see
`data/README.md` if you need to re-download it (public Kaggle "Give Me Some
Credit" competition dataset, GitHub-mirrored copies are widely available,
e.g. JLZml/Credit-Scoring-Data-Sets on GitHub).

## Train the model

```bash
cd ml-service
python3 src/train.py
```

Outputs:
- `model/xgb_pd_model.joblib` — the trained XGBoost classifier
- `model/model_metadata.json` — training AUC, dataset provenance, and
  population-quantile risk-band cutoffs (Low/Moderate/Elevated/High are
  calibrated from the model's own score distribution, not arbitrary round
  numbers)

Current benchmark: **Test AUC ≈ 0.87** (in line with published GMSC
leaderboard results using gradient boosting).

## Run the service

```bash
cd ml-service/src
PYTHONPATH=. uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

Endpoints:
- `GET /health` — service + model version check
- `GET /model-info` — full training metadata
- `POST /predict` — body is a `NormalizedMSMEData` JSON object (same shape
  the rule engine consumes); returns PD%, risk band, confidence, and top
  SHAP-driven risk-increasing / risk-reducing factors with business-readable
  labels.

## Running the full stack together

Three processes, three terminals (or a process manager of your choice):

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev

# Terminal 3
cd ml-service/src && PYTHONPATH=. uvicorn app:app --port 8000
```

Set `ML_SERVICE_URL` in `backend/.env` if the ML service isn't on
`http://localhost:8000`.
