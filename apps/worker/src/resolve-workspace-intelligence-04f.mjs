import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSignals } from "./resolve-trends.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dataDir = path.join(repoRoot, "apps/web/public/data");
const inputPath = path.join(dataDir, "workspace-signals-04f.json");
const outputPath = path.join(dataDir, "workspace-intelligence.json");
const METHODOLOGY_VERSION = "workspace-resolution-04f.v1";

const stopWords = new Set([
  "the", "and", "for", "with", "from", "this", "that", "into", "about", "your", "are", "was", "were", "will", "has", "have", "new", "more", "most", "news", "post", "posts", "today", "latest", "after", "before", "over", "under", "official", "best", "top", "free",
  "va", "và", "cua", "của", "cho", "voi", "với", "trong", "tren", "trên", "mot", "một", "khong", "không", "la", "là", "co", "có", "duoc", "được", "tu", "từ", "den", "đến", "moi", "mới", "dang", "đang"
]);
const genericSubjectTokens = new Set(["game", "games", "gaming", "mobile", "app", "apps", "vietnam", "viet", "nam", "player", "players", "android", "ios", "store"]);
const semanticGroups = [
  { id: "publishing", aliases: ["publishing", "publisher", "publish", "phat hanh", "phát hành"] },
  { id: "launch", aliases: ["launch", "launched", "release", "released", "soft launch", "ra mat", "ra mắt"] },
  { id: "mobile", aliases: ["mobile", "di dong", "di động"] },
  { id: "esports", aliases: ["esports", "e sports", "the thao dien tu", "thể thao điện tử"] },
  { id: "artificial-intelligence", aliases: ["artificial intelligence", "ai", "tri tue nhan tao", "trí tuệ nhân tạo"] },
  { id: "app-store", aliases: ["app store", "apple app store", "google play", "play store"] },
  { id: "creator", aliases: ["creator", "influencer", "streamer", "content creator"] },
];

function stableId(value) {
  return createHash("sha1").update(String(value)).digest("hex").slice(0, 18);
}

