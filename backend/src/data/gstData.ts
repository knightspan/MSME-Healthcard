import type { RawGSTData } from "../types/index.js";

// ============================================================================
// Mock GST filing data (GSTR-3B style monthly turnover self-declarations).
// Consistent, per-profile narrative — see README for the story behind each.
// ============================================================================

export const GST_DATA: Record<string, RawGSTData> = {
  // Profile 1 — thin-file NTC: filed on time in 11 of 12 months, turnover
  // closely tracks the UPI inflow numbers for the same months.
  "thin-file-ntc": {
    gstin: "27ABCDE1234F1Z5",
    registrationAgeMonths: 14,
    monthlyFilings: [
      { month: "2024-07", filed: true, filedOnTime: true, gstr3bTurnover: 198000 },
      { month: "2024-08", filed: true, filedOnTime: true, gstr3bTurnover: 215000 },
      { month: "2024-09", filed: true, filedOnTime: true, gstr3bTurnover: 208000 },
      { month: "2024-10", filed: true, filedOnTime: true, gstr3bTurnover: 203000 },
      { month: "2024-11", filed: true, filedOnTime: false, gstr3bTurnover: 211000 },
      { month: "2024-12", filed: true, filedOnTime: true, gstr3bTurnover: 206000 },
      { month: "2025-01", filed: true, filedOnTime: true, gstr3bTurnover: 214000 },
      { month: "2025-02", filed: true, filedOnTime: true, gstr3bTurnover: 200000 },
      { month: "2025-03", filed: true, filedOnTime: true, gstr3bTurnover: 209000 },
      { month: "2025-04", filed: true, filedOnTime: true, gstr3bTurnover: 212000 },
      { month: "2025-05", filed: true, filedOnTime: true, gstr3bTurnover: 198000 },
      { month: "2025-06", filed: true, filedOnTime: true, gstr3bTurnover: 207000 },
    ],
  },

  // Profile 2 — documented but risky: 4 of 12 months not filed at all
  // (turnover unreported = 0), and reported turnover shows a clear decline.
  "documented-risky": {
    gstin: "07XYZAB5678G1Z2",
    registrationAgeMonths: 63,
    monthlyFilings: [
      { month: "2024-07", filed: true, filedOnTime: true, gstr3bTurnover: 355000 },
      { month: "2024-08", filed: true, filedOnTime: true, gstr3bTurnover: 348000 },
      { month: "2024-09", filed: false, filedOnTime: false, gstr3bTurnover: 0 },
      { month: "2024-10", filed: true, filedOnTime: true, gstr3bTurnover: 352000 },
      { month: "2024-11", filed: true, filedOnTime: true, gstr3bTurnover: 345000 },
      { month: "2024-12", filed: false, filedOnTime: false, gstr3bTurnover: 0 },
      { month: "2025-01", filed: true, filedOnTime: true, gstr3bTurnover: 310000 },
      { month: "2025-02", filed: true, filedOnTime: true, gstr3bTurnover: 280000 },
      { month: "2025-03", filed: false, filedOnTime: false, gstr3bTurnover: 0 },
      { month: "2025-04", filed: true, filedOnTime: true, gstr3bTurnover: 225000 },
      { month: "2025-05", filed: false, filedOnTime: false, gstr3bTurnover: 0 },
      { month: "2025-06", filed: true, filedOnTime: true, gstr3bTurnover: 190000 },
    ],
  },

  // Profile 3 — average/stable: 3 filing hiccups (2 late, 1 missed) across
  // 12 months, moderate turnover variance.
  "average-stable": {
    gstin: "29PQRST9012H1Z8",
    registrationAgeMonths: 38,
    monthlyFilings: [
      { month: "2024-07", filed: true, filedOnTime: true, gstr3bTurnover: 150000 },
      { month: "2024-08", filed: true, filedOnTime: true, gstr3bTurnover: 165000 },
      { month: "2024-09", filed: true, filedOnTime: false, gstr3bTurnover: 140000 },
      { month: "2024-10", filed: true, filedOnTime: true, gstr3bTurnover: 155000 },
      { month: "2024-11", filed: true, filedOnTime: false, gstr3bTurnover: 148000 },
      { month: "2024-12", filed: true, filedOnTime: true, gstr3bTurnover: 160000 },
      { month: "2025-01", filed: false, filedOnTime: false, gstr3bTurnover: 0 },
      { month: "2025-02", filed: true, filedOnTime: true, gstr3bTurnover: 152000 },
      { month: "2025-03", filed: true, filedOnTime: true, gstr3bTurnover: 158000 },
      { month: "2025-04", filed: true, filedOnTime: false, gstr3bTurnover: 145000 },
      { month: "2025-05", filed: true, filedOnTime: true, gstr3bTurnover: 150000 },
      { month: "2025-06", filed: true, filedOnTime: true, gstr3bTurnover: 162000 },
    ],
  },
};
