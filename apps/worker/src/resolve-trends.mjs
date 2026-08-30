import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dataDir = path.join(repoRoot, "apps/web/public/data");
const outputPath = path.join(dataDir, "trend-candidates.json");
const METHODOLOGY_VERSION = "trend-resolution-04c.v1";

const INPUT_FILES = [
  "backbone-signals.json",
  "social-signals.json",
  "permissionless-social-signals.json",
  "live-signals.json",
];

const stopWords = new Set([
  "the", "and", "for", "with", "from", "this", "that", "into", "about", "your", "you", "are", "was", "were", "will", "has", "have", "had", "not", "but", "can", "how", "what", "why", "who", "when", "where", "new", "more", "most", "than", "after", "before", "over", "under", "out", "all", "its", "our", "their", "they", "them", "his", "her", "she", "him", "one", "two", "via", "use", "using", "used", "get", "gets", "got", "make", "made", "just", "now", "today", "week", "year", "years", "official", "latest", "hot", "trending", "trend", "post", "posts", "video", "videos", "question", "questions", "news", "update", "updates", "review", "guide", "best",
  "va", "và", "cua", "của", "cho", "voi", "với", "trong", "tren", "trên", "mot", "một", "nhung", "nhưng", "khong", "không", "la", "là", "co", "có", "duoc", "được", "tu", "từ", "den", "đến", "khi", "nay", "này", "do", "đó", "ve", "về", "theo", "sau", "truoc", "trước", "nhat", "nhất", "moi", "mới", "dang", "đang", "hom", "hôm", "ngay", "ngày",
  "2024", "2025", "2026"
]);

