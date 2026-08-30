export type WorkspaceCoverageClass =
  | "publisher"
  | "social"
  | "community"
  | "search-demand"
  | "app-store";

export type WorkspaceCoverageRuntimeStatus =
  | "operational-with-relevant-evidence"
  | "operational-no-relevant-evidence"
  | "runtime-failed"
  | "not-configured";

export interface WorkspaceCoverageClassResult {
  coverageClass: WorkspaceCoverageClass;
  required: boolean;
  configured: boolean;
  attempted: boolean;
  runtimeStatus: WorkspaceCoverageRuntimeStatus;
  sourceIds: string[];
  relevantSignalCount: number;
  failureCount: number;
  notes: string[];
}

export interface WorkspaceCoverageExpansionResult {
  schemaVersion: "workspace-coverage-expansion-04f.v1";
  workspaceId: string;
  methodologyVersion: "workspace-coverage-04f.v1";
  generatedAt: string;
  baselineSignalCount: number;
  expandedSignalCount: number;
  addedSignalCount: number;
  coverageClasses: WorkspaceCoverageClassResult[];
  notes: string[];
}

export interface WorkspaceResolutionBridgeTrace {
  methodologyVersion: "workspace-resolution-04f.v1";
  mode: "baseline-04c" | "bounded-subject-bridge";
  subjectAnchors: string[];
  semanticAnchors: string[];
  signalIds: string[];
  evidenceRefs: string[];
  rationale: string[];
}
