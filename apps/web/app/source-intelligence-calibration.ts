import type { IntelligenceWorkspace } from "@trend-pulse/contracts";
import type { WorkspaceSourceEvaluation, WorkspaceSourcePlan } from "@trend-pulse/contracts/source-intelligence";
import {
  planWorkspaceSources as basePlanWorkspaceSources,
  savaValidationWorkspaces,
  sourceRegistry,
} from "./source-intelligence-engine";

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

  fit = Math.round(fit * 10) / 10;
  const nextDisposition = disposition(fit);
  return {
    ...evaluation,
    intelligenceFit: fit,
    disposition: nextDisposition,
    activationDecision: nextDisposition === "exclude" ? "exclude" : evaluation.activationDecision,
    rationale: [...evaluation.rationale, ...notes],
  };
}

export function planWorkspaceSources(
  workspace: IntelligenceWorkspace,
  researchRuntime: WorkspaceSourcePlan["researchRuntime"] = "registry-only",
): WorkspaceSourcePlan {
  const base = basePlanWorkspaceSources(workspace, researchRuntime);
  const evaluations = base.evaluations
    .map((evaluation) => calibrateEvaluation(workspace, evaluation))
    .sort((a, b) => b.intelligenceFit - a.intelligenceFit || b.operationalFeasibility - a.operationalFeasibility);
  return {
    ...base,
    evaluations,
    notes: [...base.notes, "Calibration v0.1 adds semantic caps for mismatched specialist sources, generic source classes, broad Wikimedia, broad news, and non-core ad intelligence."],
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

export { savaValidationWorkspaces, sourceRegistry };
