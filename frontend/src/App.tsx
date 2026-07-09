import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { AssessmentResponse, MSMEProfileMeta } from "./types";
import { downloadCreditMemo, fetchProfiles, runAssessment } from "./lib/api";
import { ProfileSelector } from "./components/ProfileSelector";
import { ScoreGauge } from "./components/ScoreGauge";
import { PillarRadarChart } from "./components/PillarRadarChart";
import { PillarBreakdown } from "./components/PillarBreakdown";
import { NarrativeCard } from "./components/NarrativeCard";
import { FlagBadges } from "./components/FlagBadges";
import { OcenPanel } from "./components/OcenPanel";
import { DataModeIndicator } from "./components/DataModeIndicator";
import { AssessmentLoading } from "./components/AssessmentLoading";
import { ChatPanel } from "./components/ChatPanel";
import { PortfolioView } from "./components/PortfolioView";
import { WhatIfSimulator } from "./components/WhatIfSimulator";

type View = "assessment" | "portfolio";

function App() {
  const [view, setView] = useState<View>("assessment");
  const [profiles, setProfiles] = useState<MSMEProfileMeta[]>([]);
  const [dataMode, setDataMode] = useState<"mock" | "live" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssessmentResponse | null>(null);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [memoDownloading, setMemoDownloading] = useState(false);
  const [memoError, setMemoError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfiles()
      .then((data) => {
        setProfiles(data.profiles);
        setDataMode(data.data_mode);
        if (data.profiles.length > 0) setSelectedId(data.profiles[0].id);
      })
      .catch((err: Error) => setProfilesError(err.message));
  }, []);

  async function handleRunAssessment(idOverride?: string) {
    const idToRun = idOverride ?? selectedId;
    if (!idToRun) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await runAssessment(idToRun);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong running the assessment.");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectFromPortfolio(id: string) {
    setView("assessment");
    setSelectedId(id);
    setError(null);
    handleRunAssessment(id);
  }

  async function handleDownloadMemo() {
    if (!selectedId) return;
    setMemoDownloading(true);
    setMemoError(null);
    try {
      await downloadCreditMemo(selectedId, selectedId);
    } catch (err) {
      setMemoError(err instanceof Error ? err.message : "Could not generate the credit memo.");
    } finally {
      setMemoDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">MSME Financial Health Card</h1>
            <p className="text-sm text-slate-500">
              Alternate-data credit assessment for New-to-Credit &amp; New-to-Bank MSMEs
            </p>
          </div>
          <DataModeIndicator dataMode={dataMode} />
        </div>
        <div className="mx-auto flex max-w-7xl gap-2 px-6 pb-3">
          <TabButton active={view === "assessment"} onClick={() => setView("assessment")}>
            Assessment
          </TabButton>
          <TabButton active={view === "portfolio"} onClick={() => setView("portfolio")}>
            Portfolio
          </TabButton>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {view === "portfolio" ? (
          <PortfolioView onSelectMsme={handleSelectFromPortfolio} />
        ) : (
          <>
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
                1. Select an MSME Profile
              </h2>
              {profilesError ? (
                <p className="mt-3 text-sm text-red-600">
                  Could not load profiles: {profilesError}. Is the backend running on port 4000?
                </p>
              ) : (
                <div className="mt-3">
                  <ProfileSelector
                    profiles={profiles}
                    selectedId={selectedId}
                    onSelect={(id) => {
                      setSelectedId(id);
                      setResult(null);
                      setError(null);
                      setMemoError(null);
                    }}
                    disabled={loading}
                  />
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleRunAssessment()}
                  disabled={!selectedId || loading}
                  className="rounded-md bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {loading ? "Running Assessment…" : "Run Assessment"}
                </button>

                {result && !loading && (
                  <>
                    <button
                      type="button"
                      onClick={handleDownloadMemo}
                      disabled={memoDownloading}
                      className="rounded-md border border-teal-700 px-5 py-2.5 text-sm font-semibold text-teal-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
                    >
                      {memoDownloading ? "Generating PDF…" : "Download Credit Memo"}
                    </button>
                    <span className="text-xs text-slate-400">
                      Completed in {(result.elapsed_ms / 1000).toFixed(2)}s
                    </span>
                  </>
                )}
              </div>
              {memoError && <p className="mt-2 text-xs text-red-600">Could not generate memo: {memoError}</p>}
            </section>

            {loading && <AssessmentLoading />}

            {error && !loading && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                <span className="font-semibold">Assessment failed:</span> {error}
              </div>
            )}

            {result && !loading && (
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1 space-y-6">
                  <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-white p-5">
                      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                        Composite Financial Health Score
                      </h2>
                      <ScoreGauge score={result.score.composite_score} band={result.score.band} />
                      <p className="mt-3 text-center text-xs text-slate-500">
                        {result.profile.name} &middot; {result.profile.businessType}
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-5">
                      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
                        4-Pillar Radar
                      </h2>
                      <PillarRadarChart pillars={result.score.pillars} />
                      {result.score.reweighted && (
                        <p className="mt-1 text-center text-[11px] text-slate-400">
                          * An axis pinned at 0 means that pillar had no data and was excluded — its weight was
                          redistributed, not scored as a risk.
                        </p>
                      )}
                    </div>
                  </section>

                  <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <PillarBreakdown
                      pillars={result.score.pillars}
                      reweighted={result.score.reweighted}
                      reweightNote={result.score.reweight_note}
                    />
                    <NarrativeCard narrative={result.narrative} />
                  </section>

                  <FlagBadges riskFlags={result.score.risk_flags} strengthFlags={result.score.strength_flags} />

                  <OcenPanel payload={result.ocen} />

                  <WhatIfSimulator
                    msmeId={result.profile.id}
                    baselineNormalized={result.normalized}
                    baselineScore={result.score}
                  />
                </div>

                <ChatPanel msmeId={selectedId} msmeName={result.profile.name} />
              </div>
            )}

            {!result && !loading && !error && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-10 text-center text-sm text-slate-400">
                Select a profile above and click "Run Assessment" to generate the Financial Health Card.
              </div>
            )}
          </>
        )}
      </main>

      <footer className="mx-auto max-w-7xl px-6 pb-8 text-center text-xs text-slate-400">
        Built for IDBI Innovation Hackathon — Problem Statement 3 · Provider-agnostic adapter architecture,
        deterministic explainable scoring, OCEN-compatible output.
      </footer>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-teal-700 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

export default App;
