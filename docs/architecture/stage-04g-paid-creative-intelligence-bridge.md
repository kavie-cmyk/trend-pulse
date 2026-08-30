# Stage 04G — Experimental Paid Creative Intelligence Bridge

Status: COMPLETE / PASS WITH DECLARED GAPS

## Purpose

Stage 04G adds a bounded interoperability layer between Trend Pulse and locally captured public Meta Ad Library research records. It does not embed a Meta scraper in Trend Pulse, does not activate Meta as a scheduled source, and does not change the Stage 04F trend/corroboration methodology.

The immediate private-learning path is:

`meta-ads-scraper local process → signed/unsigned local webhook or JSON export → Trend Pulse 04G normalizer → paid-creative Signal snapshot → context-only links to existing Workspace Trend Candidates`

## Upstream reference

- Repository: `https://github.com/athm793/meta-ads-scraper`
- Pinned reference inspected for 04G: `737feeed5e86b9821dcf57129668a72b38876ca9`
- Upstream license at that reference: Apache-2.0
- Trend Pulse does not vendor, fork, execute or schedule the upstream scraping/Playwright implementation.

`rugantio/fbcrawl` remains REFERENCE_ONLY and is not integrated.

## Governance state

Meta Ad Library remains:

- Source Registry identity: `meta-ad-library`
- activation: `manual-assisted`
- compliance: `needs-review` for the experimental automated interoperability path
- scheduled operational coverage: NO
- paid creative evidence family: `paid-ad`

The bridge source ID used for imported evidence is `meta-ad-library-public-experimental`.

The coarse `signal.v1` `SignalSource.sourceType` remains `social` for backward compatibility. The more precise paid/organic distinction is carried by the 04G snapshot source boundary and `metrics.native.evidenceFamily = paid-ad`.

## Runtime boundary

### Local webhook receiver

`npm run receive:meta-ads-04g`

Default:

- host: `127.0.0.1`
- port: `4317`
- path: `/meta-ads`
- health: `/health`
- raw JSONL log: `.trend-pulse-local/paid-creative/meta-ads-webhook.jsonl`

The raw log directory is git-ignored.

Optional HMAC verification:

Set `META_ADS_WEBHOOK_SECRET` on the Trend Pulse receiver and configure the same secret in the upstream search session/bulk webhook. The receiver checks the upstream `X-Webhook-Signature: sha256=…` header.

The receiver does not contact Meta.

### Local ingestion

For the default webhook log:

`npm run ingest:meta-ads-04g -- --workspace-id runtime-vietnam-mobile-gaming`

For another JSON/JSONL export:

`npm run ingest:meta-ads-04g -- --input <local-path> --workspace-id <runtime-workspace-id>`

An explicit Workspace ID is validated against `apps/worker/config/runtime-workspaces.json`. Unknown IDs fail; the ingestor does not fabricate Workspace identity.

After Workspace Intelligence exists, contextualize paid evidence:

`npm run contextualize:paid-creative-04g`

Then verify:

`npm run verify:paid-creative-04g`

## CI / GitHub Pages behavior

GitHub Actions never executes Meta scraping or the local webhook receiver.

CI runs:

1. Stage 04F resolve/verify.
2. `ingest:meta-ads-04g -- --allow-missing`.
3. `contextualize:paid-creative-04g`.
4. `verify:paid-creative-04g`.
5. Stage 05B verification.

With no local input, the public artifact must be:

- status `awaiting-local-ingest`
- 0 paid creative Signals
- 0 trend context links
- `scheduledCollection = false`

This is the correct public/static state and must not be replaced by fixture/mock Meta data.

## Mapping boundary

Accepted upstream fields may be preserved as source-native observations, including:

- ad ID
- advertiser/page identity
- body/headline/CTA
- landing URL
- media type
- publisher platforms
- active/inactive status
- start date and days running
- spend range, when present
- impression range, when present
- EU reach/transparency fields, when present
- Ad Library snapshot URL

