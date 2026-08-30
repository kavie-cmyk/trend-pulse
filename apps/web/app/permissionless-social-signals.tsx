"use client";

import { useEffect, useState } from "react";
import type { Signal, SignalBatch } from "@trend-pulse/contracts";

type OpenSocialSignal = Signal & {
  metrics: Signal["metrics"] & { native?: Record<string, number> };
};

type OpenSocialBatch = Omit<SignalBatch, "signals"> & { signals: OpenSocialSignal[] };

type ConnectorState = {
  sourceId: string;
  family: string;
  state: string;
  access: string;
  note: string;
};

type OpenSocialSnapshot = {
  schemaVersion: "permissionless-social-snapshot.v1";
  collectedAt: string;
  collectionPolicy: { cadence: string; scheduleUtc: string[] };
  minimumOperationalSources: number;
  sourceCount: number;
  observationCount: number;
  batches: OpenSocialBatch[];
  connectorStates: ConnectorState[];
  failures: Array<{ sourceId: string; family: string; required: boolean; error: string }>;
  notes: string[];
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; snapshot: OpenSocialSnapshot };

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function nativeMetrics(signal: OpenSocialSignal) {
  const native = signal.metrics.native ?? {};
  const parts = Object.entries(native)
    .filter(([, value]) => Number.isFinite(value))
    .slice(0, 4)
    .map(([key, value]) => `${key} ${Number(value).toLocaleString()}`);
  return parts.length ? parts.join(" · ") : "source-native metric unavailable";
}

function label(value: string) {
  return value.replaceAll("-", " ").toUpperCase();
}

export default function PermissionlessSocialSignals() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("./data/permissionless-social-signals.json", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<OpenSocialSnapshot>;
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
          <div className="eyebrow">BUILD STAGE 04B-4 · PERMISSIONLESS SOCIAL EXPANSION</div>
          <h2>Public, free, no-approval social/community sources before access-gated networks.</h2>
          <p>
            This layer expands universal discovery with permissionless read paths. Public availability does not make a source globally representative: instance, community and audience bias stay explicit until workspace planning and cross-source corroboration.
          </p>
        </div>
        <span className="schemaTag">permissionless-social-snapshot.v1</span>
      </div>

      {state.status === "loading" ? <div className="demoWarning">LOADING PERMISSIONLESS SOCIAL SNAPSHOT…</div> : null}
      {state.status === "error" ? <div className="demoWarning">PERMISSIONLESS SOCIAL DATA UNAVAILABLE · {state.message}</div> : null}

      {state.status === "ready" ? (
        <>
          <div className="monitoringCard" style={{ alignItems: "flex-start" }}>
            <div>
              <strong>{state.snapshot.sourceCount} operational public source batches · {state.snapshot.observationCount} real observations</strong>
              <p>
                Collected {formatDate(state.snapshot.collectedAt)}. Gate: at least {state.snapshot.minimumOperationalSources} operational sources. Collection remains {state.snapshot.collectionPolicy.cadence} at {state.snapshot.collectionPolicy.scheduleUtc.join(" + ")} UTC.
              </p>
            </div>
            <span>NO APPROVAL</span>
          </div>

          {state.snapshot.failures.length ? (
            <div className="demoWarning">
              RUNTIME-DEFERRED · {state.snapshot.failures.map((failure) => `${failure.sourceId}: ${failure.error}`).join(" | ")}
            </div>
          ) : null}

          <div className="signalGrid">
            {state.snapshot.batches.map((batch) => (
              <article className="signalCard" key={batch.sourceId}>
                <div className="signalTopline"><span>PUBLIC / NO AUTH</span><span>{batch.count} OBS</span></div>
                <h3>{batch.scopeLabel}</h3>
                <p>{batch.query}</p>
                <div className="signalMeta">
                  <span>native freshness {batch.effectiveFreshness}</span>
                  <span>collection {batch.refreshPolicy?.cadence ?? "twice-daily"}</span>
                </div>
                <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                  {batch.signals.slice(0, 5).map((signal) => (
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
                <div className="eyebrow">PERMISSIONLESS ACCESS MAP</div>
                <h3>Runtime verification outranks documentation assumptions.</h3>
                <p>A documented public path is promoted only when the twice-daily runner can actually collect it. Failed sources remain deferred instead of receiving fallback/mock data.</p>
              </div>
              <span className="autoBadge">{state.snapshot.connectorStates.length} PATHS TRACKED</span>
            </div>
            <div className="signalGrid">
              {state.snapshot.connectorStates.map((connector) => (
                <article className="signalCard" key={connector.sourceId}>
                  <div className="signalTopline"><span>{label(connector.state)}</span><span>{connector.access}</span></div>
                  <h3>{connector.sourceId}</h3>
                  <p>{connector.note}</p>
                </article>
              ))}
            </div>
          </section>

          <div className="logicCallout" style={{ marginTop: 16 }}>
            <strong>Coverage rule:</strong> Mastodon instances, Lemmy instances, Forem communities and Stack Exchange sites are configurable source instances, not hard-coded market definitions. Trend Pulse may add more public instances/sites later without changing the Signal contract or downstream trend engine.
          </div>
        </>
      ) : null}
    </section>
  );
}
