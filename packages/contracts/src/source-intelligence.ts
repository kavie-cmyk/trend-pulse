import type { FreshnessClass, IntelligenceWorkspace, SourceAccessMode, SourcePlanRole, SourceType } from "./index";

export type SourceConnectorStatus =
  | "operational"
  | "not-built"
  | "ready-needs-credential"
  | "manual-assisted"
  | "runtime-deferred"
  | "paid-later"
  | "restricted";

export type SourceCostTier = "free" | "free-tier" | "paid" | "unknown";
export type SourceComplianceStatus = "verified" | "provisional" | "needs-review" | "restricted";
export type SourceRegistryKind = "connector" | "source" | "source-class";
export type SourcePlanDisposition = SourcePlanRole | "exclude";
export type SourceActivationDecision =
  | "activate-now"
  | "needs-credential"
  | "manual-assisted"
  | "connector-backlog"
  | "runtime-deferred"
  | "paid-later"
  | "restricted"
  | "exclude";

export type SourceSignalKind =
  | "video-attention"
  | "search-interest"
  | "news-narrative"
  | "creator"
  | "community"
  | "ad-creative"
  | "app-market"
  | "developer-ecosystem"
  | "research"
  | "cultural-attention"
  | "product-launch"
  | "competitor-activity";

export interface SourceQueryability {
  geography: boolean;
  language: boolean;
  category: boolean;
  keyword: boolean;
  entity: boolean;
  creator: boolean;
  timeRange: boolean;
}

export interface SourceQualityProfile {
  signalUniqueness: number;
  reliability: number;
  historicalDepth: number;
  granularity: number;
}

export interface SourceRegistryEntry {
  schemaVersion: "source-registry-entry.v1";
  id: string;
  name: string;
  kind: SourceRegistryKind;
  description: string;
  homepage?: string;
  sourceType: SourceType;
  signalKinds: SourceSignalKind[];
  accessMode: SourceAccessMode;
  connectorStatus: SourceConnectorStatus;
  costTier: SourceCostTier;
  complianceStatus: SourceComplianceStatus;
  freshness: FreshnessClass;
  geographyTags: string[];
  languageTags: string[];
  industryTags: string[];
  audienceTags: string[];
  queryability: SourceQueryability;
  quality: SourceQualityProfile;
  evidenceRefs: string[];
  accessNotes: string[];
  lastVerifiedAt: string;
}

export interface SourceEvaluationDimensions {
  workspaceRelevance: number;
  signalUniqueness: number;
  audienceCoverage: number;
  geographyCoverage: number;
  queryability: number;
  freshness: number;
  historicalDepth: number;
  reliability: number;
  accessCompliance: number;
  costEfficiency: number;
  automationFeasibility: number;
  granularity: number;
}

export interface WorkspaceSourceEvaluation {
  sourceId: string;
  sourceName: string;
  methodologyVersion: "source-eval.v0.1";
  intelligenceFit: number;
  operationalFeasibility: number;
  dimensions: SourceEvaluationDimensions;
  disposition: SourcePlanDisposition;
  activationDecision: SourceActivationDecision;
  rationale: string[];
  evidenceRefs: string[];
}

export interface SourceResearchCandidate {
  id: string;
  name: string;
  discoveredFor: string[];
  reason: string;
  likelySignalKinds: SourceSignalKind[];
  expectedFit: "high" | "medium" | "low";
  accessHypothesis: SourceConnectorStatus;
  evidenceRefs: string[];
  status: "research-candidate" | "promote-to-registry" | "defer" | "reject";
}

export interface SourceCoverageGap {
  id: string;
  label: string;
  requiredSignalKinds: SourceSignalKind[];
  severity: "critical" | "important" | "nice-to-have";
  status: "covered" | "partial" | "uncovered";
  reason: string;
  candidateSourceIds: string[];
}

export interface WorkspaceSourcePlan {
  schemaVersion: "workspace-source-plan.v1";
  workspaceId: IntelligenceWorkspace["id"];
  workspaceName: string;
  generatedAt: string;
  methodologyVersion: "source-planner.v1";
  researchRuntime: "registry-only" | "validation-research-pack" | "live-research";
  evaluations: WorkspaceSourceEvaluation[];
  researchCandidates: SourceResearchCandidate[];
  gaps: SourceCoverageGap[];
  notes: string[];
}
