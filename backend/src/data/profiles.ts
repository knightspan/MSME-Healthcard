import type { MSMEProfileMeta } from "../types/index.js";

// The 3 hero MSME profiles for the demo. IDs are stable and referenced
// across all data source mock files below.
export const MSME_PROFILES: MSMEProfileMeta[] = [
  {
    id: "thin-file-ntc",
    name: "Shree Balaji Hardware Store",
    businessType: "Hardware & Building Materials Retail",
    shortDescription:
      "14-month UPI history, no ITR or prior credit — thin-file, New-to-Credit retailer with steady turnover.",
  },
  {
    id: "documented-risky",
    name: "Vinayak Trading Co.",
    businessType: "Wholesale Trading (FMCG Distribution)",
    shortDescription:
      "Has ITR and prior credit history, but recent GST lapses, declining inflow, and shrinking payroll.",
  },
  {
    id: "average-stable",
    name: "Green Leaf Textiles",
    businessType: "Textile Manufacturing (Small Unit)",
    shortDescription:
      "Moderate, stable performance across all four data sources with typical minor variance.",
  },
];

export const MSME_PROFILE_IDS = MSME_PROFILES.map((p) => p.id);

export function getProfileMeta(id: string): MSMEProfileMeta | undefined {
  return MSME_PROFILES.find((p) => p.id === id);
}
