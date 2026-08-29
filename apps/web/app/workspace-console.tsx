"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import type {
  EntityIntakeMethod,
  EntityIntakeReference,
  FocusBrand,
  IntelligenceWorkspace,
  MonitoredEntity,
  WorkspaceDraft,
  WorkspaceEntityIntelligence,
} from "@trend-pulse/contracts";
import { sampleSignals } from "./sample-signals";

const STORAGE_KEY = "trend-pulse.workspace.v1";

const initialDraft: WorkspaceDraft = {
  name: "Vietnam Mobile Gaming",
  geography: "Vietnam",
  language: "Vietnamese, English",
  industry: "Gaming",
  category: "Mobile Games",
  focusBrands: "",
  product: "",
  audience: "Mobile gamers",
  objectives: "Trend discovery, content opportunities, audience growth",
};

type StoredMonitoredEntity = Omit<MonitoredEntity, "inputMethod" | "resolutionStatus"> & {
  inputMethod?: EntityIntakeMethod;
  resolutionStatus?: MonitoredEntity["resolutionStatus"];
};

type StoredEntityIntelligence = Omit<WorkspaceEntityIntelligence, "monitoredEntities" | "intakeReferences"> & {
  monitoredEntities: StoredMonitoredEntity[];
  intakeReferences?: EntityIntakeReference[];
};

type StoredWorkspace = Omit<IntelligenceWorkspace, "scope" | "focusBrands" | "entityIntelligence"> & {
  scope: IntelligenceWorkspace["scope"] & { brands?: string[]; competitors?: string[] };
  focusBrands?: FocusBrand[];
  entityIntelligence?: StoredEntityIntelligence;
};

const intakeModes: Array<{ id: EntityIntakeMethod; label: string; description: string }> = [
  { id: "typed-text", label: "Type", description: "Type one or several entity names." },
  { id: "pasted-list", label: "Paste list", description: "Paste comma-separated or one-per-line names." },
  { id: "pasted-table", label: "Paste table", description: "Paste a table; the first column is treated as the entity name." },
  { id: "text-file", label: "File", description: "Parse TXT, CSV, TSV or Markdown locally in the browser." },
  { id: "drive-link", label: "Drive link", description: "Store a Google Drive reference for the future Drive resolver." },
  { id: "url-list", label: "URL list", description: "Store entity/company/product URLs for the future URL resolver." },
];

