import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const configPath = path.join(repoRoot, "apps/worker/config/stage04b4-permissionless-social.json");
const outputPath = path.join(repoRoot, "apps/web/public/data/permissionless-social-signals.json");
const userAgent = "TrendPulse/0.4B4 (https://github.com/kavie-cmyk/trend-pulse; personal private non-commercial prototype)";

// Conservative preview filter: persist only bounded topic/title metadata suitable for the deployed preview.
const previewRestrictedTerms = /(^|[ _#-])(porn|pornography|hentai|xxx|onlyfans|suicide|self[- ]?harm|casino|betting|sportsbook|cocaine|meth|heroin|fentanyl|firearm|gun sale|weapon sale)([ _#-]|$)/i;

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

function isoOrUndefined(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
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
    return { payload: JSON.parse(text), headers: response.headers, endpoint };
  } catch (error) {
    if (error instanceof Error && Number(error.status) >= 400 && Number(error.status) < 500) throw error;
    const args = [
      "--fail-with-body",
      "--location",
      "--silent",
      "--show-error",
      "--retry", "2",
      "--retry-delay", "1",
      "--connect-timeout", "15",
      "--max-time", "45",
      "--user-agent", userAgent,
      "--header", "accept: application/json",
    ];
    for (const [key, value] of Object.entries(headers)) args.push("--header", `${key}: ${value}`);
    args.push(endpoint);
    const { stdout } = await execFileAsync("curl", args, { maxBuffer: 20 * 1024 * 1024 });
    return { payload: JSON.parse(stdout), headers: new Headers(), endpoint };
  }
}

function sourceBatch({ sourceId, scopeLabel, query, effectiveFreshness, signals, collectedAt, note }) {
  return {
    schemaVersion: "signal-batch.v1",
    sourceId,
    scopeLabel,
    collectionScope: {
      id: `${sourceId}-permissionless-social`,
      mode: "broad-source-feed",
      geographies: [],
      languages: [],
      industries: [],
      categories: [],
      note: note ?? "Permissionless/public source snapshot. Workspace applicability is evaluated separately by Source Planner.",
    },
    refreshPolicy: {
      mode: "scheduled",
      cadence: "twice-daily",
      scheduleLabel: "Global V1 policy · 07:17 UTC + 19:17 UTC",
      updateNow: "runtime-required",
    },
    collectedAt,
    query,
    timespan: "current source snapshot",
    effectiveFreshness,
    count: signals.length,
    signals,
  };
}

function sumMastodonHistory(history, key) {
  return (Array.isArray(history) ? history : []).reduce((sum, item) => sum + (Number(item?.[key]) || 0), 0);
}

async function collectMastodon(instance, collectedAt) {
  const limit = Math.min(instance.maxRecords ?? 20, 20);
  const endpoint = `${instance.baseUrl.replace(/\/$/, "")}/api/v1/trends/tags?limit=${limit}`;
  const { payload } = await requestJson(endpoint);
  if (!Array.isArray(payload)) throw new Error("Mastodon trends response was not an array.");
  const signals = payload
    .filter((tag) => safePreview(tag?.name))
    .slice(0, limit)
    .map((tag, index) => {
      const name = safeText(tag.name);
      return {
        schemaVersion: "signal.v1",
        id: `mastodon-${stableId(`${instance.id}:${name}`)}`,
        collectionScopeId: `${instance.id}-permissionless-social`,
        observedAt: collectedAt,
        collectedAt,
        normalizedAt: collectedAt,
        source: {
          sourceId: instance.id,
          sourceName: `${instance.name} Trends`,
          sourceType: "social",
          accessMode: "official-api",
          freshness: "near-live",
        },
        topic: `#${name}`,
        entities: [],
        keywords: [name],
        hashtags: [name],
        community: instance.name,
        contentType: "source-native-social-trend",
        metrics: {
          sourceRank: index + 1,
          native: {
            uses7d: sumMastodonHistory(tag.history, "uses"),
            accounts7d: sumMastodonHistory(tag.history, "accounts"),
          },
        },
        dynamics: {},
        confidence: {
          score: 0.72,
          basis: [
            "Direct public Mastodon trends/tags API response",
            "Seven-day use/account history is source-native to the selected instance",
            "Instance-local federation and moderation mean this is not a global Trend Pulse conclusion",
          ],
        },
        evidence: {
          sourceUrl: tag.url || `${instance.baseUrl.replace(/\/$/, "")}/tags/${encodeURIComponent(name)}`,
          externalId: name,
          reference: `${instance.name} trending tag #${index + 1}`,
        },
      };
    });
  if (!signals.length) throw new Error(`Mastodon collector returned no preview-safe tags for ${instance.name}.`);
  return sourceBatch({
    sourceId: instance.id,
    scopeLabel: `${instance.name} · public trending tags`,
    query: "/api/v1/trends/tags · OAuth Public",
    effectiveFreshness: "near-live",
    signals,
    collectedAt,
    note: "Instance-scoped Mastodon trend snapshot; federation coverage differs by instance.",
  });
}

async function requestLemmyPosts(instance, maxRecords) {
  const base = instance.baseUrl.replace(/\/$/, "");
  const attempts = [
    `${base}/api/v4/post/list?sort=hot&type_=all&limit=${maxRecords}`,
    `${base}/api/v3/post/list?sort=Hot&type_=All&limit=${maxRecords}`,
  ];
  let lastError;
  for (const endpoint of attempts) {
    try {
      const result = await requestJson(endpoint);
      const posts = Array.isArray(result.payload?.posts) ? result.payload.posts : [];
      if (posts.length) return { posts, endpoint };
      lastError = new Error(`No posts in ${endpoint}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("No compatible Lemmy read endpoint returned posts.");
}

async function collectLemmy(instance, collectedAt) {
  const maxRecords = Math.min(instance.maxRecords ?? 20, 50);
  const { posts, endpoint } = await requestLemmyPosts(instance, maxRecords);
  const signals = posts
    .filter((view) => safePreview(view?.post?.name || view?.post?.title))
    .slice(0, maxRecords)
    .map((view, index) => {
      const post = view.post ?? {};
      const counts = view.counts ?? {};
      const community = view.community ?? {};
      const creator = view.creator ?? {};
      const title = safeText(post.name || post.title);
      return {
        schemaVersion: "signal.v1",
        id: `lemmy-${stableId(`${instance.id}:${post.id ?? title}`)}`,
        collectionScopeId: `${instance.id}-permissionless-social`,
        observedAt: collectedAt,
        publishedAt: isoOrUndefined(post.published || post.published_at),
        collectedAt,
        normalizedAt: collectedAt,
        source: {
          sourceId: instance.id,
          sourceName: `${instance.name} Public API`,
          sourceType: "community",
          accessMode: "official-api",
          freshness: "near-live",
        },
        topic: title,
        entities: [],
        keywords: [],
        hashtags: [],
        creator: safeText(creator.name) || undefined,
        community: safeText(community.title || community.name || instance.name),
        contentType: "community-post",
        metrics: {
          sourceRank: index + 1,
          native: {
            score: Number(counts.score) || 0,
            comments: Number(counts.comments) || 0,
            upvotes: Number(counts.upvotes) || 0,
            downvotes: Number(counts.downvotes) || 0,
          },
        },
        dynamics: {},
        confidence: {
          score: 0.62,
          basis: [
            "Direct public Lemmy read API response",
            "Ranking and vote/comment counts are source-native to the selected instance/federation view",
            "Raw community post metrics remain non-comparable with other platforms",
          ],
        },
        evidence: {
          sourceUrl: post.ap_id || post.url || `${instance.baseUrl.replace(/\/$/, "")}/post/${post.id}`,
          externalId: String(post.id ?? title),
          reference: `${instance.name} hot post #${index + 1}`,
        },
      };
    });
  if (!signals.length) throw new Error(`Lemmy collector returned no preview-safe posts for ${instance.name}.`);
  return sourceBatch({
    sourceId: instance.id,
    scopeLabel: `${instance.name} · public hot community posts`,
    query: endpoint.includes("/api/v4/") ? "/api/v4/post/list · sort=hot" : "/api/v3/post/list · sort=Hot",
    effectiveFreshness: "near-live",
    signals,
    collectedAt,
    note: "Instance/federation-scoped Lemmy community snapshot; not a universal social sample.",
  });
}

