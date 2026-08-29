import type { IntelligenceWorkspace } from "@trend-pulse/contracts";
import type { SourceCoverageGap, SourceRegistryEntry, WorkspaceSourceEvaluation, WorkspaceSourcePlan } from "@trend-pulse/contracts/source-intelligence";
import {
  evaluateSourceForWorkspace,
  planWorkspaceSources as basePlanWorkspaceSources,
  savaValidationWorkspaces,
  sourceRegistry as baseSourceRegistry,
} from "./source-intelligence-engine";

const VERIFIED_AT = "2026-08-29";

const STAGE04B2_OPERATIONAL_SOURCE_IDS = new Set([
  "publisher-rss-adapter",
  "github-rest-api",
  "hacker-news-api",
]);

const STAGE04B3_OPERATIONAL_SOURCE_IDS = new Set(["bluesky-trends-api"]);

const STAGE04B3_SOCIAL_ENTRIES: SourceRegistryEntry[] = [
  {
    schemaVersion: "source-registry-entry.v1",
    id: "bluesky-trends-api",
    name: "Bluesky Public Trends API",
    kind: "connector",
    description: "Public Bluesky AppView trend snapshots with source-native topic, category, status, start time and post-count signals.",
    homepage: "https://docs.bsky.app/docs/advanced-guides/api-directory",
    sourceType: "social",
    signalKinds: ["community", "creator"],
    accessMode: "official-api",
    connectorStatus: "operational",
    costTier: "free",
    complianceStatus: "verified",
    freshness: "near-live",
    geographyTags: ["global"],
    languageTags: ["multilingual"],
    industryTags: ["universal", "technology", "gaming", "ai", "xr", "consumer", "culture"],
    audienceTags: ["general-public", "consumer", "creator", "gamer", "developer"],
    queryability: { geography: false, language: false, category: false, keyword: false, entity: false, creator: false, timeRange: false },
    quality: { signalUniqueness: 8, reliability: 8, historicalDepth: 3, granularity: 7 },
    evidenceRefs: [
      "https://docs.bsky.app/docs/advanced-guides/api-directory",
      "https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrends",
    ],
    accessNotes: [
      "Bluesky documents many public AppView requests as unauthenticated through public.api.bsky.app.",
      "Stage 04B-3 runtime verifies the getTrends endpoint twice daily; source-native trends are not Trend Pulse cross-source Trend Candidates.",
    ],
    lastVerifiedAt: VERIFIED_AT,
  },
  {
    schemaVersion: "source-registry-entry.v1",
    id: "reddit-data-api",
    name: "Reddit Data API",
    kind: "connector",
    description: "Community discussion and niche-topic evidence with strong potential for language, pain-point and emerging-narrative intelligence.",
    homepage: "https://redditinc.com/policies/data-api-terms",
    sourceType: "social",
    signalKinds: ["community", "creator", "competitor-activity"],
    accessMode: "official-api",
    connectorStatus: "restricted",
    costTier: "free-tier",
    complianceStatus: "restricted",
    freshness: "near-live",
    geographyTags: ["global"],
    languageTags: ["multilingual"],
    industryTags: ["universal", "gaming", "ai", "xr", "beauty", "consumer", "technology"],
    audienceTags: ["consumer", "gamer", "developer", "professional", "general-public"],
    queryability: { geography: false, language: false, category: true, keyword: true, entity: true, creator: true, timeRange: true },
    quality: { signalUniqueness: 10, reliability: 8, historicalDepth: 8, granularity: 9 },
    evidenceRefs: ["https://redditinc.com/policies/data-api-terms", "https://redditinc.com/policies/developer-terms"],
    accessNotes: [
      "Current Data API terms require registration, OAuth identity and eligibility to accept the terms.",
      "Not activated in the current personal runtime; no bypass or undocumented scraping path is used.",
    ],
    lastVerifiedAt: VERIFIED_AT,
  },
];

export const sourceRegistry: SourceRegistryEntry[] = [...baseSourceRegistry, ...STAGE04B3_SOCIAL_ENTRIES].map((source) => {
  if (!STAGE04B2_OPERATIONAL_SOURCE_IDS.has(source.id) && !STAGE04B3_OPERATIONAL_SOURCE_IDS.has(source.id)) return source;
  const stage = STAGE04B3_OPERATIONAL_SOURCE_IDS.has(source.id) ? "04B-3" : "04B-2";
  return {
    ...source,
    connectorStatus: "operational",
    accessNotes: [
      ...source.accessNotes.filter((note) => !/not built yet/i.test(note)),
      `Stage ${stage} runtime verified in the twice-daily GitHub Actions backbone on 2026-08-29.`,
    ],
  };
});

