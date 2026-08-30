import type { IntelligenceWorkspace } from "@trend-pulse/contracts";
import type { SourceCoverageGap, SourceRegistryEntry, WorkspaceSourceEvaluation, WorkspaceSourcePlan } from "@trend-pulse/contracts/source-intelligence";
import { evaluateSourceForWorkspace } from "./source-intelligence-engine";
import {
  planWorkspaceSources as basePlanWorkspaceSources,
  savaValidationWorkspaces,
  sourceRegistry as baseSourceRegistry,
} from "./source-intelligence-calibration";

const VERIFIED_AT = "2026-08-30";

const STAGE04B4_OPERATIONAL_SOURCE_IDS = new Set([
  "mastodon-social-trends",
  "lemmy-world-hot",
  "dev-forem-trends",
  "stackoverflow-hot",
]);

const STAGE04B4_ENTRIES: SourceRegistryEntry[] = [
  {
    schemaVersion: "source-registry-entry.v1",
    id: "mastodon-social-trends",
    name: "Mastodon.social Trends",
    kind: "connector",
    description: "Public instance-level trending tags with seven-day use/account history from Mastodon.social.",
    homepage: "https://docs.joinmastodon.org/methods/trends/",
    sourceType: "social",
    signalKinds: ["community", "creator"],
    accessMode: "official-api",
    connectorStatus: "operational",
    costTier: "free",
    complianceStatus: "verified",
    freshness: "near-live",
    geographyTags: ["global"],
    languageTags: ["multilingual"],
    industryTags: ["universal", "technology", "culture", "consumer"],
    audienceTags: ["general-public", "consumer", "creator", "professional"],
    queryability: { geography: false, language: false, category: false, keyword: false, entity: false, creator: false, timeRange: true },
    quality: { signalUniqueness: 8, reliability: 8, historicalDepth: 4, granularity: 7 },
    evidenceRefs: ["https://docs.joinmastodon.org/methods/trends/"],
    accessNotes: [
      "Mastodon documents trends/tags as OAuth Public; individual instances can still change public-preview policy.",
      "Stage 04B-4 runtime verified Mastodon.social and collected 20 trend-tag observations without authentication.",
      "Instance-local federation coverage is not treated as global social representativeness.",
    ],
    lastVerifiedAt: VERIFIED_AT,
  },
  {
    schemaVersion: "source-registry-entry.v1",
    id: "lemmy-world-hot",
    name: "Lemmy.world Hot",
    kind: "connector",
    description: "Public federated community post ranking and source-native vote/comment evidence from Lemmy.world.",
    homepage: "https://join-lemmy.org/docs/contributors/04-api.html",
    sourceType: "community",
    signalKinds: ["community", "creator"],
    accessMode: "official-api",
    connectorStatus: "operational",
    costTier: "free",
    complianceStatus: "verified",
    freshness: "near-live",
    geographyTags: ["global"],
    languageTags: ["multilingual"],
    industryTags: ["universal", "technology", "gaming", "consumer", "culture"],
    audienceTags: ["general-public", "consumer", "gamer", "developer", "professional"],
    queryability: { geography: false, language: false, category: true, keyword: false, entity: false, creator: true, timeRange: false },
    quality: { signalUniqueness: 8, reliability: 7, historicalDepth: 5, granularity: 8 },
    evidenceRefs: ["https://join-lemmy.org/docs/contributors/04-api.html", "https://join-lemmy.org/api/main"],
    accessNotes: [
      "Lemmy documents public client/read API paths; endpoint versions differ across deployments.",
      "Stage 04B-4 collector tries v4 then v3 read paths and runtime verified Lemmy.world with 20 observations.",
      "Instance/federation scope remains explicit and is not treated as a universal audience sample.",
    ],
    lastVerifiedAt: VERIFIED_AT,
  },
  {
    schemaVersion: "source-registry-entry.v1",
    id: "dev-forem-trends",
    name: "DEV / Forem Trends",
    kind: "connector",
    description: "Public semantic trend clusters from DEV Community, scored from article volume and engagement by Forem.",
    homepage: "https://developers.forem.com/api/v1",
    sourceType: "community",
    signalKinds: ["community", "developer-ecosystem", "product-launch"],
    accessMode: "official-api",
    connectorStatus: "operational",
    costTier: "free",
    complianceStatus: "verified",
    freshness: "near-live",
    geographyTags: ["global"],
    languageTags: ["english"],
    industryTags: ["ai", "software", "developer", "technology", "startup"],
    audienceTags: ["developer", "technical", "professional", "founder"],
    queryability: { geography: false, language: false, category: true, keyword: false, entity: false, creator: false, timeRange: false },
    quality: { signalUniqueness: 9, reliability: 8, historicalDepth: 5, granularity: 8 },
    evidenceRefs: ["https://developers.forem.com/api/v1"],
    accessNotes: [
      "Forem documents GET /api/trends as publicly accessible without authentication.",
      "Stage 04B-4 runtime verified DEV Community and collected 15 current semantic trend observations.",
      "Forem score remains a source-native community metric, not Trend Pulse Virality.",
    ],
    lastVerifiedAt: VERIFIED_AT,
  },
  {
    schemaVersion: "source-registry-entry.v1",
    id: "stackoverflow-hot",
    name: "Stack Overflow Hot Questions",
    kind: "connector",
    description: "Public specialist-community hot-question evidence for developer problems, tools and emerging technical demand.",
    homepage: "https://api.stackexchange.com/docs/questions",
    sourceType: "community",
    signalKinds: ["community", "developer-ecosystem"],
    accessMode: "official-api",
    connectorStatus: "operational",
    costTier: "free-tier",
    complianceStatus: "verified",
    freshness: "near-live",
    geographyTags: ["global"],
    languageTags: ["english"],
    industryTags: ["ai", "software", "developer", "technology"],
    audienceTags: ["developer", "technical", "professional"],
    queryability: { geography: false, language: false, category: true, keyword: true, entity: true, creator: true, timeRange: true },
    quality: { signalUniqueness: 8, reliability: 9, historicalDepth: 10, granularity: 9 },
    evidenceRefs: ["https://api.stackexchange.com/docs/questions"],
    accessNotes: [
      "Public read API supports hot question ordering without OAuth for this collection path.",
      "Stage 04B-4 runtime verified Stack Overflow and collected 20 hot-question observations.",
      "This is specialist developer demand, not a universal consumer social signal.",
    ],
    lastVerifiedAt: VERIFIED_AT,
  },
  {
    schemaVersion: "source-registry-entry.v1",
    id: "nostr-public-relays",
    name: "Nostr Public Relays",
    kind: "source-class",
    description: "Open NIP-01 relay protocol for public event retrieval, retained as a future source class rather than activated raw-note ingestion.",
    homepage: "https://github.com/nostr-protocol/nips/blob/master/01.md",
    sourceType: "social",
    signalKinds: ["community", "creator"],
    accessMode: "official-api",
    connectorStatus: "runtime-deferred",
    costTier: "free",
    complianceStatus: "provisional",
    freshness: "near-live",
    geographyTags: ["global"],
    languageTags: ["multilingual"],
    industryTags: ["universal", "technology", "culture"],
    audienceTags: ["general-public", "creator", "developer"],
    queryability: { geography: false, language: false, category: false, keyword: false, entity: false, creator: true, timeRange: true },
    quality: { signalUniqueness: 9, reliability: 5, historicalDepth: 4, granularity: 7 },
    evidenceRefs: ["https://github.com/nostr-protocol/nips/blob/master/01.md", "https://github.com/nostr-protocol/nips/blob/master/42.md"],
    accessNotes: [
      "NIP-01 defines public WebSocket relay retrieval, while individual relays may rate-limit or require authentication for some reads.",
      "Stage 04B-4 does not persist raw Nostr notes: there is no bounded source-native trend surface yet and relay moderation/access varies.",
      "Retain as RUNTIME-DEFERRED until a safe aggregation/query plan is defined and runtime-verified.",
    ],
    lastVerifiedAt: VERIFIED_AT,
  },
];

