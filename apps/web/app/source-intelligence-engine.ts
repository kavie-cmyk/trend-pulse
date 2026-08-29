import type { IntelligenceWorkspace } from "@trend-pulse/contracts";
import type {
  SourceActivationDecision,
  SourceCoverageGap,
  SourceEvaluationDimensions,
  SourceRegistryEntry,
  SourceResearchCandidate,
  WorkspaceSourceEvaluation,
  WorkspaceSourcePlan,
} from "@trend-pulse/contracts/source-intelligence";

const VERIFIED_AT = "2026-08-29";

export const sourceRegistry: SourceRegistryEntry[] = [
  {
    schemaVersion: "source-registry-entry.v1",
    id: "wikimedia-pageviews",
    name: "Wikimedia Pageviews",
    kind: "connector",
    description: "Broad cultural-attention observations from Wikimedia pageview rankings.",
    homepage: "https://wikitech.wikimedia.org/wiki/Analytics/AQS/Pageviews",
    sourceType: "culture",
    signalKinds: ["cultural-attention"],
    accessMode: "official-api",
    connectorStatus: "operational",
    costTier: "free",
    complianceStatus: "verified",
    freshness: "daily",
    geographyTags: ["global"],
    languageTags: ["multilingual"],
    industryTags: ["universal", "culture", "entertainment"],
    audienceTags: ["general-public"],
    queryability: { geography: false, language: true, category: false, keyword: false, entity: false, creator: false, timeRange: true },
    quality: { signalUniqueness: 5, reliability: 9, historicalDepth: 8, granularity: 4 },
    evidenceRefs: ["https://wikitech.wikimedia.org/wiki/Analytics/AQS/Pageviews"],
    accessNotes: ["Operational Stage 03 connector.", "Broad attention source; not a universal primary source."],
    lastVerifiedAt: VERIFIED_AT,
  },
  {
    schemaVersion: "source-registry-entry.v1",
    id: "youtube-data-api",
    name: "YouTube Data API",
    kind: "connector",
    description: "Video, creator and popularity signals with region/category and query-based discovery paths.",
    homepage: "https://developers.google.com/youtube/v3",
    sourceType: "video",
    signalKinds: ["video-attention", "creator", "competitor-activity"],
    accessMode: "official-api",
    connectorStatus: "ready-needs-credential",
    costTier: "free-tier",
    complianceStatus: "verified",
    freshness: "hourly",
    geographyTags: ["global"],
    languageTags: ["multilingual"],
    industryTags: ["universal", "gaming", "ai", "xr", "beauty", "consumer"],
    audienceTags: ["consumer", "creator", "developer", "gamer"],
    queryability: { geography: true, language: true, category: true, keyword: true, entity: true, creator: true, timeRange: true },
    quality: { signalUniqueness: 9, reliability: 9, historicalDepth: 7, granularity: 9 },
    evidenceRefs: [
      "https://developers.google.com/youtube/v3/docs/videos/list",
      "https://developers.google.com/youtube/v3/docs/search/list",
      "https://developers.google.com/youtube/v3/revision_history",
    ],
    accessNotes: ["Requires project API credentials/quota configuration.", "mostPopular supports region and category; search.list supports query, region and relevance language."],
    lastVerifiedAt: VERIFIED_AT,
  },
  {
    schemaVersion: "source-registry-entry.v1",
    id: "publisher-rss-adapter",
    name: "Publisher RSS / Atom",
    kind: "source-class",
    description: "Reusable feed connector for publishers and specialist industry sources whose feed terms permit use.",
    sourceType: "publisher",
    signalKinds: ["news-narrative", "competitor-activity"],
    accessMode: "rss",
    connectorStatus: "not-built",
    costTier: "free",
    complianceStatus: "needs-review",
    freshness: "hourly",
    geographyTags: ["global"],
    languageTags: ["multilingual"],
    industryTags: ["universal", "gaming", "ai", "xr", "technology"],
    audienceTags: ["professional", "developer", "business"],
    queryability: { geography: false, language: false, category: true, keyword: true, entity: true, creator: false, timeRange: true },
    quality: { signalUniqueness: 7, reliability: 8, historicalDepth: 7, granularity: 8 },
    evidenceRefs: ["https://techcrunch.com/subscribing/", "https://roadtovr.com/welcome-to-the-new-road-to-vr/"],
    accessNotes: ["Adapter is not built yet.", "Each publisher/feed needs its own terms and retention review before activation."],
    lastVerifiedAt: VERIFIED_AT,
  },
  {
    schemaVersion: "source-registry-entry.v1",
    id: "github-rest-api",
    name: "GitHub REST API",
    kind: "connector",
    description: "Public developer-ecosystem signals for repositories, projects and open-source activity.",
    homepage: "https://docs.github.com/en/rest",
    sourceType: "community",
    signalKinds: ["developer-ecosystem", "product-launch", "competitor-activity"],
    accessMode: "official-api",
    connectorStatus: "not-built",
    costTier: "free-tier",
    complianceStatus: "verified",
    freshness: "hourly",
    geographyTags: ["global"],
    languageTags: ["multilingual"],
    industryTags: ["ai", "developer", "software", "xr", "technology"],
    audienceTags: ["developer", "technical", "open-source"],
    queryability: { geography: false, language: true, category: true, keyword: true, entity: true, creator: true, timeRange: true },
    quality: { signalUniqueness: 9, reliability: 9, historicalDepth: 9, granularity: 9 },
    evidenceRefs: ["https://docs.github.com/en/rest", "https://docs.github.com/en/rest/rate-limit/rate-limit"],
    accessNotes: ["Public resources can be queried without authentication at lower limits; authenticated access has higher limits.", "Search endpoints have separate rate limits."],
    lastVerifiedAt: VERIFIED_AT,
  },
  {
    schemaVersion: "source-registry-entry.v1",
    id: "hacker-news-api",
    name: "Hacker News API",
    kind: "connector",
    description: "Near-real-time technology community stories and discussion ranking signals.",
    homepage: "https://github.com/HackerNews/API",
    sourceType: "community",
    signalKinds: ["community", "news-narrative", "product-launch"],
    accessMode: "official-api",
    connectorStatus: "not-built",
    costTier: "free",
    complianceStatus: "verified",
    freshness: "near-live",
    geographyTags: ["global"],
    languageTags: ["english"],
    industryTags: ["ai", "software", "startup", "technology"],
    audienceTags: ["developer", "founder", "technical"],
    queryability: { geography: false, language: false, category: false, keyword: false, entity: false, creator: true, timeRange: false },
    quality: { signalUniqueness: 8, reliability: 8, historicalDepth: 7, granularity: 7 },
    evidenceRefs: ["https://github.com/HackerNews/API"],
    accessNotes: ["Official public API exposes top/new/best stories and live item data.", "No rate limit is stated in the official v0 documentation."],
    lastVerifiedAt: VERIFIED_AT,
  },
  {
    schemaVersion: "source-registry-entry.v1",
    id: "google-trends-api",
    name: "Google Trends API Alpha",
    kind: "connector",
    description: "Search-interest time series with consistent scaling, historical depth and geographic breakdowns.",
    homepage: "https://developers.google.com/search/apis/trends",
    sourceType: "search",
    signalKinds: ["search-interest"],
    accessMode: "official-api",
    connectorStatus: "manual-assisted",
    costTier: "free-tier",
    complianceStatus: "verified",
    freshness: "daily",
    geographyTags: ["global"],
    languageTags: ["multilingual"],
    industryTags: ["universal", "gaming", "ai", "xr", "beauty", "consumer", "b2b"],
    audienceTags: ["general-public", "consumer", "business"],
    queryability: { geography: true, language: false, category: false, keyword: true, entity: true, creator: false, timeRange: true },
    quality: { signalUniqueness: 10, reliability: 10, historicalDepth: 10, granularity: 8 },
    evidenceRefs: ["https://developers.google.com/search/apis/trends", "https://developers.google.com/search/blog/2025/07/trends-api"],
    accessNotes: ["API remains alpha with limited tester access.", "Do not treat the public Trends website as an undocumented production API."],
    lastVerifiedAt: VERIFIED_AT,
  },
  {
    schemaVersion: "source-registry-entry.v1",
    id: "tiktok-creative-center",
    name: "TikTok Creative Center",
    kind: "source",
    description: "Public trend and creative intelligence surface for hashtags, ads, products and industry filters.",
    homepage: "https://ads.tiktok.com/creative/creativeCenter/trends",
    sourceType: "social",
    signalKinds: ["creator", "ad-creative", "video-attention", "product-launch"],
    accessMode: "manual",
    connectorStatus: "manual-assisted",
    costTier: "free",
    complianceStatus: "verified",
    freshness: "daily",
    geographyTags: ["global"],
    languageTags: ["multilingual"],
    industryTags: ["universal", "gaming", "beauty", "consumer"],
    audienceTags: ["consumer", "creator", "gamer"],
    queryability: { geography: true, language: false, category: true, keyword: true, entity: false, creator: false, timeRange: true },
    quality: { signalUniqueness: 10, reliability: 8, historicalDepth: 5, granularity: 8 },
    evidenceRefs: ["https://ads.tiktok.com/help/article/creative-center?lang=en", "https://ads.tiktok.com/resources/help/article/how-to-use-trends?lang=en"],
    accessNotes: ["Creative Center is free/public for trend exploration.", "No automated trend API is assumed by Stage 04B-1; treat as manual-assisted until a compliant automation path is verified."],
    lastVerifiedAt: VERIFIED_AT,
  },
  {
    schemaVersion: "source-registry-entry.v1",
    id: "meta-ad-library",
    name: "Meta Ad Library",
    kind: "source",
    description: "Advertiser and creative transparency source for active ads and selected historical categories.",
    homepage: "https://www.facebook.com/ads/library/",
    sourceType: "social",
    signalKinds: ["ad-creative", "competitor-activity"],
    accessMode: "manual",
    connectorStatus: "manual-assisted",
    costTier: "free",
    complianceStatus: "verified",
    freshness: "daily",
    geographyTags: ["global"],
    languageTags: ["multilingual"],
    industryTags: ["universal", "gaming", "ai", "xr", "beauty", "consumer"],
    audienceTags: ["consumer", "marketer"],
    queryability: { geography: true, language: false, category: true, keyword: true, entity: true, creator: false, timeRange: true },
    quality: { signalUniqueness: 9, reliability: 9, historicalDepth: 6, granularity: 8 },
    evidenceRefs: ["https://www.facebook.com/ads/library/"],
    accessNotes: ["Public UI supports keyword/advertiser search and country selection.", "Automation/API scope must be verified separately before production ingestion."],
    lastVerifiedAt: VERIFIED_AT,
  },
  {
    schemaVersion: "source-registry-entry.v1",
    id: "arxiv-api",
    name: "arXiv API",
    kind: "connector",
    description: "Research-paper discovery and metadata signals across AI, computer science and related fields.",
    homepage: "https://info.arxiv.org/help/api/",
    sourceType: "publisher",
    signalKinds: ["research", "news-narrative"],
    accessMode: "official-api",
    connectorStatus: "not-built",
    costTier: "free",
    complianceStatus: "needs-review",
    freshness: "daily",
    geographyTags: ["global"],
    languageTags: ["english"],
    industryTags: ["ai", "research", "computer-science", "xr"],
    audienceTags: ["researcher", "developer", "technical"],
    queryability: { geography: false, language: false, category: true, keyword: true, entity: true, creator: true, timeRange: true },
    quality: { signalUniqueness: 9, reliability: 10, historicalDepth: 10, granularity: 9 },
    evidenceRefs: ["https://info.arxiv.org/help/api/"],
    accessNotes: ["Public API exists.", "Commercial products should review arXiv API/brand terms before production use."],
    lastVerifiedAt: VERIFIED_AT,
  },
  {
    schemaVersion: "source-registry-entry.v1",
    id: "gdelt-doc",
    name: "GDELT DOC",
    kind: "connector",
    description: "Global news/event discovery source retained in registry after Stage 03 runtime connectivity failure.",
    homepage: "https://www.gdeltproject.org/",
    sourceType: "news",
    signalKinds: ["news-narrative", "competitor-activity"],
    accessMode: "public-dataset",
    connectorStatus: "runtime-deferred",
    costTier: "free",
    complianceStatus: "verified",
    freshness: "near-live",
    geographyTags: ["global"],
    languageTags: ["multilingual"],
    industryTags: ["universal", "gaming", "ai", "xr", "technology", "business"],
    audienceTags: ["general-public", "business"],
    queryability: { geography: true, language: true, category: false, keyword: true, entity: true, creator: false, timeRange: true },
    quality: { signalUniqueness: 8, reliability: 8, historicalDepth: 9, granularity: 8 },
    evidenceRefs: ["https://www.gdeltproject.org/"],
    accessNotes: ["Stage 03 Node and curl requests timed out from GitHub-hosted runners.", "Keep as runtime-deferred rather than treating the source as globally unusable."],
    lastVerifiedAt: VERIFIED_AT,
  },
];

