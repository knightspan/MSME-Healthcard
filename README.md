# MSME Financial Health Card

Built for the **IDBI Innovation Hackathon — Problem Statement 3**.

An AI/ML-driven credit assessment tool that turns MSME alternate data — **GST filings, UPI
transactions, Account Aggregator (AA) bank statement data, and EPFO payroll records** — into a
transparent, multidimensional financial health score. It's designed to help banks confidently
onboard **New-to-Credit (NTC) and New-to-Bank (NTB)** MSMEs that lack traditional documents
(ITRs, audited balance sheets), while still catching risk in "paper-strong" businesses that
traditional underwriting would miss.

The whole pipeline (fetch data → normalize → score → AI narrative → OCEN-formatted output) runs
in well under 5 seconds per assessment. On top of that core card, the demo also includes an
**AI Credit Copilot**, a **portfolio view** across all three profiles, a **PDF credit memo**
export, and a live **what-if scenario simulator**.

## What makes the demo convincing

Three realistic, internally-consistent MSME profiles are included, each proving a different part
of the thesis:

| Profile | Story | Result |
|---|---|---|
| **Shree Balaji Hardware Store** | Thin-file NTC retailer — 14 months of steady UPI inflow, no ITR, no registered payroll | Scores **Good (65–80)** despite zero traditional credit history |
| **Vinayak Trading Co.** | Has ITR and prior credit history, but GST lapses, a ~31% inflow decline, 11 bounced payments, and shrinking payroll | Scores **Bad (30–50)** despite "looking good on paper" |
| **Green Leaf Textiles** | Moderate, stable business across all four sources | Scores **Average (41–60)** — the control case |

This is the core proof point: **alternate data catches what paperwork misses**, in both
directions.

## Product features

### Assessment dashboard

Pick a profile, click **Run Assessment**, and get the full Financial Health Card: composite
gauge, 4-pillar radar, pillar breakdown, AI underwriter narrative, risk/strength flags, and
OCEN-compatible JSON.

### AI Credit Copilot

A collapsible chat panel beside the assessment. Each turn re-runs normalize + score so answers
are grounded in fresh data, then calls Anthropic with the full score object (composite, pillars,
risk/strength flags, normalized inputs) as context. Starter chips include:

- "Why is this MSME risky?"
- "Should we approve this loan?"
- "What's the biggest strength here?"
- "What would improve this score fastest?"

Conversation history stays in React state for the demo (not persisted). If `ANTHROPIC_API_KEY`
is unset, the copilot falls back to a data-only summary — same pattern as the narrative layer.

### Portfolio view

A **Portfolio** tab that scores all three mock profiles and shows:

- Summary cards: average composite score, % high-risk (Poor + Bad), total assessed
- Bar chart of score distribution across bands (Recharts)
- Sortable table of all MSMEs with score, band, and top risk flag
- Click a row to jump straight into that MSME's full assessment

### Credit memo PDF

**Download Credit Memo** on the assessment view hits `GET /api/msme/:id/memo` and downloads a
bank-style PDF (via PDFKit) with:

- Header (business name, date)
- Composite score + band
- Pillar breakdown table
- AI narrative (strength / risk / tips)
- Risk & strength flags
- Recommended action derived from band (approve / conditional approve with monitoring / decline
  or further manual review)
- Footer noting data sources used

### What-if scenario simulator

Sliders for the key normalized inputs (`monthly_revenue`, `revenue_variance_pct`,
`filing_regularity_pct`, `avg_bank_balance`, `bounced_payment_count`,
`payroll_headcount_trend_pct`), pre-filled from the selected MSME. Debounced calls to
`POST /api/msme/:id/simulate` re-run the **existing** `computeScore()` only — no scoring-engine
changes — and update the gauge/radar live with a delta vs. the actual score (e.g. `+9.3` /
`-4.1`).

## Architecture

```
frontend/  React + Vite + TypeScript + Tailwind CSS + Recharts
backend/   Node.js + Express + TypeScript + PDFKit + Anthropic SDK
```

### Provider-agnostic adapter layer (the key technical differentiator)

Every data source is fetched through a single interface, `DataSourceAdapter`
(`backend/src/adapters/DataSourceAdapter.ts`):