export const sourceRegistry: SourceRegistryEntry[] = [...baseSourceRegistry, ...STAGE04B4_ENTRIES];

function workspaceText(workspace: IntelligenceWorkspace) {
  return [
    workspace.name,
    ...workspace.scope.industries,
    ...workspace.scope.categories,
    ...workspace.scope.products,
    ...workspace.scope.audiences,
    ...workspace.scope.objectives,
    ...workspace.focusBrands.map((brand) => brand.name),
  ].join(" ").toLowerCase();
}

function hasSpecificDecisionScope(workspace: IntelligenceWorkspace) {
  return Boolean(
    workspace.scope.industries.length ||
      workspace.scope.categories.length ||
      workspace.scope.products.length ||
      workspace.focusBrands.length,
  );
}

function disposition(score: number): WorkspaceSourceEvaluation["disposition"] {
  if (score >= 8) return "primary";
  if (score >= 6.3) return "supporting";
  if (score >= 4.5) return "background";
  return "exclude";
}

function calibrateStage04B4(workspace: IntelligenceWorkspace, evaluation: WorkspaceSourceEvaluation): WorkspaceSourceEvaluation {
  const source = STAGE04B4_ENTRIES.find((item) => item.id === evaluation.sourceId);
  if (!source) return evaluation;
  let fit = evaluation.intelligenceFit;
  let operationalFeasibility = evaluation.operationalFeasibility;
  let activationDecision = evaluation.activationDecision;
  const notes: string[] = [];

  if (["mastodon-social-trends", "lemmy-world-hot"].includes(source.id) && hasSpecificDecisionScope(workspace)) {
    fit = Math.min(fit, 7.9);
    notes.push("Calibration cap: broad permissionless instance feed remains SUPPORTING until workspace-specific instance/query planning is validated.");
  }

  if (["dev-forem-trends", "stackoverflow-hot"].includes(source.id)) {
    const text = workspaceText(workspace);
    const specialistMatch = source.industryTags.some((tag) => text.includes(tag.toLowerCase()));
    if (!specialistMatch) {
      fit = Math.min(fit, 5.5);
      notes.push("Calibration cap: specialist developer/community source has no direct industry/category match for this workspace.");
    }
  }

  if (source.id === "nostr-public-relays") {
    fit = Math.min(fit, 7.5);
    notes.push("Runtime/safety defer: open protocol exists, but no bounded trend aggregation path is activated in Stage 04B-4.");
  }

  if (STAGE04B4_OPERATIONAL_SOURCE_IDS.has(source.id)) {
    operationalFeasibility = Math.max(operationalFeasibility, 9.2);
    activationDecision = "activate-now";
    notes.push("Stage 04B-4 runtime verified: public/no-auth collection succeeded on the twice-daily GitHub Actions runner.");
  }

  fit = Math.round(fit * 10) / 10;
  const nextDisposition = disposition(fit);
  return {
    ...evaluation,
    intelligenceFit: fit,
    operationalFeasibility,
    disposition: nextDisposition,
    activationDecision: nextDisposition === "exclude" ? "exclude" : activationDecision,
    rationale: [...evaluation.rationale, ...notes],
  };
}

