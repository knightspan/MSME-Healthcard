import type { RawUPIData } from "../types/index.js";

// ============================================================================
// Mock UPI transaction data. Profile 1 deliberately carries 14 months of
// history (2 more than GST/AA/EPFO) to demonstrate that UPI can establish a
// longer, independent track record for a thin-file business.
// ============================================================================

export const UPI_DATA: Record<string, RawUPIData> = {
  "thin-file-ntc": {
    vpa: "balajihardware@okicici",
    monthlyTransactions: [
      { month: "2024-05", inflowAmount: 205000, txnCount: 612 },
      { month: "2024-06", inflowAmount: 212000, txnCount: 634 },
      { month: "2024-07", inflowAmount: 198000, txnCount: 589 },
      { month: "2024-08", inflowAmount: 215000, txnCount: 648 },
      { month: "2024-09", inflowAmount: 208000, txnCount: 621 },
      { month: "2024-10", inflowAmount: 203000, txnCount: 601 },
      { month: "2024-11", inflowAmount: 211000, txnCount: 629 },
      { month: "2024-12", inflowAmount: 206000, txnCount: 615 },
      { month: "2025-01", inflowAmount: 214000, txnCount: 641 },
      { month: "2025-02", inflowAmount: 200000, txnCount: 593 },
      { month: "2025-03", inflowAmount: 209000, txnCount: 624 },
      { month: "2025-04", inflowAmount: 212000, txnCount: 633 },
      { month: "2025-05", inflowAmount: 198000, txnCount: 588 },
      { month: "2025-06", inflowAmount: 207000, txnCount: 618 },
    ],
  },

  "documented-risky": {
    vpa: "vinayaktrading@okhdfcbank",
    monthlyTransactions: [
      { month: "2024-07", inflowAmount: 355000, txnCount: 302 },
      { month: "2024-08", inflowAmount: 348000, txnCount: 296 },
      { month: "2024-09", inflowAmount: 360000, txnCount: 311 },
      { month: "2024-10", inflowAmount: 352000, txnCount: 299 },
      { month: "2024-11", inflowAmount: 345000, txnCount: 288 },
      { month: "2024-12", inflowAmount: 358000, txnCount: 305 },
      { month: "2025-01", inflowAmount: 310000, txnCount: 258 },
      { month: "2025-02", inflowAmount: 280000, txnCount: 231 },
      { month: "2025-03", inflowAmount: 250000, txnCount: 204 },
      { month: "2025-04", inflowAmount: 225000, txnCount: 181 },
      { month: "2025-05", inflowAmount: 205000, txnCount: 163 },
      { month: "2025-06", inflowAmount: 190000, txnCount: 149 },
    ],
  },

  "average-stable": {
    vpa: "greenleaftextiles@oksbi",
    monthlyTransactions: [
      { month: "2024-07", inflowAmount: 150000, txnCount: 210 },
      { month: "2024-08", inflowAmount: 165000, txnCount: 224 },
      { month: "2024-09", inflowAmount: 140000, txnCount: 198 },
      { month: "2024-10", inflowAmount: 155000, txnCount: 213 },
      { month: "2024-11", inflowAmount: 148000, txnCount: 205 },
      { month: "2024-12", inflowAmount: 160000, txnCount: 219 },
      { month: "2025-01", inflowAmount: 135000, txnCount: 190 },
      { month: "2025-02", inflowAmount: 152000, txnCount: 208 },
      { month: "2025-03", inflowAmount: 158000, txnCount: 216 },
      { month: "2025-04", inflowAmount: 145000, txnCount: 201 },
      { month: "2025-05", inflowAmount: 150000, txnCount: 209 },
      { month: "2025-06", inflowAmount: 162000, txnCount: 221 },
    ],
  },
};
