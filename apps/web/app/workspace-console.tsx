"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { IntelligenceWorkspace, WorkspaceDraft } from "@trend-pulse/contracts";
import { sampleSignals } from "./sample-signals";

const STORAGE_KEY = "trend-pulse.workspace.v1";

const initialDraft: WorkspaceDraft = {
  name: "Vietnam Mobile Gaming",
  geography: "Vietnam",
  language: "Vietnamese, English",
  industry: "Gaming",
  category: "Mobile Games",
  brand: "",
  product: "",
  audience: "Mobile gamers",
  competitors: "",
  objectives: "Trend discovery, content opportunities, audience growth",
};

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function workspaceToDraft(workspace: IntelligenceWorkspace): WorkspaceDraft {
  return {
    name: workspace.name,
    geography: workspace.scope.geographies.join(", "),
    language: workspace.scope.languages.join(", "),
    industry: workspace.scope.industries.join(", "),
    category: workspace.scope.categories.join(", "),
    brand: workspace.scope.brands.join(", "),
    product: workspace.scope.products.join(", "),
    audience: workspace.scope.audiences.join(", "),
    competitors: workspace.scope.competitors.join(", "),
    objectives: workspace.scope.objectives.join(", "),
  };
}

function buildWorkspace(draft: WorkspaceDraft, previous?: IntelligenceWorkspace): IntelligenceWorkspace {
  const now = new Date().toISOString();
  return {
    schemaVersion: "workspace.v1",
    id: previous?.id ?? `workspace-${Date.now()}`,
    name: draft.name.trim() || "Untitled workspace",
    status: previous?.status ?? "active",
    scope: {
      geographies: splitList(draft.geography),
      languages: splitList(draft.language),
      industries: splitList(draft.industry),
      categories: splitList(draft.category),
      brands: splitList(draft.brand),
      products: splitList(draft.product),
      audiences: splitList(draft.audience),
      competitors: splitList(draft.competitors),
      objectives: splitList(draft.objectives),
      riskBoundaries: [],
    },
    monitoring: {
      modes: ["market-pulse", "watchlist", "ad-hoc"],
      broadDiscovery: true,
      adjacentCulture: true,
      globalBreakouts: true,
    },
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export default function WorkspaceConsole() {
  const [draft, setDraft] = useState<WorkspaceDraft>(initialDraft);
  const [workspace, setWorkspace] = useState<IntelligenceWorkspace | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as IntelligenceWorkspace;
        if (parsed.schemaVersion === "workspace.v1") {
          setWorkspace(parsed);
          setDraft(workspaceToDraft(parsed));
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setHydrated(true);
  }, []);

  const scopeSummary = useMemo(() => {
    if (!workspace) return [];
    return [
      ...workspace.scope.geographies,
      ...workspace.scope.industries,
      ...workspace.scope.categories,
      ...workspace.scope.brands,
      ...workspace.scope.products,
    ].slice(0, 7);
  }, [workspace]);

  function updateDraft<K extends keyof WorkspaceDraft>(key: K, value: WorkspaceDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function saveWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = buildWorkspace(draft, workspace ?? undefined);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setWorkspace(next);
  }

  function clearWorkspace() {
    window.localStorage.removeItem(STORAGE_KEY);
    setWorkspace(null);
    setDraft(initialDraft);
  }

  return (
    <div className="workspaceConsole">
      <section className="workspaceHeader">
        <div>
          <div className="eyebrow">BUILD STAGE 02 · WORKSPACE + SIGNAL CONTRACT</div>
          <h1>Define once. Monitor continuously.</h1>
          <p className="lead">
            The workspace stores where Trend Pulse should look. Trends are outputs the system will discover — not keywords you must know in advance.
          </p>
        </div>
        <div className={`persistenceBadge ${workspace ? "saved" : "draft"}`}>
          <span className="statusDot" />
          {hydrated ? (workspace ? "Workspace saved in this browser" : "Unsaved workspace draft") : "Loading workspace"}
        </div>
      </section>

      <section className="workspaceLayout">
        <form className="workspaceForm" onSubmit={saveWorkspace}>
          <div className="sectionHeading">
            <div>
              <div className="eyebrow">INTELLIGENCE SCOPE</div>
              <h2>Workspace configuration</h2>
            </div>
            <span className="schemaTag">workspace.v1</span>
          </div>

          <div className="formGrid">
            <Field label="Workspace name" value={draft.name} onChange={(value) => updateDraft("name", value)} />
            <Field label="Geography / market" value={draft.geography} onChange={(value) => updateDraft("geography", value)} />
            <Field label="Language" value={draft.language} onChange={(value) => updateDraft("language", value)} />
            <Field label="Industry" value={draft.industry} onChange={(value) => updateDraft("industry", value)} />
            <Field label="Category" value={draft.category} onChange={(value) => updateDraft("category", value)} />
            <Field label="Audience" value={draft.audience} onChange={(value) => updateDraft("audience", value)} />
            <Field label="Brand (optional)" value={draft.brand} placeholder="Leave blank for market intelligence" onChange={(value) => updateDraft("brand", value)} />
            <Field label="Product (optional)" value={draft.product} placeholder="One or more products" onChange={(value) => updateDraft("product", value)} />
            <Field label="Competitors / watch entities" value={draft.competitors} placeholder="Comma separated" onChange={(value) => updateDraft("competitors", value)} />
            <Field label="Objectives" value={draft.objectives} onChange={(value) => updateDraft("objectives", value)} />
          </div>

          <div className="monitoringCard">
            <div>
              <strong>Always-on discovery defaults</strong>
              <p>Market Pulse + Watchlists + Ad-hoc Explore, with adjacent culture and global breakouts enabled.</p>
            </div>
            <span>ON</span>
          </div>

          <div className="formActions">
            <button className="primaryButton" type="submit">{workspace ? "Update workspace" : "Save workspace"}</button>
            {workspace ? <button className="secondaryButton" type="button" onClick={clearWorkspace}>Reset local demo</button> : null}
          </div>
          <p className="prototypeNote">Stage 02 persistence uses browser localStorage only. Database persistence is intentionally deferred until the storage research gate is resolved.</p>
        </form>

        <aside className="workspaceState">
          <div className="sectionHeading compact">
            <div>
              <div className="eyebrow">PERSISTENT STATE</div>
              <h2>{workspace?.name ?? "No saved workspace yet"}</h2>
            </div>
          </div>
          {workspace ? (
            <>
              <div className="scopeChips">
                {scopeSummary.map((item) => <span key={item}>{item}</span>)}
              </div>
              <dl className="stateList">
                <div><dt>Status</dt><dd>{workspace.status}</dd></div>
                <div><dt>Discovery</dt><dd>Open + adjacent + global</dd></div>
                <div><dt>Modes</dt><dd>{workspace.monitoring.modes.length}</dd></div>
                <div><dt>Updated</dt><dd>{new Date(workspace.updatedAt).toLocaleString()}</dd></div>
              </dl>
              <div className="logicCallout"><strong>Important:</strong> this scope tells the system where to look. It does not tell the system which trend to find.</div>
            </>
          ) : (
            <p className="emptyState">Save the form once. Reloading this page will restore the same workspace automatically.</p>
          )}
        </aside>
      </section>

      <section className="signalSection">
        <div className="sectionHeading">
          <div>
            <div className="eyebrow">NORMALIZED SIGNAL CONTRACT</div>
            <h2>Every future connector must speak the same language.</h2>
            <p>YouTube, RSS, news and future paid sources will map source-specific data into <code>signal.v1</code> before trend detection.</p>
          </div>
          <span className="schemaTag">signal.v1</span>
        </div>

        <div className="demoWarning">DEMO CONTRACT DATA · These cards validate the schema/UI only. No live source is connected in Stage 02.</div>
        <div className="signalGrid">
          {sampleSignals.map((signal) => (
            <article className="signalCard" key={signal.id}>
              <div className="signalTopline">
                <span>{signal.source.sourceName}</span>
                <span>{signal.source.freshness}</span>
              </div>
              <h3>{signal.topic}</h3>
              <p>{signal.evidence.reference}</p>
              <div className="signalMeta">
                <span>{signal.geography ?? "Unknown market"}</span>
                <span>{signal.language ?? "Unknown language"}</span>
                <span>confidence {Math.round(signal.confidence.score * 100)}%</span>
              </div>
              <div className="contractTrace">
                <span>source</span><b>→</b><span>metrics</span><b>→</b><span>dynamics</span><b>→</b><span>evidence</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="nextStep">
        <div>
          <div className="eyebrow">NEXT · STAGE 03</div>
          <h2>Connect one real source → normalize real observations into Signal v1 → render evidence-backed signals.</h2>
        </div>
        <div className="stage">03</div>
      </section>
    </div>
  );
}
