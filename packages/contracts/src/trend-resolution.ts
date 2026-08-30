import type { SourceType, TrendCandidate } from "./index";

export type GlobalResolvedTrendCandidate = Omit<TrendCandidate, "workspaceId"> & {
  workspaceId?: never;
  sourceFamilies: SourceType[];
  sourceFamilyDiversity: number;
  resolutionAnchors: string[];
  resolutionMethodologyVersion: string;
  corroborationRationale: string[];
};

export interface TrendResolutionInputSummary {
  file: string;
  signalCount: number;
}

export interface TrendResolutionSnapshot {
  schemaVersion: "trend-resolution-snapshot.v1";
  generatedAt: string;
  methodologyVersion: "trend-resolution-04c.v1";
  inputSignalCount: number;
  uniqueSignalCount: number;
  candidateCount: number;
  corroboratedCount: number;
  clusteredSignalCount: number;
  unclusteredSignalCount: number;
  candidates: GlobalResolvedTrendCandidate[];
  inputSummary?: TrendResolutionInputSummary[];
  notes: string[];
}

export type WorkspaceTrendProjectionClass = "direct" | "adjacent" | "global-breakout" | "out-of-scope";

export interface WorkspaceTrendProjection {
  workspaceId: string;
  globalCandidateId: string;
  projection: WorkspaceTrendProjectionClass;
  matchedTerms: string[];
  rationale: string[];
}
