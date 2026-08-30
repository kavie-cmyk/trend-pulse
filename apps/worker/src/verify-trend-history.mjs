import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTrendHistoryCycle } from "./build-trend-history.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const cyclePath = path.join(repoRoot, "apps/web/public/data/trend-history.json");
const nextStatePath = path.join(repoRoot, ".trend-history-next/state.json");

function assert(condition, message) {
  if (!condition) throw new Error(`Stage 04D verification failed: ${message}`);
}

function fixtureCandidate({ id, title, anchors, sources, families, independentSources = sources, independentFamilies = families, signalCount = 2, status = "candidate" }) {
  return {
    schemaVersion: "trend-candidate.v1",
    id,
    title,
    summary: title,
    trendType: "narrative",
    lifecycleStage: "weak-signal",
    status,
    signalIds: Array.from({ length: signalCount }, (_, index) => `${id}-signal-${index + 1}`),
    sourceIds: sources,
    sourceDiversity: sources.length,
    sourceFamilies: families,
    sourceFamilyDiversity: families.length,
    independentSourceIds: independentSources,
    independentSourceFamilies: independentFamilies,
    independentSourceDiversity: independentSources.length,
    independentSourceFamilyDiversity: independentFamilies.length,
    dependencyRisks: [],
    resolutionAnchors: anchors,
    resolutionMethodologyVersion: "trend-resolution-04c.v1",
    geographies: [],
    languages: ["en"],
    firstObservedAt: "2026-08-29T19:00:00.000Z",
    lastObservedAt: "2026-08-30T07:00:00.000Z",
    evidenceRefs: sources.map((source) => `https://example.com/${source}/${id}`),
    corroborationRationale: [],
    confidence: {
      status: "provisional",
      scaleMax: 10,
      methodologyVersion: "trend-confidence-04c.v1",
      factors: [],
      rationale: [],
      evidenceRefs: [],
    },
  };
}

function verifyFixture() {
  const previousState = {
    schemaVersion: "trend-history-state.v1",
    updatedAt: "2026-08-29T19:05:00.000Z",
    latestCycleId: "fixture-previous",
    latestSnapshotGeneratedAt: "2026-08-29T19:00:00.000Z",
    cyclesRecorded: 1,
    lineages: [
      {
        lineageId: "lineage-orion",
        firstSeenAt: "2026-08-29T19:00:00.000Z",
        lastSeenAt: "2026-08-29T19:00:00.000Z",
        seenCycles: 1,
        missedCycles: 0,
        latestCandidateId: "orion-old",
        latestTitle: "Project Orion launch gains developer attention",
        latestResolutionAnchors: ["project orion", "orion", "developer"],
        latestSignalCount: 2,
        latestSourceIds: ["publisher-a", "community-b"],
        latestSourceFamilies: ["publisher", "community"],
        latestIndependentSourceIds: ["publisher-a"],
        latestIndependentSourceFamilies: ["publisher"],
        latestStatus: "candidate",
      },
      {
        lineageId: "lineage-vanish",
        firstSeenAt: "2026-08-29T19:00:00.000Z",
        lastSeenAt: "2026-08-29T19:00:00.000Z",
        seenCycles: 1,
        missedCycles: 0,
        latestCandidateId: "vanish-old",
        latestTitle: "Vanishing topic alpha",
        latestResolutionAnchors: ["vanishing alpha"],
        latestSignalCount: 2,
        latestSourceIds: ["publisher-z"],
        latestSourceFamilies: ["publisher"],
        latestIndependentSourceIds: ["publisher-z"],
        latestIndependentSourceFamilies: ["publisher"],
        latestStatus: "candidate",
      },
    ],
  };
  const currentSnapshot = {
    schemaVersion: "trend-resolution-snapshot.v1",
    generatedAt: "2026-08-30T07:00:00.000Z",
    methodologyVersion: "trend-resolution-04c.v1",
    dependencyCalibrationVersion: "corroboration-dependency-04c.v1",
    inputSignalCount: 10,
    uniqueSignalCount: 10,
    candidateCount: 2,
    corroboratedCount: 0,
    clusteredSignalCount: 5,
    unclusteredSignalCount: 5,
    candidates: [
      fixtureCandidate({
        id: "orion-new",
        title: "Developer discussion grows around Project Orion launch",
        anchors: ["project orion", "orion", "developer", "launch"],
        sources: ["publisher-a", "community-b", "social-c"],
        families: ["publisher", "community", "social"],
        independentSources: ["publisher-a", "social-c"],
        independentFamilies: ["publisher", "social"],
        signalCount: 3,
      }),
      fixtureCandidate({
        id: "nova-new",
        title: "Project Nova creator challenge",
        anchors: ["project nova", "creator challenge"],
        sources: ["social-n"],
        families: ["social"],
        signalCount: 2,
      }),
    ],
    notes: [],
  };
  const { cycle, nextState } = buildTrendHistoryCycle(currentSnapshot, previousState, "2026-08-30T07:01:00.000Z", "fixture-current");
  assert(cycle.comparisonWindow === "comparable", "12-hour fixture must be cadence-comparable");
  const orion = cycle.current.find((item) => item.candidateId === "orion-new");
  assert(orion?.lineageId === "lineage-orion", "continuing narrative must reuse prior lineageId");
  assert(orion?.presence === "continuing", "matched active lineage must be continuing");
  assert(orion?.evidenceDirection === "expanding", "independent source/family growth must register as expanding structural evidence");
  const nova = cycle.current.find((item) => item.candidateId === "nova-new");
  assert(nova?.presence === "new", "unmatched candidate must become a new lineage");
  assert(cycle.disappeared.some((item) => item.lineageId === "lineage-vanish"), "previously active unmatched lineage must be newly disappeared");
  assert(nextState.cyclesRecorded === 2, "history state must increment cycle count exactly once");
  assert(nextState.lineages.find((item) => item.lineageId === "lineage-orion")?.seenCycles === 2, "continuing lineage must increment seenCycles");
}