async function collectForem(instance, collectedAt) {
  const limit = Math.min(instance.maxRecords ?? 20, 100);
  const endpoint = `${instance.baseUrl.replace(/\/$/, "")}/api/trends?per_page=${limit}`;
  const { payload } = await requestJson(endpoint, { accept: "application/vnd.forem.api-v1+json" });
  if (!Array.isArray(payload)) throw new Error("Forem trends response was not an array.");
  const signals = payload
    .filter((trend) => safePreview(trend?.name))
    .slice(0, limit)
    .map((trend, index) => {
      const name = safeText(trend.name);
      const slug = safeText(trend.slug);
      return {
        schemaVersion: "signal.v1",
        id: `forem-${stableId(`${instance.id}:${trend.id ?? slug ?? name}`)}`,
        collectionScopeId: `${instance.id}-permissionless-social`,
        observedAt: collectedAt,
        publishedAt: isoOrUndefined(trend.first_observed_at),
        collectedAt,
        normalizedAt: collectedAt,
        source: {
          sourceId: instance.id,
          sourceName: `${instance.name} Trends API`,
          sourceType: "community",
          accessMode: "official-api",
          freshness: "near-live",
        },
        topic: name,
        entities: [],
        keywords: slug ? [slug] : [],
        hashtags: [],
        community: instance.name,
        contentType: "source-native-community-trend",
        metrics: {
          sourceRank: index + 1,
          native: {
            score: Number(trend.score) || 0,
            articlesCount: Number(trend.articles_count) || 0,
          },
        },
        dynamics: {},
        confidence: {
          score: 0.74,
          basis: [
            "Direct public Forem v1 Trends endpoint without authentication",
            "Forem documents its trend score as reflecting community volume and engagement",
            "Forem trend score remains source-native and is not a cross-platform Virality score",
          ],
        },
        evidence: {
          sourceUrl: slug ? `${instance.baseUrl.replace(/\/$/, "")}/t/${encodeURIComponent(slug)}` : instance.baseUrl,
          externalId: String(trend.id ?? slug ?? name),
          reference: `${instance.name} trend #${index + 1}`,
        },
      };
    });
  if (!signals.length) throw new Error(`Forem collector returned no preview-safe trends for ${instance.name}.`);
  return sourceBatch({
    sourceId: instance.id,
    scopeLabel: `${instance.name} · public semantic trends`,
    query: "/api/trends · public no-auth",
    effectiveFreshness: "near-live",
    signals,
    collectedAt,
  });
}