const researchCandidates: SourceResearchCandidate[] = [
  {
    id: "candidate-pocketgamer-biz",
    name: "PocketGamer.biz",
    discoveredFor: ["gaming", "game publishing", "mobile games"],
    reason: "Specialist mobile-games industry publication with current news, deals, data and company coverage.",
    likelySignalKinds: ["news-narrative", "competitor-activity"],
    expectedFit: "high",
    accessHypothesis: "manual-assisted",
    evidenceRefs: ["https://www.pocketgamer.biz/latest/", "https://www.pocketgamer.biz/browse/"],
    status: "promote-to-registry",
  },
  {
    id: "candidate-sensor-tower-gaming",
    name: "Sensor Tower Gaming Intelligence",
    discoveredFor: ["gaming", "game publishing", "mobile games"],
    reason: "High-value commercial market intelligence for downloads, revenue, engagement, gaming taxonomy and advertising; useful benchmark for the paid-later layer.",
    likelySignalKinds: ["app-market", "ad-creative", "competitor-activity"],
    expectedFit: "high",
    accessHypothesis: "paid-later",
    evidenceRefs: ["https://sensortower.com/solutions/gaming", "https://sensortower.com/"],
    status: "defer",
  },
  {
    id: "candidate-techcrunch-ai",
    name: "TechCrunch AI / RSS",
    discoveredFor: ["ai", "saas", "lumi", "lumus"],
    reason: "High-frequency AI/startup narrative source with a documented RSS distribution path; feed terms still govern how content may be displayed and retained.",
    likelySignalKinds: ["news-narrative", "competitor-activity", "product-launch"],
    expectedFit: "high",
    accessHypothesis: "manual-assisted",
    evidenceRefs: ["https://techcrunch.com/category/artificial-intelligence/", "https://techcrunch.com/subscribing/", "https://techcrunch.com/rss-terms-of-use/"],
    status: "promote-to-registry",
  },
  {
    id: "candidate-product-hunt",
    name: "Product Hunt API",
    discoveredFor: ["ai", "saas", "product launch", "lumi", "lumus"],
    reason: "Product-launch ecosystem signal is highly relevant, but the API documentation states commercial use requires contacting Product Hunt.",
    likelySignalKinds: ["product-launch", "community", "competitor-activity"],
    expectedFit: "high",
    accessHypothesis: "restricted",
    evidenceRefs: ["https://api.producthunt.com/v2/docs"],
    status: "defer",
  },
  {
    id: "candidate-road-to-vr",
    name: "Road to VR RSS",
    discoveredFor: ["vr", "xr", "metaverse", "savRse"],
    reason: "Specialist XR publication explicitly documents a full-content RSS feed and section-specific feeds.",
    likelySignalKinds: ["news-narrative", "competitor-activity"],
    expectedFit: "high",
    accessHypothesis: "not-built",
    evidenceRefs: ["https://roadtovr.com/welcome-to-the-new-road-to-vr/"],
    status: "promote-to-registry",
  },
  {
    id: "candidate-steam-web-api",
    name: "Steamworks Web API",
    discoveredFor: ["vr", "xr", "gaming", "pc vr"],
    reason: "Official public/partner API surface is useful for parts of the Steam ecosystem, but it is not a complete XR market-intelligence source by itself.",
    likelySignalKinds: ["app-market", "developer-ecosystem", "competitor-activity"],
    expectedFit: "medium",
    accessHypothesis: "not-built",
    evidenceRefs: ["https://partner.steamgames.com/doc/webapi_overview"],
    status: "promote-to-registry",
  },
];

