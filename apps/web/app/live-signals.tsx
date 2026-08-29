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

function formatNumber(value?: number) {
  return typeof value === "number" ? value.toLocaleString() : "n/a";
}

export default function LiveSignals() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

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

  return (
    <section className="signalSection" style={{ marginTop: 20 }}>
      <div className="sectionHeading">
        <div>
          <div className="eyebrow">BUILD STAGE 03 · REAL CULTURAL ATTENTION SOURCE</div>
          <h2>Wikimedia pageviews → normalized Signal v1.</h2>
          <p>
            This is the first live data-loop proof. The build collects top viewed pages from Wikimedia, preserves source evidence and real view counts, then normalizes them before publishing the Pages artifact. These observations are not trend conclusions yet.
          </p>
        </div>
        <span className="schemaTag">Wikimedia Pageviews · daily</span>
      </div>

      {state.status === "loading" ? <div className="demoWarning">LOADING REAL SIGNAL BATCH…</div> : null}
      {state.status === "error" ? <div className="demoWarning">REAL DATA UNAVAILABLE · {state.message}</div> : null}

      {state.status === "ready" ? (
        <>
          <div className="monitoringCard">
            <div>
              <strong>{state.batch.scopeLabel}</strong>
              <p>{state.batch.query} · {state.batch.timespan}</p>
            </div>
            <span>{state.batch.count} REAL OBSERVATIONS</span>
          </div>
          <div className="signalMeta" style={{ marginBottom: 14 }}>
            <span>collected {formatDate(state.batch.collectedAt)}</span>
            <span>effective freshness {state.batch.effectiveFreshness}</span>
            <span>source {state.batch.sourceId}</span>
          </div>
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
                  <span>confidence provisional {Math.round(signal.confidence.score * 100)}%</span>
                </div>
                <div className="contractTrace">
                  <span>official API</span><b>→</b><span>normalize</span><b>→</b><span>signal.v1</span><b>→</b><span>evidence</span>
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
