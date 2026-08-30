"use client";

import { useEffect, useMemo, useState } from "react";
import type { IntelligenceWorkspace } from "@trend-pulse/contracts";
import type {
  GlobalResolvedTrendCandidate,
  TrendResolutionSnapshot,
  WorkspaceTrendProjection,
  WorkspaceTrendProjectionClass,
} from "@trend-pulse/contracts/trend-resolution";

const STORAGE_KEY = "trend-pulse.workspace.v1";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; snapshot: TrendResolutionSnapshot };

const stopWords = new Set([
  "the", "and", "for", "with", "from", "this", "that", "into", "about", "your", "are", "was", "were", "will", "new", "more", "most", "trend", "trending", "market", "content", "growth", "opportunity", "opportunities", "discovery",
  "va", "và", "cua", "của", "cho", "voi", "với", "trong", "tren", "trên", "mot", "một", "khong", "không", "la", "là", "co", "có", "duoc", "được", "tu", "từ", "den", "đến", "moi", "mới",
]);

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  return normalize(value)
    .split(" ")
    .filter((token) => token && !stopWords.has(token) && (token.length >= 3 || ["ai", "vr", "xr", "ar", "3d"].includes(token)));
}

function readWorkspace(): IntelligenceWorkspace | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IntelligenceWorkspace;
    return parsed?.schemaVersion === "workspace.v1" ? parsed : null;
  } catch {
    return null;
  }
}

function termSet(values: string[]) {
  return new Set(values.flatMap(tokens));
}

function intersect(a: Set<string>, b: Set<string>) {
  return [...a].filter((value) => b.has(value));
}

function projectCandidate(workspace: IntelligenceWorkspace, candidate: GlobalResolvedTrendCandidate): WorkspaceTrendProjection {
  const directValues = [
    ...workspace.scope.industries,
    ...workspace.scope.categories,
    ...workspace.scope.products,
    ...workspace.focusBrands.map((brand) => brand.name),
    ...workspace.entityIntelligence.monitoredEntities.map((entity) => entity.name),
  ];
  const adjacentValues = [...workspace.scope.audiences, ...workspace.scope.objectives];
  const candidateTerms = termSet([candidate.title, ...candidate.resolutionAnchors]);
  const directMatches = intersect(candidateTerms, termSet(directValues));
  const adjacentMatches = intersect(candidateTerms, termSet(adjacentValues));

  let projection: WorkspaceTrendProjectionClass = "out-of-scope";
  const rationale: string[] = [];
  if (directMatches.length) {
    projection = "direct";
    rationale.push(`Matched workspace brand/category/product/industry terms: ${directMatches.join(", ")}.`);
  } else if (adjacentMatches.length && workspace.monitoring.adjacentCulture) {
    projection = "adjacent";
    rationale.push(`Matched audience/objective terms under adjacent-culture monitoring: ${adjacentMatches.join(", ")}.`);
  } else if (candidate.status === "corroborated" && workspace.monitoring.globalBreakouts) {
    projection = "global-breakout";
    rationale.push("No direct scope match, but the workspace allows global breakouts and this candidate passed cross-source corroboration.");
  } else {
    rationale.push("No deterministic workspace-scope match in the current projection pass.");
  }

  return {
    workspaceId: workspace.id,
    globalCandidateId: candidate.id,
    projection,
    matchedTerms: [...new Set([...directMatches, ...adjacentMatches])],
    rationale,
  };
}