```ts
interface DataSourceAdapter {
  getGSTData(msmeId: string): Promise<RawGSTData | null>;
  getUPIData(msmeId: string): Promise<RawUPIData | null>;
  getAAData(msmeId: string): Promise<RawAAData | null>;
  getEPFOData(msmeId: string): Promise<RawEPFOData | null>;
}
```

- **`MockAdapter`** — implements the interface today with realistic, internally-consistent mock
  JSON (see `backend/src/data/`).
- **`LiveAdapter`** — a stub with detailed `TODO` comments for exactly what needs to be wired up
  once real bank sandbox credentials (available July 22–31) are issued. Implementing it requires
  **zero changes** to normalization, scoring, the AI layer, or the OCEN formatter — they all
  depend only on the interface.
- **`DataSourceFactory`** — picks `MockAdapter` or `LiveAdapter` based on the `DATA_MODE`
  environment variable (`mock` by default). The frontend surfaces the active mode in the header
  ("Data Mode: Mock (Sandbox integration ready)") to make this architecture visible to judges
  without needing to explain it verbally.

### Pipeline

1. **Normalization** (`backend/src/normalization/`) — maps each adapter's raw shape into one
   unified schema (`monthly_revenue`, `revenue_variance_pct`, `filing_regularity_pct`,
   `avg_bank_balance`, `bounced_payment_count`, `payroll_headcount_trend_pct`,
   `months_of_data_available`, `data_sources_available`).
2. **Scoring engine** (`backend/src/scoring/`) — a deterministic, explainable, weighted-rules
   engine (no black-box ML — explainability matters more than accuracy-at-any-cost for a banking
   credit use case). Four pillars, each 0–100:
   - **Revenue Stability** (30%) — driven by revenue consistency (coefficient of variation).
   - **Compliance Health** (25%) — GST on-time filing rate.
   - **Cash Flow Discipline** (25%) — average bank balance relative to turnover, penalized
     heavily for bounced payments.
   - **Formality / Payroll Stability** (20%) — EPFO headcount trend. If EPFO data is
     unavailable (e.g. an informal business with no registered employees), this pillar is
     **excluded and its weight is redistributed proportionally** across the other three — never
     scored as a zero. A conservative confidence discount is then applied to the composite,
     reflecting that a score built on 3 independent sources carries more uncertainty than one
     corroborated across all 4.

   The composite (0–100) is banded: `Poor (0–20)`, `Bad (21–40)`, `Average (41–60)`,
   `Good (61–80)`, `Excellent (81–100)`. Risk and strength flags are derived from the same
   normalized data, so the UI, the flags, and the AI narrative are always internally consistent.

   All scoring logic is pure and unit-tested (`backend/src/scoring/scoringEngine.test.ts`),
   verifying the three profiles land in their expected bands. The what-if simulator and
   portfolio/copilot/memo routes call this same `computeScore()` — they do not reimplement it.
3. **AI narrative layer** (`backend/src/ai/narrative.ts`) — calls the Anthropic API
   (`claude-sonnet-4-6`) server-side only, with a system prompt requiring exactly one named
   strength (with a real number from the data), one named risk (ditto), and two specific
   improvement recommendations — parsed into structured JSON. If the API key is missing, the
   call errors, or it times out, the layer **falls back to a locally-derived narrative** built
   from the score's own flags — the assessment pipeline never crashes because of the AI call.
4. **AI Credit Copilot** (`backend/src/ai/copilot.ts`) — conversational underwriting Q&A over
   the same grounded score context; shares the Anthropic client helper in
   `backend/src/ai/anthropicClient.ts`.
5. **OCEN adapter** (`backend/src/ocen/ocenAdapter.ts`) — reformats the final score into an
   OCEN-style structured payload (`applicant_id`, `composite_score`, `risk_band`,
   `recommended_action`, `score_breakdown`, `data_sources_used`, ...) for handoff to a Loan
   Service Provider, viewable and copyable from the frontend.
6. **Credit memo PDF** (`backend/src/pdf/creditMemoPdf.ts`) — formats the assessment into a
   downloadable bank-style memo via PDFKit.

### API routes

