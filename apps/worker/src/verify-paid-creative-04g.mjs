import fs from "node:fs";
import { buildPaidCreativeSnapshot, parseMetaAdsInput } from "./meta-ads-normalizer-04g.mjs";
import { enforcePaidCreativeSignalContract } from "./enforce-paid-creative-signal-contract-04g.mjs";
import { contextualizePaidCreativeSnapshot, containsPhrase } from "./paid-creative-context-04g.mjs";

const failures = [];
const requireOk = (condition, message) => { if (!condition) failures.push(message); };
const requireText = (haystack, needle, message) => requireOk(haystack.includes(needle), message);

const config = JSON.parse(fs.readFileSync("apps/worker/config/stage04g-paid-creative.json", "utf8"));
const fixtureEnvelope = {
  event: "search.ad_scraped",
  sent_at: "2026-08-30T15:00:00.000Z",
  source: "search",
  company: {
    id: "page-1",
    company_name: "Example Game Studio",
    matched_name: "Example Game Studio",
    status: "done",
    active_ads_count: 1,
    inactive_ads_count: 0,
    ad_types: ["video"],
    platforms: ["FACEBOOK", "INSTAGRAM"],
  },
  ads: [
    {
      id: "123456789",
      advertiser_name: "Example Game Studio",
      advertiser_page_id: "page-1",
      body_variants: ["Gamescom 2026: see our new mobile game in Dubai."],
      headline: "Gamescom 2026 reveal",
      cta_text: "PLAY_GAME",
      link_url: "https://example.com/game",
      media_type: "video",
      media_urls: ["https://cdn.example.com/thumb.jpg"],
      video_urls: ["https://cdn.example.com/video.mp4"],
      carousel_cards: [],
      platforms: ["FACEBOOK", "INSTAGRAM"],
      status: "ACTIVE",
      category: "ALL",
      started_at: "2026-07-15T00:00:00.000Z",
      days_running: 46,
      country: "VN",
      language: "en",
      impressions_min: 1000,
      impressions_max: 4999,
      spend_min: 100,
      spend_max: 499,
      spend_currency: "USD",
      total_reach: 2200,
      ad_snapshot_url: "https://www.facebook.com/ads/library/?id=123456789",
      scraped_at: "2026-08-30T14:59:00.000Z",
      demographic_distribution: [],
      region_distribution: [],
    },
  ],
};

const parsed = parseMetaAdsInput(JSON.stringify(fixtureEnvelope));
requireOk(parsed.mode === "json", "Fixture envelope must parse as JSON input.");
requireOk(parsed.records.length === 1, "Fixture envelope must expose exactly one ad record.");

const rawNoWorkspace = buildPaidCreativeSnapshot(parsed, config, { normalizedAt: "2026-08-30T15:01:00.000Z" });
const noWorkspace = enforcePaidCreativeSignalContract(rawNoWorkspace);
requireOk(noWorkspace.status === "ingested", "Fixture must produce an ingested snapshot.");
requireOk(noWorkspace.signals.length === 1, "Fixture must produce exactly one paid creative Signal.");
const signal = noWorkspace.signals[0];
requireOk(!("workspaceId" in signal), "Broad/local paid import must not fabricate workspaceId without explicit runtime assignment.");
requireOk(signal.source.sourceType === "social", "Final paid creative Signal must remain signal.v1 sourceType= social.");
requireOk(signal.source.sourceId === "meta-ad-library-public-experimental", "Final paid creative Signal must preserve the experimental source ID.");
requireOk(signal.metrics.native?.evidenceFamily === "paid-ad", "Paid creative evidence family must be explicit in native metrics.");
requireOk(noWorkspace.source.evidenceFamily === "paid-ad", "Snapshot source boundary must identify paid-ad evidence family.");
requireOk(signal.metrics.native?.daysRunning === 46, "daysRunning must be preserved as a source-native observation.");
requireOk(signal.metrics.native?.impressionsMin === 1000 && signal.metrics.native?.impressionsMax === 4999, "Impression range must remain source-native.");
requireOk(signal.metrics.native?.spendMin === 100 && signal.metrics.native?.spendMax === 499, "Spend range must remain source-native.");
requireOk(signal.metrics.native?.totalReach === 2200, "Total reach must remain source-native.");
requireOk(signal.metrics.native?.collectionCountry === "VN", "Collection country must remain native metadata.");
requireOk(signal.metrics.native?.collectionLanguage === "en", "Collection language must remain native metadata.");
requireOk(!("geography" in signal), "Collection country must not be promoted to Signal geography.");
requireOk(!("language" in signal), "Collection language must not be promoted to Signal language.");
requireOk(signal.metrics.views == null, "Meta impressions must not be relabelled as views.");
requireOk(signal.metrics.reachProxy == null, "Meta total reach must not be relabelled as cross-platform reachProxy.");
requireOk(signal.metrics.searchInterest == null, "Paid ad observations must not create search-interest metrics.");
for (const prohibitedKey of ["roas", "ctr", "cpi", "creativePerformance", "trendStage", "battleTested", "winner"]) {
  requireOk(!(prohibitedKey in signal.metrics.native), `Paid creative native metrics must not fabricate performance field ${prohibitedKey}.`);
}

