import type { DataSourceAdapter } from "../adapters/DataSourceAdapter.js";
import type { NormalizedMSMEData } from "../types/index.js";
import { coefficientOfVariationPct, mean, round1, trendPct } from "./mathUtils.js";

/**
 * Fetches raw data for an MSME via the adapter interface (never raw mock
 * data directly) and maps it into the unified NormalizedMSMEData schema
 * that the scoring engine consumes.
 */
export async function normalizeMSMEData(
  msmeId: string,
  adapter: DataSourceAdapter
): Promise<NormalizedMSMEData> {
  const [gst, upi, aa, epfo] = await Promise.all([
    adapter.getGSTData(msmeId),
    adapter.getUPIData(msmeId),
    adapter.getAAData(msmeId),
    adapter.getEPFOData(msmeId),
  ]);

  const dataSourcesAvailable: string[] = [];
  if (gst) dataSourcesAvailable.push("GST");
  if (upi) dataSourcesAvailable.push("UPI");
  if (aa) dataSourcesAvailable.push("AA");
  if (epfo) dataSourcesAvailable.push("EPFO");

  // --- Revenue: prefer continuous UPI inflow; fall back to filed GST months. ---
  const upiInflows = upi?.monthlyTransactions.map((t) => t.inflowAmount) ?? [];
  const filedGstTurnovers =
    gst?.monthlyFilings.filter((f) => f.filed).map((f) => f.gstr3bTurnover) ?? [];

  const revenueSeries = upiInflows.length > 0 ? upiInflows : filedGstTurnovers;
  const monthly_revenue = round1(mean(revenueSeries));
  const revenue_variance_pct = round1(coefficientOfVariationPct(revenueSeries));

  // --- Compliance: % of months GST was filed on time (out of total tracked months). ---
  const totalGstMonths = gst?.monthlyFilings.length ?? 0;
  const onTimeMonths = gst?.monthlyFilings.filter((f) => f.filedOnTime).length ?? 0;
  const filing_regularity_pct =
    totalGstMonths > 0 ? round1((onTimeMonths / totalGstMonths) * 100) : 0;

  // --- Cash flow: average AA balance + total bounced payments. ---
  const avgBalances = aa?.monthlyStatements.map((s) => s.avgBalance) ?? [];
  const avg_bank_balance = round1(mean(avgBalances));
  const bounced_payment_count =
    aa?.monthlyStatements.reduce((sum, s) => sum + s.bouncedPayments, 0) ?? 0;

  // --- Payroll: trend of headcount over the tracked period, null if no EPFO. ---
  let payroll_headcount_trend_pct: number | null = null;
  if (epfo && epfo.monthlyRecords.length >= 2) {
    const headcounts = epfo.monthlyRecords.map((r) => r.headcount);
    payroll_headcount_trend_pct = round1(trendPct(headcounts));
  }

  // --- Overall data depth: longest history among available sources. ---
  const monthCounts = [
    upi?.monthlyTransactions.length ?? 0,
    gst?.monthlyFilings.length ?? 0,
    aa?.monthlyStatements.length ?? 0,
    epfo?.monthlyRecords.length ?? 0,
  ];
  const months_of_data_available = Math.max(...monthCounts);

  return {
    monthly_revenue,
    revenue_variance_pct,
    filing_regularity_pct,
    avg_bank_balance,
    bounced_payment_count,
    payroll_headcount_trend_pct,
    months_of_data_available,
    data_sources_available: dataSourcesAvailable,
  };
}
