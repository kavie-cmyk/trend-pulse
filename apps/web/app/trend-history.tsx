"use client";

import { useEffect, useMemo, useState } from "react";
import type { TrendHistoryCycleSnapshot } from "@trend-pulse/contracts/trend-history";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; cycle: TrendHistoryCycleSnapshot };

function label(value: string) {
  return value.replaceAll("-", " ").toUpperCase();
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function TrendHistory() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("./data/trend-history.json", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<TrendHistoryCycleSnapshot>;
      })
      .then((cycle) => {
        if (!cancelled) setState({ status: "ready", cycle });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : "Unknown error" });
      });
    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(() => {
    if (state.status !== "ready") return { new: 0, continuing: 0, reappeared: 0 };
    return state.cycle.current.reduce(
      (acc, item) => {
        acc[item.presence] += 1;
        return acc;
      },
      { new: 0, continuing: 0, reappeared: 0 },
    );
  }, [state]);

  return (
    <section className="signalSection" style={{ marginTop: 22 }}>
      <div className="sectionHeading">
        <div>
          <div className="eyebrow">BUILD STAGE 04D · PERSISTENT MULTI-CYCLE TREND HISTORY</div>
          <h2>Trend lineage survives across scheduled collection cycles.</h2>
          <p>
            Stage 04D separates snapshot candidate IDs from persistent lineage IDs. The canonical baseline lives on a dedicated GitHub history branch and only scheduled twice-daily runs may advance it; push/manual runs are QA-only.
          </p>
        </div>
        <span className="schemaTag">trend-history-cycle.v1</span>
      </div>

      {state.status === "loading" ? <div className="demoWarning">LOADING TREND HISTORY…</div> : null}
      {state.status === "error" ? <div className="demoWarning">TREND HISTORY UNAVAILABLE · {state.message}</div> : null}

      {state.status === "ready" ? (
        <>
          <div className="monitoringCard" style={{ alignItems: "flex-start" }}>
            <div>
              <strong>{label(state.cycle.cyclePurpose)} · {label(state.cycle.comparisonWindow)} · {state.cycle.currentCandidateCount} current candidates</strong>
              <p>
                Cycle {state.cycle.cycleId} · current snapshot {formatDate(state.cycle.currentTrendSnapshotGeneratedAt)} · previous scheduled baseline {formatDate(state.cycle.previousSnapshotGeneratedAt)}
                {state.cycle.cycleGapHours == null ? "" : ` · gap ${state.cycle.cycleGapHours}h`}.
              </p>
            </div>
            <span>{state.cycle.persistenceEligible ? "SCHEDULED · PERSIST" : "QA · NO PERSIST"}</span>
          </div>

          <div className="signalGrid" style={{ marginTop: 16 }}>
            <article className="signalCard">
              <div className="signalTopline"><span>LINEAGE</span><span>{state.cycle.trackedLineageCount} TRACKED</span></div>
              <h3>{counts.continuing} continuing · {counts.new} new</h3>
              <p>{counts.reappeared} reappeared · {state.cycle.disappeared.length} newly disappeared against the selected baseline.</p>
            </article>
            <article className="signalCard">
              <div className="signalTopline"><span>CANONICAL BASELINE</span><span>SCHEDULE ONLY</span></div>
              <h3>QA runs cannot contaminate production history</h3>
              <p>{state.cycle.baselineStatePath} is advanced only by scheduled runs after verification and build gates pass.</p>
            </article>
            <article className="signalCard">
              <div className="signalTopline"><span>MOMENTUM BOUNDARY</span><span>STRUCTURAL ONLY</span></div>
              <h3>No Virality inference yet</h3>
              <p>Expanding/contracting refers only to evidence-count and independent-source spread between baseline cycles. Native platform metrics remain excluded.</p>
            </article>
          </div>

          {!state.cycle.persistenceEligible ? (
            <div className="demoWarning" style={{ marginTop: 16 }}>
              QA CYCLE · This artifact is inspectable for build verification but does not overwrite the canonical twice-daily production history baseline.
            </div>
          ) : null}

          {state.cycle.current.length ? (
            <div className="signalGrid" style={{ marginTop: 16 }}>
              {state.cycle.current.slice(0, 12).map((item) => (
                <article className="signalCard" key={item.lineageId}>
                  <div className="signalTopline">
                    <span>{label(item.presence)}</span>
                    <span>{label(item.evidenceDirection)}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p><strong>Lineage:</strong> {item.lineageId}</p>
                  {item.previousCandidateId ? <p><strong>Previous candidate:</strong> {item.previousCandidateId}</p> : null}
                  <div className="signalMeta" style={{ marginTop: 10 }}>
                    <span>signals Δ {item.signalCountDelta ?? "n/a"}</span>
                    <span>independent sources Δ {item.independentSourceDelta ?? "n/a"}</span>
                    <span>independent families Δ {item.independentSourceFamilyDelta ?? "n/a"}</span>
                  </div>
                  {item.matchEvidence ? (
                    <p style={{ marginTop: 10 }}>
                      <strong>Lineage match:</strong> {item.matchEvidence.anchorOverlap.join(" · ")} · similarity {item.matchEvidence.similarity.toFixed(2)} / threshold {item.matchEvidence.threshold.toFixed(2)}
                    </p>
                  ) : null}
                  {item.independentSourceIdsAdded.length || item.independentSourceIdsRemoved.length ? (
                    <p>
                      <strong>Independent source change:</strong> +{item.independentSourceIdsAdded.join(", ") || "none"} · −{item.independentSourceIdsRemoved.join(", ") || "none"}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="demoWarning" style={{ marginTop: 16 }}>NO CURRENT TREND CANDIDATES · history remains valid and prior production lineages may later be marked disappeared.</div>
          )}

          {state.cycle.disappeared.length ? (
            <div className="logicCallout" style={{ marginTop: 16 }}>
              <strong>Newly disappeared:</strong> {state.cycle.disappeared.map((item) => `${item.title} (${item.lineageId})`).join(" · ")}
            </div>
          ) : null}

          <div className="logicCallout" style={{ marginTop: 16 }}>
            <strong>04D interpretation rule:</strong> {state.cycle.cyclePurpose === "qa"
              ? "this is QA output and cannot become the scheduled production baseline."
              : state.cycle.comparisonWindow === "comparable"
                ? "this scheduled cycle gap is suitable for twice-daily structural comparison, but still does not authorize Virality/lifecycle scoring by itself."
                : state.cycle.comparisonWindow === "too-close-for-cadence"
                  ? "the scheduled gap is unexpectedly short and must not be interpreted as normal twice-daily market movement."
                  : state.cycle.comparisonWindow === "bootstrap"
                    ? "this is the first scheduled baseline; deltas are intentionally not comparable yet."
                    : "the previous scheduled cycle is too stale or temporally invalid for normal twice-daily comparison."}
          </div>
        </>
      ) : null}
    </section>
  );
}