const rawWorkspace = buildPaidCreativeSnapshot(parsed, config, {
  workspaceId: "runtime-vietnam-mobile-gaming",
  normalizedAt: "2026-08-30T15:01:00.000Z",
});
const workspaceSnapshot = enforcePaidCreativeSignalContract(rawWorkspace);
requireOk(workspaceSnapshot.signals[0]?.workspaceId === "runtime-vietnam-mobile-gaming", "Explicit validated runtime Workspace assignment must be preserved.");

const duplicateParsed = parseMetaAdsInput(JSON.stringify({ ...fixtureEnvelope, ads: [fixtureEnvelope.ads[0], fixtureEnvelope.ads[0]] }));
const duplicateSnapshot = enforcePaidCreativeSignalContract(buildPaidCreativeSnapshot(duplicateParsed, config, { normalizedAt: "2026-08-30T15:01:00.000Z" }));
requireOk(duplicateSnapshot.signals.length === 1, "Duplicate Meta ad IDs must deduplicate to one Signal.");

requireOk(containsPhrase("Dubai gaming hub", "ai") === false, "Short alias AI must not match as a substring inside Dubai.");
requireOk(containsPhrase("Gamescom 2026 mobile reveal", "gamescom 2026") === true, "Exact phrase anchor Gamescom 2026 must match paid creative text.");

const workspaceIntelligence = {
  schemaVersion: "workspace-intelligence-snapshot.v1",
  generatedAt: "2026-08-30T15:01:00.000Z",
  workspaces: [{
    workspace: { id: "runtime-vietnam-mobile-gaming", name: "Vietnam Mobile Gaming" },
    candidates: [
      {
        id: "trend-gamescom",
        workspaceId: "runtime-vietnam-mobile-gaming",
        title: "Gamescom 2026",
        status: "corroborated",
        sourceIds: ["pocketgamer-rss", "mastodon-social-trends"],
        independentSourceDiversity: 2,
        independentSourceFamilyDiversity: 2,
        resolutionAnchors: ["gamescom 2026"],
      },
      {
        id: "trend-ai",
        workspaceId: "runtime-vietnam-mobile-gaming",
        title: "AI narrative",
        status: "candidate",
        sourceIds: ["source-a", "source-b"],
        independentSourceDiversity: 2,
        independentSourceFamilyDiversity: 2,
        resolutionAnchors: ["ai"],
      },
    ],
  }],
};
const originalCandidateState = JSON.stringify(workspaceIntelligence.workspaces[0].candidates);
const contextualized = contextualizePaidCreativeSnapshot(workspaceSnapshot, workspaceIntelligence);
requireOk(contextualized.trendContext.length === 1, "Only the exact Gamescom anchor should form a paid-context link.");
requireOk(contextualized.trendContext[0]?.trendCandidateId === "trend-gamescom", "Paid context must attach to the Gamescom candidate.");
requireOk(contextualized.trendContext[0]?.matchedAnchors.includes("gamescom 2026"), "Paid context must expose the exact matched anchor.");
requireOk(JSON.stringify(workspaceIntelligence.workspaces[0].candidates) === originalCandidateState, "Paid context linking must not mutate candidate status or corroboration fields.");

