import {
  buildBrandProfileRecord,
  draftFromWorkspace,
  emptyBrandProfileStore,
  upsertBrandProfileRecord,
} from "../../web/app/brand-profile-foundation.ts";

function assert(condition, message) {
  if (!condition) throw new Error(`Stage 05A verification failed: ${message}`);
}

function workspace(overrides = {}) {
  return {
    schemaVersion: "workspace.v1",
    id: "workspace-fixture",
    name: "Fixture Workspace",
    scope: {
      geographies: ["Vietnam"],
      markets: [],
      languages: ["vi"],
      industries: ["Gaming"],
      categories: ["Gaming"],
      products: ["Game A"],
      audiences: ["Players"],
      objectives: ["Acquire users"],
      riskBoundaries: ["No gambling"],
      ...overrides.scope,
    },
    focusBrands: [
      { id: "brand-a", name: "Brand A", aliases: [], createdAt: "2026-08-30T00:00:00.000Z" },
      { id: "brand-b", name: "Brand B", aliases: [], createdAt: "2026-08-30T00:00:00.000Z" },
    ],
    entityIntelligence: { autoDiscover: true, monitoredEntities: [], excludedEntities: [], candidates: [] },
    monitoring: { mode: "market-pulse", isActive: true },
    createdAt: "2026-08-30T00:00:00.000Z",
    updatedAt: "2026-08-30T00:00:00.000Z",
    ...overrides,
  };
}

const focusA = { id: "brand-a", name: "Brand A", aliases: [], createdAt: "2026-08-30T00:00:00.000Z" };
const focusB = { id: "brand-b", name: "Brand B", aliases: [], createdAt: "2026-08-30T00:00:00.000Z" };
const now = "2026-08-30T01:00:00.000Z";

const blockedWorkspace = workspace({ scope: { categories: [], geographies: [], audiences: [] } });
const blockedDraft = draftFromWorkspace(blockedWorkspace, focusA);
const blocked = buildBrandProfileRecord(blockedWorkspace, focusA, blockedDraft, [], undefined, now);
assert(blocked.readiness.status === "blocked", "missing category/market/audience must block Brand Fit readiness");
assert(blocked.readiness.missingRequiredFields.length === 3, "all three missing core fields must be exposed");

const baseWorkspace = workspace();
const partialDraft = draftFromWorkspace(baseWorkspace, focusA);
const partial = buildBrandProfileRecord(baseWorkspace, focusA, partialDraft, [], undefined, now);
assert(partial.readiness.status === "partial", "core Workspace context without identity/expression must remain partial");
assert(partial.readiness.missingRequiredGroups.length === 2, "both required context groups must be reported");
assert(partial.provenance.find((item) => item.field === "categories")?.sourceType === "workspace-derived", "inherited category must retain workspace-derived provenance");

const readyDraft = { ...partialDraft, positioning: "Premium accessible play", toneOfVoice: "Direct, playful" };
const ready = buildBrandProfileRecord(
  baseWorkspace,
  focusA,
  readyDraft,
  [],
  undefined,
  now,
  new Set(["positioning", "toneOfVoice"]),
);
assert(ready.readiness.status === "ready-for-provisional-brand-fit", "core + strategic + expressive context must unlock provisional readiness");
assert(ready.provenance.find((item) => item.field === "positioning")?.sourceType === "user-input", "explicitly edited positioning must be user-input");
assert(ready.provenance.find((item) => item.field === "categories")?.sourceType === "workspace-derived", "untouched inherited category must remain workspace-derived");

const sameValueUserEdit = buildBrandProfileRecord(
  baseWorkspace,
  focusA,
  readyDraft,
  [],
  ready,
  "2026-08-30T02:00:00.000Z",
  new Set(["categories"]),
);
assert(sameValueUserEdit.provenance.find((item) => item.field === "categories")?.sourceType === "user-input", "a user edit must stay user-input even when its value equals Workspace context");

const revisedWorkspace = workspace({
  scope: {
    geographies: ["United States"],
    markets: [],
    languages: ["en"],
    industries: ["AI"],
    categories: ["AI SaaS"],
    products: ["Assistant"],
    audiences: ["Knowledge workers"],
    objectives: ["Trial activation"],
    riskBoundaries: ["No unsupported claims"],
  },
  updatedAt: "2026-08-30T03:00:00.000Z",
});
const inheritedRefreshDraft = draftFromWorkspace(revisedWorkspace, focusA, ready);
assert(inheritedRefreshDraft.categories === "AI SaaS", "workspace-derived category must follow a later Workspace revision");
assert(inheritedRefreshDraft.markets === "United States", "workspace-derived market must follow a later Workspace revision");
assert(inheritedRefreshDraft.positioning === "Premium accessible play", "direct Brand Profile positioning must survive Workspace revisions");

const userOwnedRefreshDraft = draftFromWorkspace(revisedWorkspace, focusA, sameValueUserEdit);
assert(userOwnedRefreshDraft.categories === "Gaming", "user-input category must not be overwritten by a later Workspace revision");

const pendingReference = {
  id: "brand-ref-pending",
  method: "url-reference",
  label: "Brand site",
  reference: "https://example.com/brand",
  status: "pending-resolver",
  createdAt: now,
};
const pendingRecord = buildBrandProfileRecord(baseWorkspace, focusA, readyDraft, [pendingReference], undefined, now);
assert(pendingRecord.profile.evidenceRefs.length === 0, "pending references must not enter resolved evidenceRefs");

const resolvedReference = { ...pendingReference, id: "brand-ref-resolved", status: "resolved" };
const resolvedRecord = buildBrandProfileRecord(baseWorkspace, focusA, readyDraft, [resolvedReference], undefined, now);
assert(resolvedRecord.profile.evidenceRefs.length === 1 && resolvedRecord.profile.evidenceRefs[0] === resolvedReference.reference, "only resolved references may enter evidenceRefs");

const brandB = buildBrandProfileRecord(baseWorkspace, focusB, { ...readyDraft, positioning: "Different position" }, [], undefined, now, new Set(["positioning", "toneOfVoice"]));
let store = emptyBrandProfileStore();
store = upsertBrandProfileRecord(store, ready);
store = upsertBrandProfileRecord(store, brandB);
assert(store.records.length === 2, "two Focus Brands in one Workspace must keep separate records");
store = upsertBrandProfileRecord(store, sameValueUserEdit);
assert(store.records.length === 2, "updating one Focus Brand must replace only its own record");
assert(store.records.some((record) => record.profile.focusBrandId === focusB.id), "updating Brand A must preserve Brand B");

for (const record of [blocked, partial, ready, sameValueUserEdit, pendingRecord, resolvedRecord, brandB]) {
  assert(record.readiness.score === undefined, "05A must not emit a numeric Brand Fit/readiness score");
  assert(record.profile.schemaVersion === "brand-profile.v1", "foundation must wrap brand-profile.v1");
  assert(record.schemaVersion === "brand-profile-foundation.v1", "foundation schema must remain explicit");
}

console.log("Stage 05A verification PASS · blocked/partial/ready gates · event-aware provenance · Workspace revision inheritance · pending-evidence boundary · multi-Focus-Brand isolation.");
