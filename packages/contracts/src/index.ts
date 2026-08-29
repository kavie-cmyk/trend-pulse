export type WorkspaceStatus = "active" | "paused";
export type MonitoringMode = "market-pulse" | "watchlist" | "ad-hoc";
export type FreshnessClass = "near-live" | "hourly" | "daily" | "manual" | "unknown";
export type SourceAccessMode = "official-api" | "rss" | "open-web" | "public-dataset" | "manual" | "licensed";
export type SourceType = "search" | "video" | "social" | "news" | "publisher" | "community" | "culture" | "brand" | "other";
export type EntityRelationship =
  | "direct-competitor"
  | "indirect-competitor"
  | "substitute"
  | "emerging-challenger"
  | "benchmark"
  | "platform"
  | "creator"
  | "community"
  | "product"
  | "other";
export type EntityIntakeMethod =
  | "typed-text"
  | "pasted-list"
  | "pasted-table"
  | "text-file"
  | "drive-link"
  | "url-list"
  | "system-research";
export type EntityResolutionStatus = "unresolved" | "resolved" | "confirmed" | "pending-resolver";

export interface IntelligenceScope {
  geographies: string[];
  languages: string[];
  industries: string[];
  categories: string[];
  products: string[];
  audiences: string[];
  objectives: string[];
  riskBoundaries: string[];
}

export interface FocusBrand {
  id: string;
  name: string;
  source: "user" | "resolved";
  addedAt: string;
}

export interface MonitoredEntity {
  id: string;
  name: string;
  relationship: EntityRelationship;
  source: "user" | "system-approved";
  inputMethod: EntityIntakeMethod;
  resolutionStatus: EntityResolutionStatus;
  sourceReference?: string;
  pinned: boolean;
  addedAt: string;
}

export interface EntityCandidate {
  id: string;
  name: string;
  relationship: EntityRelationship;
  reason: string;
  evidenceRefs: string[];
  relevanceScore?: number;
  status: "suggested" | "approved" | "ignored" | "excluded";
  discoveredAt: string;
}

export interface EntityIntakeReference {
  id: string;
  method: "drive-link" | "url-list";
  reference: string;
  status: "pending-resolver" | "resolved" | "invalid";
  createdAt: string;
}

export interface WorkspaceEntityIntelligence {
  autoDiscover: boolean;
  monitoredEntities: MonitoredEntity[];
  excludedEntities: string[];
  intakeReferences: EntityIntakeReference[];
}

export interface WorkspaceMonitoringConfig {
  modes: MonitoringMode[];
  broadDiscovery: boolean;
  adjacentCulture: boolean;
  globalBreakouts: boolean;
}

export interface IntelligenceWorkspace {
  schemaVersion: "workspace.v1";
  id: string;
  name: string;
  status: WorkspaceStatus;
  scope: IntelligenceScope;
  focusBrands: FocusBrand[];
  entityIntelligence: WorkspaceEntityIntelligence;
  monitoring: WorkspaceMonitoringConfig;
  createdAt: string;
  updatedAt: string;
}

export interface SignalSource {
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;
  accessMode: SourceAccessMode;
  freshness: FreshnessClass;
}

export interface SignalMetrics {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  engagement?: number;
  reachProxy?: number;
  searchInterest?: number;
  sourceRank?: number;
}

export interface SignalDynamics {
  velocity?: number;
  acceleration?: number;
  novelty?: number;
}

export interface SignalConfidence {
  score: number;
  basis: string[];
}

export interface SignalEvidence {
  sourceUrl?: string;
  externalId?: string;
  reference: string;
}

export interface Signal {
  schemaVersion: "signal.v1";
  id: string;
  workspaceId: string;
  observedAt: string;
  publishedAt?: string;
  collectedAt: string;
  normalizedAt: string;
  source: SignalSource;
  geography?: string;
  market?: string;
  language?: string;
  topic: string;
  entities: string[];
  keywords: string[];
  hashtags: string[];
  creator?: string;
  community?: string;
  contentType?: string;
  metrics: SignalMetrics;
  dynamics: SignalDynamics;
  sentiment?: string;
  emotion?: string[];
  intent?: string[];
  confidence: SignalConfidence;
  evidence: SignalEvidence;
}

export interface SignalBatch {
  schemaVersion: "signal-batch.v1";
  sourceId: string;
  scopeLabel: string;
  collectedAt: string;
  query: string;
  timespan: string;
  effectiveFreshness: FreshnessClass;
  count: number;
  signals: Signal[];
}

export interface WorkspaceDraft {
  name: string;
  geography: string;
  language: string;
  industry: string;
  category: string;
  focusBrands: string;
  product: string;
  audience: string;
  objectives: string;
}
