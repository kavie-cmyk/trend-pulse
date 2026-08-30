import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const currentSnapshotPath = path.join(repoRoot, "apps/web/public/data/trend-candidates.json");
const cycleOutputPath = path.join(repoRoot, "apps/web/public/data/trend-history.json");
const nextStoreRoot = path.join(repoRoot, ".trend-history-next");
const defaultPreviousStatePath = path.join(repoRoot, ".trend-history-store/history/production-state.json");
const HISTORY_METHODOLOGY_VERSION = "trend-history-04d.v1";
const MATCH_METHODOLOGY_VERSION = "trend-lineage-match-04d.v1";
const MATCH_THRESHOLD = 0.38;

const stopWords = new Set([
  "the", "and", "for", "with", "from", "this", "that", "into", "about", "after", "before", "over", "under", "new", "latest", "news", "update", "trend", "trending",
  "va", "và", "cua", "của", "cho", "voi", "với", "trong", "tren", "trên", "mot", "một", "khong", "không", "la", "là", "co", "có", "tu", "từ", "den", "đến",
]);

function cleanText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-zA-Z0-9#]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value) {
  return cleanText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleTokens(value) {
  return [...new Set(normalize(value).split(" ").filter((token) => token && token.length >= 3 && !stopWords.has(token)))];
}

function normalizedAnchors(values) {
  return [...new Set((values ?? []).map(normalize).filter(Boolean))];
}

function intersection(a, b) {
  const right = new Set(b);
  return [...new Set(a)].filter((value) => right.has(value));
}

function difference(a, b) {
  const right = new Set(b);
  return [...new Set(a)].filter((value) => !right.has(value)).sort();
}

function jaccard(a, b) {
  const left = new Set(a);
  const right = new Set(b);
  const union = new Set([...left, ...right]);
  if (!union.size) return 0;
  return [...left].filter((value) => right.has(value)).length / union.size;
}

function stableId(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 18);
}

function emptyState() {
  return {
    schemaVersion: "trend-history-state.v1",
    updatedAt: null,
    latestCycleId: null,
    latestSnapshotGeneratedAt: null,
    cyclesRecorded: 0,
    lineages: [],
  };
}

function assertCurrentSnapshot(snapshot) {
  if (snapshot?.schemaVersion !== "trend-resolution-snapshot.v1") throw new Error("Expected trend-resolution-snapshot.v1 as 04D input.");
  if (snapshot?.dependencyCalibrationVersion !== "corroboration-dependency-04c.v1") throw new Error("04D requires the calibrated 04C artifact before lineage comparison.");
  if (!Array.isArray(snapshot.candidates)) throw new Error("04D input has no candidates array.");
  for (const candidate of snapshot.candidates) {
    if (!Array.isArray(candidate.independentSourceIds) || !Array.isArray(candidate.independentSourceFamilies)) {
      throw new Error(`Candidate ${candidate.id ?? "unknown"} is missing independent-source calibration fields.`);
    }
  }
}

function assertPreviousState(state) {
  if (state?.schemaVersion !== "trend-history-state.v1" || !Array.isArray(state.lineages)) {
    throw new Error("Previous trend history state is malformed; refusing to reset persistent lineage state silently.");
  }
}

function candidateVsLineage(candidate, lineage) {
  const candidateAnchors = normalizedAnchors(candidate.resolutionAnchors);
  const lineageAnchors = normalizedAnchors(lineage.latestResolutionAnchors);
  const anchorOverlap = intersection(candidateAnchors, lineageAnchors);
  const currentTitleTokens = titleTokens(candidate.title);
  const previousTitleTokens = titleTokens(lineage.latestTitle);
  const titleTokenOverlap = intersection(currentTitleTokens, previousTitleTokens);
  const anchorSimilarity = jaccard(candidateAnchors, lineageAnchors);
  const titleSimilarity = jaccard(currentTitleTokens, previousTitleTokens);
  const similarity = Number((anchorSimilarity * 0.76 + titleSimilarity * 0.24).toFixed(4));
  const threshold = lineage.missedCycles > 4 ? 0.46 : MATCH_THRESHOLD;
  const eligible = anchorOverlap.length >= 1 && similarity >= threshold;
  return {
    eligible,
    similarity,
    evidence: {
      methodologyVersion: MATCH_METHODOLOGY_VERSION,
      anchorOverlap,
      titleTokenOverlap,
      similarity,
      threshold,
    },
  };
}

