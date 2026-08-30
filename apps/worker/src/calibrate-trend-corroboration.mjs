import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dataDir = path.join(repoRoot, "apps/web/public/data");
const artifactPath = path.join(dataDir, "trend-candidates.json");
const inputFiles = ["backbone-signals.json", "social-signals.json", "permissionless-social-signals.json", "live-signals.json"];
const CALIBRATION_VERSION = "corroboration-dependency-04c.v1";
const stopWords = new Set(["the", "and", "for", "with", "from", "this", "that", "into", "about", "new", "more", "most", "news", "post", "posts", "today", "latest", "via", "after", "before", "over", "under"]);

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value) {
  return decodeEntities(value)
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

function flattenSignals(payload) {
  if (payload?.schemaVersion === "signal-batch.v1" && Array.isArray(payload.signals)) return payload.signals;
  if (Array.isArray(payload?.batches)) return payload.batches.flatMap((batch) => Array.isArray(batch?.signals) ? batch.signals : []);
  return [];
}

async function loadSignalMap() {
  const map = new Map();
  for (const file of inputFiles) {
    const payload = JSON.parse(await readFile(path.join(dataDir, file), "utf8"));
    for (const signal of flattenSignals(payload)) map.set(signal.id, signal);
  }
  return map;
}

function isPublisherLike(family) {
  return family === "publisher" || family === "news";
}

function isDistributionLike(family) {
  return family === "community" || family === "social";
}

function calibrateCandidate(candidate, signalMap) {
  const signals = candidate.signalIds.map((id) => signalMap.get(id)).filter(Boolean);
  const dependentSignalIds = new Set();
  const dependencyRisks = [];

  for (let i = 0; i < signals.length; i += 1) {
    for (let j = i + 1; j < signals.length; j += 1) {
      const a = signals[i];
      const b = signals[j];
      const familyA = a.source?.sourceType;
      const familyB = b.source?.sourceType;
      const publisherDistributionPair =
        (isPublisherLike(familyA) && isDistributionLike(familyB)) ||
        (isPublisherLike(familyB) && isDistributionLike(familyA));
      if (!publisherDistributionPair) continue;
      const match = overlap(a.topic, b.topic);
      if (match.shared.length < 4 || match.jaccard < 0.45) continue;
      const distributionSignal = isDistributionLike(familyA) ? a : b;
      const publisherSignal = isPublisherLike(familyA) ? a : b;
      dependentSignalIds.add(distributionSignal.id);
      dependencyRisks.push({
        dependentSignalId: distributionSignal.id,
        upstreamSignalId: publisherSignal.id,
        reason: `Near-duplicate publisher ↔ distribution headline (${match.shared.slice(0, 8).join(", ")}); treated as possible repost/syndication rather than independent corroboration.`,
      });
    }
  }

  const independentSignals = signals.filter((signal) => !dependentSignalIds.has(signal.id));
  const independentSourceIds = [...new Set(independentSignals.map((signal) => signal.source?.sourceId).filter(Boolean))].sort();
  const independentSourceFamilies = [...new Set(independentSignals.map((signal) => signal.source?.sourceType).filter(Boolean))].sort();
  const status = independentSourceIds.length >= 2 && independentSourceFamilies.length >= 2 ? "corroborated" : "candidate";
  const changed = status !== candidate.status;

  return {
    ...candidate,
    title: decodeEntities(candidate.title),
    status,
    independentSourceIds,
    independentSourceFamilies,
    independentSourceDiversity: independentSourceIds.length,
    independentSourceFamilyDiversity: independentSourceFamilies.length,
    dependencyRisks,
    summary: `${status === "corroborated" ? "Independent cross-source corroboration" : "Repeated source evidence"}: ${candidate.signalIds.length} observations across ${candidate.sourceIds.length} raw source${candidate.sourceIds.length === 1 ? "" : "s"}; ${independentSourceIds.length} source${independentSourceIds.length === 1 ? "" : "s"} remain independent after derivative-evidence calibration. Shared resolution anchors: ${(candidate.resolutionAnchors ?? []).slice(0, 5).join(", ")}.`,
    corroborationRationale: [
      ...(candidate.corroborationRationale ?? []).filter((line) => !/gate passed|gate not yet passed/i.test(line)),
      `${independentSourceIds.length} independent source IDs and ${independentSourceFamilies.length} independent source families remain after derivative-evidence calibration.`,
      ...(dependencyRisks.length ? dependencyRisks.map((risk) => risk.reason) : ["No near-duplicate publisher/distribution dependency was detected by the 04C calibration rule."]),
      status === "corroborated" ? "Independent source-family corroboration gate passed after dependency calibration." : "Independent source-family corroboration gate not yet passed after dependency calibration.",
    ],
    confidence: {
      ...candidate.confidence,
      rationale: [
        ...(candidate.confidence?.rationale ?? []).filter((line) => !/^Corroborated only because|^Candidate has repeated matching evidence/i.test(line)),
        status === "corroborated"
          ? "Corroboration remains after near-duplicate publisher/distribution evidence is discounted."
          : "Candidate does not have two independent source families after near-duplicate publisher/distribution evidence is discounted.",
      ],
    },
    calibrationChange: changed ? `${candidate.status} → ${status}` : "none",
  };
}

async function main() {
  const snapshot = JSON.parse(await readFile(artifactPath, "utf8"));
  const signalMap = await loadSignalMap();
  const candidates = snapshot.candidates.map((candidate) => calibrateCandidate(candidate, signalMap));
  candidates.sort((a, b) => {
    if (a.status !== b.status) return a.status === "corroborated" ? -1 : 1;
    if (a.independentSourceFamilyDiversity !== b.independentSourceFamilyDiversity) return b.independentSourceFamilyDiversity - a.independentSourceFamilyDiversity;
    if (a.independentSourceDiversity !== b.independentSourceDiversity) return b.independentSourceDiversity - a.independentSourceDiversity;
    return b.signalIds.length - a.signalIds.length;
  });
  const calibrated = {
    ...snapshot,
    dependencyCalibrationVersion: CALIBRATION_VERSION,
    candidateCount: candidates.filter((candidate) => candidate.status === "candidate").length,
    corroboratedCount: candidates.filter((candidate) => candidate.status === "corroborated").length,
    candidates,
    notes: [
      ...snapshot.notes,
      "04C dependency calibration discounts near-duplicate publisher headlines redistributed through community/social surfaces from independent corroboration counts.",
      "A distribution/community repost may remain useful attention evidence, but it is not treated as a second independent origin of the claim/narrative.",
    ],
  };
  await writeFile(artifactPath, `${JSON.stringify(calibrated, null, 2)}\n`, "utf8");
  const demoted = candidates.filter((candidate) => candidate.calibrationChange === "corroborated → candidate").length;
  console.log(`Trend corroboration calibration complete · ${calibrated.corroboratedCount} corroborated · ${calibrated.candidateCount} candidates · ${demoted} dependency demotion(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
