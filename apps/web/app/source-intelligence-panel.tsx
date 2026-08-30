"use client";

import { useEffect, useMemo, useState } from "react";
import type { IntelligenceWorkspace } from "@trend-pulse/contracts";
import type { WorkspaceSourceEvaluation, WorkspaceSourcePlan } from "@trend-pulse/contracts/source-intelligence";
import { planWorkspaceSources, savaValidationWorkspaces, sourceRegistry, summarizePlan } from "./source-intelligence-stage04b4";

const STORAGE_KEY = "trend-pulse.workspace.v1";

type PlanTarget = "browser" | "game" | "ai" | "xr";

function readWorkspace() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IntelligenceWorkspace;
    return parsed?.schemaVersion === "workspace.v1" ? parsed : null;
  } catch {
    return null;
  }
}

function evaluationBadge(evaluation: WorkspaceSourceEvaluation) {
  if (evaluation.activationDecision === "activate-now") return "ACTIVATE NOW";
  if (evaluation.activationDecision === "needs-credential") return "NEEDS CREDENTIAL";
  if (evaluation.activationDecision === "connector-backlog") return "BUILD CONNECTOR";
  if (evaluation.activationDecision === "manual-assisted") return "MANUAL-ASSISTED";
  if (evaluation.activationDecision === "runtime-deferred") return "RUNTIME-DEFERRED";
  if (evaluation.activationDecision === "paid-later") return "PAID-LATER";
  if (evaluation.activationDecision === "restricted") return "RESTRICTED";
  return "EXCLUDE";
}

function SourceRows({ title, rows }: { title: string; rows: WorkspaceSourceEvaluation[] }) {
  return (
    <div className="entityColumn">
      <div className="entityColumnTitle"><strong>{title}</strong><span>{rows.length}</span></div>
      {rows.length ? (
        <div style={{ display: "grid", gap: 9 }}>
          {rows.map((source) => (
            <div className="signalCard" style={{ padding: 14 }} key={source.sourceId}>
              <div className="signalTopline"><span>{evaluationBadge(source)}</span><span>{source.disposition}</span></div>
              <h3 style={{ marginTop: 14 }}>{source.sourceName}</h3>
              <div className="signalMeta">
                <span>fit {source.intelligenceFit.toFixed(1)}/10</span>
                <span>feasibility {source.operationalFeasibility.toFixed(1)}/10</span>
              </div>
              <p>{source.rationale[0]}</p>
              {source.rationale.slice(2).map((note) => <p key={note}>{note}</p>)}
            </div>
          ))}
        </div>
      ) : <div className="candidateEmpty compact"><p>No sources in this role.</p></div>}
    </div>
  );
}

