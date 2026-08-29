export type WorkspaceStatus = "active" | "paused";
export type MonitoringMode = "market-pulse" | "watchlist" | "ad-hoc";
export type FreshnessClass = "near-live" | "hourly" | "daily" | "manual" | "unknown";
export type SourceAccessMode = "official-api" | "rss" | "open-web" | "public-dataset" | "manual" | "licensed";
export type SourceType = "search" | "video" | "social" | "news" | "publisher" | "community" | "culture" | "brand" | "other";

export interface IntelligenceScope {
  geographies: string[];
  languages: string[];
  industries: string[];
  categories: string[];
  brands: string[];
  products: string[];
  audiences: string[];
  competitors: string[];
  objectives: string[];
  riskBoundaries: string[];
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

export interface WorkspaceDraft {
  name: string;
  geography: string;
  language: string;
  industry: string;
  category: string;
  brand: string;
  product: string;
  audience: string;
  competitors: string;
  objectives: string;
}
