import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dataDir = path.join(repoRoot, "apps/web/public/data");
const baselinePath = path.join(dataDir, "workspace-signals.json");
const expandedPath = path.join(dataDir, "workspace-signals-04f.json");
const reportPath = path.join(dataDir, "workspace-intelligence.json");

function assert(condition, message) { if (!condition) throw new Error(`Stage 04F verification failed: ${message}`); }
function unique(values) { return [...new Set(values.filter(Boolean))]; }
function norm(value) { return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim(); }

await access(baselinePath, constants.R_OK);
await access(expandedPath, constants.R_OK);
await access(reportPath, constants.R_OK);
const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
const expanded = JSON.parse(await readFile(expandedPath, "utf8"));
const reportSnapshot = JSON.parse(await readFile(reportPath, "utf8"));

assert(baseline.schemaVersion === "workspace-signal-snapshot.v1", "verified 04E baseline artifact must remain workspace-signal-snapshot.v1");
assert(expanded.schemaVersion === "workspace-signal-snapshot-04f.v1", "04F expansion artifact schema must remain explicit");
assert(expanded.workspaceCollectionMethodologyVersion === "workspace-collection-04f.v1-remediated", "04F signal artifact must pass remediation layer");
assert(reportSnapshot.schemaVersion === "workspace-intelligence-snapshot.v1", "canonical Workspace Intelligence schema must remain compatible with downstream 05B");
assert(reportSnapshot.methodologyVersion === "workspace-resolution-04f.v1-remediated", "canonical Workspace Intelligence must pass 04F semantic finalization");

const baselineByWorkspace = new Map((baseline.workspaces ?? []).map((entry) => [entry.workspace?.id, entry]));
let totalAdded = 0, totalWeak = 0, totalCandidates = 0, totalCorroborated = 0, totalOperationalClasses = 0, totalRelevantClasses = 0, appleSignals = 0, googleSignals = 0, redditSignals = 0;

for (const entry of expanded.workspaces ?? []) {
  const baselineEntry = baselineByWorkspace.get(entry.workspace?.id);
  assert(baselineEntry, `Workspace ${entry.workspace?.id} must derive from verified 04E baseline`);
  const baselineIds = new Set((baselineEntry.signals ?? []).map((signal) => signal.id));
  const expandedIds = new Set((entry.signals ?? []).map((signal) => signal.id));
  for (const id of baselineIds) assert(expandedIds.has(id), `04F must preserve baseline signal ${id}`);
  assert((entry.signals ?? []).length >= (baselineEntry.signals ?? []).length, "04F remediation must not shrink verified 04E baseline evidence");
  assert(entry.remediation04f?.targetedAccountingRecomputed === true, "04F targeted accounting remediation must be explicit");
  assert(entry.coverageExpansion04f?.expandedSignalCount === (entry.signals ?? []).length, "expandedSignalCount must match final remediated signals");
  assert(entry.sourcePlan?.successfulTargetedSources <= entry.sourcePlan?.attemptedTargetedSources, "successful targeted sources cannot exceed attempted targeted sources");
  assert(entry.sourcePlan?.baselineTargeted04e?.attempted >= entry.sourcePlan?.baselineTargeted04e?.successfulWithRelevantEvidence, "04E baseline targeted accounting must be internally valid");
  assert(entry.sourcePlan?.expansionTargeted04f?.attempted >= entry.sourcePlan?.expansionTargeted04f?.successfulWithRelevantEvidence, "04F expansion targeted accounting must be internally valid");
  assert(entry.sourcePlan?.attemptedTargetedSources === entry.sourcePlan?.baselineTargeted04e?.attempted + entry.sourcePlan?.expansionTargeted04f?.attempted, "combined targeted attempted count must equal 04E baseline + 04F expansion");
  assert(entry.sourcePlan?.successfulTargetedSources === entry.sourcePlan?.baselineTargeted04e?.successfulWithRelevantEvidence + entry.sourcePlan?.expansionTargeted04f?.successfulWithRelevantEvidence, "combined targeted successful count must equal evidence-backed 04E + 04F counts");

  const coverageClasses = entry.coverageClasses ?? [];
  const classNames = coverageClasses.map((item) => item.coverageClass);
  assert(unique(classNames).length === 5, "04F must report exactly five non-duplicated coverage classes");
  for (const required of ["publisher", "social", "community", "search-demand", "app-store"]) assert(classNames.includes(required), `04F coverage must include ${required}`);
  for (const coverage of coverageClasses) {
    assert(["operational-with-relevant-evidence", "operational-no-relevant-evidence", "runtime-failed", "not-configured"].includes(coverage.runtimeStatus), `${coverage.coverageClass} runtime status must use explicit semantics`);
    if (coverage.runtimeStatus === "operational-no-relevant-evidence") assert(coverage.relevantSignalCount === 0, `${coverage.coverageClass} cannot claim relevant evidence`);
    if (coverage.runtimeStatus === "operational-with-relevant-evidence") assert(coverage.relevantSignalCount > 0, `${coverage.coverageClass} must be backed by actual evidence`);
  }
  const operationalClasses = coverageClasses.filter((item) => String(item.runtimeStatus).startsWith("operational-")).length;
  const relevantClasses = coverageClasses.filter((item) => item.relevantSignalCount > 0).length;
  assert(operationalClasses >= 4, "04F PASS requires new search/store operational coverage in addition to 04E baseline classes");
  totalOperationalClasses += operationalClasses;
  totalRelevantClasses += relevantClasses;

  for (const signal of entry.signals ?? []) {
    assert(signal.schemaVersion === "signal.v1", `${signal.id} must remain signal.v1`);
    assert(signal.workspaceId === entry.workspace.id, `${signal.id} must retain actual runtime Workspace ID`);
    assert(Boolean(signal.evidence?.sourceUrl), `${signal.id} must retain evidence URL`);
    if (signal.source?.sourceId === "apple-app-store-marketing-rss") {
      appleSignals += 1;
      assert(norm((signal.keywords ?? [])[0]) === "games", "Apple Workspace evidence requires primary returned genre = Games; secondary Games genre is insufficient");
      assert(signal.source?.sourceType === "store", "Apple signals must use store source family");
      assert(signal.metrics?.native?.overallTopFreeRank === signal.metrics?.sourceRank, "Apple overall rank must remain source-native without Games-rank reinterpretation");
    }
    if (signal.source?.sourceId === "google-trends-rss") {
      googleSignals += 1;
      assert(signal.source?.sourceType === "search", "Google Trends signals must use search source family");
      assert(!Object.hasOwn(signal.metrics ?? {}, "views"), "Google Trends approximate traffic must not be relabeled as views");
    }
    if (signal.source?.sourceId === "reddit-public-rss-search") {
      redditSignals += 1;
      assert((signal.confidence?.basis ?? []).some((item) => String(item).includes("Query text itself is not counted as relevance evidence")), "Reddit query provenance must not become relevance evidence");
    }
  }
  totalAdded += entry.coverageExpansion04f?.addedSignalCount ?? 0;
}

