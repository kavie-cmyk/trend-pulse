export type WorkspaceStatus = "active" | "paused";
export type MonitoringMode = "market-pulse" | "watchlist" | "ad-hoc";
export type FreshnessClass = "near-live" | "hourly" | "daily" | "manual" | "unknown";
export type SourceAccessMode = "official-api" | "rss" | "open-web" | "public-dataset" | "manual" | "licensed";
export type SourceType = "search" | "video" | "social" | "news" | "publisher" | "community" | "culture" | "brand" | "other";
export type SourceFitLevel = "high" | "medium" | "low" | "not-applicable";
export type SourcePlanRole = "primary" | "supporting" | "background";
export type SourceRuntimeStatus = "operational" | "planned" | "runtime-deferred";
export type CollectionScopeMode = "workspace-scoped" | "broad-source-feed";
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
  workspaceId?: string;
  collectionScopeId?: string;
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

export interface SignalBatchCollectionScope {
  id: string;
  mode: CollectionScopeMode;
  geographies: string[];
  languages: string[];
  industries: string[];
  categories: string[];
  note?: string;
}

export interface SourceRefreshPolicy {
  mode: "scheduled" | "manual";
  cadence: FreshnessClass;
  scheduleLabel?: string;
  updateNow: "available" | "runtime-required";
}

export interface SourcePlanItem {
  sourceId: string;
  sourceName: string;
  fit: SourceFitLevel;
  role: SourcePlanRole;
  runtimeStatus: SourceRuntimeStatus;
  freshness: FreshnessClass;
  applicableToWorkspace: boolean;
  reason: string;
}

export interface SignalBatch {
  schemaVersion: "signal-batch.v1";
  sourceId: string;
  scopeLabel: string;
  collectionScope?: SignalBatchCollectionScope;
  refreshPolicy?: SourceRefreshPolicy;
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

export type TrendLifecycleStage =
  | "weak-signal"
  | "emerging"
  | "accelerating"
  | "breakout"
  | "mainstream"
  | "saturated"
  | "declining";

export type TrendType =
  | "cultural-moment"
  | "creator-trend"
  | "meme"
  | "product-trend"
  | "seasonal"
  | "platform-native"
  | "competitor-move"
  | "search-breakout"
  | "narrative"
  | "other";

export type TrendAssessmentStatus = "unavailable" | "provisional" | "calibrated";
export type TrendDecision = "act" | "prepare" | "watch" | "avoid";

export interface ScoreFactorAssessment {
  key: string;
  label: string;
  status: "available" | "missing" | "not-applicable";
  normalizedValue?: number;
  weight?: number;
  note?: string;
}

export interface ScoreAssessment {
  status: TrendAssessmentStatus;
  score?: number;
  scaleMax: 10;
  methodologyVersion: string;
  factors: ScoreFactorAssessment[];
  rationale: string[];
  evidenceRefs: string[];
  computedAt?: string;
}

export interface BrandIntelligenceProfile {
  schemaVersion: "brand-profile.v1";
  id: string;
  workspaceId: string;
  focusBrandId: string;
  brandName: string;
  categories: string[];
  markets: string[];
  targetAudiences: string[];
  positioning: string[];
  valueProposition: string[];
  toneOfVoice: string[];
  visualCodes: string[];
  productLines: string[];
  contentPillars: string[];
  do: string[];
  dont: string[];
  riskBoundaries: string[];
  commercialObjectives: string[];
  creatorPriorities: string[];
  paidPriorities: string[];
  seoPriorities: string[];
  evidenceRefs: string[];
  updatedAt: string;
}

export interface TrendCandidate {
  schemaVersion: "trend-candidate.v1";
  id: string;
  workspaceId: string;
  title: string;
  summary: string;
  trendType: TrendType;
  lifecycleStage: TrendLifecycleStage;
  status: "candidate" | "corroborated" | "rejected";
  signalIds: string[];
  sourceIds: string[];
  sourceDiversity: number;
  geographies: string[];
  languages: string[];
  firstObservedAt?: string;
  lastObservedAt: string;
  evidenceRefs: string[];
  confidence: ScoreAssessment;
}

export interface TrendScorecard {
  virality: ScoreAssessment;
  brandFit?: ScoreAssessment;
  opportunity: ScoreAssessment;
  executionUrgency: ScoreAssessment;
  confidence: ScoreAssessment;
}

export interface MarketingIntelligenceAnalysis {
  whyItMatters: string[];
  audienceRelevance: string[];
  channelRelevance: string[];
  contentAndCreativePotential: string[];
  creatorPotential: string[];
  communityPotential: string[];
  paidMediaPotential: string[];
  seoAndSearchPotential: string[];
  prAndBrandPotential: string[];
  competitiveWhitespace: string[];
  timingNotes: string[];
  riskNotes: string[];
  commercialAndFunnelRelevance: string[];
  crmAndRetentionPotential: string[];
  productMarketingPotential: string[];
}

export interface MarketingActionPlan {
  decision: TrendDecision;
  recommendedAction: string;
  timeToAct: string;
  contentAngles: string[];
  creatorBrief?: string;
  communityPlan?: string;
  paidTest?: string;
  seoOpportunity?: string;
  prAngle?: string;
  crmAction?: string;
  productMarketingAction?: string;
  cta?: string;
  kpis: string[];
  do: string[];
  dont: string[];
}

export interface TrendWatchSection {
  risingTrends: string[];
  earlySignals: string[];
  nextWindow: string[];
  competitorWatch: string[];
  riskWatch: string[];
}

export interface TrendIntelligenceReport {
  schemaVersion: "trend-intelligence-report.v1";
  id: string;
  workspaceId: string;
  trendCandidateId: string;
  focusBrandId?: string;
  generatedAt: string;
  snapshot: {
    title: string;
    summary: string;
    trendType: TrendType;
    lifecycleStage: TrendLifecycleStage;
    window: string;
    sourceSummary: string[];
    scorecard: TrendScorecard;
  };
  analysis: MarketingIntelligenceAnalysis;
  actionPlan: MarketingActionPlan;
  watch: TrendWatchSection;
  evidenceRefs: string[];
}