async function collectStackExchange(siteConfig, collectedAt) {
  const limit = Math.min(siteConfig.maxRecords ?? 20, 100);
  const endpoint = `https://api.stackexchange.com/2.3/questions?site=${encodeURIComponent(siteConfig.site)}&sort=hot&order=desc&pagesize=${limit}`;
  const { payload } = await requestJson(endpoint);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const signals = items
    .filter((question) => safePreview(question?.title))
    .slice(0, limit)
    .map((question, index) => {
      const title = safeText(question.title);
      const tags = Array.isArray(question.tags) ? question.tags.map(safeText).filter(Boolean) : [];
      return {
        schemaVersion: "signal.v1",
        id: `stackexchange-${stableId(`${siteConfig.id}:${question.question_id ?? title}`)}`,
        collectionScopeId: `${siteConfig.id}-permissionless-social`,
        observedAt: collectedAt,
        publishedAt: Number(question.creation_date) ? new Date(Number(question.creation_date) * 1000).toISOString() : undefined,
        collectedAt,
        normalizedAt: collectedAt,
        source: {
          sourceId: siteConfig.id,
          sourceName: `${siteConfig.name} API`,
          sourceType: "community",
          accessMode: "official-api",
          freshness: "near-live",
        },
        topic: title,
        entities: [],
        keywords: tags,
        hashtags: [],
        creator: safeText(question.owner?.display_name) || undefined,
        community: siteConfig.name,
        contentType: "community-question",
        metrics: {
          sourceRank: index + 1,
          native: {
            score: Number(question.score) || 0,
            answers: Number(question.answer_count) || 0,
            views: Number(question.view_count) || 0,
          },
        },
        dynamics: {},
        confidence: {
          score: 0.68,
          basis: [
            "Direct public Stack Exchange API hot-question ordering",
            "Question score/answers/views are source-native specialist-community metrics",
            "The configured Stack Overflow site represents developer demand, not universal consumer attention",
          ],
        },
        evidence: {
          sourceUrl: question.link,
          externalId: String(question.question_id ?? title),
          reference: `${siteConfig.name} hot question #${index + 1}`,
        },
      };
    });
  if (!signals.length) throw new Error(`Stack Exchange collector returned no preview-safe questions for ${siteConfig.name}.`);
  return sourceBatch({
    sourceId: siteConfig.id,
    scopeLabel: `${siteConfig.name} · public hot questions`,
    query: `/2.3/questions · site=${siteConfig.site} · sort=hot`,
    effectiveFreshness: "near-live",
    signals,
    collectedAt,
  });
}