function clean(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/&[a-zA-Z0-9#]+;/g, " ").replace(/\s+/g, " ").trim();
}

function norm(value) {
  return clean(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#.-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return norm(value).split(" ").map((token) => token.replace(/^[#.+-]+|[#.+-]+$/g, "")).filter((token) => token && token.length >= 3 && !stopWords.has(token));
}

function distinct(values) {
  return [...new Set(values.filter(Boolean))];
}

function signalText(signal) {
  return [signal.topic, ...(signal.entities ?? []), ...(signal.hashtags ?? []), ...(signal.keywords ?? []), signal.creator, signal.community].filter(Boolean).join(" ");
}

function entityAnchors(signal) {
  return distinct((signal.entities ?? []).map(norm).filter((value) => value.length >= 3 && !genericSubjectTokens.has(value)));
}

function hashtagAnchors(signal) {
  return distinct((signal.hashtags ?? []).map(norm).filter((value) => value.length >= 3 && !genericSubjectTokens.has(value)));
}

function distinctiveTokens(signal) {
  return distinct(tokens(signalText(signal)).filter((token) => !genericSubjectTokens.has(token)));
}

function bigramAnchors(signal) {
  const values = tokens(signal.topic).filter((token) => !genericSubjectTokens.has(token));
  const result = [];
  for (let index = 0; index < values.length - 1; index += 1) {
    const pair = `${values[index]} ${values[index + 1]}`;
    if (pair.length >= 7) result.push(pair);
  }
  return distinct(result);
}

function semanticAnchors(signal) {
  const value = norm(signalText(signal));
  return semanticGroups.filter((group) => group.aliases.some((alias) => value.includes(norm(alias)))).map((group) => group.id);
}

function pairBridgeEvidence(a, b) {
  if (a.source?.sourceId === b.source?.sourceId) return { match: false, subjectAnchors: [], semanticAnchors: [], sharedTokens: [], reason: "same-source" };
  const textA = norm(signalText(a));
  const textB = norm(signalText(b));
  const entityA = entityAnchors(a);
  const entityB = entityAnchors(b);
  const hashtagA = hashtagAnchors(a);
  const hashtagB = hashtagAnchors(b);
  const bigramA = bigramAnchors(a);
  const bigramB = bigramAnchors(b);
  const tokenA = distinctiveTokens(a);
  const tokenB = new Set(distinctiveTokens(b));
  const sharedTokens = tokenA.filter((token) => tokenB.has(token));

  const entityCross = distinct([
    ...entityA.filter((anchor) => textB.includes(anchor)),
    ...entityB.filter((anchor) => textA.includes(anchor)),
  ]);
  const sharedHashtags = hashtagA.filter((anchor) => hashtagB.includes(anchor));
  const sharedBigrams = bigramA.filter((anchor) => bigramB.includes(anchor));
  const subjectAnchors = distinct([...entityCross, ...sharedHashtags, ...sharedBigrams]);
  const semanticA = semanticAnchors(a);
  const semanticB = new Set(semanticAnchors(b));
  const sharedSemantic = semanticA.filter((anchor) => semanticB.has(anchor));

  const strongEntity = entityCross.some((anchor) => anchor.includes(" ") || anchor.length >= 6);
  const strongBigram = sharedBigrams.length > 0 && sharedTokens.length >= 2;
  const strongHashtag = sharedHashtags.length > 0 && sharedTokens.length >= 1;
  const semanticSupportedSubject = subjectAnchors.length > 0 && sharedSemantic.length > 0 && (sharedTokens.length >= 1 || strongEntity);
  const lexicalSupportedSubject = strongEntity && sharedTokens.length >= 1;
  const match = strongBigram || strongHashtag || semanticSupportedSubject || lexicalSupportedSubject;

  return {
    match,
    subjectAnchors: subjectAnchors.slice(0, 8),
    semanticAnchors: sharedSemantic.slice(0, 6),
    sharedTokens: sharedTokens.slice(0, 8),
    reason: match
      ? "Cross-source bridge requires a distinctive subject anchor; semantic aliases only support an already anchored subject and never create a cluster by themselves."
      : "No sufficiently distinctive cross-source subject bridge.",
  };
}

function graphComponents(signalIds, edges) {
  const parent = new Map(signalIds.map((id) => [id, id]));
  const find = (id) => {
    let current = id;
    while (parent.get(current) !== current) {
      const next = parent.get(current);
      parent.set(current, parent.get(next));
      current = next;
    }
    return current;
  };
  const unite = (a, b) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  };
  edges.forEach((edge) => unite(edge.a, edge.b));
  const groups = new Map();
  signalIds.forEach((id) => {
    const root = find(id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(id);
  });
  return [...groups.values()].filter((group) => group.length >= 2);
}

function isPublisherLike(family) {
  return family === "publisher" || family === "news";
}

function isDistributionLike(family) {
  return family === "community" || family === "social";
}

function tokenOverlap(a, b) {
  const at = new Set(tokens(a));
  const bt = new Set(tokens(b));
  const shared = [...at].filter((token) => bt.has(token));
  const union = new Set([...at, ...bt]);
  return { shared, jaccard: union.size ? shared.length / union.size : 0 };
}

function calibrateIndependence(signals) {
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
      const match = tokenOverlap(a.topic, b.topic);
      if (match.shared.length < 4 || match.jaccard < 0.45) continue;
      const distribution = isDistributionLike(familyA) ? a : b;
      const publisher = isPublisherLike(familyA) ? a : b;
      dependent.add(distribution.id);
      dependencyRisks.push({ dependentSignalId: distribution.id, upstreamSignalId: publisher.id, reason: "Near-duplicate publisher/distribution headline; distribution evidence does not count as an independent origin." });
    }
  }
  const independentSignals = signals.filter((signal) => !dependent.has(signal.id));
  const independentSourceIds = distinct(independentSignals.map((signal) => signal.source?.sourceId)).sort();
  const independentSourceFamilies = distinct(independentSignals.map((signal) => signal.source?.sourceType)).sort();
  return {
    independentSourceIds,
    independentSourceFamilies,
    independentSourceDiversity: independentSourceIds.length,
    independentSourceFamilyDiversity: independentSourceFamilies.length,
    dependencyRisks,
    status: independentSourceIds.length >= 2 && independentSourceFamilies.length >= 2 ? "corroborated" : "candidate",
  };
}

