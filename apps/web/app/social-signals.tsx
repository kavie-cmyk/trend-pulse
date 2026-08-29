"use client";

import { useEffect, useState } from "react";
import type { Signal, SignalBatch } from "@trend-pulse/contracts";

type SocialSignal = Signal & {
  metrics: Signal["metrics"] & { native?: Record<string, number> };
};

type SocialBatch = Omit<SignalBatch, "signals"> & { signals: SocialSignal[] };

type ConnectorState = {
  sourceId: string;
  state: string;
  access: string;
  note: string;
};

type SocialSnapshot = {
  schemaVersion: "social-backbone-snapshot.v1";
  collectedAt: string;
  collectionPolicy: { cadence: string; scheduleUtc: string[] };
  sourceCount: number;
  observationCount: number;
  batches: SocialBatch[];
  connectorStates: ConnectorState[];
  failures: Array<{ sourceId: string; required: boolean; error: string }>;
  notes: string[];
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; snapshot: SocialSnapshot };

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function nativeMetrics(signal: SocialSignal) {
  const native = signal.metrics.native ?? {};
  const parts = Object.entries(native)
    .filter(([, value]) => Number.isFinite(value))
    .slice(0, 4)
    .map(([key, value]) => `${key} ${Number(value).toLocaleString()}`);
  return parts.length ? parts.join(" · ") : "source-native count unavailable";
}

function stateLabel(state: string) {
  return state.replaceAll("-", " ").toUpperCase();
}

export default function SocialSignals() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("./data/social-signals.json", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<SocialSnapshot>;
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
          <div className="eyebrow">BUILD STAGE 04B-3 · SOCIAL SIGNAL BACKBONE</div>
          <h2>Social evidence is now a first-class source family, not an afterthought.</h2>
          <p>
            The preview collects a real public social-trend source and keeps credential-gated or eligibility-gated networks explicit. A platform-native “trend” remains only one source observation until Trend Pulse corroborates it across independent source families.
          </p>
        </div>
        <span className="schemaTag">social-backbone-snapshot.v1</span>
      </div>

      {state.status === "loading" ? <div className="demoWarning">LOADING SOCIAL SNAPSHOT…</div> : null}
      {state.status === "error" ? <div className="demoWarning">SOCIAL DATA UNAVAILABLE · {state.message}</div> : null}

      {state.status === "ready" ? (
        <>
          <div className="monitoringCard" style={{ alignItems: "flex-start" }}>
            <div>
              <strong>{state.snapshot.sourceCount} active social batch · {state.snapshot.observationCount} real social observations</strong>
              <p>Collected {formatDate(state.snapshot.collectedAt)}. Locked collection policy: {state.snapshot.collectionPolicy.cadence} at {state.snapshot.collectionPolicy.scheduleUtc.join(" + ")} UTC.</p>
            </div>
            <span>SOCIAL LIVE</span>
          </div>

          {state.snapshot.failures.length ? (
            <div className="demoWarning">
              SOCIAL RUNTIME NOTES · {state.snapshot.failures.map((failure) => `${failure.sourceId}: ${failure.error}`).join(" | ")}
            </div>
          ) : null}

          <div className="signalGrid">
            {state.snapshot.batches.map((batch) => (
              <article className="signalCard" key={batch.sourceId}>
                <div className="signalTopline"><span>LIVE SOCIAL SOURCE</span><span>{batch.count} OBS</span></div>
                <h3>{batch.scopeLabel}</h3>
                <p>{batch.query}</p>
                <div className="signalMeta">
                  <span>native freshness {batch.effectiveFreshness}</span>
                  <span>collection {batch.refreshPolicy?.cadence ?? "twice-daily"}</span>
                </div>
                <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                  {batch.signals.slice(0, 6).map((signal) => (
                    <div key={signal.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                      <strong>{signal.topic}</strong>
                      <p style={{ margin: "6px 0" }}>{nativeMetrics(signal)}</p>
                      {signal.evidence.sourceUrl ? (
                        <a href={signal.evidence.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>Open evidence ↗</a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <section className="entityPanel" style={{ marginTop: 16 }}>
            <div className="entityPanelHeader">
              <div>
                <div className="eyebrow">SOCIAL ACCESS MAP</div>
                <h3>Useful source ≠ available connector.</h3>
                <p>Trend Pulse keeps access state visible instead of silently scraping a network when official access is missing.</p>
              </div>
              <span className="autoBadge">{state.snapshot.connectorStates.length} SOURCES TRACKED</span>
            </div>
            <div className="signalGrid">
              {state.snapshot.connectorStates.map((connector) => (
                <article className="signalCard" key={connector.sourceId}>
                  <div className="signalTopline"><span>{stateLabel(connector.state)}</span><span>{connector.access}</span></div>
                  <h3>{connector.sourceId}</h3>
                  <p>{connector.note}</p>
                </article>
              ))}
            </div>
          </section>

          <div className="logicCallout" style={{ marginTop: 16 }}>
            <strong>Social evidence boundary:</strong> platform-native post counts, views, likes, comments and trend labels remain native metrics. They are not directly compared across networks and do not become Trend Pulse Virality until cross-source normalization and corroboration are implemented.
          </div>
        </>
      ) : null}
    </section>
  );
}
