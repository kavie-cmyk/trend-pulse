import type { BrandIntelligenceProfile, FocusBrand, IntelligenceWorkspace } from "@trend-pulse/contracts";
import type {
  BrandFitReadinessAssessment,
  BrandProfileFieldKey,
  BrandProfileFieldProvenance,
  BrandProfileFoundationRecord,
  BrandProfileReference,
  BrandProfileStore,
} from "@trend-pulse/contracts/brand-profile";

export const BRAND_PROFILE_STORAGE_KEY = "trend-pulse.brand-profiles.v1";
export const WORKSPACE_STORAGE_KEY = "trend-pulse.workspace.v1";

export interface BrandProfileDraft {
  categories: string;
  markets: string;
  targetAudiences: string;
  positioning: string;
  valueProposition: string;
  toneOfVoice: string;
  visualCodes: string;
  productLines: string;
  contentPillars: string;
  do: string;
  dont: string;
  riskBoundaries: string;
  commercialObjectives: string;
  creatorPriorities: string;
  paidPriorities: string;
  seoPriorities: string;
}

export const BRAND_PROFILE_FIELDS: BrandProfileFieldKey[] = [
  "categories",
  "markets",
  "targetAudiences",
  "positioning",
  "valueProposition",
  "toneOfVoice",
  "visualCodes",
  "productLines",
  "contentPillars",
  "do",
  "dont",
  "riskBoundaries",
  "commercialObjectives",
  "creatorPriorities",
  "paidPriorities",
  "seoPriorities",
];

const REQUIRED_FIELDS: BrandProfileFieldKey[] = ["categories", "markets", "targetAudiences"];
const REQUIRED_ANY_OF_GROUPS: BrandProfileFieldKey[][] = [
  ["positioning", "valueProposition"],
  ["toneOfVoice", "contentPillars"],
];
const RECOMMENDED_FIELDS: BrandProfileFieldKey[] = [
  "productLines",
  "visualCodes",
  "riskBoundaries",
  "commercialObjectives",
  "creatorPriorities",
  "paidPriorities",
  "seoPriorities",
  "do",
  "dont",
];

