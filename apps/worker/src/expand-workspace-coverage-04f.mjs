import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dataDir = path.join(repoRoot, "apps/web/public/data");
const baselinePath = path.join(dataDir, "workspace-signals.json");
const outputPath = path.join(dataDir, "workspace-signals-04f.json");
const configPath = path.join(repoRoot, "apps/worker/config/runtime-workspaces.json");
const userAgent = "TrendPulse/0.4F (https://github.com/kavie-cmyk/trend-pulse; personal private non-commercial prototype)";
const previewRestrictedTerms = /(^|[ _#-])(porn|pornography|hentai|xxx|onlyfans|suicide|self[- ]?harm|casino|betting|sportsbook|cocaine|meth|heroin|fentanyl|firearm|gun sale|weapon sale)([ _#-]|$)/i;
const stopWords = new Set([
  "the", "and", "for", "with", "from", "this", "that", "into", "about", "your", "are", "was", "were", "will", "new", "more", "most", "trend", "trending", "market", "content", "growth", "opportunity", "opportunities", "discovery",
  "va", "và", "cua", "của", "cho", "voi", "với", "trong", "tren", "trên", "mot", "một", "khong", "không", "la", "là", "co", "có", "duoc", "được", "tu", "từ", "den", "đến", "moi", "mới"
]);
const genericTopicTokens = new Set(["game", "games", "gaming", "mobile", "app", "apps", "vietnam", "viet", "nam", "english", "vietnamese"]);

function stableId(value) {
  return createHash("sha1").update(String(value)).digest("hex").slice(0, 18);
}

function clean(value) {
  return String(value ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function safePreview(value) {
  const text = clean(value);
  return Boolean(text) && !previewRestrictedTerms.test(text);
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

function tokenSet(value) {
  return new Set(norm(value).split(" ").map((token) => token.replace(/^[#.+-]+|[#.+-]+$/g, "")).filter((token) => token && !stopWords.has(token) && (token.length >= 3 || ["ai", "vr", "xr", "ar", "3d"].includes(token))));
}

function jaccard(a, b) {
  const at = tokenSet(a);
  const bt = tokenSet(b);
  const shared = [...at].filter((token) => bt.has(token));
  const union = new Set([...at, ...bt]);
  return union.size ? shared.length / union.size : 0;
}

function dateWithin(value, days, now = new Date()) {
  if (!value) return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const age = now.getTime() - date.getTime();
  return age >= -86400000 && age <= days * 86400000;
}

async function requestText(endpoint, headers = {}) {
  try {
    const response = await fetch(endpoint, {
      headers: { accept: "*/*", "user-agent": userAgent, ...headers },
      signal: AbortSignal.timeout(20000),
    });
    const text = await response.text();
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${text.slice(0, 220)}`);
      error.status = response.status;
      throw error;
    }
    return text;
  } catch (error) {
    if (error instanceof Error && Number(error.status) >= 400 && Number(error.status) < 500) throw error;
    const args = ["--fail-with-body", "--location", "--silent", "--show-error", "--retry", "2", "--retry-delay", "1", "--connect-timeout", "15", "--max-time", "45", "--user-agent", userAgent];
    for (const [key, value] of Object.entries(headers)) args.push("--header", `${key}: ${value}`);
    args.push(endpoint);
    const { stdout } = await execFileAsync("curl", args, { maxBuffer: 20 * 1024 * 1024 });
    return stdout;
  }
}

async function requestJson(endpoint) {
  return JSON.parse(await requestText(endpoint, { accept: "application/json" }));
}

function topicalTerms(workspace) {
  return [
    ...(workspace.queryTerms ?? []),
    ...(workspace.scope?.industries ?? []),
    ...(workspace.scope?.categories ?? []),
    ...(workspace.scope?.products ?? []),
  ].map(clean).filter(Boolean);
}

function conceptMatches(workspace, text) {
  const value = norm(text);
  return (workspace.concepts ?? []).filter((concept) => (concept.aliases ?? []).some((alias) => value.includes(norm(alias))));
}

function contentRelevance(workspace, signal, returnedMetadataTerms = []) {
  const text = [signal.topic, ...(signal.hashtags ?? []), ...(signal.entities ?? []), signal.creator, signal.community, ...returnedMetadataTerms].filter(Boolean).join(" ");
  const value = norm(text);
  const terms = topicalTerms(workspace);
  const phraseMatches = terms.filter((term) => {
    const t = norm(term);
    return t.includes(" ") && t.length >= 5 && value.includes(t);
  });
  const concepts = conceptMatches(workspace, text);
  const wt = tokenSet(terms.join(" "));
  const st = tokenSet(text);
  const shared = [...st].filter((token) => wt.has(token));
  const distinctive = shared.filter((token) => !genericTopicTokens.has(token));
  const returnedMetadata = returnedMetadataTerms.map(clean).filter(Boolean);
  const strong = phraseMatches.length > 0 || concepts.length > 0 || (shared.length >= 2 && distinctive.length >= 1) || returnedMetadata.some((item) => norm(item) === "games" && (workspace.scope?.categories ?? []).some((category) => /game/i.test(category)));
  let score = phraseMatches.length * 5 + concepts.length * 4 + distinctive.length * 1.8 + Math.min(shared.length, 4) * 0.6;
  if (returnedMetadata.some((item) => norm(item) === "games")) score += 3;
  return {
    strong,
    score: Math.round(score * 10) / 10,
    matchedPhrases: phraseMatches.slice(0, 8),
    sharedTokens: shared.slice(0, 12),
    distinctiveTokens: distinctive.slice(0, 8),
    concepts: concepts.map((concept) => concept.id),
    returnedMetadata: returnedMetadata.slice(0, 8),
  };
}

function annotate(workspace, signal, match, collectionScopeId, queryProvenance) {
  return {
    ...signal,
    workspaceId: workspace.id,
    collectionScopeId,
    workspaceRelevance: match,
    confidence: {
      ...signal.confidence,
      basis: [
        ...(signal.confidence?.basis ?? []),
        `04F relevance uses returned content/source-native metadata only: ${match.matchedPhrases.length} exact topical phrase(s), ${match.distinctiveTokens.length} distinctive shared token(s), ${match.concepts.length} configured concept match(es), ${match.returnedMetadata.length} returned metadata term(s).`,
        ...(queryProvenance ? [`Collection query provenance: ${queryProvenance}. Query text itself is not counted as relevance evidence.`] : []),
      ],
    },
  };
}

function extractBlocks(xml, tagName) {
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  return [...xml.matchAll(re)].map((match) => match[1]);
}

function tagValue(block, tagName) {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i");
  return clean(block.match(re)?.[1] ?? "");
}

function atomLink(block) {
  const alternate = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i)?.[1];
  const any = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i)?.[1];
  return clean(alternate || any || "");
}

function parseApproxTraffic(value) {
  const label = clean(value);
  if (!label) return null;
  const match = label.replace(/,/g, "").match(/([0-9]+(?:\.[0-9]+)?)\s*([KMB])?/i);
  if (!match) return null;
  const multipliers = { K: 1e3, M: 1e6, B: 1e9 };
  return Math.round(Number(match[1]) * (multipliers[match[2]?.toUpperCase()] ?? 1));
}

async function collectGoogleTrends(workspace, config, collectedAt) {
  const sourceId = "google-trends-rss";
  const geo = clean(config.geo || "");
  if (!geo) return { coverageClass: "search-demand", sourceId, attempted: false, operational: false, signals: [], failures: [], note: "No Google Trends geo configured for this runtime Workspace." };
  const endpoint = `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`;
  try {
    const xml = await requestText(endpoint, { accept: "application/rss+xml, application/xml, text/xml" });
    const items = extractBlocks(xml, "item");
    if (!items.length) throw new Error("Google Trends RSS returned no parseable items");
    const signals = [];
    items.forEach((block, index) => {
      const title = tagValue(block, "title");
      if (!safePreview(title)) return;
      const trafficLabel = tagValue(block, "ht:approx_traffic");
      const publishedAt = tagValue(block, "pubDate");
      const link = tagValue(block, "link") || endpoint;
      const signalBase = {
        schemaVersion: "signal.v1",
        id: `workspace-google-trends-${stableId(`${workspace.id}:${geo}:${title}:${publishedAt}`)}`,
        observedAt: collectedAt,
        publishedAt: publishedAt || undefined,
        collectedAt,
        normalizedAt: collectedAt,
        source: { sourceId, sourceName: `Google Trends RSS (${geo})`, sourceType: "search", accessMode: "rss", freshness: "near-live" },
        geography: (workspace.scope?.geographies ?? [])[0],
        topic: title,
        entities: [],
        keywords: [],
        hashtags: [],
        contentType: "source-native-search-trend",
        metrics: { sourceRank: index + 1, native: { approxTrafficLabel: trafficLabel || null, approxTrafficLowerBound: parseApproxTraffic(trafficLabel) } },
        dynamics: {},
        confidence: { score: 0.68, basis: ["Direct Google Trends Trending Now RSS response", "Approximate traffic is preserved as source-native metadata and is not compared to other platforms"] },
        evidence: { sourceUrl: link, externalId: `${geo}:${title}:${publishedAt || index}`, reference: `Google Trends Trending Now RSS · ${geo}` },
      };
      const match = contentRelevance(workspace, signalBase);
      if (match.strong) signals.push(annotate(workspace, signalBase, match, `${workspace.id}-04f-google-trends`));
    });
    return { coverageClass: "search-demand", sourceId, attempted: true, operational: true, signals, failures: [], note: `${items.length} source-native Trending Now item(s) parsed; only returned-content-relevant items enter Workspace evidence.` };
  } catch (error) {
    return { coverageClass: "search-demand", sourceId, attempted: true, operational: false, signals: [], failures: [{ sourceId, query: geo, error: error instanceof Error ? error.message : String(error) }], note: "Google Trends RSS runtime request failed; no fallback observations were fabricated." };
  }
}

function appleGenreNames(item) {
  return (item?.genres ?? []).map((genre) => clean(typeof genre === "string" ? genre : genre?.name)).filter(Boolean);
}

async function collectAppleStore(workspace, config, collectedAt) {
  const sourceId = "apple-app-store-marketing-rss";
  const storefront = clean(config.storefront || "").toLowerCase();
  const limit = Math.min(Math.max(Number(config.limit) || 100, 10), 100);
  if (!storefront) return { coverageClass: "app-store", sourceId, attempted: false, operational: false, signals: [], failures: [], note: "No Apple App Store storefront configured for this runtime Workspace." };
  const endpoint = `https://rss.marketingtools.apple.com/api/v2/${encodeURIComponent(storefront)}/apps/top-free/${limit}/apps.json`;
  try {
    const payload = await requestJson(endpoint);
    const results = Array.isArray(payload?.feed?.results) ? payload.feed.results : [];
    if (!results.length) throw new Error("Apple App Store marketing RSS returned no app results");
    const signals = [];
    results.forEach((item, index) => {
      const name = clean(item?.name);
      const url = clean(item?.url);
      const artistName = clean(item?.artistName);
      const genres = appleGenreNames(item);
      if (!safePreview(name)) return;
      const isGame = genres.some((genre) => norm(genre) === "games");
      if (!isGame) return;
      const signalBase = {
        schemaVersion: "signal.v1",
        id: `workspace-apple-store-${stableId(`${workspace.id}:${storefront}:${item?.id ?? name}`)}`,
        observedAt: collectedAt,
        collectedAt,
        normalizedAt: collectedAt,
        source: { sourceId, sourceName: `Apple App Store Top Free (${storefront.toUpperCase()})`, sourceType: "store", accessMode: "rss", freshness: "daily" },
        geography: (workspace.scope?.geographies ?? [])[0],
        topic: name,
        entities: [name, artistName].filter(Boolean),
        keywords: genres,
        hashtags: [],
        creator: artistName || undefined,
        contentType: "source-native-store-chart",
        metrics: { sourceRank: index + 1, native: { overallTopFreeRank: index + 1, storefront, genreEvidence: genres.join(" | ") } },
        dynamics: {},
        confidence: { score: 0.76, basis: ["Direct Apple App Store Marketing Tools v2 Top Free Apps response", "Games classification comes from returned Apple genre metadata", "sourceRank is the overall Top Free Apps position; it is not represented as a Games-category rank"] },
        evidence: { sourceUrl: url || endpoint, externalId: String(item?.id ?? name), reference: `Apple App Store Marketing RSS · ${storefront} · Top Free Apps` },
      };
      const match = contentRelevance(workspace, signalBase, genres);
      if (match.strong) signals.push(annotate(workspace, signalBase, match, `${workspace.id}-04f-apple-store`));
    });
    return { coverageClass: "app-store", sourceId, attempted: true, operational: true, signals, failures: [], note: `${results.length} overall Top Free Apps entries parsed; ${signals.length} returned Apple-genre Games entries qualified for this Workspace.` };
  } catch (error) {
    return { coverageClass: "app-store", sourceId, attempted: true, operational: false, signals: [], failures: [{ sourceId, query: storefront, error: error instanceof Error ? error.message : String(error) }], note: "Apple App Store marketing RSS runtime request failed; no store observations were fabricated." };
  }
}

async function collectRedditRss(workspace, config, collectedAt) {
  const sourceId = "reddit-public-rss-search";
  const maxQueries = Math.min(Math.max(Number(config.maxQueries) || 4, 1), 6);
  const lookbackDays = Math.min(Math.max(Number(config.lookbackDays) || 30, 1), 90);
  const signals = [];
  const failures = [];
  let successfulQueries = 0;
  for (const query of (workspace.queryTerms ?? []).slice(0, maxQueries)) {
    const endpoint = `https://www.reddit.com/search.rss?q=${encodeURIComponent(query)}&sort=new&t=month`;
    try {
      const xml = await requestText(endpoint, { accept: "application/atom+xml, application/xml, text/xml" });
      const entries = extractBlocks(xml, "entry");
      successfulQueries += 1;
      entries.forEach((block, index) => {
        const title = tagValue(block, "title");
        const publishedAt = tagValue(block, "published") || tagValue(block, "updated");
        const href = atomLink(block);
        const externalId = tagValue(block, "id") || href || `${query}:${title}`;
        const authorBlock = extractBlocks(block, "author")[0] ?? "";
        const author = tagValue(authorBlock, "name");
        if (!safePreview(title) || !dateWithin(publishedAt, lookbackDays, new Date(collectedAt))) return;
        const signalBase = {
          schemaVersion: "signal.v1",
          id: `workspace-reddit-rss-${stableId(`${workspace.id}:${externalId}`)}`,
          observedAt: collectedAt,
          publishedAt: publishedAt || undefined,
          collectedAt,
          normalizedAt: collectedAt,
          source: { sourceId, sourceName: "Reddit public search RSS", sourceType: "community", accessMode: "rss", freshness: "near-live" },
          topic: title,
          entities: [],
          keywords: [],
          hashtags: [],
          creator: author || undefined,
          community: "Reddit",
          contentType: "workspace-community-post",
          metrics: { sourceRank: index + 1, native: {} },
          dynamics: {},
          confidence: { score: 0.55, basis: ["Direct public Reddit RSS search response", "RSS is treated as a provisional personal/private evidence path, not as official broad social-listening completeness"] },
          evidence: { sourceUrl: href || endpoint, externalId, reference: `Reddit public RSS search · ${query}` },
        };
        const match = contentRelevance(workspace, signalBase);
        if (match.strong) signals.push(annotate(workspace, signalBase, match, `${workspace.id}-04f-reddit-rss`, query));
      });
    } catch (error) {
      failures.push({ sourceId, query, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return {
    coverageClass: "community",
    sourceId,
    attempted: maxQueries > 0,
    operational: successfulQueries > 0,
    signals,
    failures,
    note: successfulQueries > 0
      ? `${successfulQueries}/${Math.min(maxQueries, (workspace.queryTerms ?? []).length)} RSS search query path(s) returned parseable responses; returned titles are independently relevance-filtered.`
      : "Reddit public RSS search did not return a parseable runtime response; no fallback observations were fabricated.",
  };
}

function sameSourceDedupe(signals) {
  const result = [];
  let duplicates = 0;
  for (const signal of signals) {
    const duplicate = result.find((existing) => existing.source?.sourceId === signal.source?.sourceId && (existing.evidence?.externalId === signal.evidence?.externalId || jaccard(existing.topic, signal.topic) >= 0.88));
    if (duplicate) {
      duplicates += 1;
      continue;
    }
    result.push(signal);
  }
  return { signals: result, duplicates };
}

function weakSignals(signals) {
  return [...signals]
    .sort((a, b) => (b.workspaceRelevance?.score ?? 0) - (a.workspaceRelevance?.score ?? 0) || new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime())
    .slice(0, 120)
    .map((signal) => ({
      signalId: signal.id,
      topic: signal.topic,
      sourceId: signal.source?.sourceId,
      sourceName: signal.source?.sourceName,
      sourceType: signal.source?.sourceType,
      sourceNativeTrend: ["source-native-social-trend", "source-native-community-trend", "source-native-search-trend", "source-native-store-chart"].includes(signal.contentType),
      relevanceScore: signal.workspaceRelevance?.score ?? 0,
      matchedPhrases: signal.workspaceRelevance?.matchedPhrases ?? [],
      concepts: signal.workspaceRelevance?.concepts ?? [],
      publishedAt: signal.publishedAt,
      evidenceUrl: signal.evidence?.sourceUrl,
    }));
}

function baselineCoverageSignals(signals, sourceType) {
  return signals.filter((signal) => signal.source?.sourceType === sourceType);
}

function coverageRecord(coverageClass, required, configured, attempted, operational, relevantSignals, failures, sourceIds, notes) {
  const runtimeStatus = !configured
    ? "not-configured"
    : operational
      ? relevantSignals.length > 0 ? "operational-with-relevant-evidence" : "operational-no-relevant-evidence"
      : attempted ? "runtime-failed" : "not-configured";
  return {
    coverageClass,
    required,
    configured,
    attempted,
    runtimeStatus,
    sourceIds: [...new Set(sourceIds.filter(Boolean))],
    relevantSignalCount: relevantSignals.length,
    failureCount: failures.length,
    notes,
  };
}

function buildCoverageClasses(workspace, baselineSignals, results) {
  const publisherSignals = [...baselineCoverageSignals(baselineSignals, "publisher"), ...baselineCoverageSignals(baselineSignals, "news")];
  const socialSignals = baselineCoverageSignals(baselineSignals, "social");
  const communitySignals = baselineCoverageSignals(baselineSignals, "community");
  const resultByClass = new Map(results.map((result) => [result.coverageClass, result]));
  const search = resultByClass.get("search-demand");
  const store = resultByClass.get("app-store");
  const reddit = results.find((result) => result.sourceId === "reddit-public-rss-search");
  return [
    coverageRecord("publisher", true, true, true, true, publisherSignals, [], publisherSignals.map((signal) => signal.source?.sourceId), ["Inherited from the verified 04E baseline actual evidence set."]),
    coverageRecord("social", true, true, true, true, socialSignals, [], socialSignals.map((signal) => signal.source?.sourceId), ["Inherited from the verified 04E baseline actual evidence set."]),
    coverageRecord("community", true, true, true, communitySignals.length > 0 || Boolean(reddit?.operational), [...communitySignals, ...(reddit?.signals ?? [])], reddit?.failures ?? [], [...communitySignals.map((signal) => signal.source?.sourceId), reddit?.sourceId], ["04E community evidence is retained; Stage 04F additionally attempts Reddit public RSS as a provisional personal/private path.", reddit?.note].filter(Boolean)),
    coverageRecord("search-demand", true, Boolean(search), Boolean(search?.attempted), Boolean(search?.operational), search?.signals ?? [], search?.failures ?? [], search ? [search.sourceId] : [], [search?.note ?? "Search-demand connector not configured."]),
    coverageRecord("app-store", true, Boolean(store), Boolean(store?.attempted), Boolean(store?.operational), store?.signals ?? [], store?.failures ?? [], store ? [store.sourceId] : [], [store?.note ?? "App-store connector not configured."]),
  ];
}

function rebuildSourcePlan(entry, finalSignals, addedSignals, failures, coverageClasses, duplicateCount) {
  const sourceIds = [...new Set(finalSignals.map((signal) => signal.source?.sourceId).filter(Boolean))];
  const sourceFamilies = [...new Set(finalSignals.map((signal) => signal.source?.sourceType).filter(Boolean))];
  const addedSourceIds = new Set(addedSignals.map((signal) => signal.source?.sourceId).filter(Boolean));
  const relevantExpansionSources = new Set(addedSignals.map((signal) => signal.source?.sourceId).filter(Boolean));
  return {
    ...entry.sourcePlan,
    methodologyVersion: "workspace-collection-04f.v1",
    activeSourceIds: sourceIds,
    activeSourceFamilies: sourceFamilies,
    postDedupeRelevantCount: finalSignals.length,
    preDedupeRelevantCount: finalSignals.length + duplicateCount,
    sameSourceDuplicateCount: (entry.sourcePlan?.sameSourceDuplicateCount ?? 0) + duplicateCount,
    sourceDiversity: sourceIds.length,
    sourceFamilyDiversity: sourceFamilies.length,
    targetedRelevantCount: (entry.sourcePlan?.targetedRelevantCount ?? 0) + addedSignals.length,
    successfulTargetedSources: (entry.sourcePlan?.successfulTargetedSources ?? 0) + relevantExpansionSources.size,
    targetedFailureCount: failures.length,
    coverage: {
      ...(entry.sourcePlan?.coverage ?? {}),
      targetedSourceSuccess: (entry.sourcePlan?.successfulTargetedSources ?? 0) + relevantExpansionSources.size,
      hasSocial: sourceFamilies.includes("social"),
      hasCommunity: sourceFamilies.includes("community"),
      hasPublisher: sourceFamilies.includes("publisher") || sourceFamilies.includes("news"),
      hasSearchDemand: coverageClasses.find((item) => item.coverageClass === "search-demand")?.runtimeStatus === "operational-with-relevant-evidence",
      hasAppStore: coverageClasses.find((item) => item.coverageClass === "app-store")?.runtimeStatus === "operational-with-relevant-evidence",
    },
    coverageClasses,
    expansion04f: {
      schemaVersion: "workspace-coverage-expansion-04f.v1",
      workspaceId: entry.workspace.id,
      methodologyVersion: "workspace-coverage-04f.v1",
      generatedAt: new Date().toISOString(),
      baselineSignalCount: entry.signals?.length ?? 0,
      expandedSignalCount: finalSignals.length,
      addedSignalCount: addedSignals.length,
      addedSourceIds: [...addedSourceIds],
      notes: [
        "Operational source access is tracked separately from whether the current cycle yields Workspace-relevant evidence.",
        "Source availability does not imply source relevance, and zero relevant items from an operational source is a valid state.",
      ],
    },
  };
}

async function main() {
  const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  const registry = JSON.parse(await readFile(configPath, "utf8"));
  if (baseline?.schemaVersion !== "workspace-signal-snapshot.v1") throw new Error("04F requires the verified 04E workspace-signal-snapshot.v1 baseline.");
  const configById = new Map((registry.workspaces ?? []).map((workspace) => [workspace.id, workspace]));
  const generatedAt = new Date().toISOString();
  const workspaces = [];

  for (const entry of baseline.workspaces ?? []) {
    const workspace = configById.get(entry.workspace?.id);
    if (!workspace) continue;
    const expansion = workspace.collection?.expansion04f ?? {};
    const results = [];
    if (expansion.googleTrends?.enabled) results.push(await collectGoogleTrends(workspace, expansion.googleTrends, generatedAt));
    if (expansion.appleAppStore?.enabled) results.push(await collectAppleStore(workspace, expansion.appleAppStore, generatedAt));
    if (expansion.redditRss?.enabled) results.push(await collectRedditRss(workspace, expansion.redditRss, generatedAt));

    const added = results.flatMap((result) => result.signals ?? []);
    const dedupe = sameSourceDedupe([...(entry.signals ?? []), ...added]);
    const finalSignals = dedupe.signals;
    const actualAddedIds = new Set(added.map((signal) => signal.id));
    const addedSignals = finalSignals.filter((signal) => actualAddedIds.has(signal.id));
    const failures = [...(entry.failures ?? []), ...results.flatMap((result) => result.failures ?? [])];
    const coverageClasses = buildCoverageClasses(workspace, entry.signals ?? [], results);
    const sourcePlan = rebuildSourcePlan(entry, finalSignals, addedSignals, failures, coverageClasses, dedupe.duplicates);

    workspaces.push({
      ...entry,
      sourcePlan,
      weakSignals: weakSignals(finalSignals),
      signals: finalSignals,
      failures,
      coverageExpansion04f: sourcePlan.expansion04f,
      coverageClasses,
    });
  }

  if (!workspaces.length) throw new Error("04F found no runtime Workspace derived from the verified 04E baseline.");
  const output = {
    schemaVersion: "workspace-signal-snapshot-04f.v1",
    generatedAt,
    baselineSchemaVersion: baseline.schemaVersion,
    baselineCollectedAt: baseline.collectedAt,
    workspaceCollectionMethodologyVersion: "workspace-collection-04f.v1",
    runtimeWorkspaceCount: workspaces.length,
    globalInputSignalCount: baseline.globalInputSignalCount,
    workspaces,
    notes: [
      "Stage 04F preserves the verified 04E workspace-signals.json artifact and writes this separate expansion artifact.",
      "Search-demand, app-store and provisional Reddit RSS access are runtime-tested; failed paths produce explicit gaps rather than mock/fallback signals.",
      "Google Trends traffic labels, Apple overall Top Free rank and other source-native metrics remain source-native and are not cross-platform scores.",
      "Workspace query text is collection provenance only and is never self-proof of returned-content relevance.",
    ],
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`04F expanded ${workspaces.length} Workspace snapshot(s) from the verified 04E baseline.`);
  for (const entry of workspaces) {
    const baselineCount = entry.coverageExpansion04f?.baselineSignalCount ?? 0;
    const addedCount = entry.coverageExpansion04f?.addedSignalCount ?? 0;
    console.log(`- ${entry.workspace.name}: ${baselineCount} baseline → ${entry.signals.length} final relevant · +${addedCount} added · ${entry.sourcePlan.sourceDiversity} sources / ${entry.sourcePlan.sourceFamilyDiversity} families`);
    for (const coverage of entry.coverageClasses ?? []) console.log(`  · ${coverage.coverageClass}: ${coverage.runtimeStatus} · ${coverage.relevantSignalCount} relevant · ${coverage.failureCount} failure(s)`);
  }
  console.log(`Output: ${path.relative(repoRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
