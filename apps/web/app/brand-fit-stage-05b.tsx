"use client";

import { useEffect, useMemo, useState } from "react";
import type { IntelligenceWorkspace } from "@trend-pulse/contracts";
import BrandFitPanel05B from "./brand-fit-panel-05b";

const WORKSPACE_KEY = "trend-pulse.workspace.v1";

type Candidate = {
  id: string;
  workspaceId: string;
  title: string;
  summary: string;
  status: "candidate" | "corroborated";
  signalIds: string[];
  sourceIds: string[];
  independentSourceDiversity: number;
  independentSourceFamilyDiversity: number;
  resolutionAnchors?: string[];
  evidenceRefs?: string[];
  geographies?: string[];
  languages?: string[];
  lifecycleStage?: string;
};

type WorkspaceReport = {
  workspace: { id: string; name: string; matchNames?: string[]; scope: IntelligenceWorkspace["scope"] };
  weakSignals: Array<{ signalId: string }>;
  repeatedSingleSourceClusters: Array<{ id: string }>;
  candidates: Candidate[];
  corroboratedCount: number;
};

type Snapshot = { schemaVersion: "workspace-intelligence-snapshot.v1"; workspaces: WorkspaceReport[] };
type DataState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: Snapshot };

function normalize(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

function readWorkspace(): IntelligenceWorkspace | null {
  try {
    const raw = window.localStorage.getItem(WORKSPACE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IntelligenceWorkspace;
    return parsed?.schemaVersion === "workspace.v1" ? parsed : null;
  } catch {
    return null;
  }
}

function matchReport(workspace: IntelligenceWorkspace | null, reports: WorkspaceReport[]) {
  if (!workspace) return null;
  const name = normalize(workspace.name);
  const exact = reports.find((report) => [report.workspace.name, ...(report.workspace.matchNames ?? [])].some((candidate) => normalize(candidate) === name));
  if (exact) return exact;
  const workspaceCore = new Set([
    ...workspace.scope.geographies,
    ...workspace.scope.industries,
    ...workspace.scope.categories,
  ].map(normalize).filter(Boolean));
  return reports.find((report) => {
    const runtimeCore = new Set([
      ...(report.workspace.scope.geographies ?? []),
      ...(report.workspace.scope.industries ?? []),
      ...(report.workspace.scope.categories ?? []),
    ].map(normalize).filter(Boolean));
    const shared = [...workspaceCore].filter((term) => runtimeCore.has(term));
    return workspaceCore.size >= 2 && shared.length >= Math.min(3, workspaceCore.size);
  }) ?? null;
}

export default function BrandFitStage05B() {
  const [workspace, setWorkspace] = useState<IntelligenceWorkspace | null>(null);
  const [state, setState] = useState<DataState>({ status: "loading" });

  useEffect(() => {
    const sync = () => setWorkspace(readWorkspace());
    sync();
    const timer = window.setInterval(sync, 800);
    window.addEventListener("storage", sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("./data/workspace-intelligence.json", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`workspace-intelligence HTTP ${response.status}`);
        return response.json() as Promise<Snapshot>;
      })
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : "Unknown Stage 05B data error" });
      });
    return () => { cancelled = true; };
  }, []);

  const report = useMemo(() => state.status === "ready" ? matchReport(workspace, state.data.workspaces) : null, [workspace, state]);

  if (!workspace) return null;
  if (state.status === "loading") return <section className="workspaceIntelligenceEntry"><div className="reportEmpty">Loading Stage 05B Brand Fit evidence gate…</div></section>;
  if (state.status === "error") return <section className="workspaceIntelligenceEntry"><div className="demoWarning">Stage 05B cannot read Workspace Intelligence: {state.message}</div></section>;
  if (!report) return <section className="workspaceIntelligenceEntry"><div className="demoWarning">STAGE 05B · RUNTIME SYNC REQUIRED · This browser Workspace has no matching 04E runtime report, so Trend Pulse will not compute Brand Fit from Global Pulse or fabricate a candidate.</div></section>;

  return <section className="workspaceIntelligenceEntry" aria-label="Stage 05B Brand Profile resolution and Brand Fit">
    <BrandFitPanel05B workspace={workspace} report={report} />
  </section>;
}
