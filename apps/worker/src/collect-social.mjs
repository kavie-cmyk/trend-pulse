import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const configPath = path.join(repoRoot, "apps/worker/config/stage04b3-social.json");
const outputPath = path.join(repoRoot, "apps/web/public/data/social-signals.json");
const userAgent = "TrendPulse/0.4B3 (https://github.com/kavie-cmyk/trend-pulse; personal private non-commercial prototype)";

// The deployed preview is intentionally conservative because it can be viewed by a minor.
const previewRestrictedTerms = /(^|[ _#-])(porn|pornography|hentai|xxx|onlyfans|suicide|self[- ]?harm|casino|betting|sportsbook|cocaine|meth|heroin|fentanyl|firearm|gun sale|weapon sale)([ _#-]|$)/i;

function stableId(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 18);
}

function safeText(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function safePreview(value) {
  const text = safeText(value);
  return Boolean(text) && !previewRestrictedTerms.test(text);
}

async function requestJson(endpoint, headers = {}) {
  const response = await fetch(endpoint, {
    headers: { accept: "application/json", "user-agent": userAgent, ...headers },
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 220)}`);
  return { payload: JSON.parse(text), headers: response.headers };
}

function sourceBatch({ sourceId, scopeLabel, query, effectiveFreshness, signals, collectedAt }) {
  return {
    schemaVersion: "signal-batch.v1",
    sourceId,
    scopeLabel,
    collectionScope: {
      id: `${sourceId}-global-social`,
      mode: "broad-source-feed",
      geographies: [],
      languages: [],
      industries: [],
      categories: [],
      note: "Global/social source snapshot. Workspace applicability is evaluated separately by Source Planner.",
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

function blueskyEvidenceUrl(link) {
  if (!link) return "https://bsky.app/";
  if (/^https?:\/\//i.test(link)) return link;
  return `https://bsky.app${link.startsWith("/") ? "" : "/"}${link}`;
}

async function collectBluesky(config, collectedAt) {
  if (!config.enabled) return null;
  const endpoint = `https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrends?limit=${Math.min(config.maxRecords ?? 25, 25)}`;
  const { payload } = await requestJson(endpoint);
  const trends = Array.isArray(payload.trends) ? payload.trends : [];
  const signals = trends
    .filter((trend) => safePreview(trend?.displayName || trend?.topic))
    .map((trend, index) => {
      const label = safeText(trend.displayName || trend.topic);
      const actors = Array.isArray(trend.actors)
        ? trend.actors.map((actor) => safeText(actor?.handle || actor?.did)).filter(Boolean).slice(0, 6)
        : [];
      const postCount = Number(trend.postCount);
      const startedAt = trend.startedAt && !Number.isNaN(new Date(trend.startedAt).getTime()) ? new Date(trend.startedAt).toISOString() : undefined;
      return {
        schemaVersion: "signal.v1",
        id: `bluesky-${stableId(`${trend.topic || label}:${trend.startedAt || "current"}`)}`,
        collectionScopeId: "bluesky-trends-api-global-social",
        observedAt: collectedAt,
        publishedAt: startedAt,
        collectedAt,
        normalizedAt: collectedAt,
        source: {
          sourceId: "bluesky-trends-api",
          sourceName: "Bluesky public AppView trends",
          sourceType: "social",
          accessMode: "official-api",
          freshness: "near-live",
        },
        topic: label,
        entities: actors,
        keywords: [safeText(trend.category), safeText(trend.status)].filter(Boolean),
        hashtags: label.startsWith("#") ? [label.slice(1)] : [],
        contentType: "source-native-social-trend",
        metrics: {
          sourceRank: index + 1,
          native: Number.isFinite(postCount) ? { postCount } : {},
        },
        dynamics: {},
        confidence: {
          score: 0.7,
          basis: [
            "Direct public Bluesky AppView trending endpoint with no authentication required",
            "Trend status and post count are source-native Bluesky signals, not a Trend Pulse cross-source conclusion",
            "Workspace relevance, geography and cross-source corroboration are not inferred at collection time",
          ],
        },
        evidence: {
          sourceUrl: blueskyEvidenceUrl(trend.link),
          externalId: safeText(trend.topic || label),
          reference: `Bluesky trend #${index + 1}${Number.isFinite(postCount) ? ` · ${postCount} posts` : ""}${trend.status ? ` · ${trend.status}` : ""}${trend.category ? ` · ${trend.category}` : ""}`,
        },
      };
    });

  if (!signals.length) throw new Error("Bluesky trending endpoint returned no preview-safe trends.");
  return sourceBatch({
    sourceId: "bluesky-trends-api",
    scopeLabel: "Bluesky · public source-native trending topics",
    query: "app.bsky.unspecced.getTrends · public AppView",
    effectiveFreshness: "near-live",
    signals,
    collectedAt,
  });
}

async function collectYouTube(config, collectedAt) {
  if (!config.enabled) return { batch: null, state: "disabled", note: "YouTube collection disabled by config." };
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return {
      batch: null,
      state: "ready-needs-credential",
      note: "Connector code is ready, but no valid YOUTUBE_API_KEY is present in the runtime. No credential is exposed to the browser.",
    };
  }

  const signals = [];
  for (const region of config.regions ?? ["US"]) {
    const endpoint = new URL("https://www.googleapis.com/youtube/v3/videos");
    endpoint.searchParams.set("part", "snippet,statistics");
    endpoint.searchParams.set("chart", "mostPopular");
    endpoint.searchParams.set("regionCode", region);
    endpoint.searchParams.set("maxResults", String(Math.min(config.maxRecordsPerRegion ?? 15, 50)));
    endpoint.searchParams.set("key", key);
    const { payload } = await requestJson(endpoint.toString());
    const items = Array.isArray(payload.items) ? payload.items : [];
    items.forEach((video, index) => {
      const title = safeText(video?.snippet?.title);
      if (!safePreview(title)) return;
      const stats = video.statistics ?? {};
      signals.push({
        schemaVersion: "signal.v1",
        id: `youtube-${stableId(`${region}:${video.id}`)}`,
        collectionScopeId: "youtube-data-api-global-social",
        observedAt: collectedAt,
        publishedAt: video?.snippet?.publishedAt,
        collectedAt,
        normalizedAt: collectedAt,
        source: {
          sourceId: "youtube-data-api",
          sourceName: "YouTube Data API",
          sourceType: "video",
          accessMode: "official-api",
          freshness: "hourly",
        },
        geography: region,
        language: video?.snippet?.defaultLanguage || video?.snippet?.defaultAudioLanguage || undefined,
        topic: title,
        entities: video?.snippet?.channelTitle ? [safeText(video.snippet.channelTitle)] : [],
        keywords: [],
        hashtags: [],
        creator: safeText(video?.snippet?.channelTitle) || undefined,
        community: "YouTube",
        contentType: "video-chart-observation",
        metrics: {
          sourceRank: index + 1,
          native: {
            views: Number(stats.viewCount) || 0,
            likes: Number(stats.likeCount) || 0,
            comments: Number(stats.commentCount) || 0,
          },
        },
        dynamics: {},
        confidence: {
          score: 0.65,
          basis: [
            "Direct YouTube Data API video chart metadata and native statistics",
            "Since July 2025 the mostPopular chart no longer represents a broad Trending page and is concentrated in Music, Movies and Gaming",
            "This is source-native evidence only; raw views/likes are not cross-platform comparable",
          ],
        },
        evidence: {
          sourceUrl: `https://www.youtube.com/watch?v=${video.id}`,
          externalId: String(video.id),
          reference: `YouTube mostPopular ${region} rank #${index + 1}`,
        },
      });
    });
  }

  if (!signals.length) throw new Error("YouTube connector had a credential but returned no preview-safe observations.");
  return {
    batch: sourceBatch({
      sourceId: "youtube-data-api",
      scopeLabel: "YouTube · source-native mostPopular chart observations",
      query: `regions ${(config.regions ?? ["US"]).join(", ")} · chart=mostPopular`,
      effectiveFreshness: "hourly",
      signals,
      collectedAt,
    }),
    state: "operational",
    note: "Valid runtime credential present; collection succeeded.",
  };
}

async function main() {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const collectedAt = new Date().toISOString();
  const batches = [];
  const failures = [];
  const connectorStates = [
    {
      sourceId: "bluesky-trends-api",
      state: "operational-target",
      access: "public-no-auth",
      note: "Official Bluesky public AppView endpoints can be called without authentication; runtime must still verify collection.",
    },
    {
      sourceId: "youtube-data-api",
      state: "ready-needs-credential",
      access: "official-api-key",
      note: "Connector is wired but cannot become ACTIVE without a valid runtime credential.",
    },
    {
      sourceId: "reddit-data-api",
      state: "access-constrained",
      access: "registration-oauth",
      note: "Current Reddit Data API terms require registration, OAuth identity and eligibility to accept the terms; not activated in this runtime.",
    },
    {
      sourceId: "tiktok-research-tools",
      state: "restricted-eligibility",
      access: "approved-researcher-only",
      note: "Personal/non-commercial use alone does not satisfy TikTok Research Tools eligibility.",
    },
    {
      sourceId: "tiktok-creative-center",
      state: "manual-assisted",
      access: "public-ui",
      note: "Useful social/creative intelligence surface; no undocumented automation path is assumed.",
    },
    {
      sourceId: "meta-ad-library",
      state: "manual-assisted",
      access: "public-ui",
      note: "Use as paid creative/competitor evidence, not as proof of organic virality.",
    },
    { sourceId: "threads-organic", state: "research-pending", access: "platform-api-review", note: "Do not activate until current official read/search scope is verified." },
    { sourceId: "instagram-organic", state: "research-pending", access: "platform-api-review", note: "Do not activate until current official public-content scope is verified." },
    { sourceId: "facebook-organic", state: "research-pending", access: "platform-api-review", note: "Do not activate until current official public-content scope is verified." },
    { sourceId: "x-organic", state: "research-pending", access: "platform-api-review", note: "Do not assume free broad listening; current access/pricing must be verified before activation." }
  ];

  try {
    const batch = await collectBluesky(config.bluesky ?? {}, collectedAt);
    if (batch) {
      batches.push(batch);
      const state = connectorStates.find((item) => item.sourceId === "bluesky-trends-api");
      if (state) state.state = "operational";
    }
  } catch (error) {
    failures.push({ sourceId: "bluesky-trends-api", required: Boolean(config.bluesky?.required), error: error instanceof Error ? error.message : String(error) });
  }

  try {
    const youtube = await collectYouTube(config.youtube ?? {}, collectedAt);
    if (youtube.batch) batches.push(youtube.batch);
    const state = connectorStates.find((item) => item.sourceId === "youtube-data-api");
    if (state) {
      state.state = youtube.state;
      state.note = youtube.note;
    }
  } catch (error) {
    failures.push({ sourceId: "youtube-data-api", required: Boolean(config.youtube?.required), error: error instanceof Error ? error.message : String(error) });
  }

  const requiredFailure = failures.some((failure) => failure.required);
  if (requiredFailure) throw new Error(`Required social source failed: ${failures.filter((failure) => failure.required).map((failure) => `${failure.sourceId}: ${failure.error}`).join(" | ")}`);
  if (!batches.length) throw new Error("Social backbone produced no source batches.");

  const snapshot = {
    schemaVersion: "social-backbone-snapshot.v1",
    collectedAt,
    collectionPolicy: { cadence: "twice-daily", scheduleUtc: ["07:17", "19:17"] },
    sourceCount: batches.length,
    observationCount: batches.reduce((sum, batch) => sum + batch.count, 0),
    batches,
    connectorStates,
    failures,
    notes: [
      "Source-native social trends are evidence inputs, not Trend Pulse Trend Candidates.",
      "All ACTIVE sources follow the locked twice-daily V1 collection policy.",
      "No credential is written into the static artifact or browser bundle.",
      "The public preview applies conservative content filtering before persistence/display.",
    ],
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Social backbone collected ${snapshot.observationCount} real observations from ${snapshot.sourceCount} source batch(es).`);
  for (const batch of batches) console.log(`- ${batch.sourceId}: ${batch.count}`);
  if (failures.length) console.log(`Social runtime notes: ${failures.map((failure) => `${failure.sourceId}: ${failure.error}`).join(" | ")}`);
  console.log(`Output: ${path.relative(repoRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
