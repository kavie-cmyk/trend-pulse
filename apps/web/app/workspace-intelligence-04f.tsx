"use client";

import { useEffect, useMemo, useState } from "react";
import type { IntelligenceWorkspace } from "@trend-pulse/contracts";
import type { WorkspaceCoverageClassResult } from "@trend-pulse/contracts/workspace-coverage";
import BrandProfileConsole from "./brand-profile-console";
import SourceIntelligencePanel from "./source-intelligence-panel";

const WORKSPACE_KEY = "trend-pulse.workspace.v1";
type TabId = "overview" | "trends" | "sources" | "brand-profile";

type WeakSignal = {
  signalId: string;
  topic: string;
  sourceId: string;
  sourceName: string;
  sourceType: string;
  sourceNativeTrend: boolean;
  relevanceScore: number;
  matchedPhrases: string[];
  concepts: string[];
  evidenceUrl?: string;
};

type Candidate = {
  id: string;
  workspaceId: string;
  title: string;
  summary: string;
  status: "candidate" | "corroborated";
  signalIds: string[];
  sourceIds: string[];
  sourceFamilies?: string[];
  independentSourceDiversity: number;
  independentSourceFamilyDiversity: number;
  resolutionAnchors?: string[];
  evidenceRefs?: string[];
  resolutionTrace04f?: {
    modes?: string[];
    subjectAnchors?: string[];
    semanticAnchors?: string[];
  };
};

type WorkspaceReport = {
  schemaVersion: "workspace-intelligence-report.v1";
  methodologyVersion?: string;
  workspace: { id: string; name: string; matchNames?: string[]; scope: IntelligenceWorkspace["scope"] };
  generatedAt: string;
  coverageStatus: "pass-with-gaps" | "partial" | "not-pass";
  coverageClasses?: WorkspaceCoverageClassResult[];
  sourcePlan: {
    collectionMode: "workspace-scoped";
    queryTerms: string[];
    attemptedTargetedSources: number;
    successfulTargetedSources: number;
    activeSourceIds: string[];
    activeSourceFamilies: string[];
    languageEvidence: string[];
    broadRelevantCount: number;
    targetedRelevantCount: number;
    preDedupeRelevantCount: number;
    postDedupeRelevantCount: number;
    sameSourceDuplicateCount: number;
    sourceDiversity: number;
    sourceFamilyDiversity: number;
    coverage: {
      workspaceQueryExecuted: boolean;
      targetedSourceSuccess: number;
      hasSocial: boolean;
      hasCommunity: boolean;
      hasPublisher: boolean;
      hasLocalLanguageEvidence: boolean;
      hasSearchDemand?: boolean;
      hasAppStore?: boolean;
    };
  };
  weakSignals: WeakSignal[];
  repeatedSingleSourceClusters: Array<{ id: string; title: string; signalIds: string[]; sourceIds: string[]; resolutionAnchors: string[]; reason: string }>;
  candidates: Candidate[];
  candidateCount: number;
  corroboratedCount: number;
  quality: {
    relevantSignalCount: number;
    weakSignalCount: number;
    crossSourceCandidateCount: number;
    independentlyCorroboratedCount: number;
    clusteredSignalCount: number;
    clusteringRate: number;
    sameSourceDuplicateCount: number;
    sourceDiversity: number;
    sourceFamilyDiversity: number;
    successfulTargetedSources: number;
    targetedFailures: number;
    operationalCoverageClassCount?: number;
    relevantCoverageClassCount?: number;
    boundedSubjectBridgeCount?: number;
  };
  failures: Array<{ sourceId: string; query?: string; error: string }>;
};

type Snapshot = { schemaVersion: "workspace-intelligence-snapshot.v1"; methodologyVersion?: string; generatedAt: string; workspaces: WorkspaceReport[] };
type DataState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: Snapshot };

