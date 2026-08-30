import type { BrandIntelligenceProfile } from "./index";

export type BrandProfileFieldKey =
  | "categories"
  | "markets"
  | "targetAudiences"
  | "positioning"
  | "valueProposition"
  | "toneOfVoice"
  | "visualCodes"
  | "productLines"
  | "contentPillars"
  | "do"
  | "dont"
  | "riskBoundaries"
  | "commercialObjectives"
  | "creatorPriorities"
  | "paidPriorities"
  | "seoPriorities";

export type BrandProfileProvenanceType =
  | "user-input"
  | "workspace-derived"
  | "pasted-brief"
  | "drive-reference"
  | "url-reference"
  | "system-research";

export type BrandProfileReferenceStatus = "pending-resolver" | "resolved" | "invalid";
export type BrandFitReadiness = "blocked" | "partial" | "ready-for-provisional-brand-fit";
export type BrandProfileResolutionStatus = "draft" | "partial" | "provisional-ready" | "conflicted";

export interface BrandProfileFieldProvenance {
  field: BrandProfileFieldKey;
  sourceType: BrandProfileProvenanceType;
  sourceLabel: string;
  reference?: string;
  capturedAt: string;
}

export interface BrandProfileReference {
  id: string;
  method: "pasted-brief" | "drive-reference" | "url-reference";
  label: string;
  reference?: string;
  rawText?: string;
  status: BrandProfileReferenceStatus;
  createdAt: string;
}

export interface BrandFitReadinessAssessment {
  status: BrandFitReadiness;
  methodologyVersion: "brand-fit-readiness-05a.v1";
  requiredFields: BrandProfileFieldKey[];
  requiredAnyOfGroups: BrandProfileFieldKey[][];
  missingRequiredFields: BrandProfileFieldKey[];
  missingRequiredGroups: BrandProfileFieldKey[][];
  recommendedContextGaps: BrandProfileFieldKey[];
  rationale: string[];
  assessedAt: string;
}

export interface BrandProfileFoundationRecord {
  schemaVersion: "brand-profile-foundation.v1";
  profile: BrandIntelligenceProfile;
  resolutionStatus: BrandProfileResolutionStatus;
  readiness: BrandFitReadinessAssessment;
  provenance: BrandProfileFieldProvenance[];
  pendingReferences: BrandProfileReference[];
  conflicts: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BrandProfileStore {
  schemaVersion: "brand-profile-store.v1";
  records: BrandProfileFoundationRecord[];
  updatedAt: string;
}