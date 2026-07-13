import "dotenv/config";
import express from "express";
import cors from "cors";
import { msmeRouter } from "./routes/msmeRoutes.js";
import { scoreRouter } from "./routes/scoreRoutes.js";
import { getDataMode } from "./adapters/DataSourceFactory.js";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", data_mode: getDataMode() });
});

app.use("/api/msme", msmeRouter);
// Ad-hoc scoring contract consumed by the RiskIntel MSME frontend's
// "Interactive Risk Underwriter" form (as opposed to the fixed demo
// profiles served under /api/msme).
app.use("/api/v1", scoreRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`MSME Financial Health Card backend listening on http://localhost:${PORT}`);
  console.log(`DATA_MODE=${getDataMode()}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      "[warning] ANTHROPIC_API_KEY is not set — the AI narrative layer will use fallback text instead of calling Claude."
    );
  }
});