function chooseTitle(signals) {
  return [...signals]
    .sort((a, b) => {
      const sourcePriority = (signal) => signal.source?.sourceType === "store" ? 3 : signal.source?.sourceType === "publisher" ? 2 : 1;
      return sourcePriority(b) - sourcePriority(a) || (b.workspaceRelevance?.score ?? 0) - (a.workspaceRelevance?.score ?? 0) || clean(a.topic).length - clean(b.topic).length;
    })[0]?.topic ?? "Workspace Trend Candidate";
}

function componentCandidate(componentIds, signalMap, rawCandidates, bridgeEdges, generatedAt, workspaceId) {
  const signals = componentIds.map((id) => signalMap.get(id)).filter(Boolean);
  const sourceIds = distinct(signals.map((signal) => signal.source?.sourceId)).sort();
  if (sourceIds.length < 2) return null;
  const sourceFamilies = distinct(signals.map((signal) => signal.source?.sourceType)).sort();
  const baselineCandidates = rawCandidates.filter((candidate) => candidate.signalIds?.some((id) => componentIds.includes(id)));
  const relevantBridges = bridgeEdges.filter((edge) => componentIds.includes(edge.a) && componentIds.includes(edge.b));
  const subjectAnchors = distinct(relevantBridges.flatMap((edge) => edge.evidence.subjectAnchors));
  const semantic = distinct(relevantBridges.flatMap((edge) => edge.evidence.semanticAnchors));
  const baselineAnchors = distinct(baselineCandidates.flatMap((candidate) => candidate.resolutionAnchors ?? []));
  const resolutionAnchors = distinct([...baselineAnchors, ...subjectAnchors, ...semantic]);
  const evidenceRefs = distinct(signals.map((signal) => signal.evidence?.sourceUrl));
  const calibration = calibrateIndependence(signals);
  const dates = signals.map((signal) => new Date(signal.publishedAt || signal.observedAt || generatedAt).getTime()).filter(Number.isFinite);
  const firstSeenAt = dates.length ? new Date(Math.min(...dates)).toISOString() : generatedAt;
  const lastSeenAt = dates.length ? new Date(Math.max(...dates)).toISOString() : generatedAt;
  const modes = distinct([
    ...(baselineCandidates.length ? ["baseline-04c"] : []),
    ...(relevantBridges.length ? ["bounded-subject-bridge"] : []),
  ]);
  const id = `workspace-trend-04f-${stableId(`${workspaceId}:${[...componentIds].sort().join("|")}`)}`;
  return {
    schemaVersion: "trend-candidate.v1",
    id,
    workspaceId,
    title: clean(chooseTitle(signals)),
    summary: `${signals.length} Workspace observations from ${sourceIds.length} distinct source IDs across ${sourceFamilies.length} source families share inspectable narrative-resolution evidence.`,
    trendType: sourceFamilies.includes("store") ? "product-trend" : "narrative",
    lifecycleStage: "weak-signal",
    status: calibration.status,
    signalIds: componentIds,
    sourceIds,
    sourceFamilies,
    independentSourceIds: calibration.independentSourceIds,
    independentSourceFamilies: calibration.independentSourceFamilies,
    independentSourceDiversity: calibration.independentSourceDiversity,
    independentSourceFamilyDiversity: calibration.independentSourceFamilyDiversity,
    dependencyRisks: calibration.dependencyRisks,
    geographies: distinct(signals.map((signal) => signal.geography)),
    languages: distinct(signals.map((signal) => signal.language)),
    firstSeenAt,
    lastSeenAt,
    evidenceRefs,
    resolutionAnchors,
    resolutionTrace04f: {
      methodologyVersion: METHODOLOGY_VERSION,
      modes,
      subjectAnchors,
      semanticAnchors: semantic,
      baselineResolutionAnchors: baselineAnchors,
      bridgeCount: relevantBridges.length,
      rationale: [
        "Baseline 04C deterministic edges remain valid and inspectable.",
        "04F bounded semantic aliases cannot create an edge alone; every added cross-source edge requires a distinctive subject anchor from returned evidence.",
        "Workspace-scope concepts such as mobile-gaming are relevance evidence only and are not used as narrative subject anchors.",
      ],
    },
    confidence: {
      status: "provisional",
      scaleMax: 10,
      methodologyVersion: "trend-confidence-04f.v1",
      factors: [
        { key: "distinct-sources", label: "Distinct sources", status: "available", note: `${sourceIds.length} distinct source IDs` },
        { key: "independent-source-family-diversity", label: "Independent source-family diversity", status: "available", note: `${calibration.independentSourceFamilyDiversity} independent source families` },
        { key: "resolution-trace", label: "Resolution trace", status: resolutionAnchors.length ? "available" : "missing", note: resolutionAnchors.length ? resolutionAnchors.slice(0, 6).join(", ") : "No inspectable resolution anchors" },
      ],
      rationale: [
        "No numeric Confidence score is emitted because 04F does not calibrate cross-source numeric confidence.",
        calibration.status === "corroborated" ? "Corroborated requires at least two independent source IDs across at least two independent source families." : "Candidate remains uncorroborated after dependency calibration.",
      ],
      evidenceRefs,
      computedAt: generatedAt,
    },
  };
}

