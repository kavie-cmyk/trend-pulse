import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dataDir = path.join(repoRoot, "apps/web/public/data");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const signalSnapshot = JSON.parse(await readFile(path.join(dataDir, "workspace-signals.json"), "utf8"));
  const intelligence = JSON.parse(await readFile(path.join(dataDir, "workspace-intelligence.json"), "utf8"));
  assert(signalSnapshot.schemaVersion === "workspace-signal-snapshot.v1", "workspace-signals schema mismatch");
  assert(intelligence.schemaVersion === "workspace-intelligence-snapshot.v1", "workspace-intelligence schema mismatch");
  assert(Array.isArray(signalSnapshot.workspaces) && signalSnapshot.workspaces.length >= 1, "no runtime workspace signal snapshots");
  assert(Array.isArray(intelligence.workspaces) && intelligence.workspaces.length === signalSnapshot.workspaces.length, "workspace report count mismatch");

  const defaultReport = intelligence.workspaces.find((entry) => (entry.workspace?.matchNames ?? []).includes("Vietnam Mobile Gaming") || entry.workspace?.name === "Vietnam Mobile Gaming");
  assert(defaultReport, "default Vietnam Mobile Gaming runtime report missing");

  for (const entry of signalSnapshot.workspaces) {
    assert(entry.sourcePlan?.collectionMode === "workspace-scoped", `${entry.workspace?.name}: collection is not workspace-scoped`);
    assert(entry.sourcePlan?.coverage?.workspaceQueryExecuted === true, `${entry.workspace?.name}: targeted workspace queries did not execute`);
    assert(Number(entry.sourcePlan?.postDedupeRelevantCount) > 0, `${entry.workspace?.name}: no relevant signals survived collection`);
    assert(Number(entry.sourcePlan?.sourceDiversity) >= 2, `${entry.workspace?.name}: source diversity below 2`);
    assert(Array.isArray(entry.weakSignals) && entry.weakSignals.length > 0, `${entry.workspace?.name}: weak-signal layer is empty`);
    const ids = new Set();
    for (const signal of entry.signals ?? []) {
      assert(signal.workspaceId === entry.workspace.id, `${entry.workspace?.name}: signal missing real workspaceId`);
      assert(signal.collectionScopeId?.startsWith(entry.workspace.id), `${entry.workspace?.name}: signal collection scope is not workspace-scoped`);
      assert(signal.evidence?.sourceUrl, `${entry.workspace?.name}: signal missing evidence URL`);
      assert(!ids.has(signal.id), `${entry.workspace?.name}: duplicate signal id ${signal.id}`);
      ids.add(signal.id);
      if (["github-rest-api", "github-workspace-search"].includes(signal.source?.sourceId)) {
        assert(!signal.language, `${entry.workspace?.name}: GitHub programming language leaked into Signal.language`);
      }
    }
  }

  for (const report of intelligence.workspaces) {
    assert(report.coverageStatus !== "not-pass", `${report.workspace?.name}: source coverage still NOT PASS`);
    assert(report.quality?.weakSignalCount > 0, `${report.workspace?.name}: report hides weak signals`);
    for (const candidate of report.candidates ?? []) {
      assert(candidate.workspaceId === report.workspace.id, `${report.workspace?.name}: candidate missing workspaceId`);
      assert((candidate.sourceIds ?? []).length >= 2, `${report.workspace?.name}: same-source cluster incorrectly promoted to Trend Candidate`);
      assert((candidate.independentSourceDiversity ?? 0) >= 1, `${report.workspace?.name}: independent source metadata missing`);
    }
    for (const cluster of report.repeatedSingleSourceClusters ?? []) {
      assert((cluster.sourceIds ?? []).length === 1, `${report.workspace?.name}: repeated-source weak cluster classification mismatch`);
    }
  }

  console.log(`Stage 04E verification PASS · ${intelligence.workspaces.length} runtime workspace(s) · ${defaultReport.quality.relevantSignalCount} relevant signals · ${defaultReport.quality.weakSignalCount} weak signals · ${defaultReport.candidateCount} cross-source candidates · ${defaultReport.corroboratedCount} corroborated · coverage ${defaultReport.coverageStatus}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