| Route | Description |
|---|---|
| `GET /api/msme/profiles` | Lists the 3 demo MSME profiles + current `DATA_MODE` |
| `POST /api/msme/:id/assess` | Runs the full pipeline end-to-end and returns everything the dashboard needs |
| `GET /api/msme/:id/ocen-payload` | Returns just the OCEN-formatted JSON |
| `POST /api/msme/:id/chat` | AI Credit Copilot — body `{ message, conversationHistory }`; re-runs normalize + score, then returns `{ reply, source }` |
| `GET /api/msme/portfolio/summary` | Scores all 3 profiles; returns averages, band/business-type counts, high-risk %, and per-MSME summaries |
| `GET /api/msme/:id/memo` | Streams a PDF credit memo (`application/pdf` attachment) |
| `POST /api/msme/:id/simulate` | Body: full `NormalizedMSMEData` overrides; returns `ScoreResult` from existing `computeScore()` |

## Running locally

Requires Node.js 18+ (developed on Node 22).

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env   # then optionally paste in your ANTHROPIC_API_KEY
npm run dev            # starts on http://localhost:4000
```

Run the scoring engine's unit tests any time with `npm test`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev             # starts on http://localhost:5173, proxies /api to :4000
```

Open `http://localhost:5173`:

1. On **Assessment**, pick a profile and click **Run Assessment**.
2. Use **Download Credit Memo**, the **AI Credit Copilot** panel, and the **What-If Scenario
   Simulator** on the results view.
3. Switch to the **Portfolio** tab for the cross-profile summary; click a table row to open that
   MSME's assessment.

### Environment variables (`backend/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | _(empty)_ | Used server-side only for the AI narrative layer and Credit Copilot. **Never exposed to the client.** If unset, both fall back to locally-derived text instead of crashing. |
| `DATA_MODE` | `mock` | `mock` uses the built-in `MockAdapter`; `live` switches to the stubbed `LiveAdapter` for future bank sandbox integration. |
| `PORT` | `4000` | Port the Express API listens on. |

## Project structure

```
backend/
  src/
    adapters/        DataSourceAdapter interface, MockAdapter, LiveAdapter, DataSourceFactory
    data/             Mock GST/UPI/AA/EPFO data + the 3 profile definitions
    normalization/    Raw adapter output -> unified schema
    scoring/          The 4-pillar weighted scoring engine + constants + unit tests
    ai/               Shared Anthropic client, underwriting narrative, Credit Copilot
    pdf/              Credit memo PDF builder (PDFKit)
    ocen/             OCEN-style payload formatter
    routes/           Express route handlers (assess, chat, portfolio, memo, simulate, …)
    types/            Shared TypeScript types
    server.ts         Express app entrypoint
frontend/
  src/
    components/       ScoreGauge, PillarRadarChart, NarrativeCard, ChatPanel,
                      PortfolioView, WhatIfSimulator, OcenPanel, etc.
    lib/               API client, debounce hook, band color helpers
    types/             Shared TypeScript types (mirrors backend response shapes)
    App.tsx           Assessment + Portfolio tabs and dashboard layout
```

## Notes & assumptions

- **In-memory data only.** There is no database — mock data lives in TypeScript files under
  `backend/src/data/`. This was an explicit choice for hackathon speed; the normalization layer
  already treats all data as coming through the adapter interface, so swapping in Postgres later
  would only mean changing what backs the adapter, not any downstream logic. Copilot chat history
  is likewise in-memory on the client only.
- **`LiveAdapter` is intentionally unimplemented** — bank sandbox credentials aren't available
  yet. It throws clear, descriptive errors if invoked, with `TODO` comments marking exactly what
  each method needs once a provider is chosen.
- **Model name**: the AI layer calls `claude-sonnet-4-6` exactly as specified. If that model ID
  is renamed/unavailable when you run this, update the constant in
  `backend/src/ai/anthropicClient.ts` (shared by narrative + copilot).
- **No scoring-engine forks.** Portfolio, chat, memo, and simulate all reuse
  `normalizeMSMEData` / `computeScore` / `generateNarrative` as appropriate — the simulator in
  particular only overrides normalized inputs and calls `computeScore()` unchanged.