const tabs: Array<{ id: TabId; label: string; description: string }> = [
  { id: "overview", label: "Overview", description: "Workspace-scoped intelligence" },
  { id: "trends", label: "Trends", description: "Weak signals + qualified candidates" },
  { id: "sources", label: "Sources", description: "Actual coverage + runtime state" },
  { id: "brand-profile", label: "Brand Profile", description: "Brand context + readiness" },
];

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
  const workspaceCore = new Set([...workspace.scope.geographies, ...workspace.scope.industries, ...workspace.scope.categories].map(normalize).filter(Boolean));
  return reports.find((report) => {
    const runtimeCore = new Set([...(report.workspace.scope.geographies ?? []), ...(report.workspace.scope.industries ?? []), ...(report.workspace.scope.categories ?? [])].map(normalize).filter(Boolean));
    const shared = [...workspaceCore].filter((term) => runtimeCore.has(term));
    return workspaceCore.size >= 2 && shared.length >= Math.min(3, workspaceCore.size);
  }) ?? null;
}

function coverageLabel(value: WorkspaceReport["coverageStatus"]) {
  if (value === "pass-with-gaps") return "WORKSPACE COLLECTION ACTIVE · GAPS DECLARED";
  if (value === "partial") return "PARTIAL COVERAGE";
  return "COVERAGE NOT PASS";
}

function coverageStateLabel(value: WorkspaceCoverageClassResult["runtimeStatus"]) {
  if (value === "operational-with-relevant-evidence") return "OPERATIONAL · EVIDENCE";
  if (value === "operational-no-relevant-evidence") return "OPERATIONAL · 0 RELEVANT THIS CYCLE";
  if (value === "runtime-failed") return "RUNTIME FAILED";
  return "NOT CONFIGURED";
}

function Overview({ workspace, report }: { workspace: IntelligenceWorkspace; report: WorkspaceReport }) {
  return <div className="intelligenceOverview">
    <section className="reportHero">
      <div><div className="eyebrow">LATEST WORKSPACE INTELLIGENCE · 04F</div><h2>{workspace.name}</h2><p>04F preserves the verified 04E baseline, expands Workspace-specific search/store/community coverage, and adds bounded subject-resolution bridges. Global Pulse still does not count as Workspace trend evidence.</p></div>
      <div className="reportFreshness"><span>{coverageLabel(report.coverageStatus)}</span><strong>{new Date(report.generatedAt).toLocaleString()}</strong></div>
    </section>
    <div className="reportKpis">
      <article><span>Relevant signals</span><strong>{report.quality.relevantSignalCount}</strong><small>verified baseline + qualified 04F expansion</small></article>
      <article><span>Weak signals</span><strong>{report.quality.weakSignalCount}</strong><small>preserved even when no candidate forms</small></article>
      <article><span>Cross-source candidates</span><strong>{report.candidateCount + report.corroboratedCount}</strong><small>{report.corroboratedCount} independently corroborated</small></article>
      <article><span>Coverage classes</span><strong>{report.quality.operationalCoverageClassCount ?? 0}/5</strong><small>{report.quality.relevantCoverageClassCount ?? 0} with relevant evidence this cycle</small></article>
    </div>
    <section className="reportBlock"><div className="reportBlockHeading"><div><div className="eyebrow">EARLY SIGNALS</div><h3>Weak signals worth watching</h3></div></div><div className="reportTrendList">{report.weakSignals.slice(0, 12).map((signal) => <article key={signal.signalId}><div className="reportTrendTopline"><span>{signal.sourceNativeTrend ? "SOURCE-NATIVE SIGNAL" : "WEAK SIGNAL"}</span><span>{signal.sourceName}</span></div><h4>{signal.topic}</h4><div className="reportEvidenceLine"><span>relevance {signal.relevanceScore.toFixed(1)}</span><span>{signal.concepts.length ? signal.concepts.join(" · ") : signal.matchedPhrases.slice(0, 2).join(" · ") || "returned-content relevance"}</span></div>{signal.evidenceUrl ? <a className="textButton" href={signal.evidenceUrl} target="_blank" rel="noreferrer">Open evidence ↗</a> : null}</article>)}</div></section>
    <section className="reportBlock"><div className="reportBlockHeading"><div><div className="eyebrow">QUALIFIED TRENDS</div><h3>Cross-source Trend Candidates</h3></div></div>{report.candidates.length ? <div className="reportTrendList">{report.candidates.slice(0, 8).map((candidate) => <article key={candidate.id}><div className="reportTrendTopline"><span>{candidate.status.toUpperCase()}</span><span>{candidate.independentSourceFamilyDiversity} independent families</span></div><h4>{candidate.title}</h4><p>{candidate.summary}</p><div className="reportEvidenceLine"><span>{candidate.signalIds.length} observations</span><span>{candidate.independentSourceDiversity} independent sources</span></div></article>)}</div> : <div className="reportEmpty">No cross-source candidate passed the current gate. Zero qualified candidates remains a valid result.</div>}</section>
    <section className="reportBlock reportBoundary"><div className="eyebrow">QUALITY BOUNDARY</div><h3>Coverage expansion ≠ relaxed corroboration.</h3><p>Search/store/community connectors may be operational while returning zero relevant evidence. Scope concepts never create a narrative cluster by themselves, and Brand Fit does not promote Weak Signals into actions.</p></section>
  </div>;
}

