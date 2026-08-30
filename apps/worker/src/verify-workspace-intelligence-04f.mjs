import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dataDir = path.join(repoRoot, "apps/web/public/data");
const baselinePath = path.join(dataDir, "workspace-signals.json");
const expandedPath = path.join(dataDir, "workspace-signals-04f.json");
const reportPath = path.join(dataDir, "workspace-intelligence.json");

function assert(condition, message) {
  if (!condition) throw new Error(`Stage 04F verification failed: ${message}`);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

await access(baselinePath, constants.R_OK);
await access(expandedPath, constants.R_OK);
await access(reportPath, constants.R_OK);

const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
const expanded = JSON.parse(await readFile(expandedPath, "utf8"));
const reportSnapshot = JSON.parse(await readFile(reportPath, "utf8"));

assert(baseline.schemaVersion === "workspace-signal-snapshot.v1", "verified 04E baseline artifact must remain workspace-signal-snapshot.v1");
assert(expanded.schemaVersion === "workspace-signal-snapshot-04f.v1", "04F expansion artifact schema must be explicit");
assert(expanded.baselineSchemaVersion === "workspace-signal-snapshot.v1", "04F expansion must declare the 04E baseline schema");
assert(reportSnapshot.schemaVersion === "workspace-intelligence-snapshot.v1", "canonical Workspace Intelligence schema must remain compatible with downstream 05B");
assert(reportSnapshot.methodologyVersion === "workspace-resolution-04f.v1", "canonical Workspace Intelligence must declare the 04F methodology");

const baselineByWorkspace = new Map((baseline.workspaces ?? []).map((entry) => [entry.workspace?.id, entry]));
let totalAdded = 0;
let totalWeak = 0;
let totalCandidates = 0;
let totalCorroborated = 0;
let totalOperationalClasses = 0;
let totalRelevantClasses = 0;
let appleSignals = 0;
let googleSignals = 0;
let redditSignals = 0;

for (const entry of expanded.workspaces ?? []) {
  const baselineEntry = baselineByWorkspace.get(entry.workspace?.id);
  assert(baselineEntry, `Workspace ${entry.workspace?.id} must derive from a verified 04E baseline entry`);
  const baselineIds = new Set((baselineEntry.signals ?? []).map((signal) => signal.id));
  const expandedIds = new Set((entry.signals ?? []).map((signal) => signal.id));
  for (const id of baselineIds) assert(expandedIds.has(id), `04F must preserve baseline signal ${id} rather than silently replacing it`);
  assert((entry.signals ?? []).length >= (baselineEntry.signals ?? []).length, "04F expansion may add/dedupe new-source observations but must not shrink the verified 04E baseline set");
  assert(entry.coverageExpansion04f?.schemaVersion === "workspace-coverage-expansion-04f.v1", "Workspace must expose 04F coverage expansion trace");
  assert(entry.coverageExpansion04f?.baselineSignalCount === (baselineEntry.signals ?? []).length, "04F baselineSignalCount must match the actual 04E baseline");
  assert(entry.coverageExpansion04f?.expandedSignalCount === (entry.signals ?? []).length, "04F expandedSignalCount must match actual final signals");

  const coverageClasses = entry.coverageClasses ?? [];
  const classNames = coverageClasses.map((item) => item.coverageClass);
  assert(unique(classNames).length === 5, "04F must report exactly five non-duplicated coverage classes");
  for (const required of ["publisher", "social", "community", "search-demand", "app-store"]) assert(classNames.includes(required), `04F coverage must include ${required}`);
  for (const coverage of coverageClasses) {
    assert(["operational-with-relevant-evidence", "operational-no-relevant-evidence", "runtime-failed", "not-configured"].includes(coverage.runtimeStatus), `${coverage.coverageClass} runtime status must use explicit operational/evidence semantics`);
    if (coverage.runtimeStatus === "operational-no-relevant-evidence") assert(coverage.relevantSignalCount === 0, `${coverage.coverageClass} operational-no-relevant-evidence must not claim relevant signals`);
    if (coverage.runtimeStatus === "operational-with-relevant-evidence") assert(coverage.relevantSignalCount > 0, `${coverage.coverageClass} operational-with-relevant-evidence must be backed by actual signals`);
    if (coverage.runtimeStatus === "runtime-failed") assert(coverage.failureCount > 0, `${coverage.coverageClass} runtime-failed must retain failure evidence`);
  }
  const operationalClasses = coverageClasses.filter((item) => String(item.runtimeStatus).startsWith("operational-")).length;
  const relevantClasses = coverageClasses.filter((item) => item.relevantSignalCount > 0).length;
  assert(operationalClasses >= 4, "04F implementation PASS requires at least one of the new search-demand/app-store classes to be runtime-operational in addition to the verified 04E baseline classes");
  totalOperationalClasses += operationalClasses;
  totalRelevantClasses += relevantClasses;

  for (const signal of entry.signals ?? []) {
    assert(signal.schemaVersion === "signal.v1", `${signal.id} must remain signal.v1`);
    assert(signal.workspaceId === entry.workspace.id, `${signal.id} must retain its real runtime Workspace ID`);
    assert(Boolean(signal.evidence?.sourceUrl), `${signal.id} must retain an evidence URL`);
    assert(Boolean(signal.evidence?.reference), `${signal.id} must retain an evidence reference`);
    if (signal.source?.sourceId === "apple-app-store-marketing-rss") {
      appleSignals += 1;
      assert(signal.source?.sourceType === "store", "Apple App Store 04F signals must use the store source family");
      assert(signal.contentType === "source-native-store-chart", "Apple signals must remain source-native store chart observations");
      assert(Number(signal.metrics?.sourceRank) >= 1, "Apple source-native overall rank must be preserved");
      assert(signal.metrics?.native?.overallTopFreeRank === signal.metrics?.sourceRank, "Apple native overallTopFreeRank must equal sourceRank without category-rank reinterpretation");
      assert(String(signal.metrics?.native?.genreEvidence ?? "").toLowerCase().includes("game"), "Apple Workspace evidence must retain source-native Games genre metadata");
      assert((signal.confidence?.basis ?? []).some((item) => String(item).includes("not represented as a Games-category rank")), "Apple rank semantic boundary must be explicit");
    }
    if (signal.source?.sourceId === "google-trends-rss") {
      googleSignals += 1;
      assert(signal.source?.sourceType === "search", "Google Trends 04F signals must use the search source family");
      assert(signal.contentType === "source-native-search-trend", "Google Trends signal must remain a source-native search trend observation");
      assert(!Object.hasOwn(signal.metrics ?? {}, "views"), "Google Trends approximate search traffic must not be relabeled as views");
    }
    if (signal.source?.sourceId === "reddit-public-rss-search") {
      redditSignals += 1;
      assert(signal.source?.sourceType === "community", "Reddit public RSS signals must remain community evidence");
      assert((signal.confidence?.basis ?? []).some((item) => String(item).includes("provisional personal/private evidence path")), "Reddit RSS access boundary must remain explicit");
      assert((signal.confidence?.basis ?? []).some((item) => String(item).includes("Query text itself is not counted as relevance evidence")), "Reddit query provenance must not become relevance evidence");
    }
  }
  totalAdded += entry.coverageExpansion04f?.addedSignalCount ?? 0;
}

const expandedByWorkspace = new Map((expanded.workspaces ?? []).map((entry) => [entry.workspace?.id, entry]));
for (const report of reportSnapshot.workspaces ?? []) {
  const entry = expandedByWorkspace.get(report.workspace?.id);
  assert(entry, `Workspace report ${report.workspace?.id} must resolve from workspace-signals-04f.json`);
  assert(report.methodologyVersion === "workspace-resolution-04f.v1", "Workspace report must expose 04F resolution methodology");
  assert(report.quality?.relevantSignalCount === (entry.signals ?? []).length, "report relevantSignalCount must match 04F expanded signals");
  assert(report.quality?.sourceDiversity === unique((entry.signals ?? []).map((signal) => signal.source?.sourceId)).length, "report sourceDiversity must be recomputed from actual 04F evidence");
  assert(report.quality?.sourceFamilyDiversity === unique((entry.signals ?? []).map((signal) => signal.source?.sourceType)).length, "report sourceFamilyDiversity must be recomputed from actual 04F evidence");
  assert(report.quality?.operationalCoverageClassCount === (report.coverageClasses ?? []).filter((item) => String(item.runtimeStatus).startsWith("operational-")).length, "operational coverage class count must match coverage records");
  assert(report.quality?.relevantCoverageClassCount === (report.coverageClasses ?? []).filter((item) => item.relevantSignalCount > 0).length, "relevant coverage class count must match coverage records");

  for (const candidate of report.candidates ?? []) {
    totalCandidates += 1;
    const sourceIds = unique(candidate.sourceIds ?? []);
    assert(sourceIds.length >= 2, `${candidate.id} must contain at least two distinct source IDs`);
    assert(candidate.workspaceId === report.workspace.id, `${candidate.id} must use the actual report Workspace ID`);
    assert(candidate.numericScore === undefined && candidate.score === undefined, `${candidate.id} must not invent a numeric trend score`);
    assert(candidate.confidence?.score === undefined, `${candidate.id} must not invent numeric Confidence precision`);
    assert((candidate.evidenceRefs ?? []).length >= 2, `${candidate.id} must retain cross-source evidence refs`);
    const trace = candidate.resolutionTrace04f;
    assert(trace?.methodologyVersion === "workspace-resolution-04f.v1", `${candidate.id} must retain an inspectable 04F resolution trace`);
    if ((trace?.modes ?? []).includes("bounded-subject-bridge")) {
      assert((trace.subjectAnchors ?? []).length > 0, `${candidate.id} bounded semantic bridge cannot exist without a distinctive subject anchor`);
    }
    assert(!((trace?.subjectAnchors ?? []).length === 0 && (trace?.semanticAnchors ?? []).length > 0 && (trace?.modes ?? []).includes("bounded-subject-bridge")), `${candidate.id} semantic aliases alone must never create a cross-source edge`);
    assert(!(candidate.resolutionAnchors ?? []).every((anchor) => ["mobile-gaming", "vietnam-gaming", "game-publishing"].includes(anchor)), `${candidate.id} cannot be created solely from Workspace scope concepts`);
    if (candidate.status === "corroborated") {
      totalCorroborated += 1;
      assert(candidate.independentSourceDiversity >= 2, `${candidate.id} corroborated status requires at least two independent source IDs`);
      assert(candidate.independentSourceFamilyDiversity >= 2, `${candidate.id} corroborated status requires at least two independent source families`);
    }
  }
  for (const cluster of report.repeatedSingleSourceClusters ?? []) assert(unique(cluster.sourceIds ?? []).length === 1, `${cluster.id} repeated-single-source cluster must remain exactly one source ID`);
  totalWeak += report.weakSignals?.length ?? 0;
}

assert((expanded.workspaces ?? []).length === (reportSnapshot.workspaces ?? []).length, "04F expansion/report Workspace counts must match");
console.log(`Stage 04F verification PASS · 04E baseline preserved · ${totalAdded} new relevant signal(s) · ${totalOperationalClasses} operational coverage-class state(s) across Workspace(s) · ${totalRelevantClasses} class(es) with current relevant evidence · Apple ${appleSignals} · Google Trends ${googleSignals} · Reddit ${redditSignals} · ${totalWeak} weak signal record(s) · ${totalCandidates} cross-source candidate(s) · ${totalCorroborated} corroborated.`);
