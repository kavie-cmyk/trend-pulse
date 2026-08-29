import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const configPath = path.join(repoRoot, "apps/worker/config/stage03-wikimedia.json");
const outputPath = path.join(repoRoot, "apps/web/public/data/live-signals.json");
const userAgent = "TrendPulse/0.3 (https://github.com/kavie-cmyk/trend-pulse; Stage 03 research prototype)";

const blockedPrefixes = [
  "Main_Page",
  "Special:",
  "Wikipedia:",
  "Help:",
  "Portal:",
  "File:",
  "Category:",
  "Template:",
  "User:"
];

const previewExplicitTerms = /(^|[ _-])(porn|pornography|hentai|xxx|onlyfans|sexual intercourse|sex position)([ _-]|$)/i;

function stableId(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 18);
}

function utcDateDaysAgo(daysAgo) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return { year, month, day, isoDate: `${year}-${month}-${day}` };
}

function displayTitle(article) {
  try {
    return decodeURIComponent(article).replaceAll("_", " ").trim();
  } catch {
    return String(article).replaceAll("_", " ").trim();
  }
}

function isPreviewSafeArticle(article) {
  const raw = String(article ?? "");
  if (!raw || raw === "-") return false;
  if (blockedPrefixes.some((prefix) => raw.startsWith(prefix))) return false;
  return !previewExplicitTerms.test(raw);
}

async function requestText(endpoint) {
  try {
    const response = await fetch(endpoint, {
      headers: { "user-agent": userAgent, accept: "application/json" },
      signal: AbortSignal.timeout(20000)
    });
    const text = await response.text();
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${text.slice(0, 180)}`);
      error.status = response.status;
      throw error;
    }
    return text;
  } catch (error) {
    if (error instanceof Error && Number(error.status) >= 400 && Number(error.status) < 500) throw error;
    console.warn(`Node fetch transport failed for Wikimedia; retrying with curl. ${error instanceof Error ? error.message : String(error)}`);
    const { stdout } = await execFileAsync(
      "curl",
      [
        "--fail-with-body",
        "--location",
        "--silent",
        "--show-error",
        "--retry",
        "2",
        "--retry-delay",
        "1",
        "--connect-timeout",
        "15",
        "--max-time",
        "45",
        "--user-agent",
        userAgent,
        endpoint
      ],
      { maxBuffer: 10 * 1024 * 1024 }
    );
    return stdout;
  }
}

async function fetchTopPages(projectConfig, fallbackDays) {
  let lastError;
  for (let daysAgo = 1; daysAgo <= fallbackDays; daysAgo += 1) {
    const date = utcDateDaysAgo(daysAgo);
    const endpoint = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${projectConfig.project}/all-access/${date.year}/${date.month}/${date.day}`;
    try {
      const text = await requestText(endpoint);
      const payload = JSON.parse(text);
      const articles = payload?.items?.[0]?.articles;
      if (Array.isArray(articles) && articles.length) return { articles, date: date.isoDate };
      lastError = new Error(`No top-page records for ${projectConfig.project} on ${date.isoDate}`);
    } catch (error) {
      lastError = error;
      console.warn(`Wikimedia snapshot unavailable: ${projectConfig.project} ${date.isoDate} · ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw lastError ?? new Error(`No Wikimedia data available for ${projectConfig.project}`);
}

function normalizeArticle(article, projectConfig, snapshotDate, config, collectedAt) {
  const title = displayTitle(article.article);
  const project = projectConfig.project;
  const sourceUrl = `https://${project}/wiki/${encodeURIComponent(String(article.article))}`;
  return {
    schemaVersion: "signal.v1",
    id: `wikimedia-${stableId(`${project}:${snapshotDate}:${article.article}`)}`,
    workspaceId: config.workspaceId,
    observedAt: `${snapshotDate}T23:59:59.000Z`,
    collectedAt,
    normalizedAt: collectedAt,
    source: {
      sourceId: "wikimedia-pageviews-top",
      sourceName: "Wikimedia Pageviews API",
      sourceType: "culture",
      accessMode: "official-api",
      freshness: "daily"
    },
    language: projectConfig.language,
    topic: title,
    entities: [],
    keywords: [],
    hashtags: [],
    contentType: "encyclopedia-pageview",
    metrics: {
      views: Number(article.views) || undefined,
      sourceRank: Number(article.rank) || undefined
    },
    dynamics: {},
    confidence: {
      score: 0.5,
      basis: [
        "Direct pageview metric from the official Wikimedia Pageviews API",
        "Single-source attention observation; not a corroborated trend",
        "Numeric confidence remains provisional until RG-002/RG-003 calibration"
      ]
    },
    evidence: {
      sourceUrl,
      externalId: `${project}:${snapshotDate}:${article.article}`,
      reference: `Rank #${article.rank} · ${Number(article.views).toLocaleString("en-US")} pageviews · ${project} · ${snapshotDate}`
    }
  };
}

async function main() {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const collectedAt = new Date().toISOString();
  const collectedProjects = [];
  const failures = [];

  for (const projectConfig of config.projects ?? []) {
    try {
      const result = await fetchTopPages(projectConfig, config.fallbackDays ?? 3);
      const safeArticles = result.articles
        .filter((article) => isPreviewSafeArticle(article.article))
        .slice(0, config.maxRecordsPerProject ?? 30);
      collectedProjects.push({ projectConfig, snapshotDate: result.date, articles: safeArticles });
    } catch (error) {
      failures.push(`${projectConfig.project}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!collectedProjects.length) {
    throw new Error(`Wikimedia collector returned no usable project snapshots. ${failures.join(" | ")}`);
  }

  const signals = collectedProjects.flatMap(({ projectConfig, snapshotDate, articles }) =>
    articles.map((article) => normalizeArticle(article, projectConfig, snapshotDate, config, collectedAt))
  );

  if (!signals.length) throw new Error("Wikimedia snapshots contained no preview-safe articles; refusing to publish fake fallback data.");

  signals.sort((a, b) => (a.metrics.sourceRank ?? 9999) - (b.metrics.sourceRank ?? 9999));
  const snapshotDates = [...new Set(collectedProjects.map((item) => item.snapshotDate))];
  const projects = collectedProjects.map((item) => item.projectConfig.project);

  const batch = {
    schemaVersion: "signal-batch.v1",
    sourceId: "wikimedia-pageviews-top",
    scopeLabel: config.scopeLabel,
    collectedAt,
    query: `Top viewed pages · ${projects.join(" + ")}`,
    timespan: `daily snapshot · ${snapshotDates.join(", ")}`,
    effectiveFreshness: "daily",
    count: signals.length,
    signals
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
  console.log(`Collected ${signals.length} real Wikimedia pageview observations from ${projects.join(", ")}`);
  console.log(`Snapshot date(s): ${snapshotDates.join(", ")}`);
  if (failures.length) console.warn(`Partial project failures: ${failures.join(" | ")}`);
  console.log(`Output: ${path.relative(repoRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
