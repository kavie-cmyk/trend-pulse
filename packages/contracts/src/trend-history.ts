import type { GlobalResolvedTrendCandidate } from "./trend-resolution";

export type TrendCyclePresence = "new" | "continuing" | "reappeared";
export type TrendEvidenceDirection = "not-comparable" | "expanding" | "stable" | "contracting" | "mixed";
export type TrendCycleComparisonWindow = "bootstrap" | "too-close-for-cadence" | "comparable" | "stale-gap";
export type TrendHistoryCyclePurpose = "scheduled" | "qa";

export interface TrendLineageMatchEvidence {
  methodologyVersion: "trend-lineage-match-04d.v1";
  anchorOverlap: string[];
  titleTokenOverlap: string[];
  similarity: number;
  threshold: number;
}

export interface TrendLineageRecord {
  lineageId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  seenCycles: number;
  missedCycles: number;
  latestCandidateId: string;
  latestTitle: string;
  latestResolutionAnchors: string[];
  latestSignalCount: number;
  latestSourceIds: string[];
  latestSourceFamilies: string[];
  latestIndependentSourceIds: string[];
  latestIndependentSourceFamilies: string[];
  latestStatus: GlobalResolvedTrendCandidate["status"];
}

export interface TrendHistoryState {
  schemaVersion: "trend-history-state.v1";
  updatedAt: string | null;
  latestCycleId: string | null;
  latestSnapshotGeneratedAt: string | null;
  cyclesRecorded: number;
  lineages: TrendLineageRecord[];
}

export interface TrendCycleDelta {
  lineageId: string;
  candidateId: string;
  title: string;
  presence: TrendCyclePresence;
  evidenceDirection: TrendEvidenceDirection;
  previousCandidateId?: string;
  signalCountDelta?: number;
  independentSourceDelta?: number;
  independentSourceFamilyDelta?: number;
  sourceIdsAdded: string[];
  sourceIdsRemoved: string[];
  independentSourceIdsAdded: string[];
  independentSourceIdsRemoved: string[];
  independentSourceFamiliesAdded: string[];
  independentSourceFamiliesRemoved: string[];
  matchEvidence?: TrendLineageMatchEvidence;
}

export interface DisappearedTrendLineage {
  lineageId: string;
  title: string;
  previousCandidateId: string;
  missedCycles: number;
  lastSeenAt: string;
}

export interface TrendHistoryCycleSnapshot {
  schemaVersion: "trend-history-cycle.v1";
  methodologyVersion: "trend-history-04d.v1";
  generatedAt: string;
  cycleId: string;
  cyclePurpose: TrendHistoryCyclePurpose;
  persistenceEligible: boolean;
  baselineStatePath: "history/production-state.json";
  currentTrendSnapshotGeneratedAt: string;
  previousCycleId: string | null;
  previousSnapshotGeneratedAt: string | null;
  cycleGapHours: number | null;
  comparisonWindow: TrendCycleComparisonWindow;
  persistenceMode: "github-history-branch";
  historyBranch: "trend-history";
  currentCandidateCount: number;
  currentCorroboratedCount: number;
  trackedLineageCount: number;
  current: TrendCycleDelta[];
  disappeared: DisappearedTrendLineage[];
  notes: string[];
}
