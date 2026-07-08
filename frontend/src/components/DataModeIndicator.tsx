interface DataModeIndicatorProps {
  dataMode: "mock" | "live" | null;
}

export function DataModeIndicator({ dataMode }: DataModeIndicatorProps) {
  if (!dataMode) return null;
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
      <span className={`h-1.5 w-1.5 rounded-full ${dataMode === "mock" ? "bg-amber-500" : "bg-green-500"}`} />
      Data Mode: {dataMode === "mock" ? "Mock (Sandbox integration ready)" : "Live"}
    </div>
  );
}
