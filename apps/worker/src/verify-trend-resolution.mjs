import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSignals } from "./resolve-trends.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const artifactPath = path.join(repoRoot, "apps/web/public/data/trend-candidates.json");

function assert(condition, message) {
  if (!condition) throw new Error(`Stage 04C verification failed: ${message}`);
}

function fixtureSignal({ id, sourceId, sourceType, topic, entity, hashtag }) {
  const now = "2026-08-30T00:00:00.000Z";
  return {
    schemaVersion: "signal.v1",
    id,
    observedAt: now,
    collectedAt: now,
    normalizedAt: now,
    source: { sourceId, sourceName: sourceId, sourceType, accessMode: "official-api", freshness: "near-live" },
    topic,
    entities: entity ? [entity] : [],
    keywords: [],
    hashtags: hashtag ? [hashtag] : [],
    metrics: {},
    dynamics: {},
    confidence: { score: 0.5, basis: ["test fixture"] },
    evidence: { sourceUrl: `https://example.com/${id}`, externalId: id, reference: id },
  };
}

function verifyResolverGate() {
  const fixture = [
    fixtureSignal({ id: "a", sourceId: "publisher-a", sourceType: "publisher", topic: "Project Orion launch draws attention", entity: "Project Orion", hashtag: "ProjectOrion" }),
    fixtureSignal({ id: "b", sourceId: "community-b", sourceType: "community", topic: "Community discusses Project Orion launch", entity: "Project Orion", hashtag: "ProjectOrion" }),
    fixtureSignal({ id: "c", sourceId: "social-c", sourceType: "social", topic: "Project Orion launch conversation", entity: "Project Orion", hashtag: "ProjectOrion" }),
  ];
  const snapshot = resolveSignals(fixture, "2026-08-30T00:00:01.000Z");
  assert(snapshot.corroboratedCount === 1, "synthetic independent-source fixture must create exactly one corroborated cluster");
  const candidate = snapshot.candidates[0];
  assert(candidate.sourceIds.length === 3, "corroborated fixture must retain three source IDs");
  assert(candidate.sourceFamilies.length === 3, "corroborated fixture must retain three source families");
  assert(candidate.workspaceId === undefined, "global resolution must not fabricate a workspaceId");
  assert(candidate.confidence.score === undefined, "04C must not emit a numeric confidence score");
}

async function verifyArtifact() {
  const snapshot = JSON.parse(await readFile(artifactPath, "utf8"));
  assert(snapshot.schemaVersion === "trend-resolution-snapshot.v1", "unexpected snapshot schema");
  assert(snapshot.methodologyVersion === "trend-resolution-04c.v1", "unexpected methodology version");
  assert(snapshot.inputSignalCount > 0 && snapshot.uniqueSignalCount > 0, "real input signal counts must be positive");
  assert(snapshot.uniqueSignalCount <= snapshot.inputSignalCount, "deduplication cannot increase signal count");
  assert(snapshot.candidateCount + snapshot.corroboratedCount === snapshot.candidates.length, "candidate counters must reconcile");

  const assigned = new Set();
  for (const candidate of snapshot.candidates) {
    assert(candidate.schemaVersion === "trend-candidate.v1", "all resolved records must be trend-candidate.v1");
    assert(candidate.signalIds.length >= 2, "single observation must never become a Trend Candidate");
    assert(candidate.workspaceId === undefined, "broad/global candidate must not fabricate workspaceId");
    assert(candidate.lifecycleStage === "weak-signal", "04C must not infer lifecycle movement from one snapshot");
    assert(candidate.confidence?.score === undefined, "04C must not fabricate numeric confidence");
    assert(candidate.evidenceRefs.length >= 2, "candidate must retain at least two evidence URLs");
    assert(candidate.resolutionAnchors?.length > 0, "candidate must expose inspectable resolution anchors");
    if (candidate.status === "corroborated") {
      assert(candidate.sourceIds.length >= 2, "corroborated candidate requires at least two source IDs");
      assert(candidate.sourceFamilies.length >= 2, "corroborated candidate requires at least two independent source families");
    }
    for (const signalId of candidate.signalIds) {
      assert(!assigned.has(signalId), `signal ${signalId} appears in multiple clusters`);
      assigned.add(signalId);
    }
  }
  assert(snapshot.clusteredSignalCount === assigned.size, "clustered signal counter must reconcile");
  assert(snapshot.clusteredSignalCount + snapshot.unclusteredSignalCount === snapshot.uniqueSignalCount, "clustered + unclustered must equal unique signals");
  console.log(`Stage 04C verification PASS · ${snapshot.corroboratedCount} corroborated · ${snapshot.candidateCount} candidates · ${snapshot.uniqueSignalCount} unique signals.`);
}

verifyResolverGate();
await verifyArtifact();
