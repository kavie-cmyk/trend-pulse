"use client";

import { useEffect, useMemo, useState } from "react";
import type { FocusBrand, IntelligenceWorkspace } from "@trend-pulse/contracts";
import type { BrandProfileFieldKey, BrandProfileReference, BrandProfileStore } from "@trend-pulse/contracts/brand-profile";
import {
  BRAND_PROFILE_STORAGE_KEY,
  WORKSPACE_STORAGE_KEY,
  buildBrandProfileRecord,
  draftFromWorkspace,
  emptyBrandProfileStore,
  normalizeBrandProfileStore,
  referenceId,
  upsertBrandProfileRecord,
  type BrandProfileDraft,
} from "./brand-profile-foundation";

const fieldLabels: Array<{ key: keyof BrandProfileDraft; label: string; helper: string }> = [
  { key: "categories", label: "Categories", helper: "What market/category does this Focus Brand actually compete in?" },
  { key: "markets", label: "Markets", helper: "Countries, regions or market scopes relevant to brand decisions." },
  { key: "targetAudiences", label: "Target audiences", helper: "Who the brand is trying to reach; inherited from Workspace until refined." },
  { key: "positioning", label: "Positioning", helper: "How the brand wants to be perceived relative to alternatives." },
  { key: "valueProposition", label: "Value proposition", helper: "Core customer value; can satisfy the strategic-identity gate with positioning." },
  { key: "toneOfVoice", label: "Tone of voice", helper: "Language/personality rules relevant to cultural and creative fit." },
  { key: "visualCodes", label: "Visual codes", helper: "Recurring visual language, motifs or aesthetic boundaries." },
  { key: "productLines", label: "Product lines", helper: "Products/services the brand may naturally connect to a trend." },
  { key: "contentPillars", label: "Content pillars", helper: "Recurring content territories; can satisfy the expressive-context gate with tone of voice." },
  { key: "do", label: "Do", helper: "Brand behaviors, messages or creative approaches that are explicitly encouraged." },
  { key: "dont", label: "Don't", helper: "Explicit brand exclusions or behaviors to avoid." },
  { key: "riskBoundaries", label: "Risk boundaries", helper: "Sensitive topics, reputational constraints or compliance boundaries." },
  { key: "commercialObjectives", label: "Commercial objectives", helper: "Growth, acquisition, conversion, launch, retention or other business outcomes." },
  { key: "creatorPriorities", label: "Creator priorities", helper: "Preferred creator types, communities or collaboration models." },
  { key: "paidPriorities", label: "Paid priorities", helper: "Paid media goals or channels that matter to execution feasibility." },
  { key: "seoPriorities", label: "SEO / search priorities", helper: "Search territories or demand areas relevant to the brand." },
];

function loadWorkspace(): IntelligenceWorkspace | null {
  const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as IntelligenceWorkspace;
    return parsed?.schemaVersion === "workspace.v1" && Array.isArray(parsed.focusBrands) ? parsed : null;
  } catch {
    return null;
  }
}

function loadStore(): BrandProfileStore {
  const raw = window.localStorage.getItem(BRAND_PROFILE_STORAGE_KEY);
  if (!raw) return emptyBrandProfileStore();
  try {
    return normalizeBrandProfileStore(JSON.parse(raw));
  } catch {
    return emptyBrandProfileStore();
  }
}

function blankDraft(): BrandProfileDraft {
  return {
    categories: "",
    markets: "",
    targetAudiences: "",
    positioning: "",
    valueProposition: "",
    toneOfVoice: "",
    visualCodes: "",
    productLines: "",
    contentPillars: "",
    do: "",
    dont: "",
    riskBoundaries: "",
    commercialObjectives: "",
    creatorPriorities: "",
    paidPriorities: "",
    seoPriorities: "",
  };
}

function fieldLabel(field: BrandProfileFieldKey) {
  return fieldLabels.find((item) => item.key === field)?.label ?? field;
}

function validHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function profileReference(method: BrandProfileReference["method"], value: string, label: string): BrandProfileReference {
  const now = new Date().toISOString();
  return {
    id: referenceId(`${method}|${value}`),
    method,
    label,
    ...(method === "pasted-brief" ? { rawText: value } : { reference: value }),
    status: "pending-resolver",
    createdAt: now,
  };
}

function BrandField({ item, value, onChange }: { item: (typeof fieldLabels)[number]; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{item.label}</span>
      <small>{item.helper}</small>
      <textarea className="entityTextarea" rows={3} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Comma-separated or one item per line" />
    </label>
  );
}

