# MSME Financial Health Card / RiskIntel MSME

An AI/ML-driven credit assessment platform for MSME lending, built from GST filings, UPI
transactions, Account Aggregator (AA) bank data, and EPFO payroll signals. It combines an
explainable rule-based scoring engine with a **real trained XGBoost probability-of-default model
+ SHAP explainability**, fronted by an institutional-banking-styled React dashboard
("RiskIntel MSME").

## Architecture

```
frontend/     React + Vite + TypeScript + Tailwind CSS — "RiskIntel MSME" dashboard UI
backend/      Node.js + Express + TypeScript — scoring engine, AI narrative/copilot, PDF memos
ml-service/   Python + FastAPI — trained XGBoost PD model + SHAP (the real ML layer)
```

```
RiskIntel MSME (frontend, :5173)
        │  POST /api/v1/score, /api/v1/chat
        ▼
Express backend (:4000)
        │  computeScore()  ──────────────► rule-based 0–100 composite (explainable, deterministic)
        │  POST /predict   ──────────────► ml-service (:8000) ──► XGBoost PD model + SHAP
        ▼
CreditScoreResponse (composite score, PD, risk band, SHAP factors, OCEN payload, ...)
```

The backend also still serves the original fixed-profile demo (`/api/msme/*` — 3 hero MSME
profiles, portfolio view, PDF credit memo, what-if simulator) that the ML-integration project was
originally built around. The new frontend's free-form "Interactive Risk Underwriter" form talks to
a second, additive route (`/api/v1/*`) that bridges its ad-hoc inputs onto the **same**
`computeScore()` engine and the **same** real ML service — no scoring logic is duplicated.

If the ML service is unreachable, both route families degrade gracefully to the rule-based score
alone (`ml_risk.available = false` / a clearly-labelled fallback in the `/api/v1/score` response)
rather than failing the request.

## Running the full stack

Three processes:

### 1. ML service (`ml-service/`)

```bash
cd ml-service
python -m venv .venv
.venv\Scripts\activate            # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd src
uvicorn app:app --host 0.0.0.0 --port 8000
```

Starts on `http://localhost:8000`. `GET /health` should return the model version.

> **Note:** `requirements.txt` pins `xgboost==2.1.4`. The committed `model/xgb_pd_model.joblib`
> was serialized with that release; newer XGBoost majors (3.x) refuse to deserialize it
> ("input stream corrupted"). If you retrain via `train.py` with a newer XGBoost, you can relax
> the pin back to `xgboost>=2.1`.

### 2. Backend (`backend/`)

```bash
cd backend
npm install
copy .env.example .env   # optionally add ANTHROPIC_API_KEY for full AI narrative/copilot
npm run dev              # http://localhost:4000
```

### 3. Frontend (`frontend/`)

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173, proxies /api/* to :4000
```

Open `http://localhost:5173`. Use **New Assessment** to run the interactive underwriter form
against the real backend + ML pipeline, or **Assessments** to browse the seeded demo history.

## Environment variables (`backend/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | _(empty)_ | Server-side only, for the AI narrative layer and both Credit Copilot chat endpoints. Falls back to locally-derived text if unset. |
| `DATA_MODE` | `mock` | `mock` uses the built-in `MockAdapter` for the 3 demo profiles; `live` switches to the stubbed `LiveAdapter`. |
| `PORT` | `4000` | Port the Express API listens on. |
| `ML_SERVICE_URL` | `http://localhost:8000` | Base URL of the Python ML microservice. If unreachable, scoring gracefully degrades to rule-based only. |

## API routes

| Route | Description |
|---|---|
| `POST /api/v1/score` | **New.** Scores the ad-hoc `MSMEFinancialInputs` form from the RiskIntel MSME frontend via the rule engine + real ML model. |
| `POST /api/v1/chat` | **New.** General-purpose AI Credit Copilot chat used by the frontend's floating chat widget. |
| `GET /api/msme/profiles` | Lists the 3 fixed demo MSME profiles. |
| `POST /api/msme/:id/assess` | Full pipeline (normalize → rule score → ML risk → AI narrative → OCEN payload) for a fixed profile. |
| `GET /api/msme/:id/ocen-payload` | OCEN-formatted JSON for a fixed profile. |
| `POST /api/msme/:id/chat` | AI Credit Copilot grounded in one specific profile's assessment. |
| `GET /api/msme/portfolio/summary` | Cross-profile portfolio summary (rule + ML aggregates). |
| `GET /api/msme/:id/memo` | Streams a PDF credit memo (rule score + ML risk section). |
| `POST /api/msme/:id/simulate` | What-if scenario simulator — re-runs `computeScore()` with overridden inputs. |

## Notes

- **No scoring-engine forks.** Both the fixed-profile routes and the new ad-hoc `/api/v1/score`
  route call the exact same `computeScore()` (rule engine) and `getMLRisk()` (ML client) —
  the ad-hoc route only adds an input-mapping layer (`backend/src/routes/scoreRoutes.ts`) that
  bridges the frontend form's fields onto `NormalizedMSMEData`, documented inline with the same
  "honesty layer" standard as `ml-service/src/feature_mapping.py`.
- **The ML model is a demonstration model**, trained on the public "Give Me Some Credit" (Kaggle)
  bureau-style dataset — not on real MSME repayment history — with alt-data bridged into its
  feature space via a documented heuristic (see `ml-service/src/feature_mapping.py`). This is
  disclosed everywhere the PD number surfaces.
- **In-memory data only** for the fixed demo profiles; no database.