They are stored primarily under `Signal.metrics.native` where appropriate.

Stage 04G MUST NOT:

- map impressions to `views`
- map EU/Meta reach to cross-platform `reachProxy`
- infer CTR, CPI, ROAS or conversion performance
- infer a creative is a winner or proven merely from longevity
- copy the upstream `<14 / 14–30 / 30+` Hook Lab stage heuristic into Trend Pulse as a performance fact
- treat upstream collection country/language as proven targeting geography/language
- treat multiple Meta ads as multiple independent source families

`daysRunning` is an observation, not a performance conclusion.

## Trend context boundary

Paid creative evidence can attach as context to an already-qualified Workspace candidate only when an existing inspectable `resolutionAnchor` is explicitly present in the paid creative topic/entities/hashtags.

Example:

- existing candidate anchor: `gamescom 2026`
- paid ad explicitly contains: `Gamescom 2026`
- result: a paid-creative context link is allowed

Short phrase/token boundaries apply. `ai` does not match inside `Dubai`.

A context link does not modify:

- candidate status
- source IDs
- source diversity
- independent-source-family diversity
- corroboration
- Virality
- Brand Fit
- Opportunity
- Decision / Action

## Verification gates

The 04G verifier must prove at minimum:

- webhook-shaped fixture parses
- duplicate ad IDs deduplicate
- missing/invalid Workspace ID cannot be fabricated by the runtime ingestor
- final `SignalSource.sourceType` remains signal.v1 compatible
- `evidenceFamily = paid-ad` is explicit
- source-native ad age/spend/impression/reach survive normalization
- no views/reachProxy/searchInterest fabrication
- no performance fields are generated
- collection country/language do not become Signal geography/language
- exact Gamescom anchor can create context
- `ai` does not substring-match `Dubai`
- context linking does not mutate candidate evidence maturity
- local payload path is git-ignored
- GitHub Actions contains no Playwright/stealth/proxy scraping path
- public CI artifact remains empty/awaiting local ingest

## Functional validation before release lock

Actions run `33319993523` on implementation HEAD `7deaca360486faa82f447807b05ba79d3b07bca9` passed the complete build/deploy chain. Direct log and artifact inspection verified:

- Stage 04E and Stage 04F remain PASS.
- Workspace result remains 17 relevant Signals, 17 Weak Signals, one independently corroborated Gamescom 2026 candidate.
- Stage 04G public ingest is `awaiting-local-ingest` with 0 records seen/accepted/rejected, 0 paid creative Signals, 0 advertisers and 0 context links.
- `workspaceId` is absent by design when no validated local import is supplied.
- `evidenceFamily = paid-ad`; signal.v1 source type remains `social`.
- Stage 04G verifier PASS.
- Stage 05B PASS with one eligible Workspace candidate and 17 Weak Signals excluded from Brand Fit.
- Static export contains `paid-creative-intelligence.json` and the 04G UI boundary markers.
- The downloaded artifact SHA-256 matched the GitHub artifact digest.
- QA push did not advance canonical scheduled trend history.

The documentation-lock HEAD must repeat the same CI/deploy gates before it is treated as the canonical Stage 04G release. The final HEAD/run/artifact identifiers are recorded in the canonical Drive Build Record.

## Open gates

- Actual Meta automated-access authorization/compliance remains unresolved for production/commercial use.
- The current private workflow requires a local long-lived upstream process; GitHub Pages cannot receive webhooks.
- No production database or multi-workspace paid-creative persistence service exists.
- Creative media CDN URLs can expire; Ad Library snapshot URL is preferred as durable evidence reference.
- Paid creative clustering/angle taxonomy is not yet calibrated as a Trend Pulse scoring methodology.
- No performance inference is authorized from ad longevity or ad presence.

Stage 04G is COMPLETE / PASS WITH DECLARED GAPS only when the documentation-lock HEAD repeats the full CI/deploy chain, the final artifact is directly inspected, downstream 04F/05B remain valid, and canonical Drive/Master Log persistence/read-back is complete.
