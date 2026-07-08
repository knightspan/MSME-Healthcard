import type { DataSourceAdapter } from "./DataSourceAdapter.js";
import type { RawAAData, RawEPFOData, RawGSTData, RawUPIData } from "../types/index.js";
import { GST_DATA } from "../data/gstData.js";
import { UPI_DATA } from "../data/upiData.js";
import { AA_DATA } from "../data/aaData.js";
import { EPFO_DATA } from "../data/epfoData.js";

/**
 * Sandbox-speed implementation of DataSourceAdapter backed by static,
 * internally-consistent mock JSON. Simulates a small amount of network
 * latency so the frontend's loading states are demonstrably real, not
 * instant/fake.
 */
export class MockAdapter implements DataSourceAdapter {
  private async simulateLatency(): Promise<void> {
    const delayMs = 80 + Math.floor(Math.random() * 120);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  async getGSTData(msmeId: string): Promise<RawGSTData | null> {
    await this.simulateLatency();
    return GST_DATA[msmeId] ?? null;
  }

  async getUPIData(msmeId: string): Promise<RawUPIData | null> {
    await this.simulateLatency();
    return UPI_DATA[msmeId] ?? null;
  }

  async getAAData(msmeId: string): Promise<RawAAData | null> {
    await this.simulateLatency();
    return AA_DATA[msmeId] ?? null;
  }

  async getEPFOData(msmeId: string): Promise<RawEPFOData | null> {
    await this.simulateLatency();
    return EPFO_DATA[msmeId] ?? null;
  }
}