function norm(value: string) {
  return value.trim().toLowerCase();
}

function workspaceText(workspace: IntelligenceWorkspace) {
  return [
    workspace.name,
    ...workspace.scope.geographies,
    ...workspace.scope.languages,
    ...workspace.scope.industries,
    ...workspace.scope.categories,
    ...workspace.scope.products,
    ...workspace.scope.audiences,
    ...workspace.scope.objectives,
    ...workspace.focusBrands.map((brand) => brand.name),
  ]
    .join(" ")
    .toLowerCase();
}

function containsAny(text: string, tags: string[]) {
  return tags.some((tag) => tag !== "universal" && tag !== "global" && tag !== "multilingual" && text.includes(norm(tag)));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(10, Math.round(value * 10) / 10));
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function freshnessScore(value: SourceRegistryEntry["freshness"]) {
  return { "near-live": 10, hourly: 9, daily: 7, manual: 4, unknown: 3 }[value];
}

function complianceScore(source: SourceRegistryEntry) {
  const base = { verified: 10, provisional: 7, "needs-review": 5, restricted: 1 }[source.complianceStatus];
  if (source.connectorStatus === "restricted") return Math.min(base, 1);
  if (source.connectorStatus === "paid-later") return Math.min(base, 8);
  return base;
}

function costScore(source: SourceRegistryEntry) {
  return { free: 10, "free-tier": 8, paid: 3, unknown: 5 }[source.costTier];
}

