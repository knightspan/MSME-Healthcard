# IDBI MSME Financial Health Card

**Built by Team Anvay** for the **IDBI Innovation Hackathon — Problem Statement 3**.

An institutional credit-assessment platform for **New-to-Credit (NTC)** and **New-to-Bank (NTB)**
MSMEs. It converts alternate data — **GST filings, UPI transactions, Account Aggregator (AA)
bank statements, and EPFO payroll records** — into an explainable financial health score,
augmented by a real **XGBoost probability-of-default (PD) model with SHAP attribution**, an
**AI Credit Copilot**, **PDF credit memos**, a **portfolio view**, and a **what-if simulator**.

The design goal is underwriter trust: every numeric output is either deterministic and
auditable, or explicitly labelled as a demonstration ML signal with documented feature bridging.

---

## Table of contents

1. [Problem framing](#1-problem-framing)
2. [Solution overview](#2-solution-overview)
3. [System architecture](#3-system-architecture)
4. [Scoring & ML methodology](#4-scoring--ml-methodology)
5. [Product capabilities](#5-product-capabilities)
6. [API reference](#6-api-reference)
7. [Local setup](#7-local-setup)
8. [Deploying to Vercel](#8-deploying-to-vercel)
9. [Configuration](#9-configuration)
10. [Repository layout](#10-repository-layout)
11. [Demo profiles](#11-demo-profiles)
12. [Assumptions & disclosures](#12-assumptions--disclosures)
13. [Team](#13-team)

---

## 1. Problem framing

Traditional MSME underwriting leans on ITR filings, audited financials, and bureau history.
A large share of eligible borrowers — especially NTC/NTB entities — lack that paper trail even
when their **cash-flow and compliance behaviour** is observable through alternate rails
(GST, UPI, AA, EPFO).

This platform demonstrates how a bank can:

- Produce a **transparent, multidimensional health score** from alternate data within seconds
- Surface **risk and strength flags** that map 1:1 to the underlying inputs
- Layer a **model-based PD estimate** with feature-level explainability (SHAP)
- Support underwriters with **grounded AI assistance**, **memo export**, and **scenario analysis**
- Emit **OCEN-compatible** structured output for LSP / ULI handoff

---

## 2. Solution overview

| Layer | Role |
|---|---|
| **Frontend** | Institutional underwriting UI (dashboard, assessments, alt-data, credit memo views, interactive form, floating AI chat) |
| **Express backend** | Adapter → normalize → rule score → ML client → narrative / copilot / PDF / OCEN |
| **ML service** | FastAPI microservice hosting a trained XGBoost PD classifier + SHAP |

Two complementary API families share the **same** scoring and ML code paths:

| Family | Purpose |
|---|---|
| `/api/msme/*` | Fixed demo profiles (3 hero MSMEs), portfolio summary, PDF memo, what-if simulator, profile-grounded chat |
| `/api/v1/*` | Ad-hoc “Interactive Risk Underwriter” form used by the primary dashboard |

No scoring logic is duplicated between families. The `/api/v1` routes only bridge form fields
onto the shared `NormalizedMSMEData` schema before calling `computeScore()` and `getMLRisk()`.

---

## 3. System architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (:5173)                                           │
│  IDBI MSME Financial Health Card · Team Anvay               │
│  React · Vite · TypeScript · Tailwind CSS · Recharts        │
└────────────────────────────┬────────────────────────────────┘
                             │  /api/v1/*  and  /api/msme/*
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Express backend (:4000)                                    │
│  DataSourceAdapter → normalize → computeScore()             │
│  getMLRisk() · AI narrative/copilot · PDFKit memo · OCEN    │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                │  POST /predict              │  Anthropic API
                ▼                             ▼  (optional)
┌───────────────────────────┐    ┌────────────────────────────┐
│  ML service (:8000)       │    │  Claude (narrative/chat)   │
│  FastAPI · XGBoost · SHAP │    │  Falls back if key missing │
└───────────────────────────┘    └────────────────────────────┘
```

### Provider-agnostic data adapters

All alternate-data access goes through `DataSourceAdapter`
(`backend/src/adapters/DataSourceAdapter.ts`):

```ts
interface DataSourceAdapter {
  getGSTData(msmeId: string): Promise<RawGSTData | null>;
  getUPIData(msmeId: string): Promise<RawUPIData | null>;
  getAAData(msmeId: string): Promise<RawAAData | null>;
  getEPFOData(msmeId: string): Promise<RawEPFOData | null>;
}
```

| Implementation | Behaviour |
|---|---|
| **`MockAdapter`** | Realistic, internally consistent mock JSON for the three demo profiles |
| **`LiveAdapter`** | Stub with explicit `TODO`s for bank sandbox / provider wiring |
| **`DataSourceFactory`** | Selects adapter via `DATA_MODE` (`mock` \| `live`) |

Downstream modules (normalization, scoring, AI, PDF, OCEN) depend **only** on the interface —
switching to live feeds requires no changes to those layers.

### Pipeline (per assessment)

1. **Fetch** raw GST / UPI / AA / EPFO via the active adapter  
2. **Normalize** into a unified schema (`NormalizedMSMEData`)  
3. **Score** with the deterministic 4-pillar engine → composite, band, flags  
4. **ML risk** (optional path): map features → XGBoost PD + SHAP; degrade gracefully if the
   ML service is down (`ml_risk.available = false`)  
5. **Narrative / Copilot** (optional Anthropic); local fallback if no API key  
6. **OCEN payload** and/or **PDF credit memo** as requested by the client  

Typical end-to-end latency for the rule path is well under **5 seconds**.

---

## 4. Scoring & ML methodology

### 4.1 Rule-based composite (explainable primary score)

Implemented in `backend/src/scoring/scoringEngine.ts`. Pure functions; unit-tested against the
three demo profiles.

| Pillar | Weight | Primary driver |
|---|---|---|
| Revenue Stability | 30% | Revenue coefficient of variation |
| Compliance Health | 25% | GST on-time filing rate |
| Cash Flow Discipline | 25% | Bank balance / turnover, bounce penalties |
| Formality / Payroll Stability | 20% | EPFO headcount trend |

**Missing EPFO:** the Formality pillar is **excluded** (not zeroed). Its weight is redistributed
across the other three, then a conservative incomplete-data confidence factor is applied.

**Bands (composite 0–100):**

| Band | Range |
|---|---|
| Poor | 0–20 |
| Bad | 21–40 |
| Average | 41–60 |
| Good | 61–80 |
| Excellent | 81–100 |

Risk and strength flags are derived from the same normalized inputs used by the pillars, so the
UI, flags, narrative, and OCEN payload remain internally consistent.

### 4.2 XGBoost PD + SHAP (model layer)

Hosted in `ml-service/`. Trained on the public **“Give Me Some Credit”** (Kaggle) dataset —
real labelled delinquency outcomes — then bridged at inference time from MSME alternate-data
features via a documented mapping (`ml-service/src/feature_mapping.py`).

**Important disclosure for bank reviewers:** this is a **demonstration model**. It is not
trained on IDBI historical MSME repayment data. Production deployment would retrain directly on
the bank’s labelled portfolio. The PD and SHAP outputs are always presented with that context.

If the ML service is unreachable, assessments continue on the rule-based score alone.

---

## 5. Product capabilities

### Assessment workspace

Portfolio overview, assessment history, alt-data views, and a full underwriting detail screen
with composite score, PD / risk band, SHAP-style explainability, and recommended action.

### Interactive Risk Underwriter

Free-form form (`POST /api/v1/score`) for ad-hoc applicants — facility type, turnover, DSCR,
vintage, concentration, utilization, delinquency flags — mapped onto the shared scoring + ML
pipeline.

### AI Credit Copilot

Conversational assistant for underwriters. Profile-grounded chat (`POST /api/msme/:id/chat`)
re-runs normalize + score before answering so replies stay current. General chat
(`POST /api/v1/chat`) supports the floating widget. Both use Anthropic when configured, with
deterministic local fallbacks otherwise.

### Portfolio summary

`GET /api/msme/portfolio/summary` scores all demo profiles and returns average composite,
high-risk share, band distribution, business-type counts, and per-MSME top risk flags
(including ML risk band when available).

### Credit memo PDF

`GET /api/msme/:id/memo` streams a bank-style PDF (PDFKit): header, composite + band, pillar
table, AI narrative, flags, recommended action by band, ML risk section when available, and
data-source footer.

### What-if scenario simulator

`POST /api/msme/:id/simulate` accepts overridden `NormalizedMSMEData`, calls the **unchanged**
`computeScore()` (and ML client where applicable), and returns the resulting score for live
slider-driven sensitivity analysis in the UI.

### OCEN-compatible output

Structured JSON for LSP handoff: applicant id, timestamp, composite score, risk band,
recommended action, pillar breakdown, data sources, flags.

---

## 6. API reference

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness + `DATA_MODE` |

### Interactive underwriter (`/api/v1`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/score` | Score ad-hoc `MSMEFinancialInputs` via rule engine + ML |
| `POST` | `/api/v1/chat` | General AI Credit Copilot for the dashboard chat widget |

### Fixed-profile demo (`/api/msme`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/msme/profiles` | List demo MSME profiles + `DATA_MODE` |
| `POST` | `/api/msme/:id/assess` | Full pipeline for one profile |
| `GET` | `/api/msme/:id/ocen-payload` | OCEN JSON only |
| `POST` | `/api/msme/:id/chat` | Copilot grounded in that profile’s live assessment |
| `GET` | `/api/msme/portfolio/summary` | Cross-profile portfolio aggregates |
| `GET` | `/api/msme/:id/memo` | PDF credit memo (`application/pdf`) |
| `POST` | `/api/msme/:id/simulate` | What-if scoring from overridden normalized inputs |

---

## 7. Local setup

Requires **Node.js 18+** (developed on Node 22) and **Python 3.10+** for the ML service.

### 7.1 ML service

```bash
cd ml-service
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd src
uvicorn app:app --host 0.0.0.0 --port 8000
```

Verify: `GET http://localhost:8000/health`

> **XGBoost pin:** `requirements.txt` pins `xgboost==2.1.4` because the committed
> `model/xgb_pd_model.joblib` was serialized with that release. XGBoost 3.x will refuse to
> load it. Retrain with `python src/train.py` if you upgrade the library.

### 7.2 Backend

```bash
cd backend
npm install
cp .env.example .env    # Windows: copy .env.example .env
# Optionally set ANTHROPIC_API_KEY for full narrative + copilot replies
npm run dev             # http://localhost:4000
```

Scoring unit tests:

```bash
npm test
```

### 7.3 Frontend

```bash
cd frontend
npm install
npm run dev             # http://localhost:5173 (proxies /api → :4000)
```

Open **http://localhost:5173**. Use **New Assessment** for the interactive underwriter, or
browse **Assessments** / **Dashboard** for portfolio and history views.

---

## 8. Deploying to Vercel

The product is packaged for a **single Vercel project** that serves:

| Piece | How it runs on Vercel |
|---|---|
| React UI | Static build from `frontend/dist` |
| Express API (`/api/*`) | Serverless function `api/index.ts` wrapping the same Express app |
| Python ML (XGBoost + SHAP) | **Not** bundled on Vercel (package size). Host separately and set `ML_SERVICE_URL`, or leave unset — the API degrades to the rule-based score |

```
Browser  →  Vercel (UI + /api Express)
                │
                └─ optional ──► ML service on Railway / Render / any Docker host
```

### 8.1 One-time setup

1. Push this repo to GitHub.
2. In [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
3. Leave **Root Directory** as the repository root (do not set it to `frontend/` only).
4. Vercel reads `vercel.json` automatically (`installCommand`, `buildCommand`, `outputDirectory`).
5. Add environment variables (Project → Settings → Environment Variables):

| Variable | Required? | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Optional | Full AI narrative / copilot; otherwise local fallbacks |
| `DATA_MODE` | Optional | Default `mock` |
| `ML_SERVICE_URL` | Optional | e.g. `https://your-ml.onrender.com` (no trailing slash) |

6. Deploy. Your app URL will be `https://<project>.vercel.app`.

### 8.2 Deploy via CLI

```bash
npm i -g vercel
vercel login
vercel          # preview
vercel --prod   # production
```

### 8.3 Optional: host the ML service

XGBoost + SHAP exceeds typical Vercel serverless size limits, so the ML layer is containerised:

```bash
cd ml-service
# Railway (railway.toml included) or Render (render.yaml included)
docker build -t idbi-msme-ml .
docker run -p 8000:8000 idbi-msme-ml
```

After the ML service is public, set **`ML_SERVICE_URL`** on the Vercel project to that origin and redeploy. Until then, assessments still work with `ml_risk.available = false`.

### 8.4 Verify production

```bash
curl https://<project>.vercel.app/api/health
# → {"status":"ok","data_mode":"mock","runtime":"vercel"}
```

Open the site, run **New Assessment → Compute ML Credit Score**. Rule-based scoring should return immediately; PD/SHAP appears once `ML_SERVICE_URL` points at a live ML host.

---

## 9. Configuration

Environment variables (`backend/.env` locally, or Vercel project env in production):

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | _(empty)_ | Server-side only. Powers AI narrative and Credit Copilot. Never sent to the browser. If unset, both fall back to locally derived text. |
| `DATA_MODE` | `mock` | `mock` → `MockAdapter`; `live` → stubbed `LiveAdapter` |
| `PORT` | `4000` | Express listen port (local only; ignored on Vercel) |
| `ML_SERVICE_URL` | `http://localhost:8000` locally; empty on Vercel | FastAPI ML base URL. If unset/unreachable, `ml_risk.available = false` and the rule path continues |

See also root [`.env.example`](.env.example).

---

## 10. Repository layout

```
/
  api/                Vercel serverless entry (wraps Express)
  vercel.json         Vercel build + /api rewrites
  package.json        Root vercel-build script
  backend/
  frontend/
  ml-service/         FastAPI + Dockerfile / railway.toml / render.yaml
```

```
backend/
  src/
    adapters/         DataSourceAdapter, MockAdapter, LiveAdapter, factory
    data/             Mock GST / UPI / AA / EPFO + 3 profile definitions
    normalization/    Raw → NormalizedMSMEData
    scoring/          4-pillar engine, constants, unit tests
    ml/               HTTP client for the Python PD/SHAP service
    ai/               Shared Anthropic client, narrative, credit copilot
    pdf/              Credit memo builder (PDFKit)
    ocen/             OCEN-compatible payload formatter
    routes/           msmeRoutes (/api/msme), scoreRoutes (/api/v1)
    types/            Shared TypeScript contracts
    app.ts            Express app factory (shared by local server + Vercel)
    server.ts         Local TCP listener

frontend/
  src/
    components/       Sidebar, gauges, explainability, forms, chatbot, …
    lib/              API client helpers
    types/            UI / response types
    App.tsx           Application shell & screens
    index.css         Design tokens + typography (Plus Jakarta Sans, Source Serif 4)

ml-service/
  src/                FastAPI app, train script, feature mapping, SHAP
  model/              Serialized XGBoost model + metadata
  Dockerfile          Container image for Railway / Render / any Docker host
```

---

## 11. Demo profiles

Used by `/api/msme/*` to prove the thesis in both directions — alternate data can **approve
thin-file strength** and **flag paper-strong weakness**.

| Profile | Narrative | Expected rule band |
|---|---|---|
| **Shree Balaji Hardware Store** (`thin-file-ntc`) | Steady UPI history, no ITR / EPFO — thin-file NTC | **Good** |
| **Vinayak Trading Co.** (`documented-risky`) | Formal docs present, but GST lapses, bounces, shrinking payroll | **Bad / Average** |
| **Green Leaf Textiles** (`average-stable`) | Moderate, stable across sources | **Average** |

---

## 12. Assumptions & disclosures

- **In-memory demo data.** Fixed profiles live in TypeScript under `backend/src/data/`. There is
  no production database in this repository. Persistence can be added behind the same adapter
  interface without rewriting scoring.
- **`LiveAdapter` is intentionally stubbed** pending bank sandbox credentials / provider choice.
- **ML model honesty.** PD estimates use a public bureau-style training set with a documented
  alt-data bridge. They are labelled as demonstration outputs suitable for hackathon evaluation,
  not as production credit decisions.
- **AI is assistive, not authoritative.** Narrative and copilot text must not invent figures
  outside the grounded score context; missing Anthropic credentials never break the assessment
  pipeline.
- **No scoring-engine forks.** Portfolio, chat, memo, simulate, and `/api/v1/score` all call the
  shared `computeScore()` / `getMLRisk()` implementations.
- **Model ID.** Anthropic calls use `claude-sonnet-4-6` via `backend/src/ai/anthropicClient.ts`.
  Update that constant if the provider renames the model.
- **Vercel + ML.** The UI and Express API deploy as one Vercel project. The Python ML service is
  optional and container-hosted; without it the product remains fully usable on rule-based scores.

---

## 13. Team

**Team Anvay** — IDBI Innovation Hackathon  

Product: **IDBI MSME Financial Health Card** · Bank Lending