async function verifyArtifact() {
  const cycle = JSON.parse(await readFile(cyclePath, "utf8"));
  const state = JSON.parse(await readFile(nextStatePath, "utf8"));
  assert(cycle.schemaVersion === "trend-history-cycle.v1", "unexpected cycle schema");
  assert(cycle.methodologyVersion === "trend-history-04d.v1", "unexpected history methodology");
  assert(cycle.persistenceMode === "github-history-branch" && cycle.historyBranch === "trend-history", "history persistence semantics must remain explicit");
  assert(cycle.currentCandidateCount === cycle.current.length, "current candidate count must reconcile");
  assert(state.schemaVersion === "trend-history-state.v1", "unexpected next-state schema");
  assert(state.latestCycleId === cycle.cycleId, "next state must point to the generated cycle");
  assert(state.latestSnapshotGeneratedAt === cycle.currentTrendSnapshotGeneratedAt, "next state must point to current trend snapshot time");
  assert(state.lineages.length === cycle.trackedLineageCount, "tracked lineage count must reconcile");
  assert(state.cyclesRecorded >= 1, "persistent state must record at least one cycle");

  const lineageIds = new Set();
  for (const item of cycle.current) {
    assert(!lineageIds.has(item.lineageId), `lineage ${item.lineageId} assigned to multiple current candidates`);
    lineageIds.add(item.lineageId);
    assert(["new", "continuing", "reappeared"].includes(item.presence), "unknown presence class");
    assert(["not-comparable", "expanding", "stable", "contracting", "mixed"].includes(item.evidenceDirection), "unknown structural evidence direction");
    assert(item.virality === undefined && item.velocity === undefined && item.acceleration === undefined, "04D must not emit Virality/velocity/acceleration fields");
    if (item.presence === "new") {
      assert(item.previousCandidateId === undefined, "new lineage must not fabricate a previous candidate");
    } else {
      assert(item.previousCandidateId, "continuing/reappeared lineage must retain previous candidate reference");
      assert(item.matchEvidence?.similarity >= item.matchEvidence?.threshold, "reused lineage must expose match evidence above threshold");
      assert(item.matchEvidence?.anchorOverlap?.length >= 1, "reused lineage requires at least one normalized anchor overlap");
    }
  }
  for (const item of cycle.disappeared) {
    assert(!lineageIds.has(item.lineageId), `lineage ${item.lineageId} cannot be current and disappeared in the same cycle`);
  }
  if (cycle.previousCycleId === null) assert(cycle.comparisonWindow === "bootstrap", "first persisted cycle must be bootstrap");
  if (cycle.comparisonWindow === "too-close-for-cadence") assert(cycle.cycleGapHours < 6, "too-close comparison must be under six hours");
  if (cycle.comparisonWindow === "comparable") assert(cycle.cycleGapHours >= 6 && cycle.cycleGapHours <= 18, "comparable cycle gap must stay inside the twice-daily QA window");

  console.log(`Stage 04D verification PASS · cycle ${cycle.cycleId} · ${cycle.current.length} current · ${cycle.disappeared.length} newly disappeared · ${cycle.trackedLineageCount} tracked lineages · ${cycle.comparisonWindow}.`);
}

verifyFixture();
await verifyArtifact();
