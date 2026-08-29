import type {
  FocusBrand,
  IntelligenceWorkspace,
  SourceActivationDecision,
  SourceFitLevel,
  SourceRegistryEntry,
  SourceResearchGap,
  SourceResearchResult,
  SourceResearchRole,
  SourceSignalKind,
  SourceWorkspaceEvaluation,
} from "@trend-pulse/contracts";
import { sourceRegistry } from "./source-registry";

const FRESHNESS_SCORE: Record<string, number> = {
  "near-live": 10,
  hourly: 9,
  daily: 7,
  manual: 3,
  unknown: 4,
};

const ACCESS_SCORE: Record<SourceRegistryEntry["accessStatus"], number> = {
  operational: 10,
  "ready-needs-credential": 7.5,
  planned: 6.5,
  "manual-assisted": 4,
  "runtime-deferred": 3,
  "paid-later": 2.5,
  restricted: 1,
};

const COMPLIANCE_SCORE: Record<SourceRegistryEntry["complianceStatus"], number> = {
  verified: 10,
  "terms-review-required": 6,
  "approval-required": 4,
  restricted: 1,
  unknown: 3,
};

type DomainProfile = {
  key: string;
  label: string;
  tags: string[];
  requiredSignalKinds: SourceSignalKind[];
};

const DOMAIN_PROFILES: DomainProfile[] = [
  {
    key: "game-publishing",
    label: "Game Publishing",
    tags: ["gaming", "mobile-games", "game-publishing", "games", "studios", "user-acquisition"],
    requiredSignalKinds: ["search-demand", "content-velocity", "creator", "community", "news-narrative", "product-store", "ad-creative", "brand-competitive"],
  },
  {
    key: "ai-saas",
    label: "AI / SaaS",
    tags: ["ai", "artificial-intelligence", "machine-learning", "saas", "developer-tools", "open-source", "startups"],
    requiredSignalKinds: ["search-demand", "developer-ecosystem", "research", "news-narrative", "launch-product", "community", "content-velocity", "brand-competitive"],
  },
  {
    key: "xr-vr",
    label: "VR / XR",
    tags: ["xr", "vr", "ar", "metaverse", "spatial-computing", "vr-games", "hardware"],
    requiredSignalKinds: ["search-demand", "content-velocity", "news-narrative", "product-store", "developer-ecosystem", "community", "brand-competitive"],
  },
  {
    key: "beauty-consumer",
    label: "Beauty / Consumer",
    tags: ["beauty", "skincare", "cosmetics", "consumer", "creator"],
    requiredSignalKinds: ["search-demand", "content-velocity", "creator", "community", "ad-creative", "brand-competitive", "news-narrative"],
  },
];

