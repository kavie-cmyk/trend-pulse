"use client";

import { useEffect, useMemo, useState } from "react";
import type { IntelligenceWorkspace } from "@trend-pulse/contracts";
import type { TrendHistoryCycleSnapshot } from "@trend-pulse/contracts/trend-history";
import type { GlobalResolvedTrendCandidate, TrendResolutionSnapshot } from "@trend-pulse/contracts/trend-resolution";
import BackboneSignals from "./backbone-signals";
import BrandProfileConsole from "./brand-profile-console";
import LiveSignals from "./live-signals";
import PermissionlessSocialSignals from "./permissionless-social-signals";
import SocialSignals from "./social-signals";
import SourceIntelligencePanel from "./source-intelligence-panel";
import TrendCandidates from "./trend-candidates";
import TrendHistory from "./trend-history";

const WORKSPACE_KEY = "trend-pulse.workspace.v1";

type TabId = "overview" | "trends" | "sources" | "brand-profile";
type DataState<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: T };
type Projection = "direct" | "adjacent" | "global-breakout" | "out-of-scope";

const tabs: Array<{ id: TabId; label: string; description: string }> = [
  { id: "overview", label: "Overview", description: "Latest intelligence report" },
  { id: "trends", label: "Trends", description: "Candidates + multi-cycle history" },
  { id: "sources", label: "Sources", description: "Coverage + collection evidence" },
  { id: "brand-profile", label: "Brand Profile", description: "Brand context + readiness" },
];

const stopWords = new Set([
  "the", "and", "for", "with", "from", "this", "that", "into", "about", "your", "are", "was", "were", "will", "new", "more", "most", "trend", "trending", "market", "content", "growth", "opportunity", "opportunities", "discovery",
  "va", "và", "cua", "của", "cho", "voi", "với", "trong", "tren", "trên", "mot", "một", "khong", "không", "la", "là", "co", "có", "duoc", "được", "tu", "từ", "den", "đến", "moi", "mới",
]);

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

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(values: string[]) {
  return new Set(
    values
      .flatMap((value) => normalize(value).split(" "))
      .filter((token) => token && !stopWords.has(token) && (token.length >= 3 || ["ai", "vr", "xr", "ar", "3d"].includes(token))),
  );
}

function classifyProjection(workspace: IntelligenceWorkspace | null, candidate: GlobalResolvedTrendCandidate): Projection {
  if (!workspace) return "out-of-scope";
  const candidateTerms = tokens([candidate.title, ...candidate.resolutionAnchors]);
  const directTerms = tokens([
    ...workspace.scope.industries,
    ...workspace.scope.categories,
    ...workspace.scope.products,
    ...workspace.focusBrands.map((brand) => brand.name),
    ...workspace.entityIntelligence.monitoredEntities.map((entity) => entity.name),
  ]);
  const adjacentTerms = tokens([...workspace.scope.audiences, ...workspace.scope.objectives]);
  if ([...candidateTerms].some((term) => directTerms.has(term))) return "direct";
  if (workspace.monitoring.adjacentCulture && [...candidateTerms].some((term) => adjacentTerms.has(term))) return "adjacent";
  if (workspace.monitoring.globalBreakouts && candidate.status === "corroborated") return "global-breakout";
  return "out-of-scope";
}

