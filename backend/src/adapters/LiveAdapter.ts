import type { DataSourceAdapter } from "./DataSourceAdapter.js";
import type { RawAAData, RawEPFOData, RawGSTData, RawUPIData } from "../types/index.js";

/**
 * Placeholder for real bank-sandbox / GSP / AA-FIU / EPFO API integration.
 *
 * Bank sandbox API access (AWS-based banking services) becomes available to
 * hackathon finalists July 22–31. Until the specific provider + credentials
 * are known, this class exists purely to prove the adapter pattern end to
 * end: flipping `DATA_MODE=live` swaps this in with ZERO changes required to
 * normalization, scoring, the AI narrative layer, or the OCEN formatter.
 *
 * TODO(live-integration): once sandbox credentials are issued, implement:
 *   - getGSTData: call the GSP/GSTN sandbox API (e.g. GSTR-3B filing
 *     history endpoint), map response into RawGSTData.monthlyFilings[].
 *   - getUPIData: call the bank's UPI statement/analytics endpoint (or NPCI
 *     partner API), map into RawUPIData.monthlyTransactions[].
 *   - getAAData: implement the Account Aggregator consent flow (consent
 *     artifact -> FIU data pull), map FI data (bank statements) into
 *     RawAAData.monthlyStatements[].
 *   - getEPFOData: call the EPFO employer sandbox API for ECR filing /
 *     headcount history, map into RawEPFOData.monthlyRecords[]. Return null
 *     if the establishment has no registered EPFO account.
 *   - Add auth (API keys / OAuth / mTLS as required by the sandbox),
 *     retries with backoff, and response caching for the <5s SLA.
 */
export class LiveAdapter implements DataSourceAdapter {
  async getGSTData(_msmeId: string): Promise<RawGSTData | null> {
    throw new Error(
      "LiveAdapter.getGSTData is not implemented yet — bank sandbox GST/GSP integration pending (see TODO in LiveAdapter.ts)."
    );
  }

  async getUPIData(_msmeId: string): Promise<RawUPIData | null> {
    throw new Error(
      "LiveAdapter.getUPIData is not implemented yet — bank sandbox UPI integration pending (see TODO in LiveAdapter.ts)."
    );
  }

  async getAAData(_msmeId: string): Promise<RawAAData | null> {
    throw new Error(
      "LiveAdapter.getAAData is not implemented yet — Account Aggregator (FIU) integration pending (see TODO in LiveAdapter.ts)."
    );
  }

  async getEPFOData(_msmeId: string): Promise<RawEPFOData | null> {
    throw new Error(
      "LiveAdapter.getEPFOData is not implemented yet — EPFO sandbox integration pending (see TODO in LiveAdapter.ts)."
    );
  }
}
