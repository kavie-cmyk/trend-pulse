# Stage 03 — First Real Source & Signal Normalization

## Goal

Prove the first real external-data loop:

`real source → collector → normalize → signal.v1 → evidence on GitHub Pages`

Stage 03 validates collection and normalization only. A real observation is **not** automatically a trend, opportunity or marketing action.

## Source-selection history

### GDELT DOC 2.0 — runtime deferred

GDELT was the first attempted source because it is free/open and requires no secret for the DOC API. The implementation and failures remain in Git history for traceability.

Two GitHub-hosted Actions attempts failed before any parser/normalization step:

- run `33238570526`: Node/Undici connection timeout to `api.gdeltproject.org:443`;
- run `33238641276`: Node connection timeout followed by `curl` TCP/TLS connection timeouts from another GitHub-hosted runner region.

The observed conclusion is bounded: **GDELT is blocked from the current GitHub-hosted Actions runtime during these tests.** This does not establish that GDELT is generally unavailable and does not remove it from the broader Tier A source strategy. It is deferred until a different runtime/network path is available or the connectivity issue changes.

## Operational Stage 03 source — Wikimedia Pageviews

Stage 03 pivots to the official Wikimedia Pageviews Top Pages endpoint because it is keyless and exposes a real behavioral metric: pageviews. It returns ranked top pages for a Wikimedia project and therefore provides a useful first cultural-attention signal family.

Current bounded demo projects:

- `vi.wikipedia.org` — Vietnamese;
- `en.wikipedia.org` — English.

The collector uses daily snapshots and labels application freshness as **daily**. It tries yesterday first and can fall back a small number of days when a daily snapshot is not yet available.

## Current demo scope boundary

The Stage 03 collector configuration lives in:

`apps/worker/config/stage03-wikimedia.json`

This scheduled collection scope is **not yet dynamically synchronized with the browser-local Intelligence Workspace**. Stage 02S persists user workspaces in `localStorage`, while GitHub Actions executes server-side scheduled collection. Per-workspace scheduled collection requires the later backend/database runtime.

## Connector pipeline

`apps/worker/src/collect-wikimedia.mjs`:

1. reads Stage 03 source configuration;
2. requests official Wikimedia top-page snapshots;
3. rejects unusable/empty source results rather than generating fake data;
4. applies bounded preview hygiene to administrative pages and a small explicit-content term list;
5. normalizes source observations into `signal.v1`;
6. writes an ephemeral `signal-batch.v1` file to `apps/web/public/data/live-signals.json`;
7. the Next.js static build packages this live batch into the GitHub Pages artifact.

Generated live data is not committed back into the repository.

## Real-source mapping

Mapped directly when available:

- article/page title → `topic`;
- article rank → `metrics.sourceRank`;
- pageview count → `metrics.views`;
- Wikipedia project language → `language`;
- official article URL → `evidence.sourceUrl`;
- rank/views/project/date → `evidence.reference`;
- source/access/freshness → normalized source metadata.

This real-source test adds `sourceRank?: number` to provisional `SignalMetrics`. This is deliberate evidence that the schema should remain provisional until exercised against multiple real connectors.

Intentionally not fabricated or inferred at this stage:

- resolved entities;
- keywords / hashtags;
- audience or event geography;
- engagement metrics unavailable from this source;
- velocity / acceleration / novelty;
- sentiment / emotion / intent;
- trend lifecycle.

## Confidence boundary

The current contract still requires a numeric confidence field. Stage 03 keeps the existing provisional `0.5` value and explicitly states its basis: direct official metric, single-source observation, no corroboration, calibration pending. It must not be interpreted as a calibrated probability. RG-002 and RG-003 remain open.

## Runtime

GitHub Actions currently performs:

`install → typecheck → collect Wikimedia → static build → deploy`

The collector is scheduled daily. GitHub Actions is a prototype scheduler for this vertical slice, not the final production worker architecture.

## Next-source direction

YouTube remains a Tier A connector target after API credentials/quota are configured. Adding a second independent signal family is necessary before cross-source corroboration or trend detection should be treated as credible.

## Stage 03 success gate

B-003 can pass only when a GitHub Actions run demonstrates all of the following:

- real Wikimedia HTTP request succeeds;
- at least one real observation is returned;
- the observation is normalized into `signal.v1` / `signal-batch.v1`;
- TypeScript typecheck passes;
- static export passes;
- Pages artifact upload passes;
- GitHub Pages deploy passes;
- the deployed UI exposes real metric values and evidence links without calling them trends.
