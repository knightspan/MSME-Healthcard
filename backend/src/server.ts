import app from "./app.js";
import { getDataMode } from "./adapters/DataSourceFactory.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

// Only bind a TCP port when running as a long-lived Node process.
// On Vercel the serverless entry imports `app` directly and never executes this.
app.listen(PORT, () => {
  console.log(`MSME Financial Health Card backend listening on http://localhost:${PORT}`);
  console.log(`DATA_MODE=${getDataMode()}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      "[warning] ANTHROPIC_API_KEY is not set — the AI narrative layer will use fallback text instead of calling Claude."
    );
  }
  if (!process.env.ML_SERVICE_URL) {
    console.warn(
      "[warning] ML_SERVICE_URL is not set — defaulting to http://localhost:8000. On Vercel, set this to your hosted ML service URL or leave the ML layer in graceful fallback."
    );
  }
});
