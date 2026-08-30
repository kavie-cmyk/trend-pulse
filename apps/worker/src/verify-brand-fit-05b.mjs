import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildBrandProfileRecord,
  draftFromWorkspace,
} from "../../web/app/brand-profile-foundation.ts";
import {
  assessBrandFit05B,
  resolveBrandProfile05B,
} from "../../web/app/brand-fit-engine-05b.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const livePath = path.join(repoRoot, "apps/web/public/data/workspace-intelligence.json");

function assert(condition, message) {
  if (!condition) throw new Error(`Stage 05B verification failed: ${message}`);
}

function workspace(overrides = {}) {
  const { scope: scopeOverrides = {}, ...rest } = overrides;
  return {
    schemaVersion: "workspace.v1",
    id: "workspace-05b-fixture",
    name: "Vietnam Mobile Gaming Fixture",
    status: "active",
    scope: {
      geographies: ["Vietnam"],
      languages: ["vi", "en"],
      industries: ["Gaming"],
      categories: ["Mobile gaming"],
      products: ["Puzzle game"],
      audiences: ["Mobile players"],
      objectives: ["Acquire users"],
      riskBoundaries: ["No gambling"],
      ...scopeOverrides,
    },
    focusBrands: [{ id: "brand-05b", name: "Brand 05B", source: "user", addedAt: "2026-08-30T00:00:00.000Z" }],
    entityIntelligence: { autoDiscover: true, monitoredEntities: [], excludedEntities: [], intakeReferences: [] },
    monitoring: { modes: ["market-pulse"], broadDiscovery: true, adjacentCulture: true, globalBreakouts: true },
    createdAt: "2026-08-30T00:00:00.000Z",
    updatedAt: "2026-08-30T00:00:00.000Z",
    ...rest,
  };
}

const focusBrand = { id: "brand-05b", name: "Brand 05B", source: "user", addedAt: "2026-08-30T00:00:00.000Z" };
const now = "2026-08-30T12:00:00.000Z";
const baseWorkspace = workspace();
const baseDraft = {
  ...draftFromWorkspace(baseWorkspace, focusBrand),
  positioning: "Accessible mobile puzzle play",
  toneOfVoice: "Playful, direct",
  contentPillars: "Puzzle mastery, mobile play",
};
const ready = buildBrandProfileRecord(baseWorkspace, focusBrand, baseDraft, [], undefined, now, new Set(["positioning", "toneOfVoice", "contentPillars"]));
assert(ready.readiness.status === "ready-for-provisional-brand-fit", "fixture Brand Profile must pass 05A readiness");

const pendingReference = {
  id: "pending-brand-site",
  method: "url-reference",
  label: "Brand site",
  reference: "https://example.com/brand",
  status: "pending-resolver",
  createdAt: now,
};
const readyWithPending = buildBrandProfileRecord(baseWorkspace, focusBrand, baseDraft, [pendingReference], undefined, now, new Set(["positioning", "toneOfVoice", "contentPillars"]));
const unresolved = resolveBrandProfile05B(readyWithPending, [], now);
assert(unresolved.schemaVersion === "brand-profile-resolution-05b.v1", "profile resolution schema must be explicit");
assert(unresolved.researchRuntimeStatus === "not-executed", "static preview must not claim autonomous brand research");
assert(unresolved.pendingReferenceIds.includes(pendingReference.id), "pending reference must remain pending");
assert(!unresolved.claims.some((claim) => claim.evidenceRefs.includes(pendingReference.reference)), "pending reference must not become claim evidence");
assert(unresolved.status === "usable-provisional", "ready structured context may be usable provisionally without claiming external verification");