function automationScore(source: SourceRegistryEntry) {
  return {
    operational: 10,
    "not-built": 7,
    "ready-needs-credential": 6,
    "manual-assisted": 3,
    "runtime-deferred": 3,
    "paid-later": 4,
    restricted: 1,
  }[source.connectorStatus];
}

function workspaceRelevance(workspace: IntelligenceWorkspace, source: SourceRegistryEntry) {
  const text = workspaceText(workspace);
  const specificMatch = containsAny(text, source.industryTags);
  if (specificMatch) return source.industryTags.includes("universal") ? 9.5 : 10;
  if (source.industryTags.includes("universal")) return 7.3;
  return 3.5;
}

function audienceCoverage(workspace: IntelligenceWorkspace, source: SourceRegistryEntry) {
  const text = workspace.scope.audiences.join(" ").toLowerCase();
  if (!text) return source.industryTags.includes("universal") ? 7 : 5;
  if (containsAny(text, source.audienceTags)) return 9.5;
  if (source.audienceTags.includes("general-public")) return 6.5;
  return 4.5;
}

function geographyCoverage(workspace: IntelligenceWorkspace, source: SourceRegistryEntry) {
  const requested = workspace.scope.geographies.map(norm);
  if (!requested.length) return source.geographyTags.includes("global") ? 9 : 6;
  if (source.geographyTags.includes("global")) return 8.5;
  return requested.some((geo) => source.geographyTags.map(norm).includes(geo)) ? 10 : 3;
}