function norm(value: string) {
  return value.trim().toLowerCase();
}

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

function sourceHasSpecificMatch(workspace: IntelligenceWorkspace, sourceId: string) {
  const source = sourceRegistry.find((item) => item.id === sourceId);
  if (!source) return false;
  const text = workspaceText(workspace);
  return source.industryTags.some((tag) => {
    const value = norm(tag);
    return !["universal", "global", "multilingual"].includes(value) && text.includes(value);
  });
}

function family(workspace: IntelligenceWorkspace) {
  const text = workspaceText(workspace);
  if (/game|gaming|publisher|mobile game/.test(text)) return "gaming";
  if (/\bai\b|artificial intelligence|lumi|lumus|saas/.test(text)) return "ai";
  if (/\bvr\b|\bxr\b|metaverse|savrs|virtual reality|mixed reality/.test(text)) return "xr";
  if (/beauty|skincare|cosmetic|makeup/.test(text)) return "beauty";
  return "general";
}

function disposition(score: number): WorkspaceSourceEvaluation["disposition"] {
  if (score >= 8) return "primary";
  if (score >= 6.3) return "supporting";
  if (score >= 4.5) return "background";
  return "exclude";
}

function calibrateEvaluation(workspace: IntelligenceWorkspace, evaluation: WorkspaceSourceEvaluation): WorkspaceSourceEvaluation {
  const source = sourceRegistry.find((item) => item.id === evaluation.sourceId);
  if (!source) return evaluation;

  let fit = evaluation.intelligenceFit;
  let operationalFeasibility = evaluation.operationalFeasibility;
  let activationDecision = evaluation.activationDecision;
  const notes: string[] = [];

  if (!source.industryTags.includes("universal") && !sourceHasSpecificMatch(workspace, source.id)) {
    fit = Math.min(fit, 5.5);
    notes.push("Calibration cap: specialist source has no direct industry/category match for this workspace.");
  }

  if (source.kind === "source-class") {
    fit = Math.min(fit, 7.9);
    notes.push("Calibration cap: a generic source class cannot become PRIMARY until a concrete source/feed is evaluated.");
  }

  if (source.id === "wikimedia-pageviews" && hasSpecificDecisionScope(workspace)) {
    fit = Math.min(fit, 5.8);
    notes.push("Calibration cap: broad Wikimedia attention remains BACKGROUND for specific brand/category workspaces.");
  }

  if (source.id === "gdelt-doc") {
    fit = Math.min(fit, 7.8);
    notes.push("Calibration cap: broad news discovery is SUPPORTING until workspace-specific query performance is validated.");
  }

  const workspaceFamily = family(workspace);
  if (source.id === "meta-ad-library" && !["gaming", "beauty"].includes(workspaceFamily)) {
    fit = Math.min(fit, 7.7);
    notes.push("Calibration cap: ad creative is useful but not a default PRIMARY signal for this workspace family.");
  }

  if (STAGE04B2_OPERATIONAL_SOURCE_IDS.has(source.id) || STAGE04B3_OPERATIONAL_SOURCE_IDS.has(source.id)) {
    operationalFeasibility = Math.max(operationalFeasibility, 9);
    activationDecision = "activate-now";
    notes.push(`Stage ${STAGE04B3_OPERATIONAL_SOURCE_IDS.has(source.id) ? "04B-3" : "04B-2"} runtime verified: connector is operational in the twice-daily GitHub Actions backbone.`);
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
  const socialExtensionEvaluations = STAGE04B3_SOCIAL_ENTRIES.map((source) => evaluateSourceForWorkspace(workspace, source));
  const evaluations = [...base.evaluations, ...socialExtensionEvaluations]
    .map((evaluation) => calibrateEvaluation(workspace, evaluation))
    .sort((a, b) => b.intelligenceFit - a.intelligenceFit || b.operationalFeasibility - a.operationalFeasibility);
  return {
    ...base,
    evaluations,
    gaps: reconcileGapCoverage(base.gaps, evaluations),
    notes: [
      ...base.notes,
      "Calibration v0.1 adds semantic caps for mismatched specialist sources, generic source classes, broad Wikimedia, broad news, and non-core ad intelligence.",
      "Stage 04B-2 runtime promotion marks RSS/Atom, GitHub REST and Hacker News operational only after real collection was verified in the twice-daily workflow.",
      "Stage 04B-3 adds Bluesky public trends as an operational social source and keeps Reddit access-constrained rather than using an undocumented scraping path.",
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
