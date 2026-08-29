# Stage 03 — First Real Source: GDELT DOC 2.0

## Goal

Prove the first real data loop without paid data or secrets:

`GDELT DOC 2.0 → connector → normalize → signal.v1 → evidence on GitHub Pages`

This stage is intentionally **not** trend detection. It validates that a real external source can enter the current contract without fabricating unsupported fields.

## Why GDELT first

GDELT is in the Free-first Tier A source universe and can be queried without a secret/API key. GDELT 2.0 data updates on an approximately 15-minute source heartbeat, while the Stage 03 prototype collector runs hourly. Therefore Trend Pulse labels the **effective application freshness as hourly**, not real-time.

YouTube remains a Tier A connector candidate but is not used for the first live proof because it requires API credentials/quota configuration. The connector architecture must allow it to be added without changing `signal.v1` consumers.

## Stage 03 collection scope

The first live deployment uses a bounded demo scope stored in:

`apps/worker/config/stage03-gdelt.json`

Current query:

`(gaming OR "mobile game" OR "mobile gaming")`

Window: 24 hours. Maximum records: 30.

This demo collector scope is **not yet synchronized with the browser-local Intelligence Workspace**. Stage 02S persists workspaces in localStorage, while scheduled collection runs in GitHub Actions. Connecting scheduled collectors to each user's persistent workspace requires the later backend/database runtime.

## Connector behavior

`apps/worker/src/collect-gdelt.mjs`:

1. Reads the Stage 03 collector configuration.
2. Calls the GDELT DOC 2.0 ArticleList JSON endpoint.
3. Rejects HTTP failures, invalid JSON and zero-result responses; it does not publish fake fallback observations.
4. Normalizes each article into `signal.v1`.
5. Writes one ephemeral `signal-batch.v1` JSON file into `apps/web/public/data/gdelt-signals.json` for the current Pages build artifact.

The generated live data is not committed back to GitHub. It exists in the deployment artifact only.

## Mapping boundaries

Mapped from GDELT ArticleList when available:

- article URL → `evidence.sourceUrl`
- article title → `topic` and `evidence.reference`
- seen date → `observedAt` / provisional `publishedAt`
- language → `language`
- publisher domain → `creator` as source-domain proxy
- source identity/access/freshness → normalized source metadata

Intentionally left empty when GDELT DOC ArticleList does not support the field directly:

- entities
- hashtags
- engagement metrics
- velocity / acceleration / novelty
- market/event geography
- sentiment / emotion / intent

`sourcecountry` is not mapped to market geography because it describes the source/publisher country and would be semantically unsafe to treat as the event or audience market.

## Confidence boundary

Stage 03 retains the current required numeric confidence field only as a clearly marked provisional value for a single-source observation. The UI labels it provisional and the basis explicitly states that corroboration/calibration has not occurred. RG-002 and RG-003 remain open.

## Runtime

The GitHub Pages workflow now runs:

`install → typecheck → collect real GDELT signals → static build → deploy`

It runs on push, manual dispatch and an hourly schedule at minute 17.

GitHub Actions is a prototype scheduled collector for this stage, not the committed production worker architecture. A later backend/worker runtime can replace the scheduler without changing connector/output contracts.

## Success gate

Stage 03 passes only if GitHub Actions demonstrates:

- live external HTTP request succeeds;
- at least one real observation is returned;
- normalization produces `signal.v1` JSON;
- TypeScript typecheck passes;
- static build passes;
- deployed Pages UI reads the generated batch and exposes source evidence links.
