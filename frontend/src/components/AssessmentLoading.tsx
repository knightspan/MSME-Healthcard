const STEPS = ["GST filings", "UPI transactions", "Account Aggregator data", "EPFO payroll records"];

export function AssessmentLoading() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white px-6 py-16 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-100 border-t-teal-600" />
      <p className="mt-4 text-sm font-medium text-slate-700">
        Analyzing {STEPS.join(", ")}
        {"… "}
      </p>
      <p className="mt-1 text-xs text-slate-400">Running scoring engine and generating underwriter narrative</p>
    </div>
  );
}
