import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const configPath = path.join(repoRoot, "apps/worker/config/stage04b2-backbone.json");
const outputPath = path.join(repoRoot, "apps/web/public/data/backbone-signals.json");
const userAgent = "TrendPulse/0.4B2 (https://github.com/kavie-cmyk/trend-pulse; free-first research prototype)";
const previewExplicitTerms = /(^|[ _-])(porn|pornography|hentai|xxx|onlyfans|sexual intercourse|sex position)([ _-]|$)/i;

function stableId(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 18);
}

function safeText(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeXml(value) {
  return String(value ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

function tagValue(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? safeText(decodeXml(match[1])) : "";
}

function atomLink(block) {
  const alternate = block.match(/<link\s+[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  if (alternate) return decodeXml(alternate[1]);
  const generic = block.match(/<link\s+[^>]*href=["']([^"']+)["'][^>]*>/i);
  return generic ? decodeXml(generic[1]) : "";
}

function parseFeed(xml) {
  const itemBlocks = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
  if (itemBlocks.length) {
    return itemBlocks.map((block) => ({
      title: tagValue(block, "title"),
      link: tagValue(block, "link"),
      publishedAt: tagValue(block, "pubDate") || tagValue(block, "dc:date"),
      guid: tagValue(block, "guid"),
      creator: tagValue(block, "dc:creator") || tagValue(block, "author"),
    }));
  }

  const entryBlocks = [...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)].map((m) => m[1]);
  return entryBlocks.map((block) => ({
    title: tagValue(block, "title"),
    link: atomLink(block),
    publishedAt: tagValue(block, "published") || tagValue(block, "updated"),
    guid: tagValue(block, "id"),
    creator: tagValue(block, "name") || tagValue(block, "author"),
  }));
}

function isoOrFallback(value, fallback) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function isPreviewSafe(value) {
  return value && !previewExplicitTerms.test(String(value));
}

async function requestText(endpoint, headers = {}) {
  try {
    const response = await fetch(endpoint, {
      headers: { "user-agent": userAgent, ...headers },
      signal: AbortSignal.timeout(20000),
    });
    const text = await response.text();
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${text.slice(0, 220)}`);
      error.status = response.status;
      throw error;
    }
    return { text, headers: response.headers };
  } catch (error) {
    if (error instanceof Error && Number(error.status) >= 400 && Number(error.status) < 500) throw error;
    console.warn(`Node fetch failed for ${endpoint}; retrying with curl. ${error instanceof Error ? error.message : String(error)}`);
    const args = ["--fail-with-body", "--location", "--silent", "--show-error", "--retry", "2", "--retry-delay", "1", "--connect-timeout", "15", "--max-time", "45", "--user-agent", userAgent];
    for (const [key, value] of Object.entries(headers)) args.push("--header", `${key}: ${value}`);
    args.push(endpoint);
    const { stdout } = await execFileAsync("curl", args, { maxBuffer: 20 * 1024 * 1024 });
    return { text: stdout, headers: new Headers() };
  }
}

function sourceBatch({ sourceId, scopeLabel, query, effectiveFreshness, signals, collectedAt }) {
  return {
    schemaVersion: "signal-batch.v1",
    sourceId,
    scopeLabel,
    collectionScope: {
      id: `${sourceId}-global-backbone`,
      mode: "broad-source-feed",
      geographies: [],
      languages: [],
      industries: [],
      categories: [],
      note: "Global backbone collection. Workspace applicability is evaluated separately by Source Planner.",
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

async function collectHackerNews(config, collectedAt) {
  if (!config.enabled) return null;
  const listEndpoint = `https://hacker-news.firebaseio.com/v0/${config.storySet ?? "topstories"}.json`;
  const { text } = await requestText(listEndpoint, { accept: "application/json" });
  const ids = JSON.parse(text).slice(0, config.maxRecords ?? 30);
  const items = await Promise.all(ids.map(async (id, index) => {
    const response = await requestText(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { accept: "application/json" });
    const item = JSON.parse(response.text);
    return { item, sourceRank: index + 1 };
  }));

  const signals = items
    .filter(({ item }) => item?.type === "story" && isPreviewSafe(item?.title))
    .map(({ item, sourceRank }) => ({
      schemaVersion: "signal.v1",
      id: `hn-${item.id}`,
      collectionScopeId: "hacker-news-api-global-backbone",
      observedAt: isoOrFallback(Number(item.time) * 1000, collectedAt),
      publishedAt: isoOrFallback(Number(item.time) * 1000, collectedAt),
      collectedAt,
      normalizedAt: collectedAt,
      source: {
        sourceId: "hacker-news-api",
        sourceName: "Hacker News API",
        sourceType: "community",
        accessMode: "official-api",
        freshness: "near-live",
      },
      language: "English",
      topic: safeText(item.title),
      entities: [],
      keywords: [],
      hashtags: [],
      creator: item.by || undefined,
      community: "Hacker News",
      contentType: "community-story",
      metrics: {
        comments: Number(item.descendants) || undefined,
        sourceRank,
        native: { points: Number(item.score) || 0 },
      },
      dynamics: {},
      confidence: {
        score: 0.6,
        basis: [
          "Direct story/ranking data from the official Hacker News Firebase API",
          "Single-source community observation; not a corroborated trend",
          "Native HN points are preserved but must not be compared directly with other platforms",
        ],
      },
      evidence: {
        sourceUrl: `https://news.ycombinator.com/item?id=${item.id}`,
        externalId: String(item.id),
        reference: `HN top rank #${sourceRank} · ${Number(item.score) || 0} points · ${Number(item.descendants) || 0} comments`,
      },
    }));

  if (!signals.length) throw new Error("Hacker News collector returned no preview-safe stories.");
  return sourceBatch({
    sourceId: "hacker-news-api",
    scopeLabel: "Global technology/community attention · Hacker News",
    query: config.storySet ?? "topstories",
    effectiveFreshness: "near-live",
    signals,
    collectedAt,
  });
}

function isoDateDaysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

async function collectGitHub(config, collectedAt) {
  if (!config.enabled) return null;
  const since = isoDateDaysAgo(config.lookbackDays ?? 7);
  const q = `created:>=${since} stars:>=${config.minStars ?? 5}`;
  const endpoint = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${config.maxRecords ?? 30}`;
  const headers = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2026-03-10",
  };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const { text, headers: responseHeaders } = await requestText(endpoint, headers);
  const payload = JSON.parse(text);
  const items = Array.isArray(payload.items) ? payload.items : [];

  const signals = items
    .filter((repo) => isPreviewSafe(repo?.full_name) && isPreviewSafe(repo?.description ?? "safe"))
    .map((repo, index) => ({
      schemaVersion: "signal.v1",
      id: `github-${stableId(String(repo.id))}`,
      collectionScopeId: "github-rest-api-global-backbone",
      observedAt: collectedAt,
      publishedAt: isoOrFallback(repo.created_at, collectedAt),
      collectedAt,
      normalizedAt: collectedAt,
      source: {
        sourceId: "github-rest-api",
        sourceName: "GitHub REST API",
        sourceType: "community",
        accessMode: "official-api",
        freshness: "hourly",
      },
      language: repo.language || undefined,
      topic: repo.full_name,
      entities: repo.owner?.login ? [repo.owner.login] : [],
      keywords: Array.isArray(repo.topics) ? repo.topics : [],
      hashtags: [],
      creator: repo.owner?.login || undefined,
      community: "GitHub",
      contentType: "repository",
      metrics: {
        sourceRank: index + 1,
        native: {
          stars: Number(repo.stargazers_count) || 0,
          forks: Number(repo.forks_count) || 0,
          openIssues: Number(repo.open_issues_count) || 0,
        },
      },
      dynamics: {},
      confidence: {
        score: 0.65,
        basis: [
          "Direct public repository metadata from the official GitHub REST API",
          "Discovery window is newly created repositories ordered by stars",
          "Stars/forks are source-native metrics and must not be compared directly with views, likes or HN points",
        ],
      },
      evidence: {
        sourceUrl: repo.html_url,
        externalId: String(repo.id),
        reference: `GitHub emerging repo rank #${index + 1} · ${Number(repo.stargazers_count) || 0} stars · created ${repo.created_at}`,
      },
    }));

  if (!signals.length) throw new Error("GitHub collector returned no usable repositories.");
  const remaining = responseHeaders.get?.("x-ratelimit-remaining");
  if (remaining) console.log(`GitHub API remaining search/core budget header: ${remaining}`);

  return sourceBatch({
    sourceId: "github-rest-api",
    scopeLabel: "Global developer-ecosystem breakout discovery · GitHub",
    query: `${config.queryLabel ?? "new repositories"} · ${q}`,
    effectiveFreshness: "hourly",
    signals,
    collectedAt,
  });
}

async function collectRssFeed(feed, collectedAt) {
  const { text } = await requestText(feed.url, { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" });
  const entries = parseFeed(text)
    .filter((entry) => entry.title && isPreviewSafe(entry.title))
    .slice(0, feed.maxRecords ?? 20);
  if (!entries.length) throw new Error(`No RSS/Atom entries parsed for ${feed.name}`);

  const signals = entries.map((entry, index) => ({
    schemaVersion: "signal.v1",
    id: `rss-${stableId(`${feed.id}:${entry.guid || entry.link || entry.title}`)}`,
    collectionScopeId: `${feed.id}-global-backbone`,
    observedAt: collectedAt,
    publishedAt: isoOrFallback(entry.publishedAt, collectedAt),
    collectedAt,
    normalizedAt: collectedAt,
    source: {
      sourceId: feed.id,
      sourceName: feed.name,
      sourceType: feed.sourceType ?? "publisher",
      accessMode: "rss",
      freshness: "hourly",
    },
    language: feed.language || undefined,
    topic: entry.title,
    entities: [],
    keywords: [],
    hashtags: [],
    creator: entry.creator || undefined,
    contentType: "publisher-article",
    metrics: { sourceRank: index + 1 },
    dynamics: {},
    confidence: {
      score: 0.6,
      basis: [
        "Publisher-provided RSS/Atom metadata and canonical link",
        "No engagement metric is fabricated when the feed does not provide one",
        "Single-publisher observation; not a corroborated trend",
      ],
    },
    evidence: {
      sourceUrl: entry.link || feed.homepage,
      externalId: entry.guid || entry.link || entry.title,
      reference: `${feed.name} · feed item #${index + 1}${entry.publishedAt ? ` · published ${entry.publishedAt}` : ""}`,
    },
  }));

  return sourceBatch({
    sourceId: feed.id,
    scopeLabel: `${feed.name} · publisher RSS/Atom feed`,
    query: `publisher feed · ${(feed.industries ?? []).join(" + ")}`,
    effectiveFreshness: "hourly",
    signals,
    collectedAt,
  });
}

async function main() {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const collectedAt = new Date().toISOString();
  const batches = [];
  const failures = [];

  try {
    const batch = await collectHackerNews(config.hackerNews ?? {}, collectedAt);
    if (batch) batches.push(batch);
  } catch (error) {
    failures.push({ sourceId: "hacker-news-api", required: true, error: error instanceof Error ? error.message : String(error) });
  }

  try {
    const batch = await collectGitHub(config.github ?? {}, collectedAt);
    if (batch) batches.push(batch);
  } catch (error) {
    failures.push({ sourceId: "github-rest-api", required: true, error: error instanceof Error ? error.message : String(error) });
  }

  for (const feed of config.rssFeeds ?? []) {
    try {
      batches.push(await collectRssFeed(feed, collectedAt));
    } catch (error) {
      failures.push({ sourceId: feed.id, required: Boolean(feed.required), error: error instanceof Error ? error.message : String(error) });
    }
  }

  const requiredFailures = failures.filter((failure) => failure.required);
  if (requiredFailures.length) {
    throw new Error(`Required backbone source failure(s): ${requiredFailures.map((f) => `${f.sourceId}: ${f.error}`).join(" | ")}`);
  }
  if (batches.length < 3) throw new Error(`Only ${batches.length} backbone source batches succeeded; refusing to publish a weak/fake backbone snapshot.`);

  const snapshot = {
    schemaVersion: "source-backbone-snapshot.v1",
    collectedAt,
    collectionPolicy: config.collectionPolicy,
    sourceCount: batches.length,
    observationCount: batches.reduce((sum, batch) => sum + batch.count, 0),
    batches,
    failures,
    notes: [
      "Every active source is invoked twice daily under Global Refresh Policy V1.",
      "Native source freshness is preserved separately from collection cadence.",
      "These are real source observations, not yet corroborated Trend Candidates.",
    ],
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Backbone collected ${snapshot.observationCount} real observations from ${snapshot.sourceCount} source batches.`);
  for (const batch of batches) console.log(`- ${batch.sourceId}: ${batch.count}`);
  for (const failure of failures) console.warn(`Optional/source failure: ${failure.sourceId} · ${failure.error}`);
  console.log(`Output: ${path.relative(repoRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
