import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSignals } from "./resolve-trends.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dataDir = path.join(repoRoot, "apps/web/public/data");
const inputPath = path.join(dataDir, "workspace-signals.json");
const outputPath = path.join(dataDir, "workspace-intelligence.json");
const stopWords = new Set(["the", "and", "for", "with", "from", "this", "that", "into", "about", "new", "more", "most", "news", "post", "posts", "today", "latest", "via", "after", "before", "over", "under"]);

function normalize(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleTokens(value) {
  return new Set(normalize(value).split(" ").filter((token) => token && token.length >= 3 && !stopWords.has(token)));
}

function overlap(a, b) {
  const at = titleTokens(a);
  const bt = titleTokens(b);
  const shared = [...at].filter((token) => bt.has(token));
  const union = new Set([...at, ...bt]);
  return { shared, jaccard: union.size ? shared.length / union.size : 0 };
}

function isPublisherLike(family) {
  return family === "publisher" || family === "news";
}

function isDistributionLike(family) {
  return family === "community" || family === "social";
}

function calibrateCandidate(candidate, signalMap) {
  const signals = candidate.signalIds.map((id) => signalMap.get(id)).filter(Boolean);
  const dependent = new Set();
  const dependencyRisks = [];
  for (let i = 0; i < signals.length; i += 1) {
    for (let j = i + 1; j < signals.length; j += 1) {
      const a = signals[i];
      const b = signals[j];
      const familyA = a.source?.sourceType;
      const familyB = b.source?.sourceType;
      const publisherDistributionPair = (isPublisherLike(familyA) && isDistributionLike(familyB)) || (isPublisherLike(familyB) && isDistributionLike(familyA));
      if (!publisherDistributionPair) continue;
      const match = overlap(a.topic, b.topic);
      if (match.shared.length < 4 || match.jaccard < 0.45) continue;
      const distribution = isDistributionLike(familyA) ? a : b;
      const publisher = isPublisherLike(familyA) ? a : b;
      dependent.add(distribution.id);
      dependencyRisks.push({ dependentSignalId: distribution.id, upstreamSignalId: publisher.id, reason: "Near-duplicate publisher/distribution headline; distribution evidence does not count as an independent origin." });
    }
  }
  const independentSignals = signals.filter((signal) => !dependent.has(signal.id));
  const independentSourceIds = [...new Set(independentSignals.map((signal) => signal.source?.sourceId).filter(Boolean))].sort();
  const independentSourceFamilies = [...new Set(independentSignals.map((signal) => signal.source?.sourceType).filter(Boolean))].sort();
  const status = independentSourceIds.length >= 2 && independentSourceFamilies.length >= 2 ? "corroborated" : "candidate";
  return {
    ...candidate,
    status,
    independentSourceIds,
    independentSourceFamilies,
    independentSourceDiversity: independentSourceIds.length,
    independentSourceFamilyDiversity: independentSourceFamilies.length,
    dependencyRisks,
  };
}

function coverageStatus(sourcePlan) {
  if (!sourcePlan?.coverage?.workspaceQueryExecuted || sourcePlan?.postDedupeRelevantCount <= 0) return "not-pass";
  const diversity = Number(sourcePlan?.sourceDiversity) || 0;
  const families = Number(sourcePlan?.sourceFamilyDiversity) || 0;
  const targeted = Number(sourcePlan?.successfulTargetedSources) || 0;
  if (diversity >= 4 && families >= 3 && targeted >= 2) return "pass-with-gaps";
  return "partial";
}

function buildWorkspaceIntelligence(entry, generatedAt) {
  const signalMap = new Map((entry.signals ?? []).map((signal) => [signal.id, signal]));
  const rawResolution = resolveSignals(entry.signals ?? [], generatedAt);
  const repeatedSingleSourceClusters = [];
  const candidates = [];
  for (const candidate of rawResolution.candidates ?? []) {
    if ((candidate.sourceIds ?? []).length < 2) {
      repeatedSingleSourceClusters.push({
        id: candidate.id,
        title: candidate.title,
        signalIds: candidate.signalIds,
        sourceIds: candidate.sourceIds,
        resolutionAnchors: candidate.resolutionAnchors,
        reason: "Repeated evidence from only one source remains a weak-signal cluster and is not promoted to a Workspace Trend Candidate."
      });
      continue;
    }
    const calibrated = calibrateCandidate(candidate, signalMap);
    candidates.push({ ...calibrated, workspaceId: entry.workspace.id });
  }
  candidates.sort((a, b) => {
    if (a.status !== b.status) return a.status === "corroborated" ? -1 : 1;
    if (a.independentSourceFamilyDiversity !== b.independentSourceFamilyDiversity) return b.independentSourceFamilyDiversity - a.independentSourceFamilyDiversity;
    if (a.independentSourceDiversity !== b.independentSourceDiversity) return b.independentSourceDiversity - a.independentSourceDiversity;
    return b.signalIds.length - a.signalIds.length;
  });
  const relevantSignals = entry.signals?.length ?? 0;
  const clusteredSignalIds = new Set(candidates.flatMap((candidate) => candidate.signalIds));
  const candidateCount = candidates.filter((candidate) => candidate.status === "candidate").length;
  const corroboratedCount = candidates.filter((candidate) => candidate.status === "corroborated").length;
  return {
    schemaVersion: "workspace-intelligence-report.v1",
    workspace: entry.workspace,
    generatedAt,
    sourcePlan: entry.sourcePlan,
    coverageStatus: coverageStatus(entry.sourcePlan),
    weakSignals: entry.weakSignals ?? [],
    repeatedSingleSourceClusters,
    candidates,
    candidateCount,
    corroboratedCount,
    quality: {
      relevantSignalCount: relevantSignals,
      weakSignalCount: entry.weakSignals?.length ?? 0,
      crossSourceCandidateCount: candidates.length,
      independentlyCorroboratedCount: corroboratedCount,
      clusteredSignalCount: clusteredSignalIds.size,
      clusteringRate: relevantSignals ? Math.round((clusteredSignalIds.size / relevantSignals) * 1000) / 10 : 0,
      sameSourceDuplicateCount: entry.sourcePlan?.sameSourceDuplicateCount ?? 0,
      sourceDiversity: entry.sourcePlan?.sourceDiversity ?? 0,
      sourceFamilyDiversity: entry.sourcePlan?.sourceFamilyDiversity ?? 0,
      successfulTargetedSources: entry.sourcePlan?.successfulTargetedSources ?? 0,
      targetedFailures: entry.failures?.length ?? 0,
    },
    failures: entry.failures ?? [],
    notes: [
      "Workspace report counts only signals that passed the 04E workspace relevance gate.",
      "A repeated same-source cluster is not promoted to Trend Candidate; it remains inspectable as weak-signal evidence.",
      "Cross-source Trend Candidate requires at least two distinct source IDs; corroborated additionally requires two independent source families after derivative-evidence calibration.",
      "Weak signals include relevant singletons and source-native trend surfaces so the report does not hide early evidence merely because corroboration is not yet available.",
      "Configured concept aliases bridge explicit multilingual equivalents before deterministic resolution; universal semantic translation remains outside this stage."
    ]
  };
}

async function main() {
  const snapshot = JSON.parse(await readFile(inputPath, "utf8"));
  const generatedAt = new Date().toISOString();
  const workspaces = (snapshot.workspaces ?? []).map((entry) => buildWorkspaceIntelligence(entry, generatedAt));
  if (!workspaces.length) throw new Error("04E workspace resolver received no runtime workspace snapshots.");
  const output = {
    schemaVersion: "workspace-intelligence-snapshot.v1",
    generatedAt,
    sourceSnapshotCollectedAt: snapshot.collectedAt,
    runtimeWorkspaceCount: workspaces.length,
    workspaces,
    notes: [
      "This artifact is the canonical workspace-scoped intelligence input for the user-facing report.",
      "Global 04C remains available as Global Pulse/debug evidence but must not be presented as a workspace trend count."
    ]
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`04E resolved ${workspaces.length} workspace intelligence report(s).`);
  for (const report of workspaces) {
    console.log(`- ${report.workspace.name}: ${report.quality.relevantSignalCount} relevant · ${report.quality.weakSignalCount} weak · ${report.candidateCount} candidates · ${report.corroboratedCount} corroborated · coverage ${report.coverageStatus}`);
  }
  console.log(`Output: ${path.relative(repoRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
