import type { IntelligenceWorkspace } from "@trend-pulse/contracts";
import type { SourceCoverageGap, SourceRegistryEntry, WorkspaceSourceEvaluation, WorkspaceSourcePlan } from "@trend-pulse/contracts/source-intelligence";
import { evaluateSourceForWorkspace } from "./source-intelligence-engine";
import {
  planWorkspaceSources as basePlanWorkspaceSources,
  savaValidationWorkspaces,
  sourceRegistry as baseSourceRegistry,
} from "./source-intelligence-stage04b4";

const VERIFIED_AT = "2026-08-30";
const UPSTREAM_REPOSITORY = "https://github.com/athm793/meta-ads-scraper";
const UPSTREAM_REF = "737feeed5e86b9821dcf57129668a72b38876ca9";

const META_SOURCE: SourceRegistryEntry = {
  ...(baseSourceRegistry.find((source) => source.id === "meta-ad-library") as SourceRegistryEntry),
  sourceType: "social",
  accessMode: "open-web",
  connectorStatus: "manual-assisted",
  complianceStatus: "needs-review",
  freshness: "manual",
  evidenceRefs: [
    "https://www.facebook.com/ads/library/",
    UPSTREAM_REPOSITORY,
    `${UPSTREAM_REPOSITORY}/blob/${UPSTREAM_REF}/LICENSE`,
  ],
  accessNotes: [
    "Stage 04G adds a local-only interoperability bridge for JSON/webhook records from the public Meta Ad Library research tool athm793/meta-ads-scraper.",
    "SignalSource.sourceType remains social for signal.v1 compatibility; Stage 04G marks the evidence family explicitly as paid-ad in its dedicated snapshot and never treats it as organic social corroboration.",
    "The upstream integration is pinned to commit 737feeed5e86b9821dcf57129668a72b38876ca9 and is Apache-2.0; Trend Pulse does not vendor or execute its scraping/Playwright code.",
    "GitHub Actions does not scrape Meta. Scheduled production collection remains disabled for this source.",
    "Automated-access authorization/compliance is not established. Keep MANUAL-ASSISTED / experimental private validation until a fresh review authorizes broader use.",
    "Paid-ad intelligence is a separate evidence family and must not be treated as organic virality or independent cross-source corroboration merely because many ads exist.",
  ],
  lastVerifiedAt: VERIFIED_AT,
};

export const sourceRegistry: SourceRegistryEntry[] = baseSourceRegistry.map((source) => source.id === "meta-ad-library" ? META_SOURCE : source);

function reconcileGapCoverage(gaps: SourceCoverageGap[], evaluations: WorkspaceSourceEvaluation[]) {
  const usableIds = new Set(
    evaluations
      .filter((evaluation) => evaluation.disposition !== "exclude" && evaluation.intelligenceFit >= 6.3 && evaluation.operationalFeasibility >= 6)
      .map((evaluation) => evaluation.sourceId),
  );
  const usableKinds = new Set(sourceRegistry.filter((source) => usableIds.has(source.id)).flatMap((source) => source.signalKinds));
  return gaps.map((gap) => {
    if (gap.requiredSignalKinds.every((kind) => usableKinds.has(kind))) return { ...gap, status: "covered" as const };
    if (gap.requiredSignalKinds.some((kind) => usableKinds.has(kind))) return { ...gap, status: "partial" as const };
    return { ...gap, status: "uncovered" as const };
  });
}

export function planWorkspaceSources(
  workspace: IntelligenceWorkspace,
  researchRuntime: WorkspaceSourcePlan["researchRuntime"] = "registry-only",
): WorkspaceSourcePlan {
  const base = basePlanWorkspaceSources(workspace, researchRuntime);
  const rawMeta = evaluateSourceForWorkspace(workspace, META_SOURCE);
  const metaEvaluation: WorkspaceSourceEvaluation = {
    ...rawMeta,
    operationalFeasibility: Math.min(rawMeta.operationalFeasibility, 5.9),
    activationDecision: rawMeta.disposition === "exclude" ? "exclude" : "manual-assisted",
    rationale: [
      ...rawMeta.rationale,
      "Stage 04G local bridge is technically available for private validation, but automation/compliance is not sufficient to count Meta as scheduled operational coverage.",
      "Use imported ads as paid-creative context only; do not convert ad count, longevity or repeated advertiser creatives into organic trend corroboration.",
    ],
    evidenceRefs: META_SOURCE.evidenceRefs,
  };
  const evaluations = base.evaluations
    .map((evaluation) => evaluation.sourceId === "meta-ad-library" ? metaEvaluation : evaluation)
    .sort((a, b) => b.intelligenceFit - a.intelligenceFit || b.operationalFeasibility - a.operationalFeasibility);
  return {
    ...base,
    evaluations,
    gaps: reconcileGapCoverage(base.gaps, evaluations),
    notes: [
      ...base.notes,
      "Stage 04G introduces an experimental local paid-creative bridge for Meta Ad Library records without promoting Meta to scheduled ACTIVE collection.",
      "Paid-ad evidence remains a distinct evidence family; multiple Meta ads are not independent source corroboration.",
      "No scraping/browser automation from the upstream repository is embedded in Trend Pulse core or GitHub Actions.",
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