function norm(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function clamp(value: number) {
  return Math.max(0, Math.min(10, Math.round(value * 10) / 10));
}

function workspaceTerms(workspace: IntelligenceWorkspace) {
  return [
    workspace.name,
    ...workspace.scope.industries,
    ...workspace.scope.categories,
    ...workspace.scope.products,
    ...workspace.scope.audiences,
    ...workspace.scope.objectives,
    ...workspace.focusBrands.map((brand) => brand.name),
  ].map(norm).filter(Boolean);
}

function fuzzyMatches(value: string, candidate: string) {
  const left = norm(value);
  const right = norm(candidate);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

export function inferWorkspaceProfiles(workspace: IntelligenceWorkspace): DomainProfile[] {
  const terms = workspaceTerms(workspace);
  const matches = DOMAIN_PROFILES.filter((profile) => profile.tags.some((tag) => terms.some((term) => fuzzyMatches(term, tag))));
  if (matches.length) return matches;
  return [{
    key: "general-market",
    label: "General Market Intelligence",
    tags: ["global", "consumer", "b2b", "culture", "news"],
    requiredSignalKinds: ["search-demand", "news-narrative", "content-velocity", "brand-competitive"],
  }];
}

function sourceDomainMatch(source: SourceRegistryEntry, profiles: DomainProfile[]) {
  const tags = source.coverageTags;
  let hits = 0;
  let total = 0;
  for (const profile of profiles) {
    total += profile.tags.length;
    hits += profile.tags.filter((tag) => tags.some((sourceTag) => fuzzyMatches(sourceTag, tag))).length;
  }
  if (!total) return 4;
  const ratio = hits / Math.max(1, Math.min(total, 6));
  const broadBonus = tags.includes("global") ? 1 : 0;
  return clamp(2 + ratio * 7 + broadBonus);
}

function requiredSignals(profiles: DomainProfile[]) {
  return Array.from(new Set(profiles.flatMap((profile) => profile.requiredSignalKinds)));
}

function sourceSignalCoverage(source: SourceRegistryEntry, required: SourceSignalKind[]) {
  if (!required.length) return 5;
  const matched = required.filter((kind) => source.signalKinds.includes(kind)).length;
  return clamp((matched / required.length) * 10);
}

function geographyFit(source: SourceRegistryEntry, workspace: IntelligenceWorkspace) {
  if (!workspace.scope.geographies.length) return 8;
  if (source.geographies.some((geo) => geo.includes("global") || geo.includes("region") || geo.includes("market") || geo.includes("geo-target"))) return 9;
  return 5;
}

function intelligenceFit(source: SourceRegistryEntry, workspace: IntelligenceWorkspace, profiles: DomainProfile[]) {
  const required = requiredSignals(profiles);
  const domain = sourceDomainMatch(source, profiles);
  const signals = sourceSignalCoverage(source, required);
  const queryability = source.queryabilityScore;
  const freshness = FRESHNESS_SCORE[source.freshness] ?? 4;
  const geography = geographyFit(source, workspace);
  const score = clamp(domain * 0.35 + signals * 0.3 + queryability * 0.15 + freshness * 0.1 + geography * 0.1);
  return { score, domain, signals, queryability, freshness, geography };
}

function operationalFeasibility(source: SourceRegistryEntry) {
  const access = ACCESS_SCORE[source.accessStatus];
  const automation = source.automationFeasibilityScore;
  const compliance = COMPLIANCE_SCORE[source.complianceStatus];
  const score = clamp(access * 0.45 + automation * 0.3 + compliance * 0.25);
  return { score, access, automation, compliance };
}

function fitLevel(score: number): SourceFitLevel {
  if (score >= 7.3) return "high";
  if (score >= 5.2) return "medium";
  if (score >= 3.5) return "low";
  return "not-applicable";
}

function roleFor(score: number): SourceResearchRole {
  if (score >= 7.3) return "primary";
  if (score >= 5.2) return "supporting";
  if (score >= 3.5) return "background";
  return "exclude";
}

function activationDecision(source: SourceRegistryEntry, role: SourceResearchRole): SourceActivationDecision {
  if (role === "exclude") return "exclude";
  switch (source.accessStatus) {
    case "operational": return "activate-now";
    case "ready-needs-credential": return "activate-when-credentialed";
    case "planned": return "build-connector";
    case "manual-assisted": return "manual-assisted";
    case "runtime-deferred": return "defer-runtime";
    case "paid-later": return "paid-later";
    case "restricted": return "exclude";
  }
}

export function evaluateSourceForWorkspace(source: SourceRegistryEntry, workspace: IntelligenceWorkspace, now = new Date()): SourceWorkspaceEvaluation {
  const profiles = inferWorkspaceProfiles(workspace);
  const fit = intelligenceFit(source, workspace, profiles);
  const ops = operationalFeasibility(source);
  const role = roleFor(fit.score);
  const decision = activationDecision(source, role);

  return {
    sourceId: source.sourceId,
    workspaceId: workspace.id,
    intelligenceFitScore: fit.score,
    operationalFeasibilityScore: ops.score,
    fit: fitLevel(fit.score),
    role,
    activationDecision: decision,
    factors: [
      { key: "domain-fit", label: "Workspace / domain relevance", score: fit.domain, note: `Coverage tags matched against ${profiles.map((profile) => profile.label).join(" + ")}.` },
      { key: "signal-coverage", label: "Required signal coverage", score: fit.signals, note: `Covers ${source.signalKinds.join(", ")}.` },
      { key: "queryability", label: "Queryability", score: fit.queryability, note: source.apiOrFeedAvailable ? "Programmatic API/feed exists or is documented." : "No production programmatic path is assumed yet." },
      { key: "freshness", label: "Freshness", score: fit.freshness, note: `Source freshness class: ${source.freshness}.` },
      { key: "geography", label: "Geography coverage", score: fit.geography, note: source.geographies.join(", ") },
      { key: "access", label: "Access feasibility", score: ops.access, note: `Access status: ${source.accessStatus}.` },
      { key: "automation", label: "Automation feasibility", score: ops.automation, note: source.termsNote },
      { key: "compliance", label: "Compliance readiness", score: ops.compliance, note: source.commercialUseNote },
    ],
    rationale: [
      `${source.name} is ${fitLevel(fit.score)} fit for this workspace and is ranked ${role}.`,
      `Intelligence Fit ${fit.score}/10; Operational Feasibility ${ops.score}/10 using Source Evaluation v0.1 heuristic weights.`,
      `Activation decision: ${decision}.`,
    ],
    evidenceRefs: source.evidenceRefs,
    evaluatedAt: now.toISOString(),
  };
}

function gapLabel(kind: SourceSignalKind) {
  const labels: Record<SourceSignalKind, string> = {
    attention: "Broad attention",
    "search-demand": "Search demand",
    "content-velocity": "Content velocity",
    creator: "Creator propagation",
    community: "Community discussion",
    "news-narrative": "News / narrative",
    "product-store": "Product / store intelligence",
    "developer-ecosystem": "Developer ecosystem",
    research: "Research / technical weak signals",
    "ad-creative": "Ad creative intelligence",
    "launch-product": "Launch / product intelligence",
    "cultural-event": "Cultural events",
    "brand-competitive": "Brand / competitor intelligence",
  };
  return labels[kind];
}

function buildGaps(workspace: IntelligenceWorkspace, evaluations: SourceWorkspaceEvaluation[], profiles: DomainProfile[]): SourceResearchGap[] {
  const required = requiredSignals(profiles);
  return required.flatMap((kind) => {
    const candidates = evaluations
      .filter((evaluation) => {
        const source = sourceRegistry.find((item) => item.sourceId === evaluation.sourceId);
        return Boolean(source?.signalKinds.includes(kind));
      })
      .sort((a, b) => (b.intelligenceFitScore + b.operationalFeasibilityScore) - (a.intelligenceFitScore + a.operationalFeasibilityScore));

    const usable = candidates.some((evaluation) => evaluation.intelligenceFitScore >= 6.5 && evaluation.operationalFeasibilityScore >= 5.5 && evaluation.activationDecision !== "exclude");
    if (usable) return [];

    const constrained = candidates.some((evaluation) => evaluation.intelligenceFitScore >= 6.5);
    return [{
      id: `${workspace.id}-gap-${kind}`,
      label: gapLabel(kind),
      description: constrained
        ? `High-value ${gapLabel(kind).toLowerCase()} sources exist, but current access/runtime/compliance is not strong enough for dependable automated collection.`
        : `No source in the current research universe is strong enough to cover ${gapLabel(kind).toLowerCase()} for this workspace. Source Research should discover additional candidates.`,
      requiredSignalKinds: [kind],
      priority: ["search-demand", "content-velocity", "community", "product-store", "developer-ecosystem"].includes(kind) ? "high" : "medium",
      candidateSourceIds: candidates.slice(0, 4).map((candidate) => candidate.sourceId),
    } satisfies SourceResearchGap];
  });
}

export function researchSourcesForWorkspace(workspace: IntelligenceWorkspace, now = new Date()): SourceResearchResult {
  const profiles = inferWorkspaceProfiles(workspace);
  const evaluatedSources = sourceRegistry
    .map((source) => evaluateSourceForWorkspace(source, workspace, now))
    .sort((a, b) => {
      if (a.role !== b.role) {
        const rank: Record<SourceResearchRole, number> = { primary: 0, supporting: 1, background: 2, exclude: 3 };
        return rank[a.role] - rank[b.role];
      }
      return b.intelligenceFitScore - a.intelligenceFitScore;
    });

  const newCandidateSourceIds = evaluatedSources
    .filter((evaluation) => {
      const source = sourceRegistry.find((item) => item.sourceId === evaluation.sourceId);
      return source?.researchOrigin === "web-research" && source.accessStatus !== "operational" && evaluation.role !== "exclude";
    })
    .map((evaluation) => evaluation.sourceId);

  const gaps = buildGaps(workspace, evaluatedSources, profiles);

  return {
    schemaVersion: "source-research.v1",
    workspaceId: workspace.id,
    generatedAt: now.toISOString(),
    sourceUniverseIds: sourceRegistry.map((source) => source.sourceId),
    evaluatedSources,
    newCandidateSourceIds,
    gaps,
    researchNotes: [
      `Workspace classified as ${profiles.map((profile) => profile.label).join(" + ")}.`,
      "Source Research v0.1 combines the persistent Source Registry with sources verified during the 2026-08-29 research pass.",
      "It does not yet launch autonomous web research from the static browser. A future server-side Source Research runtime may discover sources outside this registry and append them after evidence/access review.",
      "Intelligence Fit and Operational Feasibility are separate by design: a valuable source may remain access-constrained, paid-later or restricted.",
    ],
  };
}

function focusBrand(name: string): FocusBrand {
  return { id: `focus-${norm(name)}`, name, source: "user", addedAt: "2026-08-29T00:00:00.000Z" };
}

function makeValidationWorkspace(id: string, name: string, categories: string[], products: string[], audiences: string[], objectives: string[]): IntelligenceWorkspace {
  return {
    schemaVersion: "workspace.v1",
    id,
    name,
    status: "active",
    scope: {
      geographies: ["Vietnam", "Global"],
      languages: ["Vietnamese", "English"],
      industries: ["Technology"],
      categories,
      products,
      audiences,
      objectives,
      riskBoundaries: [],
    },
    focusBrands: [focusBrand("SAVA META")],
    entityIntelligence: { autoDiscover: true, monitoredEntities: [], excludedEntities: [], intakeReferences: [] },
    monitoring: { modes: ["market-pulse", "watchlist", "ad-hoc"], broadDiscovery: true, adjacentCulture: true, globalBreakouts: true },
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
  };
}

export const savaValidationWorkspaces: IntelligenceWorkspace[] = [
  makeValidationWorkspace(
    "validation-sava-game-publishing",
    "SAVA META — Game Publishing",
    ["Gaming", "Mobile Games", "Game Publishing"],
    ["Mobile game publishing"],
    ["Game studios", "Mobile gamers", "Game publishers"],
    ["Market opportunities", "Competitor monitoring", "Content opportunities", "User acquisition", "Product marketing"],
  ),
  makeValidationWorkspace(
    "validation-sava-ai",
    "SAVA META — AI / Lumi-Lumus",
    ["Artificial Intelligence", "AI SaaS", "Developer Tools"],
    ["Lumi", "Lumus", "AI products"],
    ["AI users", "Businesses", "Knowledge workers", "Developers"],
    ["Market opportunities", "Product launches", "Search demand", "Competitor monitoring", "Product marketing"],
  ),
  makeValidationWorkspace(
    "validation-sava-xr",
    "SAVA META — VR / XR",
    ["Virtual Reality", "XR", "Metaverse", "Spatial Computing"],
    ["SAVRSE", "VR / XR solutions"],
    ["VR users", "Enterprises", "Institutions", "Developers"],
    ["Market opportunities", "Product launches", "Competitor monitoring", "Content opportunities", "Business development"],
  ),
];
