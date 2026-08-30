import type { BrandProfileFieldKey, BrandProfileProvenanceType } from "./brand-profile";

export type BrandProfileClaimOrigin05B = BrandProfileProvenanceType;
export type BrandProfileClaimKind05B = "profile-context" | "external-evidence";
export type BrandProfileClaimRelationship05B = "profile-context" | "supports" | "adds-context" | "contradicts";
export type BrandProfileClaimStatus05B = "usable" | "pending" | "rejected";

export interface BrandProfileResearchClaim05B {
  schemaVersion: "brand-profile-research-claim-05b.v1";
  id: string;
  workspaceId: string;
  focusBrandId: string;
  field: BrandProfileFieldKey;
  values: string[];
  sourceType: Extract<BrandProfileProvenanceType, "pasted-brief" | "drive-reference" | "url-reference" | "system-research">;
  sourceLabel: string;
  evidenceRefs: string[];
  relationshipToProfile: Exclude<BrandProfileClaimRelationship05B, "profile-context">;
  status: "resolved" | "pending" | "rejected";
  capturedAt: string;
}

export interface BrandProfileClaim05B {
  schemaVersion: "brand-profile-claim-05b.v1";
  id: string;
  workspaceId: string;
  focusBrandId: string;
  field: BrandProfileFieldKey;
  values: string[];
  origin: BrandProfileClaimOrigin05B;
  sourceLabel: string;
  claimKind: BrandProfileClaimKind05B;
  relationshipToProfile: BrandProfileClaimRelationship05B;
  status: BrandProfileClaimStatus05B;
  evidenceRefs: string[];
  capturedAt: string;
}

export type BrandProfileResolutionStatus05B = "blocked" | "partial" | "usable-provisional" | "conflicted";
export type BrandResearchRuntimeStatus05B = "not-executed" | "evidence-input-reconciled";

export interface BrandProfileConflict05B {
  id: string;
  field?: BrandProfileFieldKey;
  claimIds: string[];
  description: string;
  evidenceRefs: string[];
}

export interface BrandProfileResolution05B {
  schemaVersion: "brand-profile-resolution-05b.v1";
  methodologyVersion: "brand-claim-reconciliation-05b.v1";
  workspaceId: string;
  focusBrandId: string;
  profileId: string;
  brandName: string;
  readinessStatus: "blocked" | "partial" | "ready-for-provisional-brand-fit";
  status: BrandProfileResolutionStatus05B;
  researchRuntimeStatus: BrandResearchRuntimeStatus05B;
  claims: BrandProfileClaim05B[];
  conflicts: BrandProfileConflict05B[];
  pendingReferenceIds: string[];
  usableFieldCount: number;
  externallyResolvedClaimCount: number;
  rationale: string[];
  resolvedAt: string;
}

export type BrandFitEvidenceClass05B = "weak-signal" | "trend-candidate" | "repeated-single-source-cluster";

export interface BrandFitTrendEvidence05B {
  evidenceClass: BrandFitEvidenceClass05B;
  id: string;
  workspaceId: string;
  title: string;
  summary?: string;
  status?: "candidate" | "corroborated";
  lifecycleStage?: string;
  signalIds: string[];
  sourceIds: string[];
  independentSourceDiversity?: number;
  independentSourceFamilyDiversity?: number;
  resolutionAnchors?: string[];
  geographies?: string[];
  languages?: string[];
  evidenceRefs?: string[];
}

export type BrandFitFactorStatus05B = "supported" | "partial" | "tension" | "unavailable" | "not-applicable";

export interface BrandFitFactorTrace05B {
  brandFields: BrandProfileFieldKey[];
  brandClaimIds: string[];
  trendCandidateId: string;
  trendSignalIds: string[];
  trendEvidenceRefs: string[];
}

export interface BrandFitFactorAssessment05B {
  key:
    | "category-relevance"
    | "audience-overlap"
    | "product-relevance"
    | "positioning-value-alignment"
    | "tone-of-voice-fit"
    | "visual-code-fit"
    | "market-relevance"
    | "context-seasonality"
    | "brand-safety-risk"
    | "execution-naturalness";
  label: string;
  status: BrandFitFactorStatus05B;
  matchedProfileValues: string[];
  matchedTrendTerms: string[];
  rationale: string[];
  trace: BrandFitFactorTrace05B;
}

export type BrandFitAssessmentStatus05B = "unavailable" | "provisional";
export type BrandFitSemanticResult05B = "unavailable" | "insufficient-evidence" | "mixed-evidence" | "provisional-alignment" | "caution";
export type BrandFitTrendEvidenceMaturity05B = "weak-signal" | "same-source-only" | "candidate-unconfirmed" | "independently-corroborated";

export interface BrandFitAssessment05B {
  schemaVersion: "brand-fit-assessment-05b.v1";
  methodologyVersion: "brand-fit-factor-trace-05b.v1";
  workspaceId: string;
  focusBrandId: string;
  trendCandidateId: string;
  assessmentStatus: BrandFitAssessmentStatus05B;
  semanticResult: BrandFitSemanticResult05B;
  trendEvidenceMaturity: BrandFitTrendEvidenceMaturity05B;
  numericScoreStatus: "unavailable";
  numericScoreReason: string;
  factorCoverage: {
    supported: number;
    partial: number;
    tension: number;
    unavailable: number;
    notApplicable: number;
  };
  factors: BrandFitFactorAssessment05B[];
  rationale: string[];
  generatedAt: string;
}
