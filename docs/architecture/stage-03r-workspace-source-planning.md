# Stage 03R — Workspace-aware source planning and refresh

## Goal
Prevent a connected source from being treated as relevant to every workspace. Stage 03R separates broad source collection from workspace applicability and makes refresh cadence explicit.

## Locked product behavior

1. **Workspace → Source Planner → Collection**. A connector being operational does not mean it should run as a primary source for every workspace.
2. **Collection scope ≠ workspace scope**. Broad feeds carry an explicit collection scope and must not claim a browser workspace ID unless collection was actually workspace-scoped.
3. **Source fit is evaluated before evidence is applied**. Current fit levels are high / medium / low / not-applicable; roles are primary / supporting / background.
4. **Low-fit broad data is excluded from active workspace evidence by default**. It may remain visible as background/corroboration data when the user explicitly opens it.
5. **Workspace revisions re-plan immediately** in the browser prototype. Source data refresh remains source-aware.
6. **Refresh semantics are explicit**: last collection, effective freshness, next scheduled run, and Update-now capability. The static Pages preview must not pretend it can trigger a secure worker run.

## Wikimedia Stage 03R capability boundary

The current Wikimedia connector collects daily top-page observations from `vi.wikipedia.org` and `en.wikipedia.org`. This feed is operational and source-backed, but it is broad cultural attention rather than a category/product/brand feed.

Therefore a workspace such as **Beauty · United States** receives LOW fit / BACKGROUND for the current Wikimedia feed. The batch is not used as active workspace evidence by default.

## Data lineage correction

`signal.v1.workspaceId` is now optional. Broad feeds use `collectionScopeId`. `SignalBatch` can carry `collectionScope` and `refreshPolicy` metadata.

A `workspaceId` should only be populated when the collection request was actually generated for that workspace.

## Refresh policy in the current preview

- Wikimedia effective freshness: daily.
- GitHub Actions preview schedule: daily at 07:17 UTC.
- Workspace scope changes: re-planned immediately in the client.
- `Update now`: intentionally unavailable in the static Pages runtime; a future backend/scheduler can implement it without changing the contract.

## Current limitation

Stage 03R has only one operational source family. If the active workspace has no high-fit source, the UI must expose a **primary-source gap** rather than silently falling back to Wikimedia.

## Next

Add a second source family with stronger workspace/category targeting, then use two independent families for topic/entity resolution and corroborated Trend Candidate detection.