function queryabilityScore(source: SourceRegistryEntry) {
  const values = Object.values(source.queryability);
  return (values.filter(Boolean).length / values.length) * 10;
}

function activationDecision(source: SourceRegistryEntry, disposition: WorkspaceSourceEvaluation["disposition"]): SourceActivationDecision {
  if (disposition === "exclude") return "exclude";
  return {
    operational: "activate-now",
    "ready-needs-credential": "needs-credential",
    "manual-assisted": "manual-assisted",
    "not-built": "connector-backlog",
    "runtime-deferred": "runtime-deferred",
    "paid-later": "paid-later",
    restricted: "restricted",
  }[source.connectorStatus] as SourceActivationDecision;
}

export function evaluateSourceForWorkspace(workspace: IntelligenceWorkspace, source: SourceRegistryEntry): WorkspaceSourceEvaluation {
  const dimensions: SourceEvaluationDimensions = {
    workspaceRelevance: workspaceRelevance(workspace, source),
    signalUniqueness: source.quality.signalUniqueness,
    audienceCoverage: audienceCoverage(workspace, source),
    geographyCoverage: geographyCoverage(workspace, source),
    queryability: queryabilityScore(source),
    freshness: freshnessScore(source.freshness),
    historicalDepth: source.quality.historicalDepth,
    reliability: source.quality.reliability,
    accessCompliance: complianceScore(source),
    costEfficiency: costScore(source),
    automationFeasibility: automationScore(source),
    granularity: source.quality.granularity,
  };

  const intelligenceFit = clampScore(
    dimensions.workspaceRelevance * 0.24 +
      dimensions.signalUniqueness * 0.1 +
      dimensions.audienceCoverage * 0.1 +
      dimensions.geographyCoverage * 0.1 +
      dimensions.queryability * 0.1 +
      dimensions.freshness * 0.08 +
      dimensions.historicalDepth * 0.05 +
      dimensions.reliability * 0.1 +
      dimensions.granularity * 0.13,
  );
  const operationalFeasibility = clampScore(
    dimensions.accessCompliance * 0.3 +
      dimensions.costEfficiency * 0.2 +
      dimensions.automationFeasibility * 0.3 +
      dimensions.reliability * 0.1 +
      dimensions.freshness * 0.1,
  );

  let disposition: WorkspaceSourceEvaluation["disposition"] = "exclude";
  if (intelligenceFit >= 8) disposition = "primary";
  else if (intelligenceFit >= 6.3) disposition = "supporting";
  else if (intelligenceFit >= 4.5) disposition = "background";

  const rationale = [
    `Workspace relevance ${dimensions.workspaceRelevance.toFixed(1)}/10; source provides ${source.signalKinds.join(", ")}.`,
    `Operational state: ${source.connectorStatus}; access/compliance ${dimensions.accessCompliance.toFixed(1)}/10; cost ${source.costTier}.`,
  ];
  if (intelligenceFit >= 8 && operationalFeasibility < 6) rationale.push("High intelligence value but access/runtime constraints prevent automatic activation today.");
  if (source.id === "wikimedia-pageviews" && disposition !== "exclude") rationale.push("Use as broad cultural corroboration, not as a standalone trend conclusion.");

  return {
    sourceId: source.id,
    sourceName: source.name,
    methodologyVersion: "source-eval.v0.1",
    intelligenceFit,
    operationalFeasibility,
    dimensions,
    disposition,
    activationDecision: activationDecision(source, disposition),
    rationale,
    evidenceRefs: source.evidenceRefs,
  };
}

