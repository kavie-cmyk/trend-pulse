import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const artifactPath = path.join(repoRoot, "apps/web/public/data/workspace-signals-04f.json");
const EXPANSION_SOURCE_IDS = new Set(["google-trends-rss", "apple-app-store-marketing-rss", "reddit-public-rss-search"]);

function norm(value) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

function applePrimaryGame(signal) {
  if (signal?.source?.sourceId !== "apple-app-store-marketing-rss") return true;
  const genres = Array.isArray(signal.keywords) ? signal.keywords : [];
  return norm(genres[0]) === "games";
}

function expansionConfiguredSourceIds(entry) {
  const ids = new Set();
  for (const coverage of entry.coverageClasses ?? []) {
    for (const sourceId of coverage.sourceIds ?? []) if (EXPANSION_SOURCE_IDS.has(sourceId)) ids.add(sourceId);
  }
  return ids;
}

function updateCoverageClasses(entry, signals) {
  const sourceSignals = (sourceId) => signals.filter((signal) => signal.source?.sourceId === sourceId);
  return (entry.coverageClasses ?? []).map((coverage) => {
    if (coverage.coverageClass === "app-store") {
      const relevant = sourceSignals("apple-app-store-marketing-rss");
      return {
        ...coverage,
        relevantSignalCount: relevant.length,
        runtimeStatus: coverage.runtimeStatus?.startsWith("operational")
          ? relevant.length ? "operational-with-relevant-evidence" : "operational-no-relevant-evidence"
          : coverage.runtimeStatus,
        notes: [...(coverage.notes ?? []), "04F remediation requires Apple primary returned genre = Games; a secondary Games genre alone is insufficient Workspace evidence."],
      };
    }
    if (coverage.coverageClass === "community") {
      const baselineCommunity = signals.filter((signal) => signal.source?.sourceType === "community" && signal.source?.sourceId !== "reddit-public-rss-search");
      const reddit = sourceSignals("reddit-public-rss-search");
      return { ...coverage, relevantSignalCount: baselineCommunity.length + reddit.length };
    }
    return coverage;
  });
}

async function main() {
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
  if (artifact?.schemaVersion !== "workspace-signal-snapshot-04f.v1") throw new Error("04F remediation requires workspace-signal-snapshot-04f.v1.");
  const workspaces = [];
  for (const entry of artifact.workspaces ?? []) {
    const originalSignals = entry.signals ?? [];
    const originalExpansion = entry.sourcePlan?.expansion04f ?? {};
    const originalExpansionRelevantSourceCount = new Set(originalExpansion.addedSourceIds ?? []).size;
    const baselineAttempted = Number(entry.sourcePlan?.attemptedTargetedSources) || 0;
    const baselineSuccessful = Math.max(0, (Number(entry.sourcePlan?.successfulTargetedSources) || 0) - originalExpansionRelevantSourceCount);
    const signals = originalSignals.filter(applePrimaryGame);
    const removedAppleSecondaryGenre = originalSignals.length - signals.length;
    const expansionSignals = signals.filter((signal) => EXPANSION_SOURCE_IDS.has(signal.source?.sourceId));
    const expansionRelevantSourceIds = [...new Set(expansionSignals.map((signal) => signal.source?.sourceId).filter(Boolean))];
    const configuredExpansionSourceIds = [...expansionConfiguredSourceIds(entry)];
    const attemptedExpansion = configuredExpansionSourceIds.length;
    const successfulExpansion = expansionRelevantSourceIds.length;
    const attemptedTargetedSources = baselineAttempted + attemptedExpansion;
    const successfulTargetedSources = baselineSuccessful + successfulExpansion;
    if (successfulTargetedSources > attemptedTargetedSources) throw new Error("04F targeted-source accounting invariant violated: successful exceeds attempted.");

    const sourceIds = [...new Set(signals.map((signal) => signal.source?.sourceId).filter(Boolean))];
    const sourceFamilies = [...new Set(signals.map((signal) => signal.source?.sourceType).filter(Boolean))];
    const coverageClasses = updateCoverageClasses(entry, signals);
    const oldAddedCount = Number(originalExpansion.addedSignalCount) || 0;
    const targetedRelevantCount = Math.max(0, (Number(entry.sourcePlan?.targetedRelevantCount) || 0) - oldAddedCount + expansionSignals.length);
    const sourcePlan = {
      ...entry.sourcePlan,
      methodologyVersion: "workspace-collection-04f.v1-remediated",
      activeSourceIds: sourceIds,
      activeSourceFamilies: sourceFamilies,
      sourceDiversity: sourceIds.length,
      sourceFamilyDiversity: sourceFamilies.length,
      postDedupeRelevantCount: signals.length,
      preDedupeRelevantCount: signals.length + (Number(entry.sourcePlan?.sameSourceDuplicateCount) || 0),
      targetedRelevantCount,
      attemptedTargetedSources,
      successfulTargetedSources,
      coverage: {
        ...(entry.sourcePlan?.coverage ?? {}),
        targetedSourceSuccess: successfulTargetedSources,
        hasAppStore: coverageClasses.find((item) => item.coverageClass === "app-store")?.runtimeStatus === "operational-with-relevant-evidence",
        hasSearchDemand: coverageClasses.find((item) => item.coverageClass === "search-demand")?.runtimeStatus === "operational-with-relevant-evidence",
      },
      coverageClasses,
      baselineTargeted04e: { attempted: baselineAttempted, successfulWithRelevantEvidence: baselineSuccessful },
      expansionTargeted04f: { attempted: attemptedExpansion, successfulWithRelevantEvidence: successfulExpansion, configuredSourceIds: configuredExpansionSourceIds, relevantSourceIds: expansionRelevantSourceIds },
      expansion04f: {
        ...originalExpansion,
        methodologyVersion: "workspace-coverage-04f.v1-remediated",
        expandedSignalCount: signals.length,
        addedSignalCount: expansionSignals.length,
        addedSourceIds: expansionRelevantSourceIds,
        notes: [...(originalExpansion.notes ?? []), "Remediation separates baseline 04E targeted accounting from 04F expansion accounting.", "Apple App Store evidence requires primary returned genre = Games; secondary Games classification is not sufficient."],
      },
    };
    workspaces.push({ ...entry, sourcePlan, signals, weakSignals: (entry.weakSignals ?? []).filter((weak) => signals.some((signal) => signal.id === weak.signalId)), coverageClasses, coverageExpansion04f: sourcePlan.expansion04f, remediation04f: { methodologyVersion: "workspace-coverage-04f-remediation.v1", removedAppleSecondaryGenre, targetedAccountingRecomputed: true } });
  }
  const next = { ...artifact, workspaceCollectionMethodologyVersion: "workspace-collection-04f.v1-remediated", workspaces, notes: [...(artifact.notes ?? []), "04F remediation removes secondary-genre-only Apple matches and recomputes attempted/successful targeted-source accounting without mixing the 04E baseline with 04F expansion."] };
  await writeFile(artifactPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log("04F coverage remediation complete.");
  for (const entry of workspaces) console.log(`- ${entry.workspace.name}: ${entry.signals.length} relevant · targeted ${entry.sourcePlan.successfulTargetedSources}/${entry.sourcePlan.attemptedTargetedSources} with relevant evidence · Apple secondary-genre removals ${entry.remediation04f.removedAppleSecondaryGenre}`);
}

main().catch((error) => { console.error(error instanceof Error ? error.stack : error); process.exit(1); });