function assignLineages(candidates, lineages) {
  const possible = [];
  candidates.forEach((candidate, candidateIndex) => {
    lineages.forEach((lineage, lineageIndex) => {
      const match = candidateVsLineage(candidate, lineage);
      if (match.eligible) possible.push({ candidateIndex, lineageIndex, ...match });
    });
  });
  possible.sort((a, b) => b.similarity - a.similarity);
  const candidateAssignments = new Map();
  const usedLineages = new Set();
  for (const match of possible) {
    if (candidateAssignments.has(match.candidateIndex) || usedLineages.has(match.lineageIndex)) continue;
    candidateAssignments.set(match.candidateIndex, match);
    usedLineages.add(match.lineageIndex);
  }
  return candidateAssignments;
}

function evidenceDirection(previous, candidate) {
  if (!previous) return "not-comparable";
  const deltas = [
    candidate.independentSourceFamilies.length - previous.latestIndependentSourceFamilies.length,
    candidate.independentSourceIds.length - previous.latestIndependentSourceIds.length,
    candidate.signalIds.length - previous.latestSignalCount,
  ];
  const hasPositive = deltas.some((value) => value > 0);
  const hasNegative = deltas.some((value) => value < 0);
  if (hasPositive && hasNegative) return "mixed";
  if (hasPositive) return "expanding";
  if (hasNegative) return "contracting";
  return "stable";
}

function comparisonWindow(previousSnapshotGeneratedAt, currentSnapshotGeneratedAt) {
  if (!previousSnapshotGeneratedAt) return { cycleGapHours: null, comparisonWindow: "bootstrap" };
  const previous = new Date(previousSnapshotGeneratedAt).getTime();
  const current = new Date(currentSnapshotGeneratedAt).getTime();
  if (!Number.isFinite(previous) || !Number.isFinite(current) || current <= previous) {
    return { cycleGapHours: null, comparisonWindow: "stale-gap" };
  }
  const cycleGapHours = Number(((current - previous) / 3_600_000).toFixed(2));
  if (cycleGapHours < 6) return { cycleGapHours, comparisonWindow: "too-close-for-cadence" };
  if (cycleGapHours <= 18) return { cycleGapHours, comparisonWindow: "comparable" };
  return { cycleGapHours, comparisonWindow: "stale-gap" };
}

function lineageFromCandidate(candidate, lineageId, seenAt) {
  return {
    lineageId,
    firstSeenAt: seenAt,
    lastSeenAt: seenAt,
    seenCycles: 1,
    missedCycles: 0,
    latestCandidateId: candidate.id,
    latestTitle: cleanText(candidate.title),
    latestResolutionAnchors: [...candidate.resolutionAnchors],
    latestSignalCount: candidate.signalIds.length,
    latestSourceIds: [...candidate.sourceIds],
    latestSourceFamilies: [...candidate.sourceFamilies],
    latestIndependentSourceIds: [...candidate.independentSourceIds],
    latestIndependentSourceFamilies: [...candidate.independentSourceFamilies],
    latestStatus: candidate.status,
  };
}

function updateLineage(previous, candidate, seenAt) {
  return {
    ...lineageFromCandidate(candidate, previous.lineageId, seenAt),
    firstSeenAt: previous.firstSeenAt,
    seenCycles: previous.seenCycles + 1,
  };
}

