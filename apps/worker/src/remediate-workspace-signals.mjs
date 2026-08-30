import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dataDir = path.join(repoRoot, "apps/web/public/data");
const configPath = path.join(repoRoot, "apps/worker/config/runtime-workspaces.json");
const artifactPath = path.join(dataDir, "workspace-signals.json");
const userAgent = "TrendPulse/0.4E-remediation (https://github.com/kavie-cmyk/trend-pulse; personal private non-commercial prototype)";
const previewRestrictedTerms = /(^|[ _#-])(porn|pornography|hentai|xxx|onlyfans|suicide|self[- ]?harm|casino|betting|sportsbook|cocaine|meth|heroin|fentanyl|firearm|gun sale|weapon sale)([ _#-]|$)/i;
const stopWords = new Set([
  "the", "and", "for", "with", "from", "this", "that", "into", "about", "your", "are", "was", "were", "will", "new", "more", "most", "trend", "trending", "market", "content", "growth", "opportunity", "opportunities", "discovery",
  "va", "và", "cua", "của", "cho", "voi", "với", "trong", "tren", "trên", "mot", "một", "khong", "không", "la", "là", "co", "có", "duoc", "được", "tu", "từ", "den", "đến", "moi", "mới"
]);
const genericTopicTokens = new Set(["game", "games", "gaming", "mobile", "app", "apps", "vietnam", "viet", "nam", "english", "vietnamese"]);

function stableId(value) {
  return createHash("sha1").update(String(value)).digest("hex").slice(0, 18);
}

function safeText(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/&[a-zA-Z0-9#]+;/g, " ").replace(/\s+/g, " ").trim();
}

function safePreview(value) {
  const text = safeText(value);
  return Boolean(text) && !previewRestrictedTerms.test(text);
}

function normalize(value) {
  return safeText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#.-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value) {
  return new Set(normalize(value).split(" ").map((token) => token.replace(/^[#.+-]+|[#.+-]+$/g, "")).filter((token) => token && !stopWords.has(token) && (token.length >= 3 || ["ai", "vr", "xr", "ar", "3d"].includes(token))));
}

function jaccard(a, b) {
  const as = tokenSet(a);
  const bs = tokenSet(b);
  const shared = [...as].filter((token) => bs.has(token));
  const union = new Set([...as, ...bs]);
  return union.size ? shared.length / union.size : 0;
}

function dateWithin(value, days, now = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const ageMs = now.getTime() - date.getTime();
  return ageMs >= -24 * 60 * 60 * 1000 && ageMs <= days * 24 * 60 * 60 * 1000;
}

async function requestJson(endpoint, headers = {}) {
  try {
    const response = await fetch(endpoint, {
      headers: { accept: "application/json", "user-agent": userAgent, ...headers },
      signal: AbortSignal.timeout(20000),
    });
    const text = await response.text();
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${text.slice(0, 220)}`);
      error.status = response.status;
      throw error;
    }
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof Error && Number(error.status) >= 400 && Number(error.status) < 500) throw error;
    const args = ["--fail-with-body", "--location", "--silent", "--show-error", "--retry", "2", "--retry-delay", "1", "--connect-timeout", "15", "--max-time", "45", "--user-agent", userAgent, "--header", "accept: application/json"];
    for (const [key, value] of Object.entries(headers)) args.push("--header", `${key}: ${value}`);
    args.push(endpoint);
    const { stdout } = await execFileAsync("curl", args, { maxBuffer: 20 * 1024 * 1024 });
    return JSON.parse(stdout);
  }
}

function topicalTerms(workspace) {
  return [
    ...(workspace.queryTerms ?? []),
    ...(workspace.scope?.industries ?? []),
    ...(workspace.scope?.categories ?? []),
    ...(workspace.scope?.products ?? []),
  ].map(safeText).filter(Boolean);
}

function conceptMatches(workspace, text) {
  const normalized = normalize(text);
  return (workspace.concepts ?? []).filter((concept) => (concept.aliases ?? []).some((alias) => normalized.includes(normalize(alias))));
}

function contentText(signal) {
  return [signal.topic, ...(signal.hashtags ?? []), ...(signal.entities ?? []), signal.creator, signal.community].filter(Boolean).join(" ");
}

function contentRelevance(workspace, signal) {
  const text = contentText(signal);
  const normalized = normalize(text);
  const terms = topicalTerms(workspace);
  const phraseMatches = terms.filter((term) => {
    const termNorm = normalize(term);
    return termNorm.includes(" ") && termNorm.length >= 5 && normalized.includes(termNorm);
  });
  const concepts = conceptMatches(workspace, text);
  const workspaceTokens = tokenSet(terms.join(" "));
  const signalTokens = tokenSet(text);
  const shared = [...signalTokens].filter((token) => workspaceTokens.has(token));
  const distinctiveShared = shared.filter((token) => !genericTopicTokens.has(token));
  const topicalPair = shared.length >= 2 && (distinctiveShared.length >= 1 || concepts.length >= 1);
  const specialistMobilePublisher = ["pocketgamer-rss", "gamek-mobile-rss", "gamek-market-rss"].includes(signal.source?.sourceId) && (normalized.includes("mobile") || normalized.includes("di dong") || normalized.includes("game"));
  const strong = phraseMatches.length > 0 || concepts.length > 0 || topicalPair || specialistMobilePublisher;
  let score = phraseMatches.length * 5 + concepts.length * 4 + distinctiveShared.length * 1.8 + Math.min(shared.length, 4) * 0.6;
  if (specialistMobilePublisher) score += 2;
  return {
    strong,
    score: Math.round(score * 10) / 10,
    matchedPhrases: phraseMatches.slice(0, 8),
    sharedTokens: shared.slice(0, 12),
    distinctiveTokens: distinctiveShared.slice(0, 8),
    concepts: concepts.map((concept) => concept.id),
  };
}

function annotate(workspace, signal, match, collectionScopeId, queryProvenance) {
  return {
    ...signal,
    workspaceId: workspace.id,
    collectionScopeId,
    keywords: (signal.keywords ?? []).filter((keyword) => !String(keyword).startsWith("concept-")),
    confidence: {
      ...signal.confidence,
      basis: [
        ...(signal.confidence?.basis ?? []),
        `04E calibrated relevance uses returned content only: ${match.matchedPhrases.length} exact topical phrase(s), ${match.distinctiveTokens.length} distinctive shared token(s), ${match.concepts.length} configured concept match(es).`,
        ...(queryProvenance ? [`Collection query provenance: ${queryProvenance}. Query text itself is not counted as relevance evidence.`] : []),
      ],
    },
    workspaceRelevance: {
      score: match.score,
      matchedPhrases: match.matchedPhrases,
      sharedTokens: match.sharedTokens,
      distinctiveTokens: match.distinctiveTokens,
      concepts: match.concepts,
    },
  };
}

function sameSourceDedupe(signals) {
  const result = [];
  let duplicates = 0;
  for (const signal of signals) {
    const duplicate = result.find((existing) => existing.source?.sourceId === signal.source?.sourceId && (existing.evidence?.externalId === signal.evidence?.externalId || jaccard(existing.topic, signal.topic) >= 0.82));
    if (duplicate) {
      duplicates += 1;
      continue;
    }
    result.push(signal);
  }
  return { signals: result, duplicates };
}

function cleanBaseBroadSignals(workspace, entry) {
  const result = [];
  for (const signal of entry.signals ?? []) {
    if (!String(signal.collectionScopeId ?? "").endsWith("-broad-filtered")) continue;
    const match = contentRelevance(workspace, signal);
    if (!match.strong) continue;
    result.push(annotate(workspace, signal, match, `${workspace.id}-broad-filtered`));
  }
  return result;
}

function mastodonStatusText(status) {
  return safeText(status?.content || status?.spoiler_text || "");
}

async function collectMastodonTags(workspace, config, collectedAt) {
  const signals = [];
  const failures = [];
  const base = String(config.instance ?? "https://mastodon.social").replace(/\/$/, "");
  for (const hashtag of config.hashtags ?? []) {
    try {
      const endpoint = `${base}/api/v1/timelines/tag/${encodeURIComponent(hashtag)}?limit=${Math.min(config.maxRecordsPerTag ?? 12, 40)}`;
      const payload = await requestJson(endpoint);
      if (!Array.isArray(payload)) throw new Error("Mastodon hashtag timeline did not return an array");
      payload.forEach((status, index) => {
        const text = mastodonStatusText(status);
        if (!safePreview(text) || !dateWithin(status?.created_at, 14, new Date(collectedAt))) return;
        const signalBase = {
          schemaVersion: "signal.v1",
          id: `workspace-mastodon-${stableId(`${workspace.id}:${status?.id ?? text}`)}`,
          observedAt: collectedAt,
          publishedAt: status?.created_at,
          collectedAt,
          normalizedAt: collectedAt,
          source: { sourceId: "mastodon-tag-timeline", sourceName: "Mastodon public hashtag timeline", sourceType: "social", accessMode: "official-api", freshness: "near-live" },
          topic: text.slice(0, 320),
          entities: [],
          keywords: [],
          hashtags: (status?.tags ?? []).map((tag) => safeText(tag?.name)).filter(Boolean).slice(0, 10),
          creator: safeText(status?.account?.acct) || undefined,
          community: "Mastodon.social",
          contentType: "workspace-social-post",
          metrics: { sourceRank: index + 1, native: { favourites: Number(status?.favourites_count) || 0, reblogs: Number(status?.reblogs_count) || 0, replies: Number(status?.replies_count) || 0 } },
          dynamics: {},
          confidence: { score: 0.62, basis: ["Direct public Mastodon hashtag timeline", "Hashtag path is workspace-configured and current; native engagement is platform-specific"] },
          evidence: { sourceUrl: status?.url || status?.uri || base, externalId: String(status?.id ?? text), reference: `Mastodon hashtag #${hashtag}` },
        };
        const match = contentRelevance(workspace, signalBase);
        if (match.strong) signals.push(annotate(workspace, signalBase, match, `${workspace.id}-mastodon-tag`, `#${hashtag}`));
      });
    } catch (error) {
      failures.push({ sourceId: "mastodon-tag-timeline", query: `#${hashtag}`, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { sourceId: "mastodon-tag-timeline", attempted: true, signals, failures };
}

async function collectLemmyFresh(workspace, config, collectedAt) {
  const signals = [];
  const failures = [];
  const base = String(config.instance ?? "https://lemmy.world").replace(/\/$/, "");
  const lookbackDays = Number(config.lookbackDays) || 30;
  const timeRangeSeconds = lookbackDays * 86400;
  for (const query of (workspace.queryTerms ?? []).slice(0, 6)) {
    try {
      const endpoint = new URL(`${base}/api/v4/search`);
      endpoint.searchParams.set("search_term", query);
      endpoint.searchParams.set("type_", "posts");
      endpoint.searchParams.set("listing_type", "all");
      endpoint.searchParams.set("time_range_seconds", String(timeRangeSeconds));
      endpoint.searchParams.set("limit", String(Math.min(config.maxRecordsPerQuery ?? 12, 20)));
      const payload = await requestJson(endpoint.toString());
      const posts = Array.isArray(payload?.posts) ? payload.posts : [];
      posts.forEach((view, index) => {
        const post = view?.post ?? {};
        const title = safeText(post?.name || post?.title);
        const publishedAt = post?.published || post?.published_at;
        if (!safePreview(title) || !dateWithin(publishedAt, lookbackDays, new Date(collectedAt))) return;
        const signalBase = {
          schemaVersion: "signal.v1",
          id: `workspace-lemmy-v2-${stableId(`${workspace.id}:${post?.id ?? title}`)}`,
          observedAt: collectedAt,
          publishedAt,
          collectedAt,
          normalizedAt: collectedAt,
          source: { sourceId: "lemmy-search", sourceName: "Lemmy public recent search", sourceType: "community", accessMode: "official-api", freshness: "near-live" },
          topic: title,
          entities: [],
          keywords: [],
          hashtags: [],
          creator: safeText(view?.creator?.name) || undefined,
          community: safeText(view?.community?.title || view?.community?.name || "Lemmy"),
          contentType: "workspace-community-post",
          metrics: { sourceRank: index + 1, native: { score: Number(view?.counts?.score) || 0, comments: Number(view?.counts?.comments) || 0 } },
          dynamics: {},
          confidence: { score: 0.6, basis: ["Direct Lemmy v4 search using documented search_term and time_range_seconds", `Bounded to approximately ${lookbackDays} days`] },
          evidence: { sourceUrl: post?.ap_id || post?.url || `${base}/post/${post?.id}`, externalId: String(post?.id ?? title), reference: `Lemmy recent workspace search · ${query}` },
        };
        const match = contentRelevance(workspace, signalBase);
        if (match.strong) signals.push(annotate(workspace, signalBase, match, `${workspace.id}-lemmy-search`, query));
      });
    } catch (error) {
      failures.push({ sourceId: "lemmy-search", query, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { sourceId: "lemmy-search", attempted: true, signals, failures };
}

async function collectStackExchangeFresh(workspace, config, collectedAt) {
  const signals = [];
  const failures = [];
  const sites = config.sites ?? ["stackoverflow"];
  const lookbackDays = Number(config.lookbackDays) || 30;
  const fromDate = Math.floor((new Date(collectedAt).getTime() - lookbackDays * 86400000) / 1000);
  for (const site of sites) {
    for (const query of (workspace.queryTerms ?? []).slice(0, 5)) {
      try {
        const endpoint = new URL("https://api.stackexchange.com/2.3/search/advanced");
        endpoint.searchParams.set("site", site);
        endpoint.searchParams.set("q", query);
        endpoint.searchParams.set("fromdate", String(fromDate));
        endpoint.searchParams.set("sort", "creation");
        endpoint.searchParams.set("order", "desc");
        endpoint.searchParams.set("pagesize", String(Math.min(config.maxRecordsPerQuery ?? 10, 20)));
        const payload = await requestJson(endpoint.toString());
        const items = Array.isArray(payload?.items) ? payload.items : [];
        items.forEach((question, index) => {
          const title = safeText(question?.title);
          const publishedAt = Number(question?.creation_date) ? new Date(Number(question.creation_date) * 1000).toISOString() : undefined;
          if (!safePreview(title) || !dateWithin(publishedAt, lookbackDays, new Date(collectedAt))) return;
          const signalBase = {
            schemaVersion: "signal.v1",
            id: `workspace-se-v2-${stableId(`${workspace.id}:${site}:${question?.question_id ?? title}`)}`,
            observedAt: collectedAt,
            publishedAt,
            collectedAt,
            normalizedAt: collectedAt,
            source: { sourceId: `stackexchange-search-${site}`, sourceName: `${site} recent workspace search`, sourceType: "community", accessMode: "official-api", freshness: "near-live" },
            topic: title,
            entities: [],
            keywords: question?.tags ?? [],
            hashtags: [],
            creator: safeText(question?.owner?.display_name) || undefined,
            community: site,
            contentType: "workspace-community-question",
            metrics: { sourceRank: index + 1, native: { score: Number(question?.score) || 0, answers: Number(question?.answer_count) || 0, views: Number(question?.view_count) || 0 } },
            dynamics: {},
            confidence: { score: 0.62, basis: ["Direct Stack Exchange advanced search", `fromdate limits the request to approximately ${lookbackDays} days`, "Query text is provenance only and is not relevance evidence"] },
            evidence: { sourceUrl: question?.link, externalId: String(question?.question_id ?? title), reference: `${site} recent workspace search · ${query}` },
          };
          const match = contentRelevance(workspace, signalBase);
          if (match.strong) signals.push(annotate(workspace, signalBase, match, `${workspace.id}-stackexchange-search`, query));
        });
      } catch (error) {
        failures.push({ sourceId: `stackexchange-search-${site}`, query, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  return { sourceId: "stackexchange-search", attempted: true, signals, failures };
}

function isoDateDaysAgo(days, now = new Date()) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

async function collectGitHubFresh(workspace, config, collectedAt) {
  const signals = [];
  const failures = [];
  const lookbackDays = Number(config.lookbackDays) || 14;
  const since = isoDateDaysAgo(lookbackDays, new Date(collectedAt));
  for (const query of (workspace.queryTerms ?? []).slice(0, 5)) {
    try {
      const q = `\"${query}\" in:name,description,topics created:>=${since} stars:>=${config.minStars ?? 1}`;
      const endpoint = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${Math.min(config.maxRecordsPerQuery ?? 10, 20)}`;
      const headers = { accept: "application/vnd.github+json", "x-github-api-version": "2026-03-10" };
      if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
      const payload = await requestJson(endpoint, headers);
      const items = Array.isArray(payload?.items) ? payload.items : [];
      items.forEach((repo, index) => {
        const actualText = safeText(`${repo?.full_name ?? ""} ${repo?.description ?? ""} ${(repo?.topics ?? []).join(" ")}`);
        if (!safePreview(actualText) || !dateWithin(repo?.created_at, lookbackDays, new Date(collectedAt))) return;
        const signalBase = {
          schemaVersion: "signal.v1",
          id: `workspace-github-v2-${stableId(`${workspace.id}:${repo?.id ?? actualText}`)}`,
          observedAt: collectedAt,
          publishedAt: repo?.created_at,
          collectedAt,
          normalizedAt: collectedAt,
          source: { sourceId: "github-workspace-search", sourceName: "GitHub recent workspace search", sourceType: "community", accessMode: "official-api", freshness: "hourly" },
          topic: safeText(repo?.full_name),
          entities: repo?.owner?.login ? [safeText(repo.owner.login)] : [],
          keywords: [...(Array.isArray(repo?.topics) ? repo.topics : []), ...(repo?.language ? [`programming-${safeText(repo.language)}`] : [])],
          hashtags: [],
          creator: safeText(repo?.owner?.login) || undefined,
          community: "GitHub",
          contentType: "workspace-repository",
          metrics: { sourceRank: index + 1, native: { stars: Number(repo?.stargazers_count) || 0, forks: Number(repo?.forks_count) || 0 } },
          dynamics: {},
          confidence: { score: 0.62, basis: ["Direct GitHub repository search", `Repository creation window bounded to ${lookbackDays} days`, "Programming language remains a programming-* keyword and never Signal.language"] },
          evidence: { sourceUrl: repo?.html_url, externalId: String(repo?.id ?? actualText), reference: `GitHub recent workspace search · ${query} · created since ${since}` },
        };
        const match = contentRelevance(workspace, { ...signalBase, topic: actualText });
        if (match.strong) signals.push(annotate(workspace, signalBase, match, `${workspace.id}-github-search`, query));
      });
    } catch (error) {
      failures.push({ sourceId: "github-workspace-search", query, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { sourceId: "github-workspace-search", attempted: true, signals, failures };
}

function weakSignalRecords(signals) {
  return [...signals]
    .sort((a, b) => (b.workspaceRelevance?.score ?? 0) - (a.workspaceRelevance?.score ?? 0) || new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime())
    .slice(0, 100)
    .map((signal) => ({
      signalId: signal.id,
      topic: signal.topic,
      sourceId: signal.source?.sourceId,
      sourceName: signal.source?.sourceName,
      sourceType: signal.source?.sourceType,
      sourceNativeTrend: ["source-native-social-trend", "source-native-community-trend"].includes(signal.contentType),
      relevanceScore: signal.workspaceRelevance?.score ?? 0,
      matchedPhrases: signal.workspaceRelevance?.matchedPhrases ?? [],
      concepts: signal.workspaceRelevance?.concepts ?? [],
      publishedAt: signal.publishedAt,
      evidenceUrl: signal.evidence?.sourceUrl,
    }));
}

function rebuildPlan(workspace, entry, broadSignals, results, deduped, duplicates) {
  const targeted = results.flatMap((result) => result.signals ?? []);
  const sourceIds = [...new Set(deduped.map((signal) => signal.source?.sourceId).filter(Boolean))];
  const sourceFamilies = [...new Set(deduped.map((signal) => signal.source?.sourceType).filter(Boolean))];
  const languages = [...new Set(deduped.map((signal) => signal.language).filter(Boolean))];
  const attemptedTargetedSources = results.filter((result) => result.attempted).length;
  const successfulTargetedSources = results.filter((result) => (result.signals ?? []).length > 0).length;
  const targetedFailures = results.flatMap((result) => result.failures ?? []);
  return {
    ...(entry.sourcePlan ?? {}),
    schemaVersion: "workspace-collection-plan-result.v1",
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    collectionMode: "workspace-scoped",
    methodologyVersion: "workspace-collection-04e.v2-content-verified",
    queryTerms: workspace.queryTerms ?? [],
    concepts: workspace.concepts ?? [],
    attemptedTargetedSources,
    successfulTargetedSources,
    activeSourceIds: sourceIds,
    activeSourceFamilies: sourceFamilies,
    languageEvidence: languages,
    broadRelevantCount: broadSignals.length,
    targetedRelevantCount: targeted.length,
    preDedupeRelevantCount: broadSignals.length + targeted.length,
    postDedupeRelevantCount: deduped.length,
    sameSourceDuplicateCount: duplicates,
    targetedFailureCount: targetedFailures.length,
    coverage: {
      workspaceQueryExecuted: attemptedTargetedSources > 0,
      targetedSourceSuccess: successfulTargetedSources,
      hasSocial: sourceFamilies.includes("social"),
      hasCommunity: sourceFamilies.includes("community"),
      hasPublisher: sourceFamilies.includes("publisher") || sourceFamilies.includes("news"),
      hasLocalLanguageEvidence: (workspace.scope?.languages ?? []).some((language) => languages.some((value) => normalize(value).includes(normalize(language)) || normalize(language).includes(normalize(value)))),
    },
    calibrationNotes: [
      "Returned content, not collection query text, determines Workspace relevance.",
      "Lemmy and Stack Exchange targeted evidence is bounded by a recent time window.",
      "Bluesky public search is runtime-deferred after repeated HTTP 403 on the GitHub-hosted runner; public Bluesky source-native trends remain available through the broad backbone.",
      "Mastodon public hashtag timelines provide a no-auth targeted social path where the instance permits public preview."
    ]
  };
}

async function remediateWorkspace(configWorkspace, entry, collectedAt) {
  const broadSignals = cleanBaseBroadSignals(configWorkspace, entry);
  const targeted = configWorkspace.collection?.targeted ?? {};
  const results = [];
  if (targeted.mastodonTags?.enabled) results.push(await collectMastodonTags(configWorkspace, targeted.mastodonTags, collectedAt));
  if (targeted.lemmySearch?.enabled) results.push(await collectLemmyFresh(configWorkspace, targeted.lemmySearch, collectedAt));
  if (targeted.stackExchangeSearch?.enabled) results.push(await collectStackExchangeFresh(configWorkspace, targeted.stackExchangeSearch, collectedAt));
  if (targeted.githubSearch?.enabled) results.push(await collectGitHubFresh(configWorkspace, targeted.githubSearch, collectedAt));
  const targetedSignals = results.flatMap((result) => result.signals ?? []);
  const { signals, duplicates } = sameSourceDedupe([...broadSignals, ...targetedSignals]);
  const failures = results.flatMap((result) => result.failures ?? []);
  const sourcePlan = rebuildPlan(configWorkspace, entry, broadSignals, results, signals, duplicates);
  return {
    ...entry,
    workspace: { ...entry.workspace, id: configWorkspace.id, name: configWorkspace.name, matchNames: configWorkspace.matchNames ?? [configWorkspace.name], scope: configWorkspace.scope },
    sourcePlan,
    weakSignals: weakSignalRecords(signals),
    signals,
    failures,
    remediation: {
      methodologyVersion: "workspace-collection-04e.v2-content-verified",
      recalibratedAt: collectedAt,
      discardedBaseTargetedSignals: (entry.signals ?? []).filter((signal) => !String(signal.collectionScopeId ?? "").endsWith("-broad-filtered")).length,
      notes: [
        "Old targeted results are discarded and recollected with content-verified freshness rules.",
        "Generic geography/language tokens cannot independently make a signal relevant.",
        "Same-source near duplicates are removed before resolver input."
      ]
    }
  };
}

async function main() {
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
  const registry = JSON.parse(await readFile(configPath, "utf8"));
  const collectedAt = new Date().toISOString();
  const configById = new Map((registry.workspaces ?? []).map((workspace) => [workspace.id, workspace]));
  const workspaces = [];
  for (const entry of artifact.workspaces ?? []) {
    const configWorkspace = configById.get(entry.workspace?.id) ?? (registry.workspaces ?? []).find((workspace) => (workspace.matchNames ?? [workspace.name]).includes(entry.workspace?.name));
    if (!configWorkspace) continue;
    workspaces.push(await remediateWorkspace(configWorkspace, entry, collectedAt));
  }
  if (!workspaces.length) throw new Error("04E remediation found no runtime-synced workspace to recalibrate.");
  const next = {
    ...artifact,
    schemaVersion: "workspace-signal-snapshot.v1",
    collectedAt,
    workspaceCollectionMethodologyVersion: "workspace-collection-04e.v2-content-verified",
    workspaces,
    notes: [
      ...(artifact.notes ?? []),
      "04E v2 remediation replaces query-inflated targeted results with content-verified, freshness-bounded targeted evidence before report resolution."
    ]
  };
  await writeFile(artifactPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log("04E workspace signal remediation complete.");
  for (const workspace of workspaces) {
    console.log(`- ${workspace.workspace.name}: ${workspace.signals.length} content-verified relevant · ${workspace.weakSignals.length} weak · ${workspace.sourcePlan.sourceDiversity} sources · ${workspace.sourcePlan.successfulTargetedSources}/${workspace.sourcePlan.attemptedTargetedSources} targeted paths with relevant data · ${workspace.failures.length} request failures`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