function Trends({ report }: { report: WorkspaceReport }) {
  return <div className="intelligenceOverview">
    <section className="reportBlock"><div className="reportBlockHeading"><div><div className="eyebrow">CROSS-SOURCE</div><h3>Trend Candidates</h3></div></div>{report.candidates.length ? <div className="reportTrendList">{report.candidates.map((candidate) => <article key={candidate.id}><div className="reportTrendTopline"><span>{candidate.status.toUpperCase()}</span><span>{candidate.sourceIds.length} raw sources</span></div><h4>{candidate.title}</h4><p>{candidate.summary}</p><div className="reportEvidenceLine"><span>{candidate.resolutionAnchors?.slice(0, 5).join(" · ") || "inspectable resolution trace"}</span><span>{candidate.resolutionTrace04f?.modes?.join(" + ")}</span></div></article>)}</div> : <div className="reportEmpty">No qualified cross-source candidates in this Workspace snapshot.</div>}</section>
    <section className="reportBlock"><div className="reportBlockHeading"><div><div className="eyebrow">REPEATED SAME-SOURCE</div><h3>Not promoted to Trend Candidate</h3></div></div>{report.repeatedSingleSourceClusters.length ? <div className="reportTrendList">{report.repeatedSingleSourceClusters.map((cluster) => <article key={cluster.id}><h4>{cluster.title}</h4><p>{cluster.reason}</p><div className="reportEvidenceLine"><span>{cluster.signalIds.length} observations</span><span>{cluster.sourceIds.join(" · ")}</span></div></article>)}</div> : <div className="reportEmpty">No repeated same-source clusters.</div>}</section>
    <section className="reportBlock"><div className="reportBlockHeading"><div><div className="eyebrow">WEAK-SIGNAL LAYER</div><h3>Relevant observations before corroboration</h3></div></div><div className="reportTrendList">{report.weakSignals.slice(0, 50).map((signal) => <article key={signal.signalId}><div className="reportTrendTopline"><span>{signal.sourceNativeTrend ? "SOURCE-NATIVE SIGNAL" : "WEAK SIGNAL"}</span><span>{signal.sourceName}</span></div><h4>{signal.topic}</h4>{signal.evidenceUrl ? <a className="textButton" href={signal.evidenceUrl} target="_blank" rel="noreferrer">Evidence ↗</a> : null}</article>)}</div></section>
  </div>;
}

