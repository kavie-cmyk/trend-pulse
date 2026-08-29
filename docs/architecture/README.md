# Architecture

Trend Pulse canonical workflow:

DEFINE → COLLECT → DETECT → UNDERSTAND → ASSESS → DECIDE → ACT → LEARN

Current implementation boundary:

- `apps/web`: user-facing application and GitHub Pages build preview.
- `apps/worker`: future ingestion/background jobs.
- `packages/contracts`: shared data contracts.
- `packages/intelligence`: source-agnostic intelligence logic.

The GitHub Pages deployment is a preview surface, not the production backend runtime.
