import type { DataSourceAdapter } from "./DataSourceAdapter.js";
import { MockAdapter } from "./MockAdapter.js";
import { LiveAdapter } from "./LiveAdapter.js";

export type DataMode = "mock" | "live";

export function getDataMode(): DataMode {
  const raw = (process.env.DATA_MODE ?? "mock").trim().toLowerCase();
  return raw === "live" ? "live" : "mock";
}

let cachedAdapter: DataSourceAdapter | null = null;
let cachedMode: DataMode | null = null;

/**
 * Returns the active DataSourceAdapter based on the DATA_MODE env variable.
 * Everything downstream of this factory only ever sees the
 * `DataSourceAdapter` interface — never `MockAdapter`/`LiveAdapter` directly.
 */
export function getDataSourceAdapter(): DataSourceAdapter {
  const mode = getDataMode();
  if (cachedAdapter && cachedMode === mode) {
    return cachedAdapter;
  }
  cachedAdapter = mode === "live" ? new LiveAdapter() : new MockAdapter();
  cachedMode = mode;
  return cachedAdapter;
}