function label(value: string) {
  return value.replaceAll("-", " ").toUpperCase();
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function TrendCandidates() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [workspace, setWorkspace] = useState<IntelligenceWorkspace | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("./data/trend-candidates.json", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<TrendResolutionSnapshot>;
      })
      .then((snapshot) => {
        if (!cancelled) setState({ status: "ready", snapshot });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : "Unknown error" });
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const sync = () => setWorkspace(readWorkspace());
    sync();
    const timer = window.setInterval(sync, 1000);
    window.addEventListener("storage", sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const projections = useMemo(() => {
    if (!workspace || state.status !== "ready") return new Map<string, WorkspaceTrendProjection>();
    return new Map(state.snapshot.candidates.map((candidate) => [candidate.id, projectCandidate(workspace, candidate)]));
  }, [workspace, state]);

  return (
    <section className="signalSection" style={{ marginTop: 22 }}>
      <div className="sectionHeading">
        <div>
          <div className="eyebrow">BUILD STAGE 04C · SIGNAL RESOLUTION + CROSS-SOURCE CORROBORATION</div>
          <h2>Repeated observations only become Trend Candidates after inspectable resolution evidence.</h2>
          <p>
            Stage 04C resolves titles, entities, hashtags and distinctive snapshot terms across independent source families. A single observation never becomes a Trend Candidate, and cross-platform native metrics are not compared here.
          </p>
        </div>
        <span className="schemaTag">trend-resolution-snapshot.v1</span>
      </div>

      {state.status === "loading" ? <div className="demoWarning">RESOLVING CURRENT TREND SNAPSHOT…</div> : null}
      {state.status === "error" ? <div className="demoWarning">TREND RESOLUTION UNAVAILABLE · {state.message}</div> : null}

      {state.status === "ready" ? (
        <>
          <div className="monitoringCard" style={{ alignItems: "flex-start" }}>
            <div>
              <strong>{state.snapshot.corroboratedCount} corroborated · {state.snapshot.candidateCount} candidate</strong>
              <p>
                {state.snapshot.uniqueSignalCount} unique real signals processed from {state.snapshot.inputSignalCount} collected observations · generated {formatDate(state.snapshot.generatedAt)}.
              </p>
            </div>
            <span>04C LIVE</span>
          </div>

          <div className="signalGrid" style={{ marginTop: 16 }}>
            <article className="signalCard">
              <div className="signalTopline"><span>RESOLUTION</span><span>{state.snapshot.clusteredSignalCount} CLUSTERED</span></div>
              <h3>Cross-source evidence</h3>
              <p>{state.snapshot.unclusteredSignalCount} signals remain unclustered rather than being forced into a trend.</p>
            </article>
            <article className="signalCard">
              <div className="signalTopline"><span>CORROBORATION GATE</span><span>2+ FAMILIES</span></div>
              <h3>Independent source families required</h3>
              <p>A corroborated candidate needs at least two source IDs and two source families, plus distinctive shared anchors.</p>
            </article>
            <article className="signalCard">
              <div className="signalTopline"><span>LIFECYCLE</span><span>NOT INFERRED</span></div>
              <h3>Current candidates stay weak-signal</h3>
              <p>One collection snapshot cannot prove acceleration, breakout, saturation or decline. Time-series evidence comes later.</p>
            </article>
          </div>

          {workspace ? (
            <div className="logicCallout" style={{ marginTop: 16 }}>
              <strong>Workspace projection:</strong> global candidates are being projected against <b>{workspace.name}</b>. This does not rewrite the global artifact or fabricate a workspaceId on broad-source evidence.
            </div>
          ) : (
            <div className="logicCallout" style={{ marginTop: 16 }}>
              <strong>Global Pulse:</strong> no saved Workspace is active in this browser, so candidates remain global and workspace-unscoped.
            </div>
          )}

          {state.snapshot.candidates.length ? (
            <div className="signalGrid" style={{ marginTop: 16 }}>
              {state.snapshot.candidates.slice(0, 12).map((candidate) => {
                const projection = projections.get(candidate.id);
                return (
                  <article className="signalCard" key={candidate.id}>
                    <div className="signalTopline">
                      <span>{label(candidate.status)}</span>
                      <span>{candidate.sourceFamilyDiversity} FAMILIES · {candidate.sourceDiversity} SOURCES</span>
                    </div>
                    <h3>{candidate.title}</h3>
                    <p>{candidate.summary}</p>
                    {projection ? (
                      <div className="signalMeta" style={{ marginTop: 10 }}>
                        <span>workspace {label(projection.projection)}</span>
                        <span>{projection.matchedTerms.length ? `match ${projection.matchedTerms.join(", ")}` : "no direct term match"}</span>
                      </div>
                    ) : null}
                    <div className="signalMeta" style={{ marginTop: 10 }}>
                      <span>type {label(candidate.trendType)}</span>
                      <span>lifecycle {label(candidate.lifecycleStage)}</span>
                    </div>
                    <p style={{ marginTop: 10 }}><strong>Resolution anchors:</strong> {candidate.resolutionAnchors.join(" · ")}</p>
                    <p><strong>Families:</strong> {candidate.sourceFamilies.join(" · ")}</p>
                    <p><strong>Sources:</strong> {candidate.sourceIds.join(" · ")}</p>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                      {candidate.evidenceRefs.slice(0, 4).map((url, index) => (
                        <a key={`${candidate.id}-${index}`} href={url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                          Evidence {index + 1} ↗
                        </a>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="demoWarning" style={{ marginTop: 16 }}>
              NO TREND CANDIDATES PASSED THE CURRENT RESOLUTION GATE · This is a valid result. Trend Pulse will not manufacture clusters from unrelated signals.
            </div>
          )}

          <div className="logicCallout" style={{ marginTop: 16 }}>
            <strong>04C boundary:</strong> no Virality, Brand Fit, Opportunity or numeric Confidence score is emitted. Source-native views, votes, likes, comments, ranks and trend scores remain incomparable until later normalization/calibration.
          </div>
        </>
      ) : null}
    </section>
  );
}
