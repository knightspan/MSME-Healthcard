# RiskIntel MSME — Frontend

Institutional-banking-styled React + Vite + TypeScript + Tailwind CSS dashboard for MSME credit
underwriting: portfolio overview, an interactive risk assessment workspace, alt-data insights,
credit memo generation, and an AI Credit Copilot chat panel.

This is the UI layer only. It talks to the real backend + ML service in `../backend` and
`../ml-service` — see the [root README](../README.md) for how to run the full stack.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api/* to http://localhost:4000
```

Requires the backend (`../backend`) running on port 4000 (and ideally the ML service in
`../ml-service` on port 8000 for real XGBoost/SHAP predictions — the backend degrades gracefully
to a rule-based score if the ML service isn't running).

## Configuring the API endpoint

The "Interactive Risk Underwriter" form (New Assessment screen) has an **API Gateway Settings**
panel where you can override the scoring endpoint (stored in `localStorage`). Defaults to
`/api/v1/score`, which Vite's dev proxy forwards to `http://localhost:4000/api/v1/score`.

## Build

```bash
npm run build       # outputs static assets to dist/
npm run preview      # serve the production build locally
```

A production build is a static SPA with no server-side code of its own — point
`DEFAULT_EXTERNAL_URL` in `src/lib/api.ts` (or the in-app Settings panel) at wherever the backend
is deployed.
