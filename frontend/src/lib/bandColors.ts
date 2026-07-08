import type { ScoreBand } from "../types";

export const BAND_COLORS: Record<ScoreBand, string> = {
  Poor: "#dc2626", // red-600
  Bad: "#f97316", // orange-500
  Average: "#eab308", // yellow-500
  Good: "#65a30d", // light green (lime-600)
  Excellent: "#15803d", // dark green (green-700)
};

export const BAND_BG_CLASSES: Record<ScoreBand, string> = {
  Poor: "bg-red-50 text-red-700 border-red-200",
  Bad: "bg-orange-50 text-orange-700 border-orange-200",
  Average: "bg-yellow-50 text-yellow-700 border-yellow-200",
  Good: "bg-lime-50 text-lime-700 border-lime-200",
  Excellent: "bg-green-50 text-green-800 border-green-200",
};

export const BAND_ORDER: ScoreBand[] = ["Poor", "Bad", "Average", "Good", "Excellent"];
export const BAND_RANGES: Record<ScoreBand, [number, number]> = {
  Poor: [0, 20],
  Bad: [21, 40],
  Average: [41, 60],
  Good: [61, 80],
  Excellent: [81, 100],
};