export function cleanValue(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function splitProfileList(value: string) {
  const seen = new Set<string>();
  return value
    .split(/[,;\n\t]+/)
    .map(cleanValue)
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function join(values: string[]) {
  return values.join(", ");
}

export function draftFromWorkspace(workspace: IntelligenceWorkspace, focusBrand: FocusBrand, existing?: BrandProfileFoundationRecord): BrandProfileDraft {
  const profile = existing?.profile;
  return {
    categories: join(profile?.categories ?? workspace.scope.categories),
    markets: join(profile?.markets ?? workspace.scope.geographies),
    targetAudiences: join(profile?.targetAudiences ?? workspace.scope.audiences),
    positioning: join(profile?.positioning ?? []),
    valueProposition: join(profile?.valueProposition ?? []),
    toneOfVoice: join(profile?.toneOfVoice ?? []),
    visualCodes: join(profile?.visualCodes ?? []),
    productLines: join(profile?.productLines ?? workspace.scope.products),
    contentPillars: join(profile?.contentPillars ?? []),
    do: join(profile?.do ?? []),
    dont: join(profile?.dont ?? []),
    riskBoundaries: join(profile?.riskBoundaries ?? workspace.scope.riskBoundaries),
    commercialObjectives: join(profile?.commercialObjectives ?? workspace.scope.objectives),
    creatorPriorities: join(profile?.creatorPriorities ?? []),
    paidPriorities: join(profile?.paidPriorities ?? []),
    seoPriorities: join(profile?.seoPriorities ?? []),
  };
}

function valuesForField(profile: BrandIntelligenceProfile, field: BrandProfileFieldKey): string[] {
  return profile[field];
}

function workspaceValuesForField(workspace: IntelligenceWorkspace, field: BrandProfileFieldKey): string[] {
  switch (field) {
    case "categories": return workspace.scope.categories;
    case "markets": return workspace.scope.geographies;
    case "targetAudiences": return workspace.scope.audiences;
    case "productLines": return workspace.scope.products;
    case "riskBoundaries": return workspace.scope.riskBoundaries;
    case "commercialObjectives": return workspace.scope.objectives;
    default: return [];
  }
}

function sameValues(left: string[], right: string[]) {
  const a = left.map((item) => item.toLowerCase()).sort();
  const b = right.map((item) => item.toLowerCase()).sort();
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

export function assessBrandFitReadiness(profile: BrandIntelligenceProfile, assessedAt = new Date().toISOString()): BrandFitReadinessAssessment {
  const missingRequiredFields = REQUIRED_FIELDS.filter((field) => valuesForField(profile, field).length === 0);
  const missingRequiredGroups = REQUIRED_ANY_OF_GROUPS.filter((group) => !group.some((field) => valuesForField(profile, field).length > 0));
  const recommendedContextGaps = RECOMMENDED_FIELDS.filter((field) => valuesForField(profile, field).length === 0);

  let status: BrandFitReadinessAssessment["status"] = "ready-for-provisional-brand-fit";
  if (missingRequiredFields.length) status = "blocked";
  else if (missingRequiredGroups.length) status = "partial";

  const rationale: string[] = [];
  if (status === "blocked") {
    rationale.push("Brand Fit is blocked because category/market/audience context is incomplete; a brand name alone is not sufficient.");
  } else if (status === "partial") {
    rationale.push("Core scope exists, but strategic identity or expressive/content context is still missing.");
  } else {
    rationale.push("Core scope plus strategic identity and expressive/content context are present, so a provisional Brand Fit assessment may run downstream.");
  }
  rationale.push("05A readiness is a deterministic gate, not a Brand Fit score and not evidence that any trend is relevant to the brand.");

  return {
    status,
    methodologyVersion: "brand-fit-readiness-05a.v1",
    requiredFields: [...REQUIRED_FIELDS],
    requiredAnyOfGroups: REQUIRED_ANY_OF_GROUPS.map((group) => [...group]),
    missingRequiredFields,
    missingRequiredGroups: missingRequiredGroups.map((group) => [...group]),
    recommendedContextGaps,
    rationale,
    assessedAt,
  };
}

function buildProfile(workspace: IntelligenceWorkspace, focusBrand: FocusBrand, draft: BrandProfileDraft, evidenceRefs: string[], updatedAt: string): BrandIntelligenceProfile {
  return {
    schemaVersion: "brand-profile.v1",
    id: `brand-profile-${focusBrand.id}`,
    workspaceId: workspace.id,
    focusBrandId: focusBrand.id,
    brandName: focusBrand.name,
    categories: splitProfileList(draft.categories),
    markets: splitProfileList(draft.markets),
    targetAudiences: splitProfileList(draft.targetAudiences),
    positioning: splitProfileList(draft.positioning),
    valueProposition: splitProfileList(draft.valueProposition),
    toneOfVoice: splitProfileList(draft.toneOfVoice),
    visualCodes: splitProfileList(draft.visualCodes),
    productLines: splitProfileList(draft.productLines),
    contentPillars: splitProfileList(draft.contentPillars),
    do: splitProfileList(draft.do),
    dont: splitProfileList(draft.dont),
    riskBoundaries: splitProfileList(draft.riskBoundaries),
    commercialObjectives: splitProfileList(draft.commercialObjectives),
    creatorPriorities: splitProfileList(draft.creatorPriorities),
    paidPriorities: splitProfileList(draft.paidPriorities),
    seoPriorities: splitProfileList(draft.seoPriorities),
    evidenceRefs,
    updatedAt,
  };
}

function buildProvenance(workspace: IntelligenceWorkspace, profile: BrandIntelligenceProfile, capturedAt: string): BrandProfileFieldProvenance[] {
  const result: BrandProfileFieldProvenance[] = [];
  for (const field of BRAND_PROFILE_FIELDS) {
    const values = valuesForField(profile, field);
    if (!values.length) continue;
    const workspaceValues = workspaceValuesForField(workspace, field);
    const inherited = workspaceValues.length > 0 && sameValues(values, workspaceValues);
    result.push({
      field,
      sourceType: inherited ? "workspace-derived" : "user-input",
      sourceLabel: inherited ? `Workspace ${workspace.name}` : "Direct Brand Profile input",
      capturedAt,
    });
  }
  return result;
}

export function buildBrandProfileRecord(
  workspace: IntelligenceWorkspace,
  focusBrand: FocusBrand,
  draft: BrandProfileDraft,
  pendingReferences: BrandProfileReference[],
  previous?: BrandProfileFoundationRecord,
  now = new Date().toISOString(),
): BrandProfileFoundationRecord {
  const resolvedEvidenceRefs = pendingReferences
    .filter((reference) => reference.status === "resolved" && reference.reference)
    .map((reference) => reference.reference as string);
  const profile = buildProfile(workspace, focusBrand, draft, resolvedEvidenceRefs, now);
  const readiness = assessBrandFitReadiness(profile, now);
  const resolutionStatus = readiness.status === "blocked"
    ? "draft"
    : readiness.status === "partial"
      ? "partial"
      : "provisional-ready";

  return {
    schemaVersion: "brand-profile-foundation.v1",
    profile,
    resolutionStatus,
    readiness,
    provenance: buildProvenance(workspace, profile, now),
    pendingReferences,
    conflicts: previous?.conflicts ?? [],
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
}

export function emptyBrandProfileStore(): BrandProfileStore {
  return { schemaVersion: "brand-profile-store.v1", records: [], updatedAt: new Date(0).toISOString() };
}

export function normalizeBrandProfileStore(raw: unknown): BrandProfileStore {
  const parsed = raw as BrandProfileStore;
  if (!parsed || parsed.schemaVersion !== "brand-profile-store.v1" || !Array.isArray(parsed.records)) return emptyBrandProfileStore();
  const records = parsed.records.filter((record) => record?.schemaVersion === "brand-profile-foundation.v1" && record.profile?.schemaVersion === "brand-profile.v1");
  return { schemaVersion: "brand-profile-store.v1", records, updatedAt: parsed.updatedAt ?? new Date(0).toISOString() };
}

export function upsertBrandProfileRecord(store: BrandProfileStore, record: BrandProfileFoundationRecord): BrandProfileStore {
  const records = store.records.filter((item) => !(item.profile.workspaceId === record.profile.workspaceId && item.profile.focusBrandId === record.profile.focusBrandId));
  records.push(record);
  return { schemaVersion: "brand-profile-store.v1", records, updatedAt: record.updatedAt };
}

export function referenceId(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `brand-ref-${(hash >>> 0).toString(16)}`;
}