export default function SourceIntelligencePanel() {
  const [browserWorkspace, setBrowserWorkspace] = useState<IntelligenceWorkspace | null>(null);
  const [serialized, setSerialized] = useState("");
  const [target, setTarget] = useState<PlanTarget>("game");

  useEffect(() => {
    const sync = () => {
      const raw = window.localStorage.getItem(STORAGE_KEY) ?? "";
      if (raw !== serialized) {
        setSerialized(raw);
        setBrowserWorkspace(readWorkspace());
      }
    };
    sync();
    const timer = window.setInterval(sync, 700);
    return () => window.clearInterval(timer);
  }, [serialized]);

  const selected = useMemo(() => {
    if (target === "browser") return browserWorkspace;
    if (target === "game") return savaValidationWorkspaces[0];
    if (target === "ai") return savaValidationWorkspaces[1];
    return savaValidationWorkspaces[2];
  }, [target, browserWorkspace]);

  const plan: WorkspaceSourcePlan | null = useMemo(() => {
    if (!selected) return null;
    return planWorkspaceSources(selected, target === "browser" ? "registry-only" : "validation-research-pack");
  }, [selected, target]);

  const summary = useMemo(() => plan ? summarizePlan(plan) : null, [plan]);

  return (
    <section className="signalSection" style={{ marginTop: 22 }}>
      <div className="sectionHeading">
        <div>
          <div className="eyebrow">BUILD STAGE 04B-1 → 04B-4 · SOURCE INTELLIGENCE LAYER</div>
          <h2>Workspace → source research → evaluation → source plan → gaps.</h2>
          <p>
            Trend Pulse separates source intelligence value from operational feasibility. Registry memory is reusable across workspaces; research can discover new source candidates outside the registry before the planner assigns PRIMARY, SUPPORTING, BACKGROUND or EXCLUDE.
          </p>
        </div>
        <span className="schemaTag">source-planner.v1 · calibration v0.1 · permissionless expansion</span>
      </div>

      <div className="inputModeRow" style={{ marginBottom: 12 }}>
        <button className={`modeButton ${target === "browser" ? "active" : ""}`} type="button" onClick={() => setTarget("browser")}>Current workspace</button>
        <button className={`modeButton ${target === "game" ? "active" : ""}`} type="button" onClick={() => setTarget("game")}>SAVA · Game Publishing</button>
        <button className={`modeButton ${target === "ai" ? "active" : ""}`} type="button" onClick={() => setTarget("ai")}>SAVA · AI</button>
        <button className={`modeButton ${target === "xr" ? "active" : ""}`} type="button" onClick={() => setTarget("xr")}>SAVA · VR/XR</button>
      </div>

      {!selected ? (
        <div className="candidateEmpty">
          <strong>No saved workspace in this browser.</strong>
          <p>Save a workspace above, or use one of the SAVA META validation cases.</p>
        </div>
      ) : plan && summary ? (
        <>
          <div className="monitoringCard" style={{ alignItems: "flex-start" }}>
            <div>
              <strong>{plan.workspaceName}</strong>
              <p>
                Research runtime: {plan.researchRuntime}. Registry: {sourceRegistry.length} known source/source-class records. Planner method: {plan.methodologyVersion}.
              </p>
            </div>
            <span>{summary.unresolvedGaps.length} OPEN/PARTIAL GAPS</span>
          </div>

          {target === "browser" ? (
            <div className="demoWarning">
              LIVE SOURCE RESEARCH NOT RUNNING IN STATIC PAGES · This browser workspace is evaluated against Source Registry memory only. Autonomous web research requires the future research/runtime service; the SAVA validation tabs below use a curated evidence-backed research pack, not fabricated discovery.
            </div>
          ) : (
            <div className="demoWarning">
              VALIDATION RESEARCH PACK · Candidate sources below were researched externally for these SAVA META scopes and are used to validate the planning architecture. This is not yet an autonomous research call made by the deployed website.
            </div>
          )}

          <div className="entityColumns" style={{ marginTop: 14 }}>
            <SourceRows title="PRIMARY" rows={summary.primary} />
            <SourceRows title="SUPPORTING" rows={summary.supporting} />
          </div>

          <div className="entityColumns" style={{ marginTop: 14 }}>
            <SourceRows title="BACKGROUND" rows={summary.background} />
            <SourceRows title="EXCLUDE" rows={summary.excluded.slice(0, 5)} />
          </div>

          <section className="entityPanel" style={{ marginTop: 16 }}>
            <div className="entityPanelHeader">
              <div>
                <div className="eyebrow">SOURCE RESEARCH</div>
                <h3>New candidates outside current registry</h3>
                <p>Research output is a candidate, not an automatic connector. Each candidate still needs access/compliance/terms verification and a connector decision.</p>
              </div>
              <span className="autoBadge">{plan.researchCandidates.length} CANDIDATES</span>
            </div>
            {plan.researchCandidates.length ? (
              <div className="signalGrid">
                {plan.researchCandidates.map((candidate) => (
                  <article className="signalCard" key={candidate.id}>
                    <div className="signalTopline"><span>{candidate.expectedFit.toUpperCase()} EXPECTED FIT</span><span>{candidate.status}</span></div>
                    <h3>{candidate.name}</h3>
                    <p>{candidate.reason}</p>
                    <div className="signalMeta"><span>{candidate.accessHypothesis}</span><span>{candidate.likelySignalKinds.join(" · ")}</span></div>
                  </article>
                ))}
              </div>
            ) : <div className="candidateEmpty compact"><p>No external-research candidate pack is attached to this runtime. Registry matching still works; live research is a later runtime capability.</p></div>}
          </section>

          <section className="entityPanel" style={{ marginTop: 16 }}>
            <div className="entityPanelHeader">
              <div>
                <div className="eyebrow">COVERAGE GAP ANALYSIS</div>
                <h3>What intelligence is still missing?</h3>
                <p>Trend Pulse must surface missing primary evidence instead of silently substituting a weaker source.</p>
              </div>
            </div>
            <div className="signalGrid">
              {plan.gaps.map((gap) => (
                <article className="signalCard" key={gap.id}>
                  <div className="signalTopline"><span>{gap.severity}</span><span>{gap.status}</span></div>
                  <h3>{gap.label}</h3>
                  <p>{gap.reason}</p>
                  <div className="signalMeta"><span>{gap.requiredSignalKinds.join(" · ")}</span></div>
                </article>
              ))}
            </div>
          </section>

          <div className="logicCallout" style={{ marginTop: 16 }}>
            <strong>Source intelligence rule:</strong> Connected ≠ eligible ≠ active. A source can be PRIMARY by intelligence value while still being access-constrained, paid-later or connector-backlog. Operational feasibility controls activation; it does not rewrite intelligence value.
          </div>
        </>
      ) : null}
    </section>
  );
}