export default function BrandProfileConsole() {
  const [workspace, setWorkspace] = useState<IntelligenceWorkspace | null>(null);
  const [store, setStore] = useState<BrandProfileStore>(emptyBrandProfileStore());
  const [selectedFocusBrandId, setSelectedFocusBrandId] = useState("");
  const [draft, setDraft] = useState<BrandProfileDraft>(blankDraft());
  const [references, setReferences] = useState<BrandProfileReference[]>([]);
  const [referenceMode, setReferenceMode] = useState<BrandProfileReference["method"]>("pasted-brief");
  const [referenceInput, setReferenceInput] = useState("");
  const [notice, setNotice] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => {
      const parsed = loadWorkspace();
      setWorkspace((current) => {
        if (!parsed) return null;
        if (current?.id === parsed.id && current.updatedAt === parsed.updatedAt) return current;
        return parsed;
      });
    };
    sync();
    setStore(loadStore());
    setHydrated(true);
    const interval = window.setInterval(sync, 800);
    return () => window.clearInterval(interval);
  }, []);

  const focusBrands = workspace?.focusBrands ?? [];
  const selectedFocusBrand: FocusBrand | undefined = focusBrands.find((brand) => brand.id === selectedFocusBrandId) ?? focusBrands[0];

  useEffect(() => {
    if (!selectedFocusBrand && selectedFocusBrandId) setSelectedFocusBrandId("");
    if (selectedFocusBrand && selectedFocusBrand.id !== selectedFocusBrandId) setSelectedFocusBrandId(selectedFocusBrand.id);
  }, [selectedFocusBrand, selectedFocusBrandId]);

  useEffect(() => {
    if (!workspace || !selectedFocusBrand) {
      setDraft(blankDraft());
      setReferences([]);
      return;
    }
    const existing = store.records.find((record) => record.profile.workspaceId === workspace.id && record.profile.focusBrandId === selectedFocusBrand.id);
    setDraft(draftFromWorkspace(workspace, selectedFocusBrand, existing));
    setReferences(existing?.pendingReferences ?? []);
    setNotice("");
  }, [workspace, selectedFocusBrand?.id]);

  const existingRecord = workspace && selectedFocusBrand
    ? store.records.find((record) => record.profile.workspaceId === workspace.id && record.profile.focusBrandId === selectedFocusBrand.id)
    : undefined;

  const previewRecord = useMemo(() => {
    if (!workspace || !selectedFocusBrand) return null;
    return buildBrandProfileRecord(workspace, selectedFocusBrand, draft, references, existingRecord, existingRecord?.updatedAt ?? new Date().toISOString());
  }, [workspace, selectedFocusBrand, draft, references, existingRecord]);

  function updateDraft(key: keyof BrandProfileDraft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function addReference() {
    setNotice("");
    const trimmed = referenceInput.trim();
    if (!trimmed) {
      setNotice("Add a brief or reference first.");
      return;
    }

    let additions: BrandProfileReference[] = [];
    if (referenceMode === "pasted-brief") {
      additions = [profileReference("pasted-brief", trimmed, "Pasted brand brief")];
    } else {
      const values = trimmed.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
      const valid = values.filter(validHttpUrl).filter((value) => {
        if (referenceMode !== "drive-reference") return true;
        const host = new URL(value).hostname;
        return host.endsWith("drive.google.com") || host.endsWith("docs.google.com");
      });
      if (!valid.length) {
        setNotice(referenceMode === "drive-reference" ? "No valid Google Drive/Docs URL detected." : "No valid HTTP(S) URL detected.");
        return;
      }
      additions = valid.map((value) => profileReference(referenceMode, value, referenceMode === "drive-reference" ? "Drive brand reference" : "Brand URL reference"));
    }

    setReferences((current) => {
      const known = new Set(current.map((item) => item.id));
      return [...current, ...additions.filter((item) => !known.has(item.id))];
    });
    setReferenceInput("");
    setNotice(`${additions.length} input${additions.length === 1 ? "" : "s"} stored as pending resolver context. No brand facts were inferred from it.`);
  }

  function removeReference(id: string) {
    setReferences((current) => current.filter((item) => item.id !== id));
  }

  function saveProfile() {
    if (!workspace || !selectedFocusBrand) return;
    const record = buildBrandProfileRecord(workspace, selectedFocusBrand, draft, references, existingRecord);
    const next = upsertBrandProfileRecord(store, record);
    window.localStorage.setItem(BRAND_PROFILE_STORAGE_KEY, JSON.stringify(next));
    setStore(next);
    setNotice(`Brand Profile saved · ${record.readiness.status}.`);
  }

  function deleteProfile() {
    if (!workspace || !selectedFocusBrand) return;
    const records = store.records.filter((record) => !(record.profile.workspaceId === workspace.id && record.profile.focusBrandId === selectedFocusBrand.id));
    const next: BrandProfileStore = { schemaVersion: "brand-profile-store.v1", records, updatedAt: new Date().toISOString() };
    window.localStorage.setItem(BRAND_PROFILE_STORAGE_KEY, JSON.stringify(next));
    setStore(next);
    setDraft(draftFromWorkspace(workspace, selectedFocusBrand));
    setReferences([]);
    setNotice("Saved Brand Profile removed. Workspace-derived context remains available as a new draft.");
  }

  const readiness = previewRecord?.readiness;
  const populatedFieldCount = previewRecord?.provenance.length ?? 0;

  return (
    <section className="signalSection" aria-label="Brand Profile intake and resolution foundation">
      <div className="sectionHeading">
        <div>
          <div className="eyebrow">STAGE 05A · BRAND PROFILE INTAKE & RESOLUTION FOUNDATION</div>
          <h2>Brand Fit starts with brand context — never with the brand name alone.</h2>
          <p>Build a reusable <code>brand-profile.v1</code> for each Focus Brand. Workspace context can seed the draft; direct input has field-level provenance; unresolved briefs/URLs remain pending inputs and are not converted into facts.</p>
        </div>
        <span className="schemaTag">brand-profile-foundation.v1</span>
      </div>

      {!hydrated ? <p className="emptyState">Loading saved Workspace and Brand Profiles…</p> : null}
      {hydrated && !workspace ? (
        <div className="candidateEmpty" style={{ marginTop: 18 }}>
          <strong>No saved Workspace.</strong>
          <p>Save a Workspace first. 05A attaches Brand Profiles to Focus Brand IDs rather than creating detached brand records.</p>
        </div>
      ) : null}
      {workspace && !focusBrands.length ? (
        <div className="candidateEmpty" style={{ marginTop: 18 }}>
          <strong>Market-only Workspace.</strong>
          <p>This is valid. Add a Focus Brand only when you want Brand Fit / Opportunity intelligence for a specific decision target.</p>
        </div>
      ) : null}

      {workspace && selectedFocusBrand ? (
        <>
          <div className="monitoringCard">
            <div>
              <strong>Focus Brand · {selectedFocusBrand.name}</strong>
              <p>Workspace: {workspace.name}. This profile is separate from competitors, benchmarks and other Monitored Entities.</p>
            </div>
            <span>{existingRecord ? "SAVED PROFILE" : "DRAFT"}</span>
          </div>

          {focusBrands.length > 1 ? (
            <div className="inputModeRow" aria-label="Select Focus Brand">
              {focusBrands.map((brand) => (
                <button key={brand.id} type="button" className={`modeButton ${brand.id === selectedFocusBrand.id ? "active" : ""}`} onClick={() => setSelectedFocusBrandId(brand.id)}>
                  {brand.name}
                </button>
              ))}
            </div>
          ) : null}

          <div className="workspaceLayout" style={{ marginTop: 18 }}>
            <div className="workspaceForm">
              <div className="sectionHeading compact">
                <div><div className="eyebrow">STRUCTURED BRAND CONTEXT</div><h2>{selectedFocusBrand.name}</h2></div>
                <span className="schemaTag">{populatedFieldCount}/16 fields populated</span>
              </div>
              <div className="formGrid">
                {fieldLabels.map((item) => <BrandField key={item.key} item={item} value={draft[item.key]} onChange={(value) => updateDraft(item.key, value)} />)}
              </div>
              <div className="formActions">
                <button type="button" className="primaryButton" onClick={saveProfile}>{existingRecord ? "Update Brand Profile" : "Save Brand Profile"}</button>
                {existingRecord ? <button type="button" className="secondaryButton" onClick={deleteProfile}>Remove saved profile</button> : null}
              </div>
              {notice ? <div className="intakeNotice">{notice}</div> : null}
            </div>

            <aside className="workspaceState">
              <div className="sectionHeading compact"><div><div className="eyebrow">BRAND FIT READINESS GATE</div><h2>{readiness?.status ?? "blocked"}</h2></div></div>
              <dl className="stateList">
                <div><dt>Methodology</dt><dd>{readiness?.methodologyVersion}</dd></div>
                <div><dt>Core required</dt><dd>Category · market · audience</dd></div>
                <div><dt>Strategic identity</dt><dd>Positioning OR value proposition</dd></div>
                <div><dt>Expressive context</dt><dd>Tone OR content pillars</dd></div>
                <div><dt>Brand Fit score</dt><dd>NOT COMPUTED</dd></div>
              </dl>
              {readiness?.missingRequiredFields.length ? (
                <div className="logicCallout"><strong>Blocking fields:</strong> {readiness.missingRequiredFields.map(fieldLabel).join(", ")}</div>
              ) : null}
              {readiness?.missingRequiredGroups.length ? (
                <div className="logicCallout"><strong>Required context groups:</strong> {readiness.missingRequiredGroups.map((group) => group.map(fieldLabel).join(" OR ")).join(" · ")}</div>
              ) : null}
              {readiness?.rationale.map((item) => <p className="prototypeNote" key={item}>{item}</p>)}
              {readiness?.status === "ready-for-provisional-brand-fit" ? <div className="demoWarning">READY FOR PROVISIONAL BRAND FIT · scoring remains Stage 05B+</div> : null}
            </aside>
          </div>

          <div className="entityPanel">
            <div className="entityPanelHeader">
              <div>
                <div className="eyebrow">BRIEF / URL / DRIVE INTAKE</div>
                <h3>Store context without pretending it has been resolved.</h3>
                <p>05A records these inputs with provenance. A future resolver/research runtime may extract claims and reconcile conflicts. Until then they stay <code>pending-resolver</code>.</p>
              </div>
              <span className="autoBadge">NO AUTO-INFERENCE</span>
            </div>
            <div className="inputModeRow">
              {(["pasted-brief", "url-reference", "drive-reference"] as const).map((mode) => (
                <button key={mode} type="button" className={`modeButton ${referenceMode === mode ? "active" : ""}`} onClick={() => { setReferenceMode(mode); setReferenceInput(""); setNotice(""); }}>
                  {mode === "pasted-brief" ? "Paste brief" : mode === "url-reference" ? "URLs" : "Drive"}
                </button>
              ))}
            </div>
            <textarea
              className="entityTextarea"
              rows={5}
              value={referenceInput}
              onChange={(event) => setReferenceInput(event.target.value)}
              placeholder={referenceMode === "pasted-brief" ? "Paste first-party brand notes, guidelines or a working brief. 05A stores the text but does not infer structured facts from it." : referenceMode === "drive-reference" ? "https://drive.google.com/..." : "https://brand.example.com/about\nhttps://brand.example.com/products"}
            />
            <div className="intakeActionRow">
              <button type="button" className="secondaryButton" onClick={addReference}>Store pending input</button>
              <small>Pending inputs do not count as resolved evidence.</small>
            </div>
            {references.length ? (
              <div className="pendingRefs">
                <div className="entityColumnTitle"><strong>Pending inputs</strong><span>{references.length}</span></div>
                {references.map((item) => (
                  <div className="pendingRef" key={item.id}>
                    <div><b>{item.method}</b><span>{item.reference ?? item.rawText?.slice(0, 120) ?? item.label}</span></div>
                    <em>{item.status}</em>
                    <button type="button" onClick={() => removeReference(item.id)}>Remove</button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="entityPanel">
            <div className="entityPanelHeader">
              <div>
                <div className="eyebrow">PROVENANCE & GAPS</div>
                <h3>Every populated field keeps its source class.</h3>
                <p>Workspace-derived values remain distinguishable from direct Brand Profile input. Recommended gaps improve downstream reasoning but do not fabricate blockers.</p>
              </div>
              <span className="autoBadge">{previewRecord?.provenance.length ?? 0} PROVENANCE RECORDS</span>
            </div>
            <div className="entityColumns">
              <div className="entityColumn">
                <div className="entityColumnTitle"><strong>Field provenance</strong><span>current draft</span></div>
                <div className="entityChips">
                  {previewRecord?.provenance.map((item) => (
                    <div className="entityToken" key={item.field}><span>{fieldLabel(item.field)}</span><small>{item.sourceType}</small><span aria-hidden="true">·</span></div>
                  ))}
                </div>
              </div>
              <div className="entityColumn">
                <div className="entityColumnTitle"><strong>Recommended context gaps</strong><span>non-blocking</span></div>
                {readiness?.recommendedContextGaps.length ? (
                  <div className="scopeChips">{readiness.recommendedContextGaps.map((field) => <span key={field}>{fieldLabel(field)}</span>)}</div>
                ) : <div className="candidateEmpty compact"><p>No recommended context gaps in the 05A checklist.</p></div>}
              </div>
            </div>
          </div>

          <p className="prototypeNote">05A persists Brand Profiles in browser localStorage under <code>{BRAND_PROFILE_STORAGE_KEY}</code>. This is a preview persistence layer, not a production multi-user database. Resolver/research, contradiction adjudication and Brand Fit scoring remain downstream.</p>
        </>
      ) : null}
    </section>
  );
}