function sourceFamily(workspace: IntelligenceWorkspace) {
  const text = workspaceText(workspace);
  if (/game|gaming|publisher|mobile game/.test(text)) return "gaming";
  if (/\bai\b|artificial intelligence|lumi|lumus|saas/.test(text)) return "ai";
  if (/\bvr\b|\bxr\b|metaverse|savrs|virtual reality|mixed reality/.test(text)) return "xr";
  return "general";
}

function candidatesForWorkspace(workspace: IntelligenceWorkspace) {
  const text = workspaceText(workspace);
  return researchCandidates.filter((candidate) => candidate.discoveredFor.some((tag) => text.includes(norm(tag))));
}

function gapStatus(
  requiredKinds: SourceCoverageGap["requiredSignalKinds"],
  evaluations: WorkspaceSourceEvaluation[],
  candidates: SourceResearchCandidate[],
) {
  const usableSourceIds = evaluations
    .filter((evaluation) => evaluation.disposition !== "exclude" && evaluation.intelligenceFit >= 6.3 && evaluation.operationalFeasibility >= 6)
    .map((evaluation) => evaluation.sourceId);
  const usableKinds = new Set(
    sourceRegistry
      .filter((source) => usableSourceIds.includes(source.id))
      .flatMap((source) => source.signalKinds),
  );
  if (requiredKinds.every((kind) => usableKinds.has(kind))) return "covered" as const;
  const plannedKinds = new Set(
    [
      ...sourceRegistry
        .filter((source) => evaluations.some((evaluation) => evaluation.sourceId === source.id && evaluation.intelligenceFit >= 6.3))
        .flatMap((source) => source.signalKinds),
      ...candidates.flatMap((candidate) => candidate.likelySignalKinds),
    ],
  );
  if (requiredKinds.some((kind) => plannedKinds.has(kind))) return "partial" as const;
  return "uncovered" as const;
}

