"use client";

import { useEffect, useMemo, useState } from "react";
import type { IntelligenceWorkspace, SignalBatch } from "@trend-pulse/contracts";
import { nextTwiceDailyRunUtc, planWikimediaForWorkspace } from "./source-planner";

const WORKSPACE_STORAGE_KEY = "trend-pulse.workspace.v1";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; batch: SignalBatch };

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function formatNumber(value?: number) {
  return typeof value === "number" ? value.toLocaleString() : "n/a";
}

function readWorkspace(): IntelligenceWorkspace | null {
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IntelligenceWorkspace;
    return parsed?.schemaVersion === "workspace.v1" ? parsed : null;
  } catch {
    return null;
  }
}

function workspaceScopeLabel(workspace: IntelligenceWorkspace | null) {
  if (!workspace) return "No saved workspace";
  const parts = [
    ...workspace.scope.categories,
    ...workspace.scope.industries,
    ...workspace.scope.geographies,
  ].filter(Boolean);
  return parts.length ? parts.slice(0, 3).join(" · ") : workspace.name;
}

export default function LiveSignals() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [workspace, setWorkspace] = useState<IntelligenceWorkspace | null>(null);
  const [workspaceSerialized, setWorkspaceSerialized] = useState("");
  const [showBackground, setShowBackground] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("./data/live-signals.json", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<SignalBatch>;
      })
      .then((batch) => {
        if (!cancelled) setState({ status: "ready", batch });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : "Unknown error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const syncWorkspace = () => {
      const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? "";
      if (raw !== workspaceSerialized) {
        setWorkspaceSerialized(raw);
        setWorkspace(readWorkspace());
        setShowBackground(false);
      }
    };
    syncWorkspace();
    const timer = window.setInterval(syncWorkspace, 600);
    return () => window.clearInterval(timer);
  }, [workspaceSerialized]);

  const plan = useMemo(() => {
    if (state.status !== "ready") return null;
    return planWikimediaForWorkspace(workspace, state.batch);
  }, [state, workspace]);

  const nextRun = useMemo(() => nextTwiceDailyRunUtc([7, 19], 17), [state.status, workspace?.updatedAt]);
  const shouldShowCards = state.status === "ready" && (!workspace || plan?.applicableToWorkspace || showBackground);

  return (
    <section className="signalSection" style={{ marginTop: 20 }}>
      <div className="sectionHeading">
        <div>
          <div className="eyebrow">BUILD STAGE 03R · WORKSPACE-AWARE SOURCE PLANNING</div>
          <h2>Workspace → source fit → collection scope → evidence.</h2>
          <p>
            A connected source is no longer assumed to fit every workspace. Trend Pulse evaluates source fit first, keeps broad feeds separate from workspace-scoped evidence, and applies the V1 global collection policy of two collection cycles per day.
          </p>
        </div>
        <span className="schemaTag">Source Planner v0 · provisional</span>
      </div>

      {state.status === "loading" ? <div className="demoWarning">LOADING REAL SIGNAL BATCH…</div> : null}
      {state.status === "error" ? <div className="demoWarning">REAL DATA UNAVAILABLE · {state.message}</div> : null}

      {state.status === "ready" && plan ? (
        <>
          <div className="monitoringCard" style={{ alignItems: "flex-start" }}>
            <div>
              <strong>Active workspace: {workspaceScopeLabel(workspace)}</strong>
              <p>{workspace ? `Scope saved ${formatDate(workspace.updatedAt)}. Source fit is re-evaluated automatically when this browser workspace changes.` : "Save a workspace to evaluate whether this source belongs in active intelligence."}</p>
            </div>
            <span>{plan.fit.toUpperCase()} FIT</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 12 }}>
            <div className="signalCard" style={{ padding: 15 }}>
              <div className="signalTopline"><span>SOURCE PLAN</span><span>{plan.runtimeStatus}</span></div>
              <h3 style={{ marginTop: 18 }}>{plan.sourceName}</h3>
              <p>{plan.reason}</p>
              <div className="signalMeta"><span>role {plan.role}</span><span>fit {plan.fit}</span><span>native freshness {plan.freshness}</span></div>
            </div>
            <div className="signalCard" style={{ padding: 15 }}>
              <div className="signalTopline"><span>GLOBAL REFRESH POLICY V1</span><span>AUTO</span></div>
              <h3 style={{ marginTop: 18 }}>Every source · twice daily</h3>
              <p>Trend Pulse V1 schedules two collection cycles per day for every active source. Native source freshness remains separate: if a source only publishes daily data, the second collection may observe the same upstream snapshot.</p>
              <div className="signalMeta"><span>cadence {state.batch.refreshPolicy?.cadence ?? "twice-daily"}</span><span>last {formatDate(state.batch.collectedAt)}</span><span>next {formatDate(nextRun)}</span></div>
              <button className="secondaryButton" type="button" disabled style={{ marginTop: 12, opacity: 0.55, cursor: "not-allowed" }} title="The static GitHub Pages preview cannot securely trigger the worker runtime.">
                Update now · runtime required
              </button>
            </div>
          </div>

          {!plan.applicableToWorkspace && workspace ? (
            <div className="demoWarning">
              SOURCE NOT APPLIED TO ACTIVE WORKSPACE · The {state.batch.count} Wikimedia observations remain a broad background feed and are excluded from workspace evidence by default. A HIGH-fit primary source is still missing for this scope.
            </div>
          ) : null}

          <div className="monitoringCard">
            <div>
              <strong>{state.batch.scopeLabel}</strong>
              <p>{state.batch.query} · {state.batch.timespan}</p>
            </div>
            <span>{state.batch.count} REAL OBSERVATIONS</span>
          </div>
          <div className="signalMeta" style={{ marginBottom: 14 }}>
            <span>collection scope {state.batch.collectionScope?.mode ?? "legacy"}</span>
            <span>languages {(state.batch.collectionScope?.languages ?? []).join(" + ") || "unspecified"}</span>
            <span>collection cadence {state.batch.refreshPolicy?.cadence ?? "unspecified"}</span>
            <span>effective source freshness {state.batch.effectiveFreshness}</span>
            <span>source {state.batch.sourceId}</span>
          </div>

          {!shouldShowCards ? (
            <div className="candidateEmpty" style={{ paddingTop: 6 }}>
              <strong>Background observations hidden.</strong>
              <p>They are real source data, but they do not match the active workspace strongly enough to be treated as current evidence.</p>
              <button className="secondaryButton" type="button" onClick={() => setShowBackground(true)} style={{ marginTop: 10 }}>View background feed</button>
            </div>
          ) : (
            <div className="signalGrid">
              {state.batch.signals.slice(0, 16).map((signal) => (
                <article className="signalCard" key={signal.id}>
                  <div className="signalTopline">
                    <span>{signal.language ?? signal.source.sourceName}</span>
                    <span>{signal.metrics.sourceRank ? `source rank #${signal.metrics.sourceRank}` : "rank n/a"}</span>
                  </div>
                  <h3>{signal.topic}</h3>
                  <p>{signal.evidence.reference}</p>
                  <div className="signalMeta">
                    <span>{formatNumber(signal.metrics.views)} views</span>
                    <span>{signal.contentType ?? "observation"}</span>
                    <span>{workspace && !plan.applicableToWorkspace ? "background only" : "workspace-usable"}</span>
                  </div>
                  <div className="contractTrace">
                    <span>official API</span><b>→</b><span>collection scope</span><b>→</b><span>source fit</span><b>→</b><span>evidence</span>
                  </div>
                  {signal.evidence.sourceUrl ? (
                    <p style={{ marginTop: 14 }}>
                      <a href={signal.evidence.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>Open source evidence ↗</a>
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