const workflow = fs.readFileSync(".github/workflows/pages.yml", "utf8");
const packageJson = fs.readFileSync("package.json", "utf8");
const page = fs.readFileSync("apps/web/app/page.tsx", "utf8");
const panel = fs.readFileSync("apps/web/app/paid-creative-stage-04g.tsx", "utf8");
const sourceStage = fs.readFileSync("apps/web/app/source-intelligence-stage04g.ts", "utf8");
const receiver = fs.readFileSync("apps/worker/src/receive-meta-ads-webhook-04g.mjs", "utf8");
const gitignore = fs.readFileSync(".gitignore", "utf8");

for (const marker of [
  "ingest:meta-ads-04g",
  "contextualize:paid-creative-04g",
  "verify:paid-creative-04g",
  "receive:meta-ads-04g",
]) requireText(packageJson, marker, `package.json missing Stage 04G script: ${marker}`);

requireText(page, 'import PaidCreativeStage04G from "./paid-creative-stage-04g";', "Homepage must import the Stage 04G paid creative panel.");
requireText(page, "<PaidCreativeStage04G />", "Homepage must mount the Stage 04G paid creative panel.");
for (const marker of [
  "STAGE 04G · PAID CREATIVE INTELLIGENCE",
  "BRIDGE READY · NO LOCAL META IMPORT IN THIS BUILD",
  "Paid ads ≠ organic virality ≠ creative performance.",
  "no corroboration promotion",
]) requireText(panel, marker, `Stage 04G UI missing required boundary marker: ${marker}`);

for (const marker of [
  "manual-assisted",
  "needs-review",
  "scheduled operational coverage",
  "does not vendor or execute its scraping/Playwright code",
]) requireText(sourceStage, marker, `Stage 04G source registry/planner missing boundary marker: ${marker}`);

requireText(receiver, 'const host = process.env.META_ADS_WEBHOOK_HOST || config.runtime.defaultWebhookHost;', "Local webhook receiver must use configured loopback host by default.");
requireText(receiver, "X-Webhook", "Receiver must support the upstream webhook boundary.");
requireText(gitignore, ".trend-pulse-local/", "Local raw paid creative payload directory must be git-ignored.");

for (const prohibited of ["playwright", "stealth", "META_SCRAPER_PROXIES", "proxy rotation"]) {
  requireOk(!workflow.toLowerCase().includes(prohibited.toLowerCase()), `GitHub Actions must not contain Meta scraping/evasion dependency: ${prohibited}.`);
}
requireText(workflow, "Prepare Stage 04G paid creative bridge artifact", "Workflow must prepare the default 04G artifact.");
requireText(workflow, "Verify Stage 04G paid creative intelligence bridge", "Workflow must verify Stage 04G before downstream Brand Fit.");

const outputPath = "apps/web/public/data/paid-creative-intelligence.json";
if (fs.existsSync(outputPath)) {
  const live = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  requireOk(live.schemaVersion === "paid-creative-intelligence-04g.v1", "Live paid creative artifact schema mismatch.");
  requireOk(live.source?.scheduledCollection === false, "Live paid creative source must never claim scheduled collection.");
  requireOk(live.source?.complianceStatus === "needs-review", "Live paid creative source must retain compliance needs-review.");
  requireOk(live.source?.evidenceFamily === "paid-ad", "Live paid creative artifact must identify paid-ad evidence family.");
  if (process.env.GITHUB_ACTIONS === "true") {
    requireOk(live.status === "awaiting-local-ingest", "CI default paid creative artifact must remain awaiting-local-ingest.");
    requireOk(live.summary?.signalCount === 0, "CI default must not fabricate Meta paid creative signals.");
    requireOk(live.trendContext?.length === 0, "CI default must not fabricate paid trend context links.");
  }
}

if (failures.length) {
  console.error("Stage 04G paid creative verification FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Stage 04G verification PASS · experimental local Meta Ads interoperability · signal.v1 firewall · paid-ad ≠ organic corroboration · source-native metrics only · no performance inference · CI scrape disabled.");