function buildGaps(workspace: IntelligenceWorkspace, evaluations: WorkspaceSourceEvaluation[], candidates: SourceResearchCandidate[]): SourceCoverageGap[] {
  const family = sourceFamily(workspace);
  const templates: Array<Omit<SourceCoverageGap, "status">> =
    family === "gaming"
      ? [
          { id: "gap-game-market", label: "App/store competitive performance", requiredSignalKinds: ["app-market"], severity: "critical", reason: "Publishing decisions need product/category performance signals, not only content attention.", candidateSourceIds: ["candidate-sensor-tower-gaming"] },
          { id: "gap-game-search", label: "Search demand", requiredSignalKinds: ["search-interest"], severity: "important", reason: "Search demand is needed for cross-source momentum and intent validation.", candidateSourceIds: [] },
          { id: "gap-game-community", label: "Player/community discussion", requiredSignalKinds: ["community"], severity: "important", reason: "Player reaction and emerging gameplay narratives are currently under-covered.", candidateSourceIds: [] },
          { id: "gap-game-creative", label: "Paid creative intelligence", requiredSignalKinds: ["ad-creative"], severity: "important", reason: "UA/creative pattern intelligence is central to game publishing marketing decisions.", candidateSourceIds: ["candidate-sensor-tower-gaming"] },
        ]
      : family === "ai"
        ? [
            { id: "gap-ai-dev", label: "Developer/open-source momentum", requiredSignalKinds: ["developer-ecosystem"], severity: "important", reason: "AI product momentum often appears in developer ecosystems before mainstream coverage.", candidateSourceIds: [] },
            { id: "gap-ai-launch", label: "Product launch ecosystem", requiredSignalKinds: ["product-launch"], severity: "important", reason: "New AI products and competitors require launch-level monitoring.", candidateSourceIds: ["candidate-product-hunt", "candidate-techcrunch-ai"] },
            { id: "gap-ai-search", label: "Search demand", requiredSignalKinds: ["search-interest"], severity: "important", reason: "Search-interest data is required to separate technical chatter from broader demand.", candidateSourceIds: [] },
            { id: "gap-ai-research", label: "Research frontier", requiredSignalKinds: ["research"], severity: "nice-to-have", reason: "Research signals help explain emerging capabilities but should not dominate marketing intelligence.", candidateSourceIds: [] },
          ]
        : family === "xr"
          ? [
              { id: "gap-xr-specialist", label: "XR specialist news", requiredSignalKinds: ["news-narrative"], severity: "important", reason: "General tech news is insufficient for platform/device/content shifts in XR.", candidateSourceIds: ["candidate-road-to-vr"] },
              { id: "gap-xr-store", label: "XR platform/store demand", requiredSignalKinds: ["app-market"], severity: "critical", reason: "XR product intelligence needs platform/store signals beyond general web attention.", candidateSourceIds: ["candidate-steam-web-api"] },
              { id: "gap-xr-creator", label: "Creator/video adoption", requiredSignalKinds: ["video-attention", "creator"], severity: "important", reason: "Creator demonstrations and gameplay are strong adoption signals for XR.", candidateSourceIds: [] },
              { id: "gap-xr-search", label: "Search demand", requiredSignalKinds: ["search-interest"], severity: "important", reason: "Search demand helps quantify broader market interest across devices and use cases.", candidateSourceIds: [] },
            ]
          : [
              { id: "gap-general-search", label: "Search demand", requiredSignalKinds: ["search-interest"], severity: "important", reason: "Broad workspaces benefit from demand-side search evidence.", candidateSourceIds: [] },
              { id: "gap-general-news", label: "Current narrative coverage", requiredSignalKinds: ["news-narrative"], severity: "important", reason: "Narrative/news signals are required for contextual trend explanation.", candidateSourceIds: [] },
            ];

  return templates.map((gap) => ({ ...gap, status: gapStatus(gap.requiredSignalKinds, evaluations, candidates) }));
}

export function planWorkspaceSources(workspace: IntelligenceWorkspace, researchRuntime: WorkspaceSourcePlan["researchRuntime"] = "registry-only"): WorkspaceSourcePlan {
  const evaluations = sourceRegistry
    .map((source) => evaluateSourceForWorkspace(workspace, source))
    .sort((a, b) => b.intelligenceFit - a.intelligenceFit || b.operationalFeasibility - a.operationalFeasibility);
  const candidates = researchRuntime === "registry-only" ? [] : candidatesForWorkspace(workspace);
  return {
    schemaVersion: "workspace-source-plan.v1",
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    generatedAt: new Date().toISOString(),
    methodologyVersion: "source-planner.v1",
    researchRuntime,
    evaluations,
    researchCandidates: candidates,
    gaps: buildGaps(workspace, evaluations, candidates),
    notes: [
      "Intelligence Fit and Operational Feasibility are intentionally separate.",
      "A PRIMARY source may still be access-constrained; activation decisions must respect connector/access status.",
      "Stage 04B-1 validation research uses a curated evidence pack. Live autonomous web research is not yet running inside the static Pages runtime.",
    ],
  };
}

