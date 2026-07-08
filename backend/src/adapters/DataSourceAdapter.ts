import type { RawAAData, RawEPFOData, RawGSTData, RawUPIData } from "../types/index.js";

/**
 * Provider-agnostic contract for fetching alternate-data for an MSME.
 *
 * Every consumer downstream (normalization, scoring, narrative, OCEN
 * formatting) depends ONLY on this interface — never on raw mock/live data
 * directly. Swapping `DATA_MODE=live` at the factory level is the only
 * change required to point the entire pipeline at real bank sandbox APIs.
 */
export interface DataSourceAdapter {
  getGSTData(msmeId: string): Promise<RawGSTData | null>;
  getUPIData(msmeId: string): Promise<RawUPIData | null>;
  getAAData(msmeId: string): Promise<RawAAData | null>;
  /** Returns null when the business has no registered EPFO establishment (informal/no employees). */
  getEPFOData(msmeId: string): Promise<RawEPFOData | null>;
}