const shortAllowed = new Set(["ai", "vr", "xr", "ar", "3d", "5g"]);
const genericAnchors = new Set(["ai", "app", "data", "game", "games", "tech", "technology", "software", "internet", "world", "people", "user", "users"]);
const previewRestrictedTerms = /(^|[ _#-])(porn|pornography|hentai|xxx|onlyfans|suicide|self[- ]?harm|casino|betting|sportsbook|cocaine|meth|heroin|fentanyl|firearm|gun sale|weapon sale)([ _#-]|$)/i;

function stableId(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 18);
}

function cleanText(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeText(value) {
  return cleanText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#.-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensFrom(value) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.replace(/^[#.+-]+|[#.+-]+$/g, ""))
    .filter((token) => token && !stopWords.has(token) && (token.length >= 3 || shortAllowed.has(token)));
}

function safeTopic(value) {
  const text = cleanText(value);
  return Boolean(text) && !previewRestrictedTerms.test(text);
}

function flattenSignals(payload) {
  if (payload?.schemaVersion === "signal-batch.v1" && Array.isArray(payload.signals)) return payload.signals;
  if (Array.isArray(payload?.batches)) return payload.batches.flatMap((batch) => Array.isArray(batch?.signals) ? batch.signals : []);
  return [];
}

async function loadSignals() {
  const all = [];
  const inputSummary = [];
  for (const file of INPUT_FILES) {
    const filePath = path.join(dataDir, file);
    const payload = JSON.parse(await readFile(filePath, "utf8"));
    const signals = flattenSignals(payload).filter((signal) => signal?.schemaVersion === "signal.v1" && safeTopic(signal.topic));
    all.push(...signals);
    inputSummary.push({ file, signalCount: signals.length });
  }
  return { signals: all, inputSummary };
}

function dedupeSignals(signals) {
  const seen = new Set();
  const result = [];
  for (const signal of signals) {
    const sourceId = String(signal?.source?.sourceId ?? "unknown");
    const external = cleanText(signal?.evidence?.externalId);
    const topic = normalizeText(signal?.topic);
    const key = external ? `${sourceId}:external:${external}` : `${sourceId}:topic:${topic}`;
    if (!topic || seen.has(key)) continue;
    seen.add(key);
    result.push(signal);
  }
  return result;
}

function signalFeatures(signal) {
  const topicTokens = tokensFrom(signal.topic);
  const entityTokens = (signal.entities ?? []).flatMap(tokensFrom);
  const hashtagTokens = (signal.hashtags ?? []).flatMap(tokensFrom);
  const keywordTokens = (signal.keywords ?? []).flatMap(tokensFrom);
  const creatorTokens = tokensFrom(signal.creator ?? "");
  const communityTokens = tokensFrom(signal.community ?? "");
  return {
    topicTokens,
    entityTokens,
    hashtagTokens,
    keywordTokens,
    creatorTokens,
    communityTokens,
    allTokens: [...new Set([...topicTokens, ...entityTokens, ...hashtagTokens, ...keywordTokens, ...creatorTokens, ...communityTokens])],
    entities: [...new Set((signal.entities ?? []).map(normalizeText).filter((value) => value.length >= 3))],
    hashtags: [...new Set((signal.hashtags ?? []).map(normalizeText).filter(Boolean))],
  };
}

function buildDocumentFrequency(featureMap) {
  const counts = new Map();
  for (const features of featureMap.values()) {
    for (const token of new Set(features.allTokens)) counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function tokenWeight(token, df, total) {
  const idf = Math.log((total + 1) / ((df.get(token) ?? 0) + 1)) + 1;
  return genericAnchors.has(token) ? idf * 0.35 : idf;
}

function weightedMap(features, df, total) {
  const weights = new Map();
  const add = (tokens, multiplier) => {
    for (const token of tokens) {
      const next = tokenWeight(token, df, total) * multiplier;
      weights.set(token, Math.max(weights.get(token) ?? 0, next));
    }
  };
  add(features.topicTokens, 1);
  add(features.keywordTokens, 1.15);
  add(features.communityTokens, 1.2);
  add(features.creatorTokens, 1.35);
  add(features.hashtagTokens, 2.2);
  add(features.entityTokens, 2.6);
  return weights;
}

function intersection(a, b) {
  const bs = new Set(b);
  return [...new Set(a)].filter((value) => bs.has(value));
}

function pairEvidence(a, b, df, total) {
  const exactEntities = intersection(a.features.entities, b.features.entities).filter((value) => !genericAnchors.has(value));
  const exactHashtags = intersection(a.features.hashtags, b.features.hashtags).filter((value) => !genericAnchors.has(value));
  const sharedTokens = intersection(a.features.allTokens, b.features.allTokens)
    .filter((token) => !genericAnchors.has(token))
    .sort((x, y) => tokenWeight(y, df, total) - tokenWeight(x, df, total));

  const weightsA = a.weights;
  const weightsB = b.weights;
  const union = new Set([...weightsA.keys(), ...weightsB.keys()]);
  let minSum = 0;
  let maxSum = 0;
  for (const token of union) {
    const wa = weightsA.get(token) ?? 0;
    const wb = weightsB.get(token) ?? 0;
    minSum += Math.min(wa, wb);
    maxSum += Math.max(wa, wb);
  }
  const similarity = maxSum ? minSum / maxSum : 0;
  const rareShared = sharedTokens.filter((token) => (df.get(token) ?? total) <= Math.max(5, Math.ceil(total * 0.08)));
  const strongAnchor = exactEntities.length > 0 || exactHashtags.length > 0;
  const enoughAnchors = rareShared.length >= 2 || (strongAnchor && sharedTokens.length >= 1);
  const sameSource = a.signal.source.sourceId === b.signal.source.sourceId;
  const threshold = sameSource ? 0.48 : 0.32;
  return {
    match: enoughAnchors && (similarity >= threshold || (strongAnchor && similarity >= 0.18)),
    similarity,
    sharedTokens: sharedTokens.slice(0, 8),
    rareShared: rareShared.slice(0, 6),
    exactEntities,
    exactHashtags,
  };
}

function connectedComponents(nodes, edges) {
  const parent = nodes.map((_, index) => index);
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const unite = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  for (const edge of edges) unite(edge.a, edge.b);
  const groups = new Map();
  nodes.forEach((node, index) => {
    const root = find(index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push({ ...node, index });
  });
  return [...groups.values()];
}

function chooseMedoid(component, edgeMap) {
  if (component.length === 1) return component[0];
  let best = component[0];
  let bestScore = -1;
  for (const node of component) {
    let sum = 0;
    for (const other of component) {
      if (node.index === other.index) continue;
      const key = node.index < other.index ? `${node.index}:${other.index}` : `${other.index}:${node.index}`;
      sum += edgeMap.get(key)?.similarity ?? 0;
    }
    if (sum > bestScore) {
      best = node;
      bestScore = sum;
    }
  }
  return best;
}

function collectAnchorTerms(component, edges, df, total) {
  const score = new Map();
  for (const edge of edges) {
    if (!component.some((node) => node.index === edge.a) || !component.some((node) => node.index === edge.b)) continue;
    for (const token of [...edge.evidence.rareShared, ...edge.evidence.exactEntities, ...edge.evidence.exactHashtags]) {
      if (!token || genericAnchors.has(token)) continue;
      score.set(token, (score.get(token) ?? 0) + tokenWeight(token, df, total));
    }
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([token]) => token);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function classifyTrendType(component, sourceFamilies) {
  if (component.some((node) => node.signal.creator) && sourceFamilies.includes("social")) return "creator-trend";
  if (sourceFamilies.length === 1 && sourceFamilies[0] === "social") return "platform-native";
  if (sourceFamilies.includes("culture") && sourceFamilies.length >= 2) return "cultural-moment";
  if (sourceFamilies.some((family) => ["publisher", "news", "community"].includes(family))) return "narrative";
  return "other";
}

function confidenceAssessment({ status, sourceIds, sourceFamilies, evidenceRefs, anchorTerms, generatedAt, geographies, languages }) {
  return {
    status: "provisional",
    scaleMax: 10,
    methodologyVersion: "trend-confidence-04c.v1",
    factors: [
      { key: "distinct-sources", label: "Distinct sources", status: "available", note: `${sourceIds.length} distinct source IDs` },
      { key: "source-family-diversity", label: "Independent source-family diversity", status: "available", note: `${sourceFamilies.length} source families` },
      { key: "resolution-anchors", label: "Resolution anchors", status: anchorTerms.length ? "available" : "missing", note: anchorTerms.length ? `Shared anchors: ${anchorTerms.join(", ")}` : "No sufficiently distinctive shared anchor" },
      { key: "geography-coverage", label: "Geography coverage", status: geographies.length ? "available" : "missing", note: geographies.length ? geographies.join(", ") : "Most current broad feeds do not provide reliable geography" },
      { key: "language-coverage", label: "Language coverage", status: languages.length ? "available" : "missing", note: languages.length ? languages.join(", ") : "Language is not consistently supplied across current source families" },
      { key: "historical-persistence", label: "Historical persistence", status: "missing", note: "04C uses the current collection snapshot; persistence requires stored multi-cycle history" },
    ],
    rationale: [
      status === "corroborated"
        ? "Corroborated only because the cluster contains matching evidence from at least two distinct source IDs and at least two independent source families."
        : "Candidate has repeated matching evidence but does not yet satisfy the independent source-family corroboration gate.",
      "No numeric confidence score is emitted in 04C because empirical calibration is not yet available.",
      "Lexical/entity resolution evidence is deterministic and inspectable; it is not a model-generated semantic claim.",
    ],
    evidenceRefs,
    computedAt: generatedAt,
  };
}

export function resolveSignals(rawSignals, generatedAt = new Date().toISOString()) {
  const signals = dedupeSignals(rawSignals);
  const featureMap = new Map(signals.map((signal) => [signal.id, signalFeatures(signal)]));
  const df = buildDocumentFrequency(featureMap);
  const nodes = signals.map((signal) => {
    const features = featureMap.get(signal.id);
    return { signal, features, weights: weightedMap(features, df, signals.length) };
  });
  const edges = [];
  const edgeMap = new Map();
  for (let a = 0; a < nodes.length; a += 1) {
    for (let b = a + 1; b < nodes.length; b += 1) {
      const evidence = pairEvidence(nodes[a], nodes[b], df, nodes.length);
      if (!evidence.match) continue;
      const edge = { a, b, evidence };
      edges.push(edge);
      edgeMap.set(`${a}:${b}`, evidence);
    }
  }

  const components = connectedComponents(nodes, edges).filter((component) => component.length >= 2);
  const candidates = [];
  for (const component of components) {
    const sourceIds = uniqueSorted(component.map((node) => node.signal.source.sourceId));
    const sourceFamilies = uniqueSorted(component.map((node) => node.signal.source.sourceType));
    const evidenceRefs = uniqueSorted(component.map((node) => node.signal.evidence?.sourceUrl).filter(Boolean));
    if (evidenceRefs.length < 2) continue;
    const anchorTerms = collectAnchorTerms(component, edges, df, nodes.length);
    if (!anchorTerms.length) continue;
    const medoid = chooseMedoid(component, edgeMap);
    const status = sourceIds.length >= 2 && sourceFamilies.length >= 2 ? "corroborated" : "candidate";
    const geographies = uniqueSorted(component.map((node) => node.signal.geography));
    const languages = uniqueSorted(component.map((node) => node.signal.language));
    const observedTimes = component.map((node) => node.signal.observedAt || node.signal.collectedAt).filter(Boolean).sort();
    const signalIds = uniqueSorted(component.map((node) => node.signal.id));
    const title = cleanText(medoid.signal.topic).slice(0, 160);
    const candidate = {
      schemaVersion: "trend-candidate.v1",
      id: `trend-${stableId(`${anchorTerms.join("|")}:${sourceIds.join("|")}`)}`,
      title,
      summary: `${status === "corroborated" ? "Cross-source corroboration" : "Repeated source evidence"}: ${signalIds.length} observations across ${sourceIds.length} source${sourceIds.length === 1 ? "" : "s"} and ${sourceFamilies.length} source famil${sourceFamilies.length === 1 ? "y" : "ies"}. Shared resolution anchors: ${anchorTerms.slice(0, 5).join(", ")}.`,
      trendType: classifyTrendType(component, sourceFamilies),
      lifecycleStage: "weak-signal",
      status,
      signalIds,
      sourceIds,
      sourceDiversity: sourceIds.length,
      sourceFamilies,
      sourceFamilyDiversity: sourceFamilies.length,
      resolutionAnchors: anchorTerms,
      resolutionMethodologyVersion: METHODOLOGY_VERSION,
      geographies,
      languages,
      firstObservedAt: observedTimes[0],
      lastObservedAt: observedTimes.at(-1) ?? generatedAt,
      evidenceRefs,
      corroborationRationale: [
        `${signalIds.length} observations survived deterministic deduplication and clustering.`,
        `${sourceIds.length} distinct source IDs; ${sourceFamilies.length} distinct source families.`,
        `Shared distinctive anchors: ${anchorTerms.slice(0, 6).join(", ")}.`,
        status === "corroborated" ? "Independent source-family corroboration gate passed." : "Independent source-family corroboration gate not yet passed.",
      ],
      confidence: confidenceAssessment({ status, sourceIds, sourceFamilies, evidenceRefs, anchorTerms, generatedAt, geographies, languages }),
    };
    candidates.push(candidate);
  }

  candidates.sort((a, b) => {
    if (a.status !== b.status) return a.status === "corroborated" ? -1 : 1;
    if (a.sourceFamilyDiversity !== b.sourceFamilyDiversity) return b.sourceFamilyDiversity - a.sourceFamilyDiversity;
    if (a.sourceDiversity !== b.sourceDiversity) return b.sourceDiversity - a.sourceDiversity;
    return b.signalIds.length - a.signalIds.length;
  });

  const clusteredSignalIds = new Set(candidates.flatMap((candidate) => candidate.signalIds));
  return {
    schemaVersion: "trend-resolution-snapshot.v1",
    generatedAt,
    methodologyVersion: METHODOLOGY_VERSION,
    inputSignalCount: rawSignals.length,
    uniqueSignalCount: signals.length,
    candidateCount: candidates.filter((candidate) => candidate.status === "candidate").length,
    corroboratedCount: candidates.filter((candidate) => candidate.status === "corroborated").length,
    clusteredSignalCount: clusteredSignalIds.size,
    unclusteredSignalCount: Math.max(0, signals.length - clusteredSignalIds.size),
    candidates,
    notes: [
      "Global/broad source signals remain workspace-unscoped. TrendCandidate.workspaceId is omitted until a real workspace projection is applied.",
      "A single observation never becomes a Trend Candidate.",
      "Corroborated requires at least two distinct source IDs and at least two independent source families.",
      "Lifecycle stays weak-signal in 04C because one current snapshot cannot establish acceleration, breakout, saturation or decline.",
      "No Virality, Brand Fit, Opportunity or numeric Confidence score is computed in 04C.",
      "Source-native metrics are not compared across platforms during resolution.",
    ],
  };
}

async function main() {
  const { signals, inputSummary } = await loadSignals();
  if (!signals.length) throw new Error("Stage 04C received no real signals; refusing to write an empty/fake fallback artifact.");
  const snapshot = resolveSignals(signals);
  snapshot.inputSummary = inputSummary;
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Trend resolution processed ${snapshot.uniqueSignalCount} unique real signals.`);
  console.log(`- corroborated: ${snapshot.corroboratedCount}`);
  console.log(`- candidate: ${snapshot.candidateCount}`);
  console.log(`- clustered signals: ${snapshot.clusteredSignalCount}`);
  console.log(`- unclustered signals: ${snapshot.unclusteredSignalCount}`);
  console.log(`Output: ${path.relative(repoRoot, outputPath)}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
  });
}