function Sources({ report }: { report: WorkspaceReport }) {
  const plan = report.sourcePlan;
  const coverageClasses = report.coverageClasses ?? [];
  return <div className="intelligenceOverview">
    <section className="reportHero"><div><div className="eyebrow">ACTUAL WORKSPACE COVERAGE · 04F</div><h2>{report.workspace.name}</h2><p>Operational access and relevant evidence are tracked separately. A source that runs but finds nothing relevant stays visible as operational with zero relevant evidence instead of being treated as coverage success.</p></div><div className="reportFreshness"><span>{coverageLabel(report.coverageStatus)}</span><strong>{plan.sourceDiversity} evidence sources · {plan.sourceFamilyDiversity} families</strong></div></section>
    <div className="reportKpis"><article><span>Broad relevant</span><strong>{plan.broadRelevantCount}</strong></article><article><span>Targeted relevant</span><strong>{plan.targetedRelevantCount}</strong></article><article><span>Same-source duplicates removed</span><strong>{plan.sameSourceDuplicateCount}</strong></article><article><span>Bounded subject bridges</span><strong>{report.quality.boundedSubjectBridgeCount ?? 0}</strong><small>semantic aliases alone cannot form an edge</small></article></div>
    <section className="reportBlock"><div className="reportBlockHeading"><div><div className="eyebrow">COVERAGE CLASSES</div><h3>Operational state vs current evidence</h3></div></div><div className="reportTrendList">{coverageClasses.map((coverage) => <article key={coverage.coverageClass}><div className="reportTrendTopline"><span>{coverage.coverageClass.toUpperCase()}</span><span>{coverageStateLabel(coverage.runtimeStatus)}</span></div><h4>{coverage.relevantSignalCount} relevant signal{coverage.relevantSignalCount === 1 ? "" : "s"}</h4><div className="reportEvidenceLine"><span>{coverage.sourceIds.join(" · ") || "no active source evidence"}</span><span>{coverage.failureCount} runtime failure{coverage.failureCount === 1 ? "" : "s"}</span></div><p>{coverage.notes.slice(0, 2).join(" ")}</p></article>)}</div></section>
    <section className="reportBlock"><div className="eyebrow">QUERY TERMS</div><div className="scopeChips">{plan.queryTerms.map((term) => <span key={term}>{term}</span>)}</div></section>
    <section className="reportBlock"><div className="eyebrow">ACTIVE EVIDENCE SOURCE IDS</div><div className="scopeChips">{plan.activeSourceIds.map((source) => <span key={source}>{source}</span>)}</div></section>
    <section className="reportBlock"><div className="eyebrow">COVERAGE CHECKS</div><div className="changeSummary"><div><strong>{plan.coverage.workspaceQueryExecuted ? "YES" : "NO"}</strong><span>Workspace query executed</span></div><div><strong>{plan.coverage.hasSocial ? "YES" : "NO"}</strong><span>Social evidence</span></div><div><strong>{plan.coverage.hasCommunity ? "YES" : "NO"}</strong><span>Community evidence</span></div><div><strong>{plan.coverage.hasPublisher ? "YES" : "NO"}</strong><span>Publisher evidence</span></div><p>Search demand relevant this cycle: {plan.coverage.hasSearchDemand ? "yes" : "no"}. App/store relevant this cycle: {plan.coverage.hasAppStore ? "yes" : "no"}. These are evidence states, not connector-health labels.</p></div></section>
    {report.failures.length ? <div className="demoWarning">Some public paths failed this cycle: {Array.from(new Set(report.failures.map((failure) => failure.sourceId))).join(", ")}. Failures remain visible and do not trigger mock/fallback observations.</div> : null}
    <SourceIntelligencePanel />
  </div>;
}