const expandedByWorkspace = new Map((expanded.workspaces ?? []).map((entry) => [entry.workspace?.id, entry]));
for (const report of reportSnapshot.workspaces ?? []) {
  const entry = expandedByWorkspace.get(report.workspace?.id);
  assert(entry, `Workspace report ${report.workspace?.id} must resolve from remediated 04F signals`);
  assert(report.resolutionFinalization04f?.semanticBoundaryRevalidated === true, "04F report must pass semantic boundary finalization");
  assert(report.quality?.relevantSignalCount === (entry.signals ?? []).length, "report relevantSignalCount must match final 04F signals");
  for (const candidate of report.candidates ?? []) {
    totalCandidates += 1;
    assert(unique(candidate.sourceIds ?? []).length >= 2, `${candidate.id} requires at least two source IDs`);
    assert(candidate.confidence?.score === undefined, `${candidate.id} must not invent numeric Confidence`);
    const trace = candidate.resolutionTrace04f;
    assert(trace?.methodologyVersion === "workspace-resolution-04f.v1-remediated", `${candidate.id} must retain remediated resolution trace`);
    assert(trace?.semanticSupportOnly === true, `${candidate.id} semantic anchors must be explicitly support-only`);
    if ((trace?.modes ?? []).includes("bounded-subject-bridge")) assert((trace.subjectAnchors ?? []).length > 0, `${candidate.id} bounded bridge requires subject anchor`);
    for (const semantic of trace?.semanticAnchors ?? []) assert(!(candidate.resolutionAnchors ?? []).includes(semantic) || (trace.subjectAnchors ?? []).includes(semantic) || (trace.baselineResolutionAnchors ?? []).includes(semantic), `${candidate.id} semantic-only support must not be promoted into primary resolutionAnchors`);
    assert(!(trace?.semanticAnchors ?? []).includes("artificial-intelligence") || (candidate.signalIds ?? []).every((id) => {
      const signal = (entry.signals ?? []).find((item) => item.id === id); const text = norm([signal?.topic, ...(signal?.entities ?? []), ...(signal?.hashtags ?? []), ...(signal?.keywords ?? [])].join(" ")); return new Set(text.split(" ")).has("ai") || text.includes("artificial intelligence");
    }), `${candidate.id} AI semantic support must use token/phrase boundary, never substring matching`);
    if (candidate.status === "corroborated") { totalCorroborated += 1; assert(candidate.independentSourceDiversity >= 2 && candidate.independentSourceFamilyDiversity >= 2, `${candidate.id} corroborated requires two independent sources and families`); }
  }
  totalWeak += report.weakSignals?.length ?? 0;
}

console.log(`Stage 04F verification PASS · remediation locked · ${totalAdded} new relevant signal(s) · ${totalOperationalClasses} operational coverage-class state(s) · ${totalRelevantClasses} class(es) with relevant evidence · Apple ${appleSignals} · Google Trends ${googleSignals} · Reddit ${redditSignals} · ${totalWeak} weak signal record(s) · ${totalCandidates} cross-source candidate(s) · ${totalCorroborated} corroborated.`);