function cleanName(value: string) {
  return value.replace(/^[-*•\d.)\s]+/, "").replace(/^['"]|['"]$/g, "").trim();
}

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitList(value: string) {
  return unique(value.split(/[,;\n\t]+/).map(cleanName).filter(Boolean));
}

function parseEntityNames(value: string, method: EntityIntakeMethod) {
  if (method === "pasted-table") {
    const rows = value.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
    const names = rows.map((row) => cleanName(row.split(/\t|\||,|;/)[0] ?? ""));
    const withoutHeader = names.filter((name, index) => {
      if (index !== 0) return true;
      return !/^(entity|name|company|brand|product|competitor)$/i.test(name);
    });
    return unique(withoutHeader.filter(Boolean));
  }
  return splitList(value);
}

function entityId(name: string) {
  return `entity-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || Date.now()}`;
}

function focusBrandId(name: string) {
  return `focus-brand-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || Date.now()}`;
}

function referenceId(reference: string) {
  let hash = 0;
  for (let index = 0; index < reference.length; index += 1) hash = (hash * 31 + reference.charCodeAt(index)) >>> 0;
  return `entity-ref-${hash}`;
}

function normalizeStoredWorkspace(raw: unknown): IntelligenceWorkspace | null {
  const parsed = raw as StoredWorkspace;
  if (!parsed || parsed.schemaVersion !== "workspace.v1" || !parsed.scope) return null;

  const now = new Date().toISOString();
  const legacyBrands = parsed.scope.brands ?? [];
  const legacyCompetitors = parsed.scope.competitors ?? [];
  const rawMonitored: StoredMonitoredEntity[] = parsed.entityIntelligence?.monitoredEntities ?? legacyCompetitors.map((name) => ({
    id: entityId(name),
    name,
    relationship: "other" as const,
    source: "user" as const,
    inputMethod: "typed-text" as const,
    resolutionStatus: "unresolved" as const,
    pinned: false,
    addedAt: now,
  }));

  const monitoredEntities: MonitoredEntity[] = rawMonitored.map((entity) => ({
    ...entity,
    inputMethod: entity.inputMethod ?? (entity.source === "system-approved" ? "system-research" : "typed-text"),
    resolutionStatus: entity.resolutionStatus ?? "unresolved",
  }));

  const focusBrands = parsed.focusBrands ?? legacyBrands.map((name) => ({
    id: focusBrandId(name),
    name,
    source: "user" as const,
    addedAt: now,
  }));

  return {
    ...parsed,
    scope: {
      geographies: parsed.scope.geographies ?? [],
      languages: parsed.scope.languages ?? [],
      industries: parsed.scope.industries ?? [],
      categories: parsed.scope.categories ?? [],
      products: parsed.scope.products ?? [],
      audiences: parsed.scope.audiences ?? [],
      objectives: parsed.scope.objectives ?? [],
      riskBoundaries: parsed.scope.riskBoundaries ?? [],
    },
    focusBrands,
    entityIntelligence: {
      autoDiscover: parsed.entityIntelligence?.autoDiscover ?? true,
      monitoredEntities,
      excludedEntities: parsed.entityIntelligence?.excludedEntities ?? [],
      intakeReferences: parsed.entityIntelligence?.intakeReferences ?? [],
    },
  };
}

function workspaceToDraft(workspace: IntelligenceWorkspace): WorkspaceDraft {
  return {
    name: workspace.name,
    geography: workspace.scope.geographies.join(", "),
    language: workspace.scope.languages.join(", "),
    industry: workspace.scope.industries.join(", "),
    category: workspace.scope.categories.join(", "),
    focusBrands: workspace.focusBrands.map((brand) => brand.name).join(", "),
    product: workspace.scope.products.join(", "),
    audience: workspace.scope.audiences.join(", "),
    objectives: workspace.scope.objectives.join(", "),
  };
}

function buildFocusBrands(value: string, previous?: FocusBrand[]) {
  const now = new Date().toISOString();
  return splitList(value).map((name) => {
    const existing = previous?.find((brand) => brand.name.toLowerCase() === name.toLowerCase());
    return existing ?? { id: focusBrandId(name), name, source: "user" as const, addedAt: now };
  });
}

function buildWorkspace(
  draft: WorkspaceDraft,
  monitoredEntities: MonitoredEntity[],
  intakeReferences: EntityIntakeReference[],
  previous?: IntelligenceWorkspace,
): IntelligenceWorkspace {
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
      products: splitList(draft.product),
      audiences: splitList(draft.audience),
      objectives: splitList(draft.objectives),
      riskBoundaries: [],
    },
    focusBrands: buildFocusBrands(draft.focusBrands, previous?.focusBrands),
    entityIntelligence: {
      autoDiscover: true,
      monitoredEntities,
      excludedEntities: previous?.entityIntelligence.excludedEntities ?? [],
      intakeReferences,
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

function Field({ label, helper, value, placeholder, onChange }: { label: string; helper?: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      {helper ? <small>{helper}</small> : null}
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export default function WorkspaceConsole() {
  const [draft, setDraft] = useState<WorkspaceDraft>(initialDraft);
  const [workspace, setWorkspace] = useState<IntelligenceWorkspace | null>(null);
  const [monitoredEntities, setMonitoredEntities] = useState<MonitoredEntity[]>([]);
  const [intakeReferences, setIntakeReferences] = useState<EntityIntakeReference[]>([]);
  const [intakeMethod, setIntakeMethod] = useState<EntityIntakeMethod>("typed-text");
  const [entityInput, setEntityInput] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [intakeNotice, setIntakeNotice] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = normalizeStoredWorkspace(JSON.parse(saved));
        if (parsed) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          setWorkspace(parsed);
          setDraft(workspaceToDraft(parsed));
          setMonitoredEntities(parsed.entityIntelligence.monitoredEntities);
          setIntakeReferences(parsed.entityIntelligence.intakeReferences);
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setHydrated(true);
  }, []);

  const scopeSummary = useMemo(() => {
    if (!workspace) return [];
    return unique([
      ...workspace.scope.geographies,
      ...workspace.scope.industries,
      ...workspace.scope.categories,
      ...workspace.focusBrands.map((brand) => brand.name),
      ...workspace.scope.products,
    ]).slice(0, 8);
  }, [workspace]);

  const previewNames = useMemo(() => {
    if (["typed-text", "pasted-list", "pasted-table", "text-file"].includes(intakeMethod)) {
      return parseEntityNames(entityInput, intakeMethod).slice(0, 12);
    }
    return [];
  }, [entityInput, intakeMethod]);

  function updateDraft<K extends keyof WorkspaceDraft>(key: K, value: WorkspaceDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function mergeMonitoredEntities(names: string[], method: EntityIntakeMethod, sourceReference?: string) {
    const now = new Date().toISOString();
    setMonitoredEntities((current) => {
      const next = [...current];
      for (const name of names) {
        if (next.some((entity) => entity.name.toLowerCase() === name.toLowerCase())) continue;
        next.push({
          id: entityId(name),
          name,
          relationship: "other",
          source: "user",
          inputMethod: method,
          resolutionStatus: "unresolved",
          sourceReference,
          pinned: false,
          addedAt: now,
        });
      }
      return next;
    });
  }

  function addEntityInput() {
    setIntakeNotice("");
    if (["drive-link", "url-list"].includes(intakeMethod)) {
      const references = intakeMethod === "drive-link" ? [entityInput.trim()] : splitList(entityInput);
      const valid = references.filter((reference) => {
        try {
          const url = new URL(reference);
          return intakeMethod === "drive-link" ? url.hostname.endsWith("drive.google.com") : ["http:", "https:"].includes(url.protocol);
        } catch {
          return false;
        }
      });
      if (!valid.length) {
        setIntakeNotice(intakeMethod === "drive-link" ? "Paste a valid Google Drive URL." : "Paste one or more valid HTTP(S) URLs.");
        return;
      }
      const now = new Date().toISOString();
      setIntakeReferences((current) => {
        const existing = new Set(current.map((item) => item.reference));
        return [
          ...current,
          ...valid.filter((reference) => !existing.has(reference)).map((reference) => ({
            id: referenceId(reference),
            method: intakeMethod as "drive-link" | "url-list",
            reference,
            status: "pending-resolver" as const,
            createdAt: now,
          })),
        ];
      });
      setEntityInput("");
      setIntakeNotice(`${valid.length} reference${valid.length > 1 ? "s" : ""} saved as pending resolver input.`);
      return;
    }

    const names = parseEntityNames(entityInput, intakeMethod);
    if (!names.length) {
      setIntakeNotice("No entity names detected yet.");
      return;
    }
    mergeMonitoredEntities(names, intakeMethod, selectedFileName || undefined);
    setEntityInput("");
    setSelectedFileName("");
    setIntakeNotice(`${names.length} entit${names.length > 1 ? "ies" : "y"} added to the monitored set. Classification can be refined later.`);
  }

  async function handleEntityFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setIntakeNotice("");
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["txt", "csv", "tsv", "md"].includes(extension)) {
      setSelectedFileName("");
      setEntityInput("");
      setIntakeNotice("Stage 02S parses TXT, CSV, TSV and Markdown locally. XLSX/PDF need a later file resolver.");
      return;
    }
    setSelectedFileName(file.name);
    setEntityInput(await file.text());
  }

  function removeEntity(id: string) {
    setMonitoredEntities((current) => current.filter((entity) => entity.id !== id));
  }

  function removeReference(id: string) {
    setIntakeReferences((current) => current.filter((reference) => reference.id !== id));
  }

  function saveWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = buildWorkspace(draft, monitoredEntities, intakeReferences, workspace ?? undefined);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setWorkspace(next);
  }

  function clearWorkspace() {
    window.localStorage.removeItem(STORAGE_KEY);
    setWorkspace(null);
    setDraft(initialDraft);
    setMonitoredEntities([]);
    setIntakeReferences([]);
    setEntityInput("");
    setSelectedFileName("");
    setIntakeNotice("");
  }

  const currentMode = intakeModes.find((mode) => mode.id === intakeMethod) ?? intakeModes[0];

  return (
    <div className="workspaceConsole">
      <section className="workspaceHeader">
        <div>
          <div className="eyebrow">BUILD STAGE 02S · WORKSPACE + ENTITY INTAKE</div>
          <h1>Define the market. Let the system discover the rest.</h1>
          <p className="lead">Workspace scope, Focus Brand(s) and monitored entities now have distinct jobs. Competitors can be discovered automatically or supplied by the user through several intake formats.</p>
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
            <span className="schemaTag">workspace.v1 · provisional</span>
          </div>

          <div className="formGrid">
            <Field label="Workspace name" value={draft.name} onChange={(value) => updateDraft("name", value)} />
            <Field label="Geography / market" value={draft.geography} onChange={(value) => updateDraft("geography", value)} />
            <Field label="Language" value={draft.language} onChange={(value) => updateDraft("language", value)} />
            <Field label="Industry" value={draft.industry} onChange={(value) => updateDraft("industry", value)} />
            <Field label="Category" value={draft.category} onChange={(value) => updateDraft("category", value)} />
            <Field label="Audience" value={draft.audience} onChange={(value) => updateDraft("audience", value)} />
            <Field
              label="Focus Brand(s) (optional)"
              helper="Brands you want Trend Pulse to evaluate trends and opportunities for. Leave blank for market/category intelligence only."
              value={draft.focusBrands}
              placeholder="e.g. Cocoon, Brand B"
              onChange={(value) => updateDraft("focusBrands", value)}
            />
            <Field label="Product (optional)" value={draft.product} placeholder="Products within the workspace scope" onChange={(value) => updateDraft("product", value)} />
            <Field label="Objectives" value={draft.objectives} onChange={(value) => updateDraft("objectives", value)} />
          </div>

          <div className="monitoringCard">
            <div>
              <strong>Always-on discovery defaults</strong>
              <p>Market Pulse + Watchlists + Ad-hoc Explore, with adjacent culture, global breakouts and entity discovery enabled.</p>
            </div>
            <span>ON</span>
          </div>

          <section className="entityPanel" aria-label="Competitor and entity intelligence">
            <div className="entityPanelHeader">
              <div>
                <div className="eyebrow">COMPETITOR & ENTITY INTELLIGENCE</div>
                <h3>Auto-discover + user-supplied entities</h3>
                <p>System suggestions remain candidates until approved. User-supplied entities enter the monitored set with provenance showing how they were added.</p>
              </div>
              <span className="autoBadge">AUTO DISCOVERY ON</span>
            </div>

            <div className="entityPipeline" aria-label="Entity discovery flow">
              <span>Workspace scope</span><b>→</b><span>Research / user intake</span><b>→</b><span>Resolve + dedupe</span><b>→</b><span>Curate</span><b>→</b><span>Monitoring set</span>
            </div>

            <div className="entityIntake">
              <div className="entityColumnTitle"><strong>Add entities</strong><span>multiple input formats</span></div>
              <div className="inputModeRow">
                {intakeModes.filter((mode) => mode.id !== "system-research").map((mode) => (
                  <button
                    className={`modeButton ${intakeMethod === mode.id ? "active" : ""}`}
                    type="button"
                    key={mode.id}
                    onClick={() => {
                      setIntakeMethod(mode.id);
                      setEntityInput("");
                      setSelectedFileName("");
                      setIntakeNotice("");
                    }}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <p className="modeDescription">{currentMode.description}</p>

              {intakeMethod === "text-file" ? (
                <div className="filePicker">
                  <input type="file" accept=".txt,.csv,.tsv,.md,text/plain,text/csv,text/tab-separated-values,text/markdown" onChange={handleEntityFile} />
                  <span>{selectedFileName || "Supported now: TXT · CSV · TSV · MD"}</span>
                </div>
              ) : (
                <textarea
                  className="entityTextarea"
                  value={entityInput}
                  onChange={(event) => setEntityInput(event.target.value)}
                  placeholder={intakeMethod === "drive-link" ? "https://drive.google.com/..." : intakeMethod === "url-list" ? "https://company-a.com\nhttps://product-b.com" : intakeMethod === "pasted-table" ? "Entity\tType\nCompany A\tCompetitor\nCompany B\tBenchmark" : "Garena\nVNGGames\nAmanotes"}
                  rows={5}
                />
              )}

              {intakeMethod === "text-file" && entityInput ? <div className="filePreview">Detected {parseEntityNames(entityInput, intakeMethod).length} possible entity names from {selectedFileName}.</div> : null}
              {previewNames.length ? <div className="intakePreview"><span>Preview</span>{previewNames.map((name) => <b key={name}>{name}</b>)}</div> : null}

              <div className="intakeActionRow">
                <button className="secondaryButton" type="button" onClick={addEntityInput}>
                  {["drive-link", "url-list"].includes(intakeMethod) ? "Save resolver reference" : "Add to monitored entities"}
                </button>
                <small>Changes persist when you save/update the workspace.</small>
              </div>
              {intakeNotice ? <div className="intakeNotice">{intakeNotice}</div> : null}
            </div>

            <div className="entityColumns">
              <div className="entityColumn">
                <div className="entityColumnTitle"><strong>Suggested candidates</strong><span>system output</span></div>
                <div className="candidateEmpty">
                  <strong>No fabricated candidates.</strong>
                  <p>Real suggestions will appear after evidence-backed research is connected. Each candidate must include relationship type, reason and evidence before approval.</p>
                  <div className="futureControls">Approve · Pin · Ignore · Exclude</div>
                </div>
              </div>
              <div className="entityColumn">
                <div className="entityColumnTitle"><strong>Monitored entities</strong><span>{monitoredEntities.length} current</span></div>
                {monitoredEntities.length ? (
                  <div className="entityChips">
                    {monitoredEntities.map((entity) => (
                      <div className="entityToken" key={entity.id}>
                        <span>{entity.name}</span>
                        <small>{entity.inputMethod}</small>
                        <button type="button" aria-label={`Remove ${entity.name}`} onClick={() => removeEntity(entity.id)}>×</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="candidateEmpty compact"><p>This can stay empty. Trend Pulse should still discover candidate competitors/entities from the workspace scope.</p></div>
                )}
              </div>
            </div>

            {intakeReferences.length ? (
              <div className="pendingRefs">
                <div className="entityColumnTitle"><strong>Pending resolver references</strong><span>{intakeReferences.length}</span></div>
                {intakeReferences.map((item) => (
                  <div className="pendingRef" key={item.id}>
                    <div><b>{item.method}</b><span>{item.reference}</span></div>
                    <em>{item.status}</em>
                    <button type="button" onClick={() => removeReference(item.id)}>Remove</button>
                  </div>
                ))}
                <p>Drive/URL references are stored only. Stage 02S does not fetch or infer entity names from them yet.</p>
              </div>
            ) : null}
          </section>

          <div className="formActions">
            <button className="primaryButton" type="submit">{workspace ? "Update workspace" : "Save workspace"}</button>
            {workspace ? <button className="secondaryButton" type="button" onClick={clearWorkspace}>Reset local demo</button> : null}
          </div>
          <p className="prototypeNote">Stage 02S uses browser localStorage. Focus Brand(s) are decision targets; monitored entities are comparison/watch targets. Drive and arbitrary URL resolution will be implemented only when the relevant connector/runtime exists.</p>
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
              <div className="scopeChips">{scopeSummary.map((item) => <span key={item}>{item}</span>)}</div>
              <dl className="stateList">
                <div><dt>Status</dt><dd>{workspace.status}</dd></div>
                <div><dt>Focus brands</dt><dd>{workspace.focusBrands.length || "Market-only"}</dd></div>
                <div><dt>Entity discovery</dt><dd>{workspace.entityIntelligence.autoDiscover ? "Auto" : "Off"}</dd></div>
                <div><dt>Monitored entities</dt><dd>{workspace.entityIntelligence.monitoredEntities.length}</dd></div>
                <div><dt>Pending refs</dt><dd>{workspace.entityIntelligence.intakeReferences.length}</dd></div>
                <div><dt>Updated</dt><dd>{new Date(workspace.updatedAt).toLocaleString()}</dd></div>
              </dl>
              <div className="logicCallout"><strong>Focus Brand ≠ competitor.</strong> Focus Brand(s) are the brands Trend Pulse evaluates opportunities for. Monitored entities are entities to compare, watch or investigate.</div>
            </>
          ) : (
            <p className="emptyState">Save once to persist scope, Focus Brand(s), monitored entities and pending entity references in this browser.</p>
          )}
        </aside>
      </section>

      <section className="signalSection">
        <div className="sectionHeading">
          <div>
            <div className="eyebrow">NORMALIZED SIGNAL CONTRACT</div>
            <h2>Every future connector must speak the same language.</h2>
            <p>YouTube, RSS, news and future paid sources will map source-specific data into <code>signal.v1</code> before trend or entity discovery.</p>
          </div>
          <span className="schemaTag">signal.v1 · provisional</span>
        </div>
        <div className="demoWarning">DEMO CONTRACT DATA · These cards validate the schema/UI only. No live source is connected in Stage 02S.</div>
        <div className="signalGrid">
          {sampleSignals.map((signal) => (
            <article className="signalCard" key={signal.id}>
              <div className="signalTopline"><span>{signal.source.sourceName}</span><span>{signal.source.freshness}</span></div>
              <h3>{signal.topic}</h3>
              <p>{signal.evidence.reference}</p>
              <div className="signalMeta"><span>{signal.geography ?? "Unknown market"}</span><span>{signal.language ?? "Unknown language"}</span><span>confidence {Math.round(signal.confidence.score * 100)}%</span></div>
              <div className="contractTrace"><span>source</span><b>→</b><span>metrics</span><b>→</b><span>dynamics</span><b>→</b><span>evidence</span></div>
            </article>
          ))}
        </div>
      </section>

      <section className="nextStep">
        <div><div className="eyebrow">NEXT · STAGE 03</div><h2>Connect real sources → normalize observations → begin evidence-backed signal and entity discovery.</h2></div>
        <div className="stage">03</div>
      </section>
    </div>
  );
}
