import type { Signal } from "./index";

export type PaidCreativeBridgeStatus = "awaiting-local-ingest" | "ingested" | "invalid-input";
export type PaidCreativeInputMode = "none" | "json" | "jsonl-webhook";

export interface PaidCreativeSourceBoundary {
  sourceId: "meta-ad-library-public-experimental";
  sourceName: "Meta Ad Library · experimental local bridge";
  evidenceFamily: "paid-ad";
  upstreamRepository: string;
  upstreamRef: string;
  upstreamLicense: "Apache-2.0";
  accessBoundary: "experimental-local-sidecar";
  complianceStatus: "needs-review";
  scheduledCollection: false;
}

export interface PaidCreativeInputSummary {
  mode: PaidCreativeInputMode;
  inputPath?: string;
  workspaceId?: string;
  recordsSeen: number;
  recordsAccepted: number;
  recordsRejected: number;
}

export interface PaidCreativeSummary {
  signalCount: number;
  advertiserCount: number;
  activeAdCount: number;
  inactiveAdCount: number;
  mediaTypes: Record<string, number>;
  platforms: Record<string, number>;
  candidateContextLinkCount: number;
}

export interface PaidCreativeTrendContextLink {
  trendCandidateId: string;
  trendTitle: string;
  workspaceId: string;
  matchedAnchors: string[];
  paidSignalIds: string[];
  advertiserCount: number;
  note: string;
}

export interface PaidCreativeIntelligenceSnapshot {
  schemaVersion: "paid-creative-intelligence-04g.v1";
  methodologyVersion: "paid-creative-bridge-04g.v1";
  generatedAt: string;
  status: PaidCreativeBridgeStatus;
  source: PaidCreativeSourceBoundary;
  input: PaidCreativeInputSummary;
  summary: PaidCreativeSummary;
  signals: Signal[];
  trendContext: PaidCreativeTrendContextLink[];
  warnings: string[];
}