function reconcileGapCoverage(gaps: SourceCoverageGap[], evaluations: WorkspaceSourceEvaluation[]) {
  const usableIds = new Set(
    evaluations
      .filter((evaluation) => evaluation.disposition !== "exclude" && evaluation.intelligenceFit >= 6.3 && evaluation.operationalFeasibility >= 6)
      .map((evaluation) => evaluation.sourceId),
  );
  const usableKinds = new Set(sourceRegistry.filter((source) => usableIds.has(source.id)).flatMap((source) => source.signalKinds));
  return gaps.map((gap) => {
    if (gap.requiredSignalKinds.every((kind) => usableKinds.has(kind))) return { ...gap, status: "covered" as const };
    if (gap.status === "uncovered" && gap.requiredSignalKinds.some((kind) => usableKinds.has(kind))) return { ...gap, status: "partial" as const };
    return gap;
  });
}

export function planWorkspaceSources(
  workspace: IntelligenceWorkspace,
  researchRuntime: WorkspaceSourcePlan["researchRuntime"] = "registry-only",
): WorkspaceSourcePlan {
  const base = basePlanWorkspaceSources(workspace, researchRuntime);
  const expansionEvaluations = STAGE04B4_ENTRIES.map((source) => evaluateSourceForWorkspace(workspace, source)).map((evaluation) => calibrateStage04B4(workspace, evaluation));
  const evaluations = [...base.evaluations, ...expansionEvaluations]
    .sort((a, b) => b.intelligenceFit - a.intelligenceFit || b.operationalFeasibility - a.operationalFeasibility);
  return {
    ...base,
    evaluations,
    gaps: reconcileGapCoverage(base.gaps, evaluations),
    notes: [
      ...base.notes,
      "Stage 04B-4 adds four runtime-verified public/no-auth source instances: Mastodon.social Trends, Lemmy.world Hot, DEV/Forem Trends and Stack Overflow Hot Questions.",
      "Permissionless does not imply globally representative: instance/community bias remains explicit and broad feeds are capped until workspace-specific querying is validated.",
      "Nostr remains runtime/safety-deferred rather than ingesting raw relay text merely to increase source count.",
    ],
  };
}

export function summarizePlan(plan: WorkspaceSourcePlan) {
  const byRole = (role: WorkspaceSourceEvaluation["disposition"]) => plan.evaluations.filter((evaluation) => evaluation.disposition === role);
  const values = plan.evaluations.map((evaluation) => evaluation.intelligenceFit);
  const averageFit = values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : 0;
  return {
    primary: byRole("primary"),
    supporting: byRole("supporting"),
    background: byRole("background"),
    excluded: byRole("exclude"),
    averageFit,
    unresolvedGaps: plan.gaps.filter((gap) => gap.status !== "covered"),
  };
}

export { savaValidationWorkspaces };