function deltaRecord(candidate, previous, lineageId, matchEvidence) {
  const presence = previous ? (previous.missedCycles > 0 ? "reappeared" : "continuing") : "new";
  return {
    lineageId,
    candidateId: candidate.id,
    title: cleanText(candidate.title),
    presence,
    evidenceDirection: evidenceDirection(previous, candidate),
    ...(previous ? { previousCandidateId: previous.latestCandidateId } : {}),
    ...(previous ? { signalCountDelta: candidate.signalIds.length - previous.latestSignalCount } : {}),
    ...(previous ? { independentSourceDelta: candidate.independentSourceIds.length - previous.latestIndependentSourceIds.length } : {}),
    ...(previous ? { independentSourceFamilyDelta: candidate.independentSourceFamilies.length - previous.latestIndependentSourceFamilies.length } : {}),
    sourceIdsAdded: previous ? difference(candidate.sourceIds, previous.latestSourceIds) : [...candidate.sourceIds].sort(),
    sourceIdsRemoved: previous ? difference(previous.latestSourceIds, candidate.sourceIds) : [],
    independentSourceIdsAdded: previous ? difference(candidate.independentSourceIds, previous.latestIndependentSourceIds) : [...candidate.independentSourceIds].sort(),
    independentSourceIdsRemoved: previous ? difference(previous.latestIndependentSourceIds, candidate.independentSourceIds) : [],
    independentSourceFamiliesAdded: previous ? difference(candidate.independentSourceFamilies, previous.latestIndependentSourceFamilies) : [...candidate.independentSourceFamilies].sort(),
    independentSourceFamiliesRemoved: previous ? difference(previous.latestIndependentSourceFamilies, candidate.independentSourceFamilies) : [],
    ...(matchEvidence ? { matchEvidence } : {}),
  };
}

export function buildTrendHistoryCycle(currentSnapshot, previousState, generatedAt = new Date().toISOString(), cycleIdOverride, options = {}) {
  assertCurrentSnapshot(currentSnapshot);
  assertPreviousState(previousState);
  const cyclePurpose = options.cyclePurpose === "scheduled" ? "scheduled" : "qa";
  const persistenceEligible = cyclePurpose === "scheduled" && options.persistenceEligible === true;
  const cycleId = cycleIdOverride ?? `cycle-${generatedAt.replace(/[:.]/g, "-")}`;
  const assignments = assignLineages(currentSnapshot.candidates, previousState.lineages);
  const matchedLineageIndexes = new Set();
  const nextLineages = previousState.lineages.map((lineage) => ({ ...lineage, missedCycles: lineage.missedCycles + 1 }));
  const current = [];

  currentSnapshot.candidates.forEach((candidate, candidateIndex) => {
    const assignment = assignments.get(candidateIndex);
    if (assignment) {
      const previous = previousState.lineages[assignment.lineageIndex];
      matchedLineageIndexes.add(assignment.lineageIndex);
      nextLineages[assignment.lineageIndex] = updateLineage(previous, candidate, currentSnapshot.generatedAt);
      current.push(deltaRecord(candidate, previous, previous.lineageId, assignment.evidence));
      return;
    }
    const lineageId = `lineage-${stableId(`${candidate.id}|${currentSnapshot.generatedAt}`)}`;
    nextLineages.push(lineageFromCandidate(candidate, lineageId, currentSnapshot.generatedAt));
    current.push(deltaRecord(candidate, null, lineageId));
  });

  const disappeared = previousState.lineages
    .map((lineage, index) => ({ lineage, index }))
    .filter(({ lineage, index }) => lineage.missedCycles === 0 && !matchedLineageIndexes.has(index))
    .map(({ lineage }) => ({
      lineageId: lineage.lineageId,
      title: lineage.latestTitle,
      previousCandidateId: lineage.latestCandidateId,
      missedCycles: lineage.missedCycles + 1,
      lastSeenAt: lineage.lastSeenAt,
    }));

  const window = comparisonWindow(previousState.latestSnapshotGeneratedAt, currentSnapshot.generatedAt);
  const nextState = {
    schemaVersion: "trend-history-state.v1",
    updatedAt: generatedAt,
    latestCycleId: cycleId,
    latestSnapshotGeneratedAt: currentSnapshot.generatedAt,
    cyclesRecorded: previousState.cyclesRecorded + 1,
    lineages: nextLineages,
  };
  const cycle = {
    schemaVersion: "trend-history-cycle.v1",
    methodologyVersion: HISTORY_METHODOLOGY_VERSION,
    generatedAt,
    cycleId,
    cyclePurpose,
    persistenceEligible,
    baselineStatePath: "history/production-state.json",
    currentTrendSnapshotGeneratedAt: currentSnapshot.generatedAt,
    previousCycleId: previousState.latestCycleId,
    previousSnapshotGeneratedAt: previousState.latestSnapshotGeneratedAt,
    cycleGapHours: window.cycleGapHours,
    comparisonWindow: window.comparisonWindow,
    persistenceMode: "github-history-branch",
    historyBranch: "trend-history",
    currentCandidateCount: currentSnapshot.candidates.length,
    currentCorroboratedCount: currentSnapshot.corroboratedCount,
    trackedLineageCount: nextLineages.length,
    current,
    disappeared,
    notes: [
      "04D tracks candidate lineage across collection cycles; snapshot candidate IDs are not treated as permanent lineage IDs.",
      "Canonical twice-daily history uses history/production-state.json and is advanced only by scheduled workflow runs.",
      cyclePurpose === "scheduled"
        ? "This is a scheduled cycle and is eligible to advance the canonical production baseline after all verification/build gates pass."
        : "This is a QA cycle from a push/manual run; it may be inspected in the artifact but must not overwrite the canonical scheduled baseline.",
      "Evidence direction reflects structural evidence-count/source-family change only. It is not Virality, velocity, acceleration or lifecycle movement.",
      "A comparison window shorter than six hours is marked too-close-for-cadence and must not be interpreted as the twice-daily production interval.",
      "Source-native metrics remain excluded from cross-platform trend momentum in 04D.",
    ],
  };
  return { cycle, nextState };
}

