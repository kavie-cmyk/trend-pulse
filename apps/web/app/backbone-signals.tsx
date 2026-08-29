"use client";

import { useEffect, useState } from "react";
import type { Signal, SignalBatch } from "@trend-pulse/contracts";

type BackboneSignal = Signal & {
  metrics: Signal["metrics"] & { native?: Record<string, number> };
};

type BackboneBatch = Omit<SignalBatch, "signals"> & { signals: BackboneSignal[] };

type BackboneSnapshot = {
  schemaVersion: "source-backbone-snapshot.v1";
  collectedAt: string;
  collectionPolicy: { cadence: string; scheduleUtc: string[] };
  sourceCount: number;
  observationCount: number;
  batches: BackboneBatch[];
  failures: Array<{ sourceId: string; required: boolean; error: string }>;
  notes: string[];
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; snapshot: BackboneSnapshot };

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function nativeMetricSummary(signal: BackboneSignal) {
  const native = signal.metrics.native ?? {};
  const parts = Object.entries(native)
    .filter(([, value]) => Number.isFinite(value))
    .slice(0, 3)
    .map(([key, value]) => `${key} ${Number(value).toLocaleString()}`);
  if (signal.metrics.comments) parts.push(`comments ${signal.metrics.comments.toLocaleString()}`);
  return parts.length ? parts.join(" · ") : "no comparable engagement metric";
}

export default function BackboneSignals() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("./data/backbone-signals.json", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<BackboneSnapshot>;
      })
      .then((snapshot) => {
        if (!cancelled) setState({ status: "ready", snapshot });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : "Unknown error" });
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="signalSection" style={{ marginTop: 22 }}>
      <div className="sectionHeading">
        <div>
          <div className="eyebrow">BUILD STAGE 04B-2 · GLOBAL CONNECTOR BACKBONE</div>
          <h2>Real multi-source observations, collected on one global twice-daily policy.</h2>
          <p>
            This layer proves the platform can collect multiple independent source families before workspace-specific clustering. These observations are evidence inputs only — they are not yet Trend Candidates, Virality scores or marketing recommendations.
          </p>
        </div>
        <span className="schemaTag">source-backbone-snapshot.v1</span>
      </div>

      {state.status === "loading" ? <div className="demoWarning">LOADING BACKBONE SNAPSHOT…</div> : null}
      {state.status === "error" ? <div className="demoWarning">BACKBONE DATA UNAVAILABLE · {state.message}</div> : null}

      {state.status === "ready" ? (
        <>
          <div className="monitoringCard" style={{ alignItems: "flex-start" }}>
            <div>
              <strong>{state.snapshot.sourceCount} live source batches · {state.snapshot.observationCount} real observations</strong>
              <p>Collected {formatDate(state.snapshot.collectedAt)}. Global V1 collection cadence: twice daily at {state.snapshot.collectionPolicy.scheduleUtc.join(" + ")} UTC.</p>
            </div>
            <span>TWICE DAILY</span>
          </div>

          {state.snapshot.failures.length ? (
            <div className="demoWarning">
              SOURCE RUNTIME NOTES · {state.snapshot.failures.map((failure) => `${failure.sourceId}: ${failure.error}`).join(" | ")}
            </div>
          ) : null}

          <div className="signalGrid">
            {state.snapshot.batches.map((batch) => (
              <article className="signalCard" key={batch.sourceId}>
                <div className="signalTopline"><span>LIVE SOURCE</span><span>{batch.count} OBS</span></div>
                <h3>{batch.scopeLabel}</h3>
                <p>{batch.query}</p>
                <div className="signalMeta">
                  <span>native freshness {batch.effectiveFreshness}</span>
                  <span>collection {batch.refreshPolicy?.cadence ?? "twice-daily"}</span>
                </div>
                <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                  {batch.signals.slice(0, 4).map((signal) => (
                    <div key={signal.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                      <strong>{signal.topic}</strong>
                      <p style={{ margin: "6px 0" }}>{nativeMetricSummary(signal)}</p>
                      {signal.evidence.sourceUrl ? (
                        <a href={signal.evidence.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>Open evidence ↗</a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="logicCallout" style={{ marginTop: 16 }}>
            <strong>Normalization boundary:</strong> HN points, GitHub stars/forks, publisher-feed position and Wikimedia views remain source-native metrics. Trend Pulse stores them without pretending they are directly comparable; cross-source normalization and corroboration belong to later stages.
          </div>
        </>
      ) : null}
    </section>
  );
}
