import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dataDir = path.join(repoRoot, "apps/web/public/data");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ageDays(value, now) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return (now.getTime() - date.getTime()) / 86400000;
}

async function main() {
  const signalSnapshot = JSON.parse(await readFile(path.join(dataDir, "workspace-signals.json"), "utf8"));
  const intelligence = JSON.parse(await readFile(path.join(dataDir, "workspace-intelligence.json"), "utf8"));
  assert(signalSnapshot.schemaVersion === "workspace-signal-snapshot.v1", "workspace-signals schema mismatch");
  assert(intelligence.schemaVersion === "workspace-intelligence-snapshot.v1", "workspace-intelligence schema mismatch");
  assert(signalSnapshot.workspaceCollectionMethodologyVersion === "workspace-collection-04e.v3-finalized", "workspace collection was not finalized by 04E v3 quality gate");
  assert(Array.isArray(signalSnapshot.workspaces) && signalSnapshot.workspaces.length >= 1, "no runtime workspace signal snapshots");
  assert(Array.isArray(intelligence.workspaces) && intelligence.workspaces.length === signalSnapshot.workspaces.length, "workspace report count mismatch");

  const defaultReport = intelligence.workspaces.find((entry) => (entry.workspace?.matchNames ?? []).includes("Vietnam Mobile Gaming") || entry.workspace?.name === "Vietnam Mobile Gaming");
  assert(defaultReport, "default Vietnam Mobile Gaming runtime report missing");

  for (const entry of signalSnapshot.workspaces) {
    assert(entry.sourcePlan?.collectionMode === "workspace-scoped", `${entry.workspace?.name}: collection is not workspace-scoped`);
    assert(entry.sourcePlan?.methodologyVersion === "workspace-collection-04e.v3-finalized", `${entry.workspace?.name}: source plan is not final 04E v3 methodology`);
    assert(entry.sourcePlan?.coverage?.workspaceQueryExecuted === true, `${entry.workspace?.name}: targeted workspace queries did not execute`);
    assert(Number(entry.sourcePlan?.postDedupeRelevantCount) > 0, `${entry.workspace?.name}: no relevant signals survived collection`);
    assert(Number(entry.sourcePlan?.sourceDiversity) >= 2, `${entry.workspace?.name}: source diversity below 2`);
    assert(Array.isArray(entry.weakSignals) && entry.weakSignals.length > 0, `${entry.workspace?.name}: weak-signal layer is empty`);

    const actualSources = [...new Set((entry.signals ?? []).map((signal) => signal.source?.sourceId).filter(Boolean))];
    const actualFamilies = [...new Set((entry.signals ?? []).map((signal) => signal.source?.sourceType).filter(Boolean))];
    assert(entry.sourcePlan.sourceDiversity === actualSources.length, `${entry.workspace?.name}: sourceDiversity is stale or inconsistent with actual signals`);
    assert(entry.sourcePlan.sourceFamilyDiversity === actualFamilies.length, `${entry.workspace?.name}: sourceFamilyDiversity is stale or inconsistent with actual signals`);
    assert(JSON.stringify([...entry.sourcePlan.activeSourceIds].sort()) === JSON.stringify([...actualSources].sort()), `${entry.workspace?.name}: activeSourceIds do not match actual signal sources`);

    const ids = new Set();
    const now = new Date(signalSnapshot.collectedAt);
    for (const signal of entry.signals ?? []) {
      assert(signal.workspaceId === entry.workspace.id, `${entry.workspace?.name}: signal missing real workspaceId`);
      assert(signal.collectionScopeId?.startsWith(entry.workspace.id), `${entry.workspace?.name}: signal collection scope is not workspace-scoped`);
      assert(signal.evidence?.sourceUrl, `${entry.workspace?.name}: signal missing evidence URL`);
      assert(!ids.has(signal.id), `${entry.workspace?.name}: duplicate signal id ${signal.id}`);
      ids.add(signal.id);
      if (["github-rest-api", "github-workspace-search"].includes(signal.source?.sourceId)) {
        assert(!signal.language, `${entry.workspace?.name}: GitHub programming language leaked into Signal.language`);
      }
      if (signal.source?.sourceType === "publisher" && signal.publishedAt) {
        const age = ageDays(signal.publishedAt, now);
        assert(age !== null && age <= 30.1, `${entry.workspace?.name}: stale publisher evidence older than 30 days survived (${signal.source?.sourceId})`);
      }
      if (String(signal.source?.sourceId).startsWith("stackexchange-search-") || signal.source?.sourceId === "lemmy-search") {
        const age = ageDays(signal.publishedAt, now);
        assert(age !== null && age <= 30.1, `${entry.workspace?.name}: stale targeted community evidence survived (${signal.source?.sourceId})`);
      }
    }
  }

  for (const report of intelligence.workspaces) {
    assert(report.coverageStatus !== "not-pass", `${report.workspace?.name}: source coverage still NOT PASS`);
    assert(report.quality?.weakSignalCount > 0, `${report.workspace?.name}: report hides weak signals`);
    assert(report.quality?.sourceDiversity === report.sourcePlan?.sourceDiversity, `${report.workspace?.name}: report source diversity mismatch`);
    assert(report.quality?.sourceFamilyDiversity === report.sourcePlan?.sourceFamilyDiversity, `${report.workspace?.name}: report source-family diversity mismatch`);
    for (const candidate of report.candidates ?? []) {
      assert(candidate.workspaceId === report.workspace.id, `${report.workspace?.name}: candidate missing workspaceId`);
      assert((candidate.sourceIds ?? []).length >= 2, `${report.workspace?.name}: same-source cluster incorrectly promoted to Trend Candidate`);
      assert((candidate.independentSourceDiversity ?? 0) >= 1, `${report.workspace?.name}: independent source metadata missing`);
    }
    for (const cluster of report.repeatedSingleSourceClusters ?? []) {
      assert((cluster.sourceIds ?? []).length === 1, `${report.workspace?.name}: repeated-source weak cluster classification mismatch`);
    }
  }

  console.log(`Stage 04E verification PASS · finalized content/freshness gates · ${intelligence.workspaces.length} runtime workspace(s) · ${defaultReport.quality.relevantSignalCount} relevant signals · ${defaultReport.quality.weakSignalCount} weak signals · ${defaultReport.candidateCount} cross-source candidates · ${defaultReport.corroboratedCount} corroborated · ${defaultReport.quality.sourceDiversity} actual sources / ${defaultReport.quality.sourceFamilyDiversity} families · coverage ${defaultReport.coverageStatus}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
