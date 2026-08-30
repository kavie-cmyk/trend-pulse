import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dataDir = path.join(repoRoot, "apps/web/public/data");
const configPath = path.join(repoRoot, "apps/worker/config/runtime-workspaces.json");
const outputPath = path.join(dataDir, "workspace-signals.json");
const userAgent = "TrendPulse/0.4E (https://github.com/kavie-cmyk/trend-pulse; personal private non-commercial prototype)";
const inputFiles = ["backbone-signals.json", "social-signals.json", "permissionless-social-signals.json", "live-signals.json"];
const previewRestrictedTerms = /(^|[ _#-])(porn|pornography|hentai|xxx|onlyfans|suicide|self[- ]?harm|casino|betting|sportsbook|cocaine|meth|heroin|fentanyl|firearm|gun sale|weapon sale)([ _#-]|$)/i;
const stopWords = new Set([
  "the", "and", "for", "with", "from", "this", "that", "into", "about", "your", "are", "was", "were", "will", "new", "more", "most", "trend", "trending", "market", "content", "growth", "opportunity", "opportunities", "discovery",
  "va", "và", "cua", "của", "cho", "voi", "với", "trong", "tren", "trên", "mot", "một", "khong", "không", "la", "là", "co", "có", "duoc", "được", "tu", "từ", "den", "đến", "moi", "mới"
]);

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

function flattenSignals(payload) {
  if (payload?.schemaVersion === "signal-batch.v1" && Array.isArray(payload.signals)) return payload.signals;
  if (Array.isArray(payload?.batches)) return payload.batches.flatMap((batch) => Array.isArray(batch?.signals) ? batch.signals : []);
  return [];
}

async function loadGlobalSignals() {
  const signals = [];
  for (const file of inputFiles) {
    try {
      const payload = JSON.parse(await readFile(path.join(dataDir, file), "utf8"));
      signals.push(...flattenSignals(payload));
    } catch (error) {
      console.warn(`Workspace collector could not read ${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return signals.filter((signal) => signal?.schemaVersion === "signal.v1" && safePreview(signal.topic));
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

function workspaceTerms(workspace) {
  return [
    ...(workspace.queryTerms ?? []),
    ...(workspace.scope?.geographies ?? []),
    ...(workspace.scope?.languages ?? []),
    ...(workspace.scope?.industries ?? []),
    ...(workspace.scope?.categories ?? []),
    ...(workspace.scope?.products ?? []),
    ...(workspace.scope?.audiences ?? []),
  ].map(safeText).filter(Boolean);
}

function conceptMatches(workspace, text) {
  const normalized = normalize(text);
  return (workspace.concepts ?? []).filter((concept) => (concept.aliases ?? []).some((alias) => normalized.includes(normalize(alias))));
}

function relevance(workspace, signal) {
  const text = [signal.topic, ...(signal.keywords ?? []), ...(signal.hashtags ?? []), ...(signal.entities ?? []), signal.creator, signal.community].filter(Boolean).join(" ");
  const normalized = normalize(text);
  const terms = workspaceTerms(workspace);
  const matchedPhrases = terms.filter((term) => normalize(term).length >= 3 && normalized.includes(normalize(term)));
  const workspaceTokens = tokenSet(terms.join(" "));
  const signalTokens = tokenSet(text);
  const sharedTokens = [...signalTokens].filter((token) => workspaceTokens.has(token));
  const concepts = conceptMatches(workspace, text);
  let score = matchedPhrases.length * 4 + sharedTokens.length * 1.2 + concepts.length * 4;
  if (signal.source?.sourceId === "pocketgamer-rss" && /game|gaming/.test(normalize(workspace.scope?.industries?.join(" ") ?? ""))) score += 2;
  if (signal.source?.sourceId === "vnexpress-tech-rss" && /vietnam/.test(normalize(workspace.scope?.geographies?.join(" ") ?? ""))) score += 1.5;
  return {
    score,
    matchedPhrases: matchedPhrases.slice(0, 8),
    sharedTokens: sharedTokens.slice(0, 12),
    concepts: concepts.map((concept) => concept.id),
  };
}

function annotateSignal(workspace, signal, match, collectionScopeId) {
  const conceptKeywords = match.concepts.map((concept) => `concept-${concept}`);
  return {
    ...signal,
    workspaceId: workspace.id,
    collectionScopeId,
    keywords: [...new Set([...(signal.keywords ?? []), ...conceptKeywords])],
    confidence: {
      ...signal.confidence,
      basis: [
        ...(signal.confidence?.basis ?? []),
        `04E workspace relevance: ${match.matchedPhrases.length} phrase match(es), ${match.sharedTokens.length} shared scope token(s), ${match.concepts.length} configured concept bridge(s).`,
      ],
    },
    workspaceRelevance: {
      score: Math.round(match.score * 10) / 10,
      matchedPhrases: match.matchedPhrases,
      sharedTokens: match.sharedTokens,
      concepts: match.concepts,
    },
  };
}

function sameSourceDedupe(signals) {
  const result = [];
  let duplicates = 0;
  for (const signal of signals) {
    const duplicate = result.find((existing) => existing.source?.sourceId === signal.source?.sourceId && jaccard(existing.topic, signal.topic) >= 0.82);
    if (duplicate) {
      duplicates += 1;
      continue;
    }
    result.push(signal);
  }
  return { signals: result, duplicates };
}

function bskyPostUrl(post) {
  const handle = safeText(post?.author?.handle);
  const uri = safeText(post?.uri);
  const rkey = uri.split("/").at(-1);
  return handle && rkey ? `https://bsky.app/profile/${handle}/post/${rkey}` : "https://bsky.app/";
}

async function collectBlueskySearch(workspace, config, collectedAt) {
  const signals = [];
  const failures = [];
  for (const query of (workspace.queryTerms ?? []).slice(0, 5)) {
    try {
      const endpoint = new URL("https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts");
      endpoint.searchParams.set("q", query);
      endpoint.searchParams.set("limit", String(Math.min(config.maxRecordsPerQuery ?? 12, 25)));
      endpoint.searchParams.set("sort", "latest");
      const payload = await requestJson(endpoint.toString());
      const posts = Array.isArray(payload?.posts) ? payload.posts : [];
      posts.forEach((post, index) => {
        const text = safeText(post?.record?.text);
        if (!safePreview(text)) return;
        const match = relevance(workspace, { ...post, topic: text, keywords: [], hashtags: [], entities: [], source: { sourceId: "bluesky-search" } });
        if (match.score < 2.2) return;
        signals.push(annotateSignal(workspace, {
          schemaVersion: "signal.v1",
          id: `workspace-bsky-${stableId(`${workspace.id}:${post.uri ?? text}`)}`,
          observedAt: collectedAt,
          publishedAt: post?.record?.createdAt || post?.indexedAt,
          collectedAt,
          normalizedAt: collectedAt,
          source: { sourceId: "bluesky-search", sourceName: "Bluesky public search", sourceType: "social", accessMode: "official-api", freshness: "near-live" },
          geography: workspace.scope?.geographies?.[0],
          topic: text.slice(0, 280),
          entities: post?.author?.displayName ? [safeText(post.author.displayName)] : [],
          keywords: [query],
          hashtags: [...text.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map((match) => match[1]).slice(0, 8),
          creator: safeText(post?.author?.handle) || undefined,
          community: "Bluesky",
          contentType: "workspace-social-post",
          metrics: { sourceRank: index + 1, native: { likes: Number(post?.likeCount) || 0, replies: Number(post?.replyCount) || 0, reposts: Number(post?.repostCount) || 0, quotes: Number(post?.quoteCount) || 0 } },
          dynamics: {},
          confidence: { score: 0.62, basis: ["Direct public Bluesky searchPosts response", "Workspace query is explicit; native engagement remains platform-specific"] },
          evidence: { sourceUrl: bskyPostUrl(post), externalId: safeText(post?.uri || text), reference: `Bluesky workspace search · ${query}` },
        }, match, `${workspace.id}-bluesky-search`));
      });
    } catch (error) {
      failures.push({ sourceId: "bluesky-search", query, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { signals, failures, attempted: true };
}

async function collectLemmySearch(workspace, config, collectedAt) {
  const signals = [];
  const failures = [];
  const base = String(config.instance ?? "https://lemmy.world").replace(/\/$/, "");
  for (const query of (workspace.queryTerms ?? []).slice(0, 5)) {
    const attempts = [
      `${base}/api/v4/search?q=${encodeURIComponent(query)}&type_=posts&sort=top&limit=${Math.min(config.maxRecordsPerQuery ?? 10, 20)}`,
      `${base}/api/v3/search?q=${encodeURIComponent(query)}&type_=Posts&sort=TopAll&listing_type=All&limit=${Math.min(config.maxRecordsPerQuery ?? 10, 20)}`,
    ];
    let payload = null;
    let usedEndpoint = "";
    let lastError = null;
    for (const endpoint of attempts) {
      try {
        const next = await requestJson(endpoint);
        if (Array.isArray(next?.posts)) {
          payload = next;
          usedEndpoint = endpoint;
          break;
        }
      } catch (error) {
        lastError = error;
      }
    }
    if (!payload) {
      failures.push({ sourceId: "lemmy-search", query, error: lastError instanceof Error ? lastError.message : "No compatible Lemmy search response" });
      continue;
    }
    payload.posts.forEach((view, index) => {
      const post = view?.post ?? {};
      const title = safeText(post?.name || post?.title);
      if (!safePreview(title)) return;
      const signalBase = {
        schemaVersion: "signal.v1",
        id: `workspace-lemmy-${stableId(`${workspace.id}:${post.id ?? title}`)}`,
        observedAt: collectedAt,
        publishedAt: post?.published || post?.published_at,
        collectedAt,
        normalizedAt: collectedAt,
        source: { sourceId: "lemmy-search", sourceName: "Lemmy public search", sourceType: "community", accessMode: "official-api", freshness: "near-live" },
        geography: workspace.scope?.geographies?.[0],
        topic: title,
        entities: [],
        keywords: [query],
        hashtags: [],
        creator: safeText(view?.creator?.name) || undefined,
        community: safeText(view?.community?.title || view?.community?.name || "Lemmy"),
        contentType: "workspace-community-post",
        metrics: { sourceRank: index + 1, native: { score: Number(view?.counts?.score) || 0, comments: Number(view?.counts?.comments) || 0 } },
        dynamics: {},
        confidence: { score: 0.58, basis: ["Direct public Lemmy search response", "Workspace query is explicit; federation/instance bias remains"] },
        evidence: { sourceUrl: post?.ap_id || post?.url || `${base}/post/${post.id}`, externalId: String(post?.id ?? title), reference: `Lemmy workspace search · ${query} · ${usedEndpoint.includes("/v4/") ? "v4" : "v3"}` },
      };
      const match = relevance(workspace, signalBase);
      if (match.score >= 2.2) signals.push(annotateSignal(workspace, signalBase, match, `${workspace.id}-lemmy-search`));
    });
  }
  return { signals, failures, attempted: true };
}

async function collectStackExchangeSearch(workspace, config, collectedAt) {
  const signals = [];
  const failures = [];
  const sites = config.sites ?? ["stackoverflow"];
  for (const site of sites) {
    for (const query of (workspace.queryTerms ?? []).slice(0, 4)) {
      try {
        const endpoint = new URL("https://api.stackexchange.com/2.3/search/advanced");
        endpoint.searchParams.set("site", site);
        endpoint.searchParams.set("q", query);
        endpoint.searchParams.set("sort", "relevance");
        endpoint.searchParams.set("order", "desc");
        endpoint.searchParams.set("pagesize", String(Math.min(config.maxRecordsPerQuery ?? 10, 20)));
        const payload = await requestJson(endpoint.toString());
        const items = Array.isArray(payload?.items) ? payload.items : [];
        items.forEach((question, index) => {
          const title = safeText(question?.title);
          if (!safePreview(title)) return;
          const signalBase = {
            schemaVersion: "signal.v1",
            id: `workspace-se-${stableId(`${workspace.id}:${site}:${question.question_id ?? title}`)}`,
            observedAt: collectedAt,
            publishedAt: Number(question?.creation_date) ? new Date(Number(question.creation_date) * 1000).toISOString() : undefined,
            collectedAt,
            normalizedAt: collectedAt,
            source: { sourceId: `stackexchange-search-${site}`, sourceName: `${site} workspace search`, sourceType: "community", accessMode: "official-api", freshness: "near-live" },
            topic: title,
            entities: [],
            keywords: [...(question?.tags ?? []), query],
            hashtags: [],
            creator: safeText(question?.owner?.display_name) || undefined,
            community: site,
            contentType: "workspace-community-question",
            metrics: { sourceRank: index + 1, native: { score: Number(question?.score) || 0, answers: Number(question?.answer_count) || 0, views: Number(question?.view_count) || 0 } },
            dynamics: {},
            confidence: { score: 0.62, basis: ["Direct Stack Exchange advanced-search response", "Search is workspace-query scoped; specialist-community evidence is not universal consumer attention"] },
            evidence: { sourceUrl: question?.link, externalId: String(question?.question_id ?? title), reference: `${site} workspace search · ${query}` },
          };
          const match = relevance(workspace, signalBase);
          if (match.score >= 2.2) signals.push(annotateSignal(workspace, signalBase, match, `${workspace.id}-stackexchange-search`));
        });
      } catch (error) {
        failures.push({ sourceId: `stackexchange-search-${site}`, query, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  return { signals, failures, attempted: true };
}

function isoDateDaysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

async function collectGitHubSearch(workspace, config, collectedAt) {
  const signals = [];
  const failures = [];
  const since = isoDateDaysAgo(config.lookbackDays ?? 14);
  for (const query of (workspace.queryTerms ?? []).slice(0, 4)) {
    try {
      const q = `\"${query}\" in:name,description,topics created:>=${since} stars:>=${config.minStars ?? 1}`;
      const endpoint = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${Math.min(config.maxRecordsPerQuery ?? 10, 20)}`;
      const headers = { accept: "application/vnd.github+json", "x-github-api-version": "2026-03-10" };
      if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
      const payload = await requestJson(endpoint, headers);
      const items = Array.isArray(payload?.items) ? payload.items : [];
      items.forEach((repo, index) => {
        const title = safeText(`${repo?.full_name ?? ""} ${repo?.description ?? ""}`);
        if (!safePreview(title)) return;
        const signalBase = {
          schemaVersion: "signal.v1",
          id: `workspace-github-${stableId(`${workspace.id}:${repo.id ?? title}`)}`,
          observedAt: collectedAt,
          publishedAt: repo?.created_at,
          collectedAt,
          normalizedAt: collectedAt,
          source: { sourceId: "github-workspace-search", sourceName: "GitHub workspace search", sourceType: "community", accessMode: "official-api", freshness: "hourly" },
          topic: safeText(repo?.full_name),
          entities: repo?.owner?.login ? [safeText(repo.owner.login)] : [],
          keywords: [...(Array.isArray(repo?.topics) ? repo.topics : []), query, ...(repo?.language ? [`programming-${safeText(repo.language)}`] : [])],
          hashtags: [],
          creator: safeText(repo?.owner?.login) || undefined,
          community: "GitHub",
          contentType: "workspace-repository",
          metrics: { sourceRank: index + 1, native: { stars: Number(repo?.stargazers_count) || 0, forks: Number(repo?.forks_count) || 0 } },
          dynamics: {},
          confidence: { score: 0.62, basis: ["Direct GitHub repository search scoped by workspace query", "Repository programming language is preserved as a keyword and is not written into Signal.language"] },
          evidence: { sourceUrl: repo?.html_url, externalId: String(repo?.id ?? title), reference: `GitHub workspace search · ${query} · created since ${since}` },
        };
        const match = relevance(workspace, signalBase);
        if (match.score >= 2.2) signals.push(annotateSignal(workspace, signalBase, match, `${workspace.id}-github-search`));
      });
    } catch (error) {
      failures.push({ sourceId: "github-workspace-search", query, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { signals, failures, attempted: true };
}

function selectBroadSignals(workspace, globalSignals) {
  const allowed = new Set(workspace.collection?.broadSourceIds ?? []);
  const selected = [];
  for (const signal of globalSignals) {
    if (allowed.size && !allowed.has(signal.source?.sourceId)) continue;
    const match = relevance(workspace, signal);
    const sourceNative = signal.contentType === "source-native-social-trend" || signal.contentType === "source-native-community-trend";
    const threshold = sourceNative ? 1.2 : 2.2;
    if (match.score < threshold) continue;
    selected.push(annotateSignal(workspace, signal, match, `${workspace.id}-broad-filtered`));
  }
  return selected;
}

function weakSignalRecords(signals) {
  return [...signals]
    .sort((a, b) => (b.workspaceRelevance?.score ?? 0) - (a.workspaceRelevance?.score ?? 0) || (a.metrics?.sourceRank ?? 999) - (b.metrics?.sourceRank ?? 999))
    .slice(0, 80)
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
      evidenceUrl: signal.evidence?.sourceUrl,
    }));
}

function sourcePlanSummary(workspace, results, broadSignals, deduped) {
  const targeted = results.flatMap((result) => result.signals ?? []);
  const all = [...broadSignals, ...targeted];
  const sourceIds = [...new Set(deduped.map((signal) => signal.source?.sourceId).filter(Boolean))];
  const sourceFamilies = [...new Set(deduped.map((signal) => signal.source?.sourceType).filter(Boolean))];
  const languages = [...new Set(deduped.map((signal) => signal.language).filter(Boolean))];
  const attemptedTargetedSources = results.filter((result) => result.attempted).length;
  const successfulTargetedSources = results.filter((result) => (result.signals ?? []).length > 0).length;
  return {
    schemaVersion: "workspace-collection-plan-result.v1",
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    collectionMode: "workspace-scoped",
    queryTerms: workspace.queryTerms ?? [],
    concepts: workspace.concepts ?? [],
    attemptedTargetedSources,
    successfulTargetedSources,
    activeSourceIds: sourceIds,
    activeSourceFamilies: sourceFamilies,
    languageEvidence: languages,
    broadRelevantCount: broadSignals.length,
    targetedRelevantCount: targeted.length,
    preDedupeRelevantCount: all.length,
    postDedupeRelevantCount: deduped.length,
    sameSourceDuplicateCount: Math.max(0, all.length - deduped.length),
    sourceDiversity: sourceIds.length,
    sourceFamilyDiversity: sourceFamilies.length,
    coverage: {
      workspaceQueryExecuted: attemptedTargetedSources > 0,
      targetedSourceSuccess: successfulTargetedSources,
      hasSocial: sourceFamilies.includes("social"),
      hasCommunity: sourceFamilies.includes("community"),
      hasPublisher: sourceFamilies.includes("publisher") || sourceFamilies.includes("news"),
      hasLocalLanguageEvidence: (workspace.scope?.languages ?? []).some((language) => languages.some((value) => normalize(value).includes(normalize(language)) || normalize(language).includes(normalize(value)))),
    },
  };
}

async function collectWorkspace(workspace, globalSignals, collectedAt) {
  const broadSignals = selectBroadSignals(workspace, globalSignals);
  const targetedConfig = workspace.collection?.targeted ?? {};
  const results = [];
  if (targetedConfig.blueskySearch?.enabled) results.push(await collectBlueskySearch(workspace, targetedConfig.blueskySearch, collectedAt));
  if (targetedConfig.lemmySearch?.enabled) results.push(await collectLemmySearch(workspace, targetedConfig.lemmySearch, collectedAt));
  if (targetedConfig.stackExchangeSearch?.enabled) results.push(await collectStackExchangeSearch(workspace, targetedConfig.stackExchangeSearch, collectedAt));
  if (targetedConfig.githubSearch?.enabled) results.push(await collectGitHubSearch(workspace, targetedConfig.githubSearch, collectedAt));
  const targetedSignals = results.flatMap((result) => result.signals ?? []);
  const { signals: deduped, duplicates } = sameSourceDedupe([...broadSignals, ...targetedSignals]);
  const plan = sourcePlanSummary(workspace, results, broadSignals, deduped);
  plan.sameSourceDuplicateCount = duplicates;
  plan.preDedupeRelevantCount = broadSignals.length + targetedSignals.length;
  const failures = results.flatMap((result) => result.failures ?? []);
  return {
    workspace: { id: workspace.id, name: workspace.name, matchNames: workspace.matchNames ?? [workspace.name], scope: workspace.scope },
    sourcePlan: plan,
    weakSignals: weakSignalRecords(deduped),
    signals: deduped,
    failures,
  };
}

async function main() {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const globalSignals = await loadGlobalSignals();
  if (!globalSignals.length) throw new Error("04E received no global real signals; refusing to fabricate a workspace collection.");
  const collectedAt = new Date().toISOString();
  const workspaces = [];
  for (const workspace of config.workspaces ?? []) {
    if (workspace.status !== "active") continue;
    workspaces.push(await collectWorkspace(workspace, globalSignals, collectedAt));
  }
  if (!workspaces.length) throw new Error("04E has no active runtime workspace configuration.");
  const snapshot = {
    schemaVersion: "workspace-signal-snapshot.v1",
    collectedAt,
    collectionPolicy: { cadence: "twice-daily", scheduleUtc: ["07:17", "19:17"] },
    runtimeWorkspaceCount: workspaces.length,
    globalInputSignalCount: globalSignals.length,
    workspaces,
    notes: [
      "Workspace-scoped collection is generated from a runtime-synced registry readable by GitHub Actions; browser localStorage alone cannot drive scheduled collection.",
      "Broad feeds are filtered by workspace relevance and augmented with targeted public/no-auth queries where available.",
      "Same-source near-duplicate titles are removed before workspace resolution.",
      "Configured multilingual concept aliases are deterministic resolution bridges, not claims of universal machine translation.",
      "Single source-native trends and relevant singleton observations remain visible as weak signals even if they do not form a Trend Candidate."
    ]
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`04E workspace collection built ${workspaces.length} runtime workspace snapshot(s) from ${globalSignals.length} global real signals.`);
  for (const workspace of workspaces) {
    console.log(`- ${workspace.workspace.name}: ${workspace.signals.length} relevant signals · ${workspace.weakSignals.length} weak signals · ${workspace.sourcePlan.sourceDiversity} sources · ${workspace.failures.length} targeted failures`);
  }
  console.log(`Output: ${path.relative(repoRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