async function main() {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const collectedAt = new Date().toISOString();
  const batches = [];
  const failures = [];
  const connectorStates = [];

  const runCollectors = async (kind, entries, collector) => {
    for (const entry of entries ?? []) {
      try {
        const batch = await collector(entry, collectedAt);
        batches.push(batch);
        connectorStates.push({ sourceId: entry.id, family: kind, state: "operational", access: "public-no-auth", note: "Runtime verified on this collection cycle." });
      } catch (error) {
        failures.push({ sourceId: entry.id, family: kind, required: false, error: error instanceof Error ? error.message : String(error) });
        connectorStates.push({ sourceId: entry.id, family: kind, state: "runtime-deferred", access: "public-no-auth-on-paper", note: "Public path researched, but this runtime collection failed; not promoted to operational." });
      }
    }
  };

  if (config.mastodon?.enabled) await runCollectors("mastodon", config.mastodon.instances, collectMastodon);
  if (config.lemmy?.enabled) await runCollectors("lemmy", config.lemmy.instances, collectLemmy);
  if (config.forem?.enabled) await runCollectors("forem", config.forem.instances, collectForem);
  if (config.stackExchange?.enabled) await runCollectors("stack-exchange", config.stackExchange.sites, collectStackExchange);

  connectorStates.push({
    sourceId: "nostr-public-relays",
    family: "nostr",
    state: config.nostr?.state ?? "runtime-deferred",
    access: "open-protocol-variable-relays",
    note: config.nostr?.note ?? "Nostr relay access and moderation vary; not activated in this stage.",
  });

  const minimum = Number(config.minimumOperationalSources) || 3;
  if (batches.length < minimum) {
    throw new Error(`Permissionless social gate failed: ${batches.length} operational source batches, minimum ${minimum}. ${failures.map((failure) => `${failure.sourceId}: ${failure.error}`).join(" | ")}`);
  }

  const snapshot = {
    schemaVersion: "permissionless-social-snapshot.v1",
    collectedAt,
    collectionPolicy: { cadence: "twice-daily", scheduleUtc: ["07:17", "19:17"] },
    minimumOperationalSources: minimum,
    sourceCount: batches.length,
    observationCount: batches.reduce((sum, batch) => sum + batch.count, 0),
    batches,
    connectorStates,
    failures,
    notes: [
      "04B-4 prioritizes public/free/no-approval read paths before access-gated social networks.",
      "Public source does not mean globally representative; instance/community bias remains explicit.",
      "All ACTIVE source batches follow the locked twice-daily V1 collection policy.",
      "Only bounded topic/title metadata passes the conservative preview filter before persistence/display.",
      "No source-native metric is converted into Trend Pulse Virality at collection time.",
    ],
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Permissionless social collected ${snapshot.observationCount} observations from ${snapshot.sourceCount} operational source batches.`);
  for (const batch of batches) console.log(`- ${batch.sourceId}: ${batch.count}`);
  if (failures.length) console.log(`Runtime-deferred notes: ${failures.map((failure) => `${failure.sourceId}: ${failure.error}`).join(" | ")}`);
  console.log(`Output: ${path.relative(repoRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
