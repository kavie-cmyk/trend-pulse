import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const configPath = path.join(repoRoot, "apps/worker/config/stage03-gdelt.json");
const outputPath = path.join(repoRoot, "apps/web/public/data/gdelt-signals.json");
const browserUserAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36 TrendPulse-Stage03/0.3";

function parseGdeltDate(value) {
  if (!value) return undefined;
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))).toISOString();
}

function stableId(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 18);
}

function cleanText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function normalizeArticle(article, config, collectedAt) {
  const url = cleanText(article.url);
  const title = cleanText(article.title) || cleanText(article.domain) || "Untitled GDELT observation";
  const observedAt = parseGdeltDate(article.seendate) ?? collectedAt;
  const language = cleanText(article.language) || undefined;
  const sourceDomain = cleanText(article.domain) || undefined;

  return {
    schemaVersion: "signal.v1",
    id: `gdelt-${stableId(url || `${title}-${observedAt}`)}`,
    workspaceId: config.workspaceId,
    observedAt,
    publishedAt: observedAt,
    collectedAt,
    normalizedAt: collectedAt,
    source: {
      sourceId: "gdelt-doc-2",
      sourceName: "GDELT DOC 2.0",
      sourceType: "news",
      accessMode: "public-dataset",
      freshness: "hourly"
    },
    language,
    topic: title,
    entities: [],
    keywords: [],
    hashtags: [],
    creator: sourceDomain,
    contentType: "news-article",
    metrics: {},
    dynamics: {},
    confidence: {
      score: 0.5,
      basis: [
        "Single-source Stage 03 observation; not corroborated yet",
        "Retrieved from GDELT DOC ArticleList with source URL preserved",
        "Numeric confidence remains provisional until RG-002/RG-003 calibration"
      ]
    },
    evidence: {
      sourceUrl: url || undefined,
      externalId: url ? stableId(url) : undefined,
      reference: title
    }
  };
}

async function requestText(endpoint) {
  try {
    const response = await fetch(endpoint, {
      headers: { "user-agent": browserUserAgent },
      signal: AbortSignal.timeout(30000)
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`GDELT request failed: HTTP ${response.status}: ${text.slice(0, 240)}`);
    return text;
  } catch (error) {
    const cause = error instanceof Error && error.cause ? ` cause=${String(error.cause)}` : "";
    console.warn(`Node fetch transport failed; retrying with curl.${cause}`);
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
        "2",
        "--connect-timeout",
        "20",
        "--max-time",
        "60",
        "--user-agent",
        browserUserAgent,
        endpoint
      ],
      { maxBuffer: 10 * 1024 * 1024 }
    );
    return stdout;
  }
}

async function main() {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const params = new URLSearchParams({
    query: config.query,
    mode: "artlist",
    maxrecords: String(config.maxRecords ?? 30),
    timespan: config.timespan ?? "24h",
    sort: "datedesc",
    format: "json"
  });

  const endpoint = `https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`;
  const text = await requestText(endpoint);
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`GDELT returned non-JSON content: ${text.slice(0, 240)}`);
  }

  const articles = Array.isArray(payload.articles) ? payload.articles : [];
  if (!articles.length) throw new Error("GDELT returned zero articles for the Stage 03 query; refusing to publish fake fallback data.");

  const collectedAt = new Date().toISOString();
  const signals = articles.map((article) => normalizeArticle(article, config, collectedAt));
  const batch = {
    schemaVersion: "signal-batch.v1",
    sourceId: "gdelt-doc-2",
    scopeLabel: config.scopeLabel,
    collectedAt,
    query: config.query,
    timespan: config.timespan ?? "24h",
    effectiveFreshness: "hourly",
    count: signals.length,
    signals
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
  console.log(`Collected ${signals.length} real GDELT observations at ${collectedAt}`);
  console.log(`Query: ${config.query}`);
  console.log(`Output: ${path.relative(repoRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  if (error instanceof Error && error.cause) console.error("Cause:", error.cause);
  process.exit(1);
});