function formatDate(value?: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function label(value: string) {
  return value.replaceAll("-", " ").toUpperCase();
}

function Overview({
  workspace,
  trends,
  history,
}: {
  workspace: IntelligenceWorkspace | null;
  trends: DataState<TrendResolutionSnapshot>;
  history: DataState<TrendHistoryCycleSnapshot>;
}) {
  const trendSnapshot = trends.status === "ready" ? trends.data : null;
  const historyCycle = history.status === "ready" ? history.data : null;

  const historyCounts = useMemo(() => {
    if (!historyCycle) return { new: 0, continuing: 0, reappeared: 0, disappeared: 0 };
    const result = { new: 0, continuing: 0, reappeared: 0, disappeared: historyCycle.disappeared.length };
    for (const item of historyCycle.current) result[item.presence] += 1;
    return result;
  }, [historyCycle]);

  return (
    <div className="intelligenceOverview">
      <section className="reportHero">
        <div>
          <div className="eyebrow">LATEST INTELLIGENCE</div>
          <h2>{workspace?.name ?? "Global Pulse"}</h2>
          <p>
            {workspace
              ? "This view turns the latest collected signals into a workspace-facing intelligence summary. Broad-source provenance remains global; relevance is projected against your saved Workspace."
              : "Save a Workspace above to turn the latest global signal pool into a workspace-facing intelligence view."}
          </p>
        </div>
        <div className="reportFreshness">
          <span>{historyCycle?.cyclePurpose === "scheduled" ? "SCHEDULED SNAPSHOT" : "PREVIEW SNAPSHOT"}</span>
          <strong>{formatDate(trendSnapshot?.generatedAt)}</strong>
        </div>
      </section>

      {trends.status === "error" || history.status === "error" ? (
        <div className="demoWarning">Some intelligence data is unavailable. Open Trends or Sources for diagnostics.</div>
      ) : null}

      <div className="reportKpis">
        <article>
          <span>Trend candidates</span>
          <strong>{trendSnapshot ? trendSnapshot.candidateCount + trendSnapshot.corroboratedCount : "—"}</strong>
          <small>{trendSnapshot ? `${trendSnapshot.corroboratedCount} independently corroborated` : "Loading latest resolution"}</small>
        </article>
        <article>
          <span>What changed</span>
          <strong>{historyCycle ? `${historyCounts.new} new` : "—"}</strong>
          <small>{historyCycle ? `${historyCounts.continuing} continuing · ${historyCounts.reappeared} reappeared` : "Loading trend history"}</small>
        </article>
        <article>
          <span>Tracked lineages</span>
          <strong>{historyCycle?.trackedLineageCount ?? "—"}</strong>
          <small>{historyCycle ? `${historyCounts.disappeared} newly disappeared` : "Persistent history pending"}</small>
        </article>
        <article>
          <span>Brand Fit</span>
          <strong>NOT COMPUTED</strong>
          <small>05A establishes Brand Profile readiness; Brand Fit evaluation is downstream.</small>
        </article>
      </div>

      <section className="reportBlock">
        <div className="reportBlockHeading">
          <div>
            <div className="eyebrow">WHAT’S HAPPENING</div>
            <h3>Latest Trend Candidates</h3>
          </div>
          <button type="button" className="textButton" data-open-tab="trends">See full trend evidence in the Trends tab</button>
        </div>

        {trends.status === "loading" ? <div className="reportEmpty">Loading the latest resolved trend snapshot…</div> : null}
        {trends.status === "ready" && !trends.data.candidates.length ? (
          <div className="reportEmpty">No candidate passed the current resolution gate. Trend Pulse does not manufacture a trend when the evidence does not support one.</div>
        ) : null}
        {trends.status === "ready" && trends.data.candidates.length ? (
          <div className="reportTrendList">
            {trends.data.candidates.slice(0, 6).map((candidate) => {
              const projection = classifyProjection(workspace, candidate);
              return (
                <article key={candidate.id}>
                  <div className="reportTrendTopline">
                    <span className={`projectionBadge projection-${projection}`}>{label(projection)}</span>
                    <span>{label(candidate.status)} · {candidate.independentSourceFamilyDiversity} independent families</span>
                  </div>
                  <h4>{candidate.title}</h4>
                  <p>{candidate.summary}</p>
                  <div className="reportEvidenceLine">
                    <span>{candidate.signalIds.length} observations</span>
                    <span>{candidate.independentSourceDiversity} independent sources</span>
                    <span>Lifecycle: {label(candidate.lifecycleStage)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="reportBlock">
        <div className="reportBlockHeading">
          <div>
            <div className="eyebrow">WHAT CHANGED</div>
            <h3>Since the previous canonical cycle</h3>
          </div>
        </div>
        {historyCycle ? (
          <div className="changeSummary">
            <div><strong>{historyCounts.new}</strong><span>New</span></div>
            <div><strong>{historyCounts.continuing}</strong><span>Continuing</span></div>
            <div><strong>{historyCounts.reappeared}</strong><span>Reappeared</span></div>
            <div><strong>{historyCounts.disappeared}</strong><span>Disappeared</span></div>
            <p>
              {historyCycle.cyclePurpose === "scheduled"
                ? `Scheduled cycle ${historyCycle.cycleId} · comparison window ${label(historyCycle.comparisonWindow)}.`
                : "This deployed preview was generated by a QA/non-scheduled run, so it does not advance the canonical production history baseline."}
            </p>
          </div>
        ) : (
          <div className="reportEmpty">Waiting for trend-history data.</div>
        )}
      </section>

      <section className="reportBlock reportBoundary">
        <div className="eyebrow">CURRENT DECISION BOUNDARY</div>
        <h3>Report ≠ recommendation yet.</h3>
        <p>
          This report currently supports evidence-backed detection, corroboration, workspace projection and multi-cycle structural history. Virality, Brand Fit, Opportunity and marketing actions remain intentionally unavailable until their downstream gates are implemented and verified.
        </p>
      </section>
    </div>
  );
}

export default function WorkspaceIntelligence() {
  const [workspace, setWorkspace] = useState<IntelligenceWorkspace | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [trends, setTrends] = useState<DataState<TrendResolutionSnapshot>>({ status: "loading" });
  const [history, setHistory] = useState<DataState<TrendHistoryCycleSnapshot>>({ status: "loading" });

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
    Promise.all([
      fetch("./data/trend-candidates.json", { cache: "no-store" }).then(async (response) => {
        if (!response.ok) throw new Error(`trend-candidates HTTP ${response.status}`);
        return response.json() as Promise<TrendResolutionSnapshot>;
      }),
      fetch("./data/trend-history.json", { cache: "no-store" }).then(async (response) => {
        if (!response.ok) throw new Error(`trend-history HTTP ${response.status}`);
        return response.json() as Promise<TrendHistoryCycleSnapshot>;
      }),
    ])
      .then(([trendSnapshot, historyCycle]) => {
        if (cancelled) return;
        setTrends({ status: "ready", data: trendSnapshot });
        setHistory({ status: "ready", data: historyCycle });
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unknown intelligence data error";
        setTrends({ status: "error", message });
        setHistory({ status: "error", message });
      });
    return () => { cancelled = true; };
  }, []);

  const candidateCount = trends.status === "ready" ? trends.data.candidateCount + trends.data.corroboratedCount : null;

  function openTab(tab: TabId) {
    setActiveTab(tab);
    window.requestAnimationFrame(() => document.getElementById("workspace-intelligence-report")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <section className="workspaceIntelligenceEntry" aria-label="Workspace intelligence report entry">
      <div className="intelligenceEntryCard">
        <div>
          <div className="eyebrow">YOUR INTELLIGENCE</div>
          <h2>{workspace ? `${workspace.name} intelligence is ready to inspect.` : "Save a Workspace to open its intelligence view."}</h2>
          <p>
            {workspace
              ? `Latest resolution currently contains ${candidateCount ?? "…"} Trend Candidate${candidateCount === 1 ? "" : "s"}. Open the report instead of scrolling through collector and schema panels.`
              : "Trend Pulse already collects a global signal pool, but workspace-specific viewing starts after you save a Workspace."}
          </p>
        </div>
        <a
          className={`intelligenceCta ${workspace ? "" : "disabled"}`}
          href={workspace ? "#workspace-intelligence-report" : undefined}
          aria-disabled={!workspace}
          onClick={(event) => {
            if (!workspace) event.preventDefault();
            else setActiveTab("overview");
          }}
        >
          View Intelligence <span>→</span>
        </a>
      </div>

      <div id="workspace-intelligence-report" className="intelligenceShell">
        <header className="intelligenceShellHeader">
          <div>
            <div className="eyebrow">WORKSPACE INTELLIGENCE</div>
            <h2>{workspace?.name ?? "Global Pulse preview"}</h2>
          </div>
          <div className="intelligenceWorkspaceMeta">
            <span>{workspace ? "SAVED WORKSPACE" : "NO WORKSPACE"}</span>
            <strong>{workspace ? workspace.scope.geographies.join(" · ") || "Global" : "Save a Workspace above"}</strong>
          </div>
        </header>

        <nav className="intelligenceTabs" aria-label="Intelligence report sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "active" : ""}
              onClick={() => openTab(tab.id)}
            >
              <strong>{tab.label}</strong>
              <span>{tab.description}</span>
            </button>
          ))}
        </nav>

        <div className="intelligenceTabBody">
          {activeTab === "overview" ? <Overview workspace={workspace} trends={trends} history={history} /> : null}
          {activeTab === "trends" ? <><TrendCandidates /><TrendHistory /></> : null}
          {activeTab === "sources" ? <><SourceIntelligencePanel /><SocialSignals /><PermissionlessSocialSignals /><BackboneSignals /><LiveSignals /></> : null}
          {activeTab === "brand-profile" ? <BrandProfileConsole /> : null}
        </div>
      </div>
    </section>
  );
}