function coverageStatus(sourcePlan) {
  const classes = sourcePlan?.coverageClasses ?? [];
  if (!classes.length) return "partial";
  const operational = classes.filter((item) => String(item.runtimeStatus).startsWith("operational-")).length;
  const diversity = Number(sourcePlan?.sourceDiversity) || 0;
  const families = Number(sourcePlan?.sourceFamilyDiversity) || 0;
  if (operational >= 4 && diversity >= 4 && families >= 3) return "pass-with-gaps";
  if (operational >= 3 && diversity >= 3 && families >= 2) return "partial";
  return "not-pass";
}

function buildReport(entry, generatedAt) {
  const signals = entry.signals ?? [];
  const signalMap = new Map(signals.map((signal) => [signal.id, signal]));
  const rawResolution = resolveSignals(signals, generatedAt);
  const rawCandidates = rawResolution.candidates ?? [];
  const edges = [];

  for (const candidate of rawCandidates) {
    const ids = candidate.signalIds ?? [];
    for (let index = 0; index < ids.length - 1; index += 1) {
      edges.push({ a: ids[index], b: ids[index + 1], mode: "baseline-04c", evidence: { subjectAnchors: [], semanticAnchors: [], sharedTokens: [], reason: "Baseline 04C component edge." } });
    }
  }

  const bridgeEdges = [];
  for (let a = 0; a < signals.length; a += 1) {
    for (let b = a + 1; b < signals.length; b += 1) {
      const left = signals[a];
      const right = signals[b];
      const evidence = pairBridgeEvidence(left, right);
      if (!evidence.match) continue;
      const edge = { a: left.id, b: right.id, mode: "bounded-subject-bridge", evidence };
      bridgeEdges.push(edge);
      edges.push(edge);
    }
  }

  const components = graphComponents(signals.map((signal) => signal.id), edges);
  const repeatedSingleSourceClusters = [];
  const candidates = [];
  for (const componentIds of components) {
    const sourceIds = distinct(componentIds.map((id) => signalMap.get(id)?.source?.sourceId));
    if (sourceIds.length < 2) {
      const baseline = rawCandidates.find((candidate) => candidate.signalIds?.some((id) => componentIds.includes(id)));
      repeatedSingleSourceClusters.push({
        id: baseline?.id ?? `workspace-single-source-04f-${stableId(componentIds.sort().join("|"))}`,
        title: baseline?.title ?? chooseTitle(componentIds.map((id) => signalMap.get(id)).filter(Boolean)),
        signalIds: componentIds,
        sourceIds,
        resolutionAnchors: baseline?.resolutionAnchors ?? [],
        reason: "Repeated evidence from only one source remains a weak-signal cluster and is not promoted to a Workspace Trend Candidate.",
      });
      continue;
    }
    const candidate = componentCandidate(componentIds, signalMap, rawCandidates, bridgeEdges, generatedAt, entry.workspace.id);
    if (candidate) candidates.push(candidate);
  }

  candidates.sort((a, b) => {
    if (a.status !== b.status) return a.status === "corroborated" ? -1 : 1;
    if (a.independentSourceFamilyDiversity !== b.independentSourceFamilyDiversity) return b.independentSourceFamilyDiversity - a.independentSourceFamilyDiversity;
    if (a.independentSourceDiversity !== b.independentSourceDiversity) return b.independentSourceDiversity - a.independentSourceDiversity;
    return b.signalIds.length - a.signalIds.length;
  });

  const relevantSignalCount = signals.length;
  const clusteredSignalIds = new Set(candidates.flatMap((candidate) => candidate.signalIds));
  const corroboratedCount = candidates.filter((candidate) => candidate.status === "corroborated").length;
  const candidateCount = candidates.filter((candidate) => candidate.status === "candidate").length;
  const coverageClasses = entry.coverageClasses ?? entry.sourcePlan?.coverageClasses ?? [];
  const operationalCoverageClassCount = coverageClasses.filter((item) => String(item.runtimeStatus).startsWith("operational-")).length;
  const relevantCoverageClassCount = coverageClasses.filter((item) => item.relevantSignalCount > 0).length;

  return {
    schemaVersion: "workspace-intelligence-report.v1",
    workspace: entry.workspace,
    generatedAt,
    methodologyVersion: METHODOLOGY_VERSION,
    sourcePlan: entry.sourcePlan,
    coverageClasses,
    coverageStatus: coverageStatus(entry.sourcePlan),
    weakSignals: entry.weakSignals ?? [],
    repeatedSingleSourceClusters,
    candidates,
    candidateCount,
    corroboratedCount,
    quality: {
      relevantSignalCount,
      weakSignalCount: entry.weakSignals?.length ?? 0,
      crossSourceCandidateCount: candidates.length,
      independentlyCorroboratedCount: corroboratedCount,
      clusteredSignalCount: clusteredSignalIds.size,
      clusteringRate: relevantSignalCount ? Math.round((clusteredSignalIds.size / relevantSignalCount) * 1000) / 10 : 0,
      sameSourceDuplicateCount: entry.sourcePlan?.sameSourceDuplicateCount ?? 0,
      sourceDiversity: entry.sourcePlan?.sourceDiversity ?? 0,
      sourceFamilyDiversity: entry.sourcePlan?.sourceFamilyDiversity ?? 0,
      successfulTargetedSources: entry.sourcePlan?.successfulTargetedSources ?? 0,
      targetedFailures: entry.failures?.length ?? 0,
      operationalCoverageClassCount,
      relevantCoverageClassCount,
      boundedSubjectBridgeCount: bridgeEdges.length,
    },
    failures: entry.failures ?? [],
    notes: [
      "Stage 04F expands source coverage after the verified 04E baseline without rewriting the 04E artifact.",
      "Operational access and current-cycle relevant evidence are separate states for every coverage class.",
      "Workspace-scope concepts are not narrative identity. A bounded semantic alias cannot form a Trend Candidate without a distinctive subject anchor from returned evidence.",
      "Cross-source Trend Candidate still requires at least two distinct source IDs; corroborated additionally requires at least two independent source families after derivative-evidence calibration.",
      "A result of zero qualified Workspace Trend Candidates remains valid and must not trigger fabricated trends or relaxed thresholds.",
    ],
  };
}

