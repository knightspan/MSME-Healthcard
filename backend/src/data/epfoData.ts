import type { RawEPFOData } from "../types/index.js";

// ============================================================================
// Mock EPFO payroll data. `thin-file-ntc` has no registered establishment
// (informal, no employees on the books) — the adapter returns null for it,
// and downstream layers must reweight gracefully rather than treat it as 0.
// ============================================================================

export const EPFO_DATA: Record<string, RawEPFOData | null> = {
  "thin-file-ntc": null,

  // Headcount shrinks from a ~42.5 avg in H1 to 25 by the final month (~-41%).
  "documented-risky": {
    establishmentRegistered: true,
    monthlyRecords: [
      { month: "2024-07", headcount: 42, totalWageBill: 336000 },
      { month: "2024-08", headcount: 43, totalWageBill: 344000 },
      { month: "2024-09", headcount: 41, totalWageBill: 328000 },
      { month: "2024-10", headcount: 44, totalWageBill: 352000 },
      { month: "2024-11", headcount: 42, totalWageBill: 336000 },
      { month: "2024-12", headcount: 43, totalWageBill: 344000 },
      { month: "2025-01", headcount: 39, totalWageBill: 312000 },
      { month: "2025-02", headcount: 36, totalWageBill: 288000 },
      { month: "2025-03", headcount: 33, totalWageBill: 264000 },
      { month: "2025-04", headcount: 30, totalWageBill: 240000 },
      { month: "2025-05", headcount: 27, totalWageBill: 216000 },
      { month: "2025-06", headcount: 25, totalWageBill: 200000 },
    ],
  },

  // Moderate, gentle softening in headcount (mild seasonal-style dip, not a
  // collapse) — distinct in severity from the sharp payroll shrinkage in
  // the "documented-risky" profile.
  "average-stable": {
    establishmentRegistered: true,
    monthlyRecords: [
      { month: "2024-07", headcount: 15, totalWageBill: 135000 },
      { month: "2024-08", headcount: 16, totalWageBill: 144000 },
      { month: "2024-09", headcount: 14, totalWageBill: 126000 },
      { month: "2024-10", headcount: 15, totalWageBill: 135000 },
      { month: "2024-11", headcount: 15, totalWageBill: 135000 },
      { month: "2024-12", headcount: 16, totalWageBill: 144000 },
      { month: "2025-01", headcount: 13, totalWageBill: 117000 },
      { month: "2025-02", headcount: 14, totalWageBill: 126000 },
      { month: "2025-03", headcount: 13, totalWageBill: 117000 },
      { month: "2025-04", headcount: 12, totalWageBill: 108000 },
      { month: "2025-05", headcount: 13, totalWageBill: 117000 },
      { month: "2025-06", headcount: 14, totalWageBill: 126000 },
    ],
  },
};