export const savaValidationWorkspaces: IntelligenceWorkspace[] = [
  {
    schemaVersion: "workspace.v1",
    id: "validation-sava-game-publishing",
    name: "SAVA META — Game Publishing",
    status: "active",
    scope: {
      geographies: ["Vietnam", "Global"],
      languages: ["Vietnamese", "English"],
      industries: ["Gaming"],
      categories: ["Mobile Games", "Game Publishing"],
      products: ["Mobile game publishing"],
      audiences: ["Game studios", "Mobile gamers", "Game marketers"],
      objectives: ["Market opportunities", "Competitor intelligence", "Creative trends", "Publishing decisions"],
      riskBoundaries: [],
    },
    focusBrands: [{ id: "sava-meta-game", name: "SAVA META", source: "user", addedAt: VERIFIED_AT }],
    entityIntelligence: { autoDiscover: true, monitoredEntities: [], excludedEntities: [], intakeReferences: [] },
    monitoring: { modes: ["market-pulse", "watchlist", "ad-hoc"], broadDiscovery: true, adjacentCulture: true, globalBreakouts: true },
    createdAt: VERIFIED_AT,
    updatedAt: VERIFIED_AT,
  },
  {
    schemaVersion: "workspace.v1",
    id: "validation-sava-ai",
    name: "SAVA META — AI / Lumi-Lumus",
    status: "active",
    scope: {
      geographies: ["Vietnam", "Global"],
      languages: ["Vietnamese", "English"],
      industries: ["AI", "Software"],
      categories: ["AI SaaS", "Generative AI"],
      products: ["Lumi", "Lumus", "AI assistant"],
      audiences: ["AI users", "Business users", "Developers"],
      objectives: ["Product trends", "Competitor intelligence", "Content opportunities", "Market demand"],
      riskBoundaries: [],
    },
    focusBrands: [{ id: "sava-meta-ai", name: "SAVA META", source: "user", addedAt: VERIFIED_AT }],
    entityIntelligence: { autoDiscover: true, monitoredEntities: [], excludedEntities: [], intakeReferences: [] },
    monitoring: { modes: ["market-pulse", "watchlist", "ad-hoc"], broadDiscovery: true, adjacentCulture: true, globalBreakouts: true },
    createdAt: VERIFIED_AT,
    updatedAt: VERIFIED_AT,
  },
  {
    schemaVersion: "workspace.v1",
    id: "validation-sava-xr",
    name: "SAVA META — VR / XR",
    status: "active",
    scope: {
      geographies: ["Vietnam", "Global"],
      languages: ["Vietnamese", "English"],
      industries: ["VR", "XR", "Metaverse"],
      categories: ["Virtual Reality", "Mixed Reality", "Immersive experiences"],
      products: ["SAVRSE", "VR/XR solutions"],
      audiences: ["XR users", "Developers", "Brands", "Institutions"],
      objectives: ["Market opportunities", "Platform shifts", "Competitor intelligence", "Product marketing"],
      riskBoundaries: [],
    },
    focusBrands: [{ id: "sava-meta-xr", name: "SAVA META", source: "user", addedAt: VERIFIED_AT }],
    entityIntelligence: { autoDiscover: true, monitoredEntities: [], excludedEntities: [], intakeReferences: [] },
    monitoring: { modes: ["market-pulse", "watchlist", "ad-hoc"], broadDiscovery: true, adjacentCulture: true, globalBreakouts: true },
    createdAt: VERIFIED_AT,
    updatedAt: VERIFIED_AT,
  },
];

export function summarizePlan(plan: WorkspaceSourcePlan) {
  const byRole = (role: WorkspaceSourceEvaluation["disposition"]) => plan.evaluations.filter((evaluation) => evaluation.disposition === role);
  return {
    primary: byRole("primary"),
    supporting: byRole("supporting"),
    background: byRole("background"),
    excluded: byRole("exclude"),
    averageFit: clampScore(average(plan.evaluations.map((evaluation) => evaluation.intelligenceFit))),
    unresolvedGaps: plan.gaps.filter((gap) => gap.status !== "covered"),
  };
}