async function main() {
  const snapshot = JSON.parse(await readFile(inputPath, "utf8"));
  if (snapshot?.schemaVersion !== "workspace-signal-snapshot-04f.v1") throw new Error("04F resolver requires workspace-signal-snapshot-04f.v1.");
  const generatedAt = new Date().toISOString();
  const workspaces = (snapshot.workspaces ?? []).map((entry) => buildReport(entry, generatedAt));
  if (!workspaces.length) throw new Error("04F resolver received no runtime Workspace snapshots.");
  const output = {
    schemaVersion: "workspace-intelligence-snapshot.v1",
    methodologyVersion: METHODOLOGY_VERSION,
    generatedAt,
    sourceSnapshotCollectedAt: snapshot.generatedAt,
    baseline04eCollectedAt: snapshot.baselineCollectedAt,
    runtimeWorkspaceCount: workspaces.length,
    workspaces,
    notes: [
      "This Stage 04F artifact supersedes the 04E report as the canonical Workspace Intelligence input while retaining 04E as the verified baseline artifact.",
      "Global Pulse remains separate and must not be substituted for Workspace Trend Candidates.",
    ],
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`04F resolved ${workspaces.length} Workspace Intelligence report(s).`);
  for (const report of workspaces) {
    console.log(`- ${report.workspace.name}: ${report.quality.relevantSignalCount} relevant · ${report.quality.weakSignalCount} weak · ${report.candidateCount} candidates · ${report.corroboratedCount} corroborated · ${report.quality.operationalCoverageClassCount}/5 operational coverage classes · ${report.coverageStatus}`);
  }
  console.log(`Output: ${path.relative(repoRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
