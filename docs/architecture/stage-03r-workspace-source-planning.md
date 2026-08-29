# Stage 03R — Workspace-aware source planning and refresh

## Goal
Prevent a connected source from being treated as relevant to every workspace. Stage 03R separates broad source collection from workspace applicability and makes refresh cadence explicit.

## Locked product behavior

1. **Workspace → Source Planner → Collection**. A connector being operational does not mean it should run as a primary source for every workspace.
2. **Collection scope ≠ workspace scope**. Broad feeds carry an explicit collection scope and must not claim a browser workspace ID unless collection was actually workspace-scoped.
3. **Source fit is evaluated before evidence is applied**. Current fit levels are high / medium / low / not-applicable; roles are primary / supporting / background.
4. **Low-fit broad data is excluded from active workspace evidence by default**. It may remain visible as background/corroboration data when the user explicitly opens it.
5. **Workspace revisions re-plan immediately** in the browser prototype.
6. **Global Refresh Policy V1: every active source is collected twice per day.** V1 does not vary collection frequency by source family, workspace, native source freshness or perceived importance.
7. **Collection cadence ≠ native source freshness.** A daily upstream source is still polled in both daily collection cycles; the second cycle may legitimately observe the same upstream snapshot.
8. **Refresh semantics are explicit**: last collection, collection cadence, effective/native freshness, next scheduled run, and Update-now capability. The static Pages preview must not pretend it can trigger a secure worker run.

## Wikimedia Stage 03R capability boundary

The current Wikimedia connector collects top-page observations from `vi.wikipedia.org` and `en.wikipedia.org`. This feed is operational and source-backed, but it is broad cultural attention rather than a category/product/brand feed.

Therefore a workspace such as **Beauty · United States** receives LOW fit / BACKGROUND for the current Wikimedia feed. The batch is not used as active workspace evidence by default.

## Data lineage correction

`signal.v1.workspaceId` is optional. Broad feeds use `collectionScopeId`. `SignalBatch` can carry `collectionScope` and `refreshPolicy` metadata.

A `workspaceId` should only be populated when the collection request was actually generated for that workspace.

## Global Refresh Policy V1

- Platform collection cadence: **twice daily for every active source**.
- Current preview execution times: **07:17 UTC and 19:17 UTC** via GitHub Actions.
- Source native freshness remains separately recorded in `FreshnessClass`.
- Collection cadence is separately represented by `CollectionCadence`; the locked V1 runtime value is `twice-daily`.
- Workspace scope changes are re-planned immediately in the client, but source collection still waits for a scheduled cycle unless a future runtime implements `Update now`.
- `Update now`: intentionally unavailable in the static Pages runtime; a future backend/scheduler can implement it without changing the V1 automatic cadence.

## Current limitation

Stage 03R still has only one operational source family. If the active workspace has no high-fit source, the UI must expose a **primary-source gap** rather than silently falling back to Wikimedia.

## Next

Stage 04B-2 expands the Global Connector Backbone. Every connector activated in V1 inherits the same twice-daily collection policy unless this decision is explicitly superseded later.
