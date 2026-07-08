import { describe, expect, it } from "vitest";
import { MockAdapter } from "../adapters/MockAdapter.js";
import { normalizeMSMEData } from "../normalization/normalize.js";
import { computeScore } from "./scoringEngine.js";

const adapter = new MockAdapter();

describe("scoring engine — profile bands", () => {
  it("Profile 1 (thin-file-ntc): lands in the Good band (65-80) despite zero traditional credit history", async () => {
    const normalized = await normalizeMSMEData("thin-file-ntc", adapter);
    const result = computeScore(normalized);

    expect(result.band).toBe("Good");
    expect(result.composite_score).toBeGreaterThanOrEqual(65);
    expect(result.composite_score).toBeLessThanOrEqual(80);

    // No EPFO data -> pillar should be reweighted, not scored as zero.
    expect(result.reweighted).toBe(true);
    expect(normalized.data_sources_available).not.toContain("EPFO");
    const payrollPillar = result.pillars.find((p) => p.key === "formalityPayrollStability");
    expect(payrollPillar?.applied).toBe(false);
  });

  it("Profile 2 (documented-risky): lands in the Bad/Average range (30-50) despite having formal paperwork", async () => {
    const normalized = await normalizeMSMEData("documented-risky", adapter);
    const result = computeScore(normalized);

    expect(["Bad", "Average"]).toContain(result.band);
    expect(result.composite_score).toBeGreaterThanOrEqual(30);
    expect(result.composite_score).toBeLessThanOrEqual(50);

    expect(result.risk_flags.length).toBeGreaterThan(0);
    expect(result.risk_flags.some((f) => f.toLowerCase().includes("bounced"))).toBe(true);
    expect(result.risk_flags.some((f) => f.toLowerCase().includes("payroll"))).toBe(true);
  });

  it("Profile 3 (average-stable): lands in the Average band (41-60)", async () => {
    const normalized = await normalizeMSMEData("average-stable", adapter);
    const result = computeScore(normalized);

    expect(result.band).toBe("Average");
    expect(result.composite_score).toBeGreaterThanOrEqual(41);
    expect(result.composite_score).toBeLessThanOrEqual(60);
  });
});

describe("scoring engine — pillar weight integrity", () => {
  it("weights sum to 1.0 when all 4 pillars are applied", async () => {
    const normalized = await normalizeMSMEData("average-stable", adapter);
    const result = computeScore(normalized);
    const totalWeight = result.pillars.reduce((sum, p) => sum + p.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 5);
  });

  it("weights sum to 1.0 after reweighting when EPFO is missing", async () => {
    const normalized = await normalizeMSMEData("thin-file-ntc", adapter);
    const result = computeScore(normalized);
    const totalWeight = result.pillars.reduce((sum, p) => sum + p.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 5);
  });

  it("composite score is always within [0, 100]", async () => {
    for (const id of ["thin-file-ntc", "documented-risky", "average-stable"]) {
      const normalized = await normalizeMSMEData(id, adapter);
      const result = computeScore(normalized);
      expect(result.composite_score).toBeGreaterThanOrEqual(0);
      expect(result.composite_score).toBeLessThanOrEqual(100);
    }
  });

  it("is deterministic — same input always produces the same output", async () => {
    const normalized = await normalizeMSMEData("average-stable", adapter);
    const result1 = computeScore(normalized);
    const result2 = computeScore(normalized);
    expect(result1).toEqual(result2);
  });
});
