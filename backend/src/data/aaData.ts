import type { RawAAData } from "../types/index.js";

// ============================================================================
// Mock Account Aggregator (AA) bank statement data — average/closing balance
// and bounced payment counts per month, consent-based as in the real AA flow.
// ============================================================================

export const AA_DATA: Record<string, RawAAData> = {
  // Healthy balance relative to turnover (~20-27%), only 1 bounce all year.
  "thin-file-ntc": {
    consentGranted: true,
    bankName: "ICICI Bank",
    monthlyStatements: [
      { month: "2024-07", avgBalance: 48000, closingBalance: 51000, bouncedPayments: 0 },
      { month: "2024-08", avgBalance: 52000, closingBalance: 54000, bouncedPayments: 0 },
      { month: "2024-09", avgBalance: 55000, closingBalance: 57000, bouncedPayments: 0 },
      { month: "2024-10", avgBalance: 49000, closingBalance: 50000, bouncedPayments: 0 },
      { month: "2024-11", avgBalance: 51000, closingBalance: 53000, bouncedPayments: 0 },
      { month: "2024-12", avgBalance: 53000, closingBalance: 55000, bouncedPayments: 0 },
      { month: "2025-01", avgBalance: 50000, closingBalance: 52000, bouncedPayments: 0 },
      { month: "2025-02", avgBalance: 54000, closingBalance: 56000, bouncedPayments: 1 },
      { month: "2025-03", avgBalance: 47000, closingBalance: 49000, bouncedPayments: 0 },
      { month: "2025-04", avgBalance: 52000, closingBalance: 54000, bouncedPayments: 0 },
      { month: "2025-05", avgBalance: 56000, closingBalance: 58000, bouncedPayments: 0 },
      { month: "2025-06", avgBalance: 51000, closingBalance: 53000, bouncedPayments: 0 },
    ],
  },

  // Balance erodes steadily as revenue declines; bounces climb sharply in
  // the back half of the year (11 total).
  "documented-risky": {
    consentGranted: true,
    bankName: "HDFC Bank",
    monthlyStatements: [
      { month: "2024-07", avgBalance: 60000, closingBalance: 63000, bouncedPayments: 0 },
      { month: "2024-08", avgBalance: 58000, closingBalance: 60000, bouncedPayments: 0 },
      { month: "2024-09", avgBalance: 62000, closingBalance: 64000, bouncedPayments: 1 },
      { month: "2024-10", avgBalance: 55000, closingBalance: 57000, bouncedPayments: 0 },
      { month: "2024-11", avgBalance: 50000, closingBalance: 52000, bouncedPayments: 1 },
      { month: "2024-12", avgBalance: 53000, closingBalance: 54000, bouncedPayments: 0 },
      { month: "2025-01", avgBalance: 45000, closingBalance: 46000, bouncedPayments: 1 },
      { month: "2025-02", avgBalance: 38000, closingBalance: 39000, bouncedPayments: 1 },
      { month: "2025-03", avgBalance: 32000, closingBalance: 33000, bouncedPayments: 2 },
      { month: "2025-04", avgBalance: 28000, closingBalance: 28500, bouncedPayments: 1 },
      { month: "2025-05", avgBalance: 22000, closingBalance: 21000, bouncedPayments: 2 },
      { month: "2025-06", avgBalance: 18000, closingBalance: 17000, bouncedPayments: 2 },
    ],
  },

  // Moderate balance (~18-20% of revenue), 2 isolated bounces across the year.
  "average-stable": {
    consentGranted: true,
    bankName: "State Bank of India",
    monthlyStatements: [
      { month: "2024-07", avgBalance: 28000, closingBalance: 29000, bouncedPayments: 0 },
      { month: "2024-08", avgBalance: 30000, closingBalance: 31000, bouncedPayments: 1 },
      { month: "2024-09", avgBalance: 26000, closingBalance: 27000, bouncedPayments: 0 },
      { month: "2024-10", avgBalance: 29000, closingBalance: 30000, bouncedPayments: 1 },
      { month: "2024-11", avgBalance: 27000, closingBalance: 28000, bouncedPayments: 0 },
      { month: "2024-12", avgBalance: 31000, closingBalance: 32000, bouncedPayments: 0 },
      { month: "2025-01", avgBalance: 24000, closingBalance: 25000, bouncedPayments: 0 },
      { month: "2025-02", avgBalance: 28000, closingBalance: 29000, bouncedPayments: 0 },
      { month: "2025-03", avgBalance: 30000, closingBalance: 31000, bouncedPayments: 1 },
      { month: "2025-04", avgBalance: 26000, closingBalance: 27000, bouncedPayments: 0 },
      { month: "2025-05", avgBalance: 29000, closingBalance: 30000, bouncedPayments: 0 },
      { month: "2025-06", avgBalance: 32000, closingBalance: 33000, bouncedPayments: 0 },
    ],
  },
};