const supportingClaim = {
  schemaVersion: "brand-profile-research-claim-05b.v1",
  id: "research-claim-category",
  workspaceId: baseWorkspace.id,
  focusBrandId: focusBrand.id,
  field: "categories",
  values: ["Mobile gaming"],
  sourceType: "url-reference",
  sourceLabel: "Verified source fixture",
  evidenceRefs: ["https://example.com/evidence/mobile-gaming"],
  relationshipToProfile: "supports",
  status: "resolved",
  capturedAt: now,
};
const reconciled = resolveBrandProfile05B(ready, [supportingClaim], now);
assert(reconciled.researchRuntimeStatus === "evidence-input-reconciled", "explicit evidence claim input must be distinguishable from autonomous research");
assert(reconciled.externallyResolvedClaimCount === 1, "resolved evidence-backed claim must be counted once");
assert(reconciled.claims.some((claim) => claim.id === supportingClaim.id && claim.status === "usable" && claim.evidenceRefs.length === 1), "resolved external claim must retain evidence trace");

const noEvidenceClaim = { ...supportingClaim, id: "research-claim-no-evidence", evidenceRefs: [] };
const noEvidenceResolution = resolveBrandProfile05B(ready, [noEvidenceClaim], now);
assert(noEvidenceResolution.externallyResolvedClaimCount === 0, "a claim marked resolved without evidence refs must not become usable evidence");
assert(noEvidenceResolution.claims.find((claim) => claim.id === noEvidenceClaim.id)?.status === "pending", "evidence-less external claim must remain pending");

const contradiction = {
  ...supportingClaim,
  id: "research-claim-conflict",
  field: "markets",
  values: ["United States"],
  relationshipToProfile: "contradicts",
  evidenceRefs: ["https://example.com/evidence/conflict"],
};
const conflictedResolution = resolveBrandProfile05B(ready, [contradiction], now);
assert(conflictedResolution.status === "conflicted", "explicit evidence-backed contradiction must block Brand Fit until adjudicated");
assert(conflictedResolution.conflicts.length === 1, "explicit contradiction must be traceable in conflict register");

const weakSignal = {
  evidenceClass: "weak-signal",
  id: "weak-05b",
  workspaceId: baseWorkspace.id,
  title: "Mobile puzzle conversation",
  summary: "Early discussion",
  signalIds: ["signal-weak"],
  sourceIds: ["source-a"],
  evidenceRefs: ["https://example.com/weak"],
};
const weakFit = assessBrandFit05B(unresolved, weakSignal, now);
assert(weakFit.assessmentStatus === "unavailable", "Weak Signal must never receive a provisional Brand Fit assessment");
assert(weakFit.trendEvidenceMaturity === "weak-signal", "Weak Signal maturity must remain explicit");
assert(weakFit.factors.length === 0, "Weak Signal gate must stop factor computation");

const sameSourceCluster = {
  ...weakSignal,
  evidenceClass: "repeated-single-source-cluster",
  id: "same-source-cluster",
  signalIds: ["signal-a", "signal-b"],
  sourceIds: ["source-a"],
};
const sameSourceFit = assessBrandFit05B(unresolved, sameSourceCluster, now);
assert(sameSourceFit.assessmentStatus === "unavailable", "same-source repetition must not enter Brand Fit");
assert(sameSourceFit.trendEvidenceMaturity === "same-source-only", "same-source evidence maturity must remain explicit");