export default function WorkspaceIntelligence04F() {
  const [workspace, setWorkspace] = useState<IntelligenceWorkspace | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [state, setState] = useState<DataState>({ status: "loading" });

  useEffect(() => {
    const sync = () => setWorkspace(readWorkspace());
    sync();
    const timer = window.setInterval(sync, 800);
    window.addEventListener("storage", sync);
    return () => { window.clearInterval(timer); window.removeEventListener("storage", sync); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("./data/workspace-intelligence.json", { cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error(`workspace-intelligence HTTP ${response.status}`); return response.json() as Promise<Snapshot>; })
      .then((data) => { if (!cancelled) setState({ status: "ready", data }); })
      .catch((error) => { if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : "Unknown workspace intelligence error" }); });
    return () => { cancelled = true; };
  }, []);

  const report = useMemo(() => state.status === "ready" ? matchReport(workspace, state.data.workspaces) : null, [workspace, state]);
  const runtimeSynced = Boolean(workspace && report);

  function openTab(tab: TabId) {
    setActiveTab(tab);
    window.requestAnimationFrame(() => document.getElementById("workspace-intelligence-report")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return <section className="workspaceIntelligenceEntry" aria-label="Workspace intelligence report entry">
    <div className="intelligenceEntryCard"><div><div className="eyebrow">YOUR INTELLIGENCE</div><h2>{workspace ? `${workspace.name} intelligence` : "Save a Workspace to open intelligence."}</h2><p>{!workspace ? "Workspace-specific collection starts from a saved Workspace." : runtimeSynced ? `${report?.quality.relevantSignalCount ?? 0} relevant signals · ${report?.quality.weakSignalCount ?? 0} weak signals · ${(report?.candidateCount ?? 0) + (report?.corroboratedCount ?? 0)} cross-source candidates.` : "This browser Workspace is not yet runtime-synced. Trend Pulse will not show a fake Workspace trend count from Global Pulse."}</p></div><a className={`intelligenceCta ${workspace ? "" : "disabled"}`} href={workspace ? "#workspace-intelligence-report" : undefined} aria-disabled={!workspace} onClick={(event) => { if (!workspace) event.preventDefault(); else setActiveTab("overview"); }}>View Intelligence <span>→</span></a></div>
    <div id="workspace-intelligence-report" className="intelligenceShell">
      <header className="intelligenceShellHeader"><div><div className="eyebrow">WORKSPACE INTELLIGENCE · 04F</div><h2>{workspace?.name ?? "No saved Workspace"}</h2></div><div className="intelligenceWorkspaceMeta"><span>{runtimeSynced ? "RUNTIME-SYNCED" : workspace ? "BROWSER-ONLY" : "NO WORKSPACE"}</span><strong>{runtimeSynced ? coverageLabel(report!.coverageStatus) : "Scheduled collector requires a runtime-synced Workspace profile"}</strong></div></header>
      <nav className="intelligenceTabs" aria-label="Intelligence report sections">{tabs.map((tab) => <button key={tab.id} type="button" className={activeTab === tab.id ? "active" : ""} onClick={() => openTab(tab.id)}><strong>{tab.label}</strong><span>{tab.description}</span></button>)}</nav>
      <div className="intelligenceTabBody">{!workspace ? <div className="reportEmpty">Save a Workspace above first.</div> : state.status === "loading" ? <div className="reportEmpty">Loading workspace-scoped intelligence…</div> : state.status === "error" ? <div className="demoWarning">Workspace intelligence artifact unavailable: {state.message}</div> : !report ? <div className="demoWarning">BROWSER-ONLY WORKSPACE · This saved Workspace exists only in localStorage and is not readable by scheduled GitHub Actions. No Global Pulse candidate count is substituted. Add/sync this Workspace to the runtime registry before scheduled workspace-specific collection can claim coverage.</div> : activeTab === "overview" ? <Overview workspace={workspace} report={report} /> : activeTab === "trends" ? <Trends report={report} /> : activeTab === "sources" ? <Sources report={report} /> : <BrandProfileConsole />}</div>
    </div>
  </section>;
}
