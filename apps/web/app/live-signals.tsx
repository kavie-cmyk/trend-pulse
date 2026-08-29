"use client";

import { useEffect, useState } from "react";
import type { SignalBatch } from "@trend-pulse/contracts";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; batch: SignalBatch };

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function LiveSignals() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("./data/gdelt-signals.json", { cache: "no-store" })
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

  return (
    <section className="signalSection" style={{ marginTop: 20 }}>
      <div className="sectionHeading">
        <div>
          <div className="eyebrow">BUILD STAGE 03 · LIVE SOURCE</div>
          <h2>Real GDELT observations → normalized Signal v1.</h2>
          <p>
            This is the first real connector proof. The scheduled GitHub build fetches GDELT, normalizes observations, and publishes the resulting evidence with the Pages artifact. It is not trend detection yet.
          </p>
        </div>
        <span className="schemaTag">GDELT DOC 2.0 · hourly collector</span>
      </div>

      {state.status === "loading" ? <div className="demoWarning">LOADING LIVE SIGNAL BATCH…</div> : null}
      {state.status === "error" ? <div className="demoWarning">LIVE DATA UNAVAILABLE · {state.message}</div> : null}

      {state.status === "ready" ? (
        <>
          <div className="monitoringCard">
            <div>
              <strong>{state.batch.scopeLabel}</strong>
              <p>Query: {state.batch.query} · window: {state.batch.timespan}</p>
            </div>
            <span>{state.batch.count} REAL OBSERVATIONS</span>
          </div>
          <div className="signalMeta" style={{ marginBottom: 14 }}>
            <span>collected {formatDate(state.batch.collectedAt)}</span>
            <span>effective freshness {state.batch.effectiveFreshness}</span>
            <span>source {state.batch.sourceId}</span>
          </div>
          <div className="signalGrid">
            {state.batch.signals.slice(0, 12).map((signal) => (
              <article className="signalCard" key={signal.id}>
                <div className="signalTopline">
                  <span>{signal.creator ?? signal.source.sourceName}</span>
                  <span>{signal.language ?? "language n/a"}</span>
                </div>
                <h3>{signal.topic}</h3>
                <p>{formatDate(signal.observedAt)}</p>
                <div className="signalMeta">
                  <span>{signal.source.sourceName}</span>
                  <span>{signal.contentType ?? "observation"}</span>
                  <span>confidence provisional {Math.round(signal.confidence.score * 100)}%</span>
                </div>
                <div className="contractTrace">
                  <span>real source</span><b>→</b><span>normalize</span><b>→</b><span>signal.v1</span><b>→</b><span>evidence</span>
                </div>
                {signal.evidence.sourceUrl ? (
                  <p style={{ marginTop: 14 }}>
                    <a href={signal.evidence.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                      Open source evidence ↗
                    </a>
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