const candidate = {
  evidenceClass: "trend-candidate",
  id: "candidate-05b",
  workspaceId: baseWorkspace.id,
  title: "Mobile gaming puzzle mastery grows among Vietnam players",
  summary: "Cross-source discussion around mobile gaming, puzzle play and player mastery.",
  status: "candidate",
  lifecycleStage: "weak-signal",
  signalIds: ["signal-a", "signal-b"],
  sourceIds: ["publisher-a", "community-b"],
  independentSourceDiversity: 1,
  independentSourceFamilyDiversity: 1,
  resolutionAnchors: ["mobile gaming", "mobile puzzle", "players", "Vietnam"],
  geographies: ["Vietnam"],
  languages: ["vi", "en"],
  evidenceRefs: ["https://example.com/a", "https://example.com/b"],
};
const fit = assessBrandFit05B(unresolved, candidate, now);
assert(fit.schemaVersion === "brand-fit-assessment-05b.v1", "Brand Fit schema must be explicit");
assert(fit.assessmentStatus === "provisional", "cross-source Trend Candidate may receive provisional non-numeric Brand Fit factor evaluation");
assert(fit.trendEvidenceMaturity === "candidate-unconfirmed", "non-corroborated candidate must remain candidate-unconfirmed");
assert(fit.numericScoreStatus === "unavailable", "05B must not emit numeric Brand Fit precision");
assert(fit.factors.length === 10, "05B must expose all ten D-010 Brand Fit factor slots");
assert(fit.factors.some((factor) => factor.key === "category-relevance" && factor.status === "supported"), "explicit category overlap should be inspectably supported");
assert(fit.factors.some((factor) => factor.key === "market-relevance" && factor.status === "supported"), "explicit market overlap should be inspectably supported");
for (const factor of fit.factors.filter((item) => item.status !== "unavailable" && item.status !== "not-applicable")) {
  assert(factor.trace.brandClaimIds.length > 0, `${factor.key} must trace to Brand Profile claims`);
  assert(factor.trace.trendSignalIds.length > 0, `${factor.key} must trace to Trend signal IDs`);
  assert(factor.trace.trendEvidenceRefs.length > 0, `${factor.key} must trace to Trend evidence refs`);
}

const corroborated = {
  ...candidate,
  id: "candidate-corroborated",
  status: "corroborated",
  independentSourceDiversity: 2,
  independentSourceFamilyDiversity: 2,
};
const corroboratedFit = assessBrandFit05B(unresolved, corroborated, now);
assert(corroboratedFit.trendEvidenceMaturity === "independently-corroborated", "corroborated trend maturity must require independent source + family diversity");
assert(corroboratedFit.assessmentStatus === "provisional", "corroboration does not convert Brand Fit to calibrated numeric status");

const blockedWorkspace = workspace({ scope: { categories: [], geographies: [], audiences: [] } });
const blockedDraft = draftFromWorkspace(blockedWorkspace, focusBrand);
const blockedRecord = buildBrandProfileRecord(blockedWorkspace, focusBrand, blockedDraft, [], undefined, now);
const blockedResolution = resolveBrandProfile05B(blockedRecord, [], now);
const blockedFit = assessBrandFit05B(blockedResolution, candidate, now);
assert(blockedFit.assessmentStatus === "unavailable", "05A readiness blocker must stop 05B Brand Fit");

const conflictedFit = assessBrandFit05B(conflictedResolution, candidate, now);
assert(conflictedFit.assessmentStatus === "unavailable", "unresolved Brand Profile conflict must stop Brand Fit");

let liveSummary = "live workspace artifact not present in local pre-collection verification";
try {
  await access(livePath, constants.R_OK);
  const live = JSON.parse(await readFile(livePath, "utf8"));
  assert(live.schemaVersion === "workspace-intelligence-snapshot.v1", "live Workspace Intelligence schema must remain 04E canonical");
  let liveWeak = 0;
  let liveCandidates = 0;
  for (const report of live.workspaces ?? []) {
    liveWeak += report.weakSignals?.length ?? 0;
    liveCandidates += report.candidates?.length ?? 0;
    assert((report.candidates ?? []).every((candidate) => new Set(candidate.sourceIds ?? []).size >= 2), "live Brand Fit eligible pool must contain only cross-source candidates");
  }
  if (liveCandidates === 0) {
    assert(liveWeak >= 0, "zero Trend Candidates is valid and Weak Signals may remain visible without Brand Fit");
  }
  liveSummary = `${liveCandidates} eligible candidate(s) · ${liveWeak} weak signal(s) excluded from Brand Fit`;
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

console.log(`Stage 05B verification PASS · claim/provenance reconciliation · pending-reference firewall · conflict gate · Weak Signal/same-source exclusion · non-numeric factor trace · ${liveSummary}.`);