async function loadPreviousState() {
  const previousStatePath = process.env.TREND_HISTORY_STATE_PATH || defaultPreviousStatePath;
  try {
    const state = JSON.parse(await readFile(previousStatePath, "utf8"));
    assertPreviousState(state);
    return state;
  } catch (error) {
    if (error?.code === "ENOENT") return emptyState();
    throw error;
  }
}

async function main() {
  const currentSnapshot = JSON.parse(await readFile(currentSnapshotPath, "utf8"));
  const previousState = await loadPreviousState();
  const generatedAt = new Date().toISOString();
  const runId = process.env.GITHUB_RUN_ID;
  const runAttempt = process.env.GITHUB_RUN_ATTEMPT;
  const cycleId = runId ? `gh-${runId}-a${runAttempt || "1"}` : `local-${generatedAt.replace(/[:.]/g, "-")}`;
  const cyclePurpose = process.env.TREND_HISTORY_CYCLE_PURPOSE === "scheduled" ? "scheduled" : "qa";
  const persistenceEligible = process.env.TREND_HISTORY_PERSISTENCE_ELIGIBLE === "true";
  const { cycle, nextState } = buildTrendHistoryCycle(currentSnapshot, previousState, generatedAt, cycleId, { cyclePurpose, persistenceEligible });

  await mkdir(path.dirname(cycleOutputPath), { recursive: true });
  await writeFile(cycleOutputPath, `${JSON.stringify(cycle, null, 2)}\n`, "utf8");
  await mkdir(path.join(nextStoreRoot, "cycles"), { recursive: true });
  await mkdir(path.join(nextStoreRoot, "snapshots"), { recursive: true });
  await writeFile(path.join(nextStoreRoot, "state.json"), `${JSON.stringify(nextState, null, 2)}\n`, "utf8");
  await writeFile(path.join(nextStoreRoot, "latest.json"), `${JSON.stringify(cycle, null, 2)}\n`, "utf8");
  await writeFile(path.join(nextStoreRoot, "cycles", `${cycle.cycleId}.json`), `${JSON.stringify(cycle, null, 2)}\n`, "utf8");
  await writeFile(path.join(nextStoreRoot, "snapshots", `${cycle.cycleId}.json`), `${JSON.stringify(currentSnapshot, null, 2)}\n`, "utf8");

  const counts = cycle.current.reduce((acc, item) => {
    acc[item.presence] = (acc[item.presence] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Trend history cycle ${cycle.cycleId} built from ${cycle.currentCandidateCount} current candidates.`);
  console.log(`- purpose: ${cycle.cyclePurpose}; persistence eligible: ${cycle.persistenceEligible}`);
  console.log(`- baseline: ${cycle.baselineStatePath}`);
  console.log(`- previous cycle: ${cycle.previousCycleId ?? "none"}`);
  console.log(`- comparison window: ${cycle.comparisonWindow}${cycle.cycleGapHours == null ? "" : ` (${cycle.cycleGapHours}h)`}`);
  console.log(`- new: ${counts.new ?? 0}`);
  console.log(`- continuing: ${counts.continuing ?? 0}`);
  console.log(`- reappeared: ${counts.reappeared ?? 0}`);
  console.log(`- newly disappeared: ${cycle.disappeared.length}`);
  console.log(`- tracked lineages: ${cycle.trackedLineageCount}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
  });
}
