# Stage 04B-4 — Permissionless Social Expansion

Status: COMPLETE / PASS — subject to final documentation-head CI verification.
Date: 2026-08-30

## Goal

Expand Trend Pulse toward universal market/trend coverage by prioritizing reusable social/community sources that are free to read, public, and do not require approval or a credential for the collection path used in this stage.

The source-priority ladder for V1 is:

`PUBLIC / NO AUTH → SELF-SERVICE CREDENTIAL → PUBLIC WEB / RSS → BROWSER-ASSISTED → APPROVAL-GATED API → PAID`

This priority affects connector investment, not Intelligence Fit. A public/no-auth source is not automatically relevant or PRIMARY for a workspace.

## Locked collection policy

Every ACTIVE source remains on D-012: two automatic collection cycles per day. Current preview anchors remain 07:17 UTC and 19:17 UTC.

## Runtime-verified permissionless sources

Implementation baseline `ca99db3d7f4f8e768061509e8225279eb2aca84d` passed GitHub Actions run `33291959318` across typecheck, all collectors, static export, artifact upload and Pages deployment.

The Stage 04B-4 collector returned 75 real observations from four public/no-auth source batches:

- `mastodon-social-trends` — 20 Mastodon.social trending-tag observations;
- `lemmy-world-hot` — 20 Lemmy.world hot community-post observations;
- `dev-forem-trends` — 15 DEV/Forem semantic trend observations;
- `stackoverflow-hot` — 20 Stack Overflow hot-question observations.

There were no Stage 04B-4 runtime failures in that run.

## Source-specific boundaries

### Mastodon

Use the public `GET /api/v1/trends/tags` path on configured instances. Mastodon documents this endpoint as OAuth Public, but an instance can change public-preview/access policy. Trend Pulse therefore treats each instance as an explicit source instance rather than assuming every Mastodon server is readable.

Stored fields are bounded to tag name, source-native seven-day history totals, source rank and evidence URL. Instance/federation coverage is not treated as global representativeness.

### Lemmy

Use public read/list paths on configured instances. Lemmy API versions differ across deployments, so the collector currently attempts v4 and then v3-compatible read paths. Runtime verification, not documentation alone, determines operational status.

Stored fields are bounded to post title, community/creator metadata where available, source-native rank/vote/comment counts and evidence URL. A single Lemmy instance is not treated as a universal audience sample.

### DEV / Forem

Use the current Forem v1 public Trends endpoint. Forem documents `GET /api/trends` as publicly accessible without authentication and describes its score as reflecting community volume and engagement.

The Forem trend score stays source-native. It is not converted into Trend Pulse Virality.

### Stack Exchange / Stack Overflow

Use the public questions read API with `sort=hot` for the configured site. Stage 04B-4 activates Stack Overflow as a concrete specialist developer-community source.

Question score, answer count and view count remain source-native. Stack Overflow is not a general-consumer social proxy and is calibrated down for unrelated workspaces.

### Nostr

NIP-01 defines an open WebSocket relay protocol, but individual relays can vary in authentication, rate limits, retention and moderation. Stage 04B-4 intentionally does not persist raw Nostr relay notes merely to increase source count.

`nostr-public-relays` is retained in Source Registry as `runtime-deferred` until Trend Pulse has a bounded, safe trend/aggregation path and runtime-verifies selected relays.

## Universal architecture

The four verified source IDs are concrete runtime instances, while their connector families are reusable:

- Mastodon connector → configurable instances;
- Lemmy connector → configurable instances;
- Forem connector → configurable communities;
- Stack Exchange connector → configurable sites.

A future workspace may activate different instances/sites without changing `signal.v1` or downstream trend intelligence contracts.

Canonical flow remains:

`Global source universe → Source Registry / Research → Workspace Source Planner → ACTIVE source instances → Collection → Signal Store`

## Source Planner integration

Canonical Stage 04B-4 wrapper:

`apps/web/app/source-intelligence-stage04b4.ts`

It extends the prior 04B-1/2/3 planner without deleting historical layers.

Rules:
- runtime-verified 04B-4 sources receive high Operational Feasibility and `activate-now` when otherwise eligible;
- broad Mastodon/Lemmy snapshots are capped at SUPPORTING for specific decision scopes until workspace-specific instance/query planning is validated;
- DEV/Forem and Stack Overflow are specialist sources and are capped when there is no direct industry/category match;
- Nostr remains runtime-deferred;
- operational status never rewrites Intelligence Fit into PRIMARY by itself.

## Worker and artifact

Worker:

`apps/worker/src/collect-permissionless-social.mjs`

Config:

`apps/worker/config/stage04b4-permissionless-social.json`

Output:

`apps/web/public/data/permissionless-social-signals.json`

Envelope:
- `schemaVersion: permissionless-social-snapshot.v1`;
- collectedAt;
- twice-daily policy;
- minimum operational-source gate;
- sourceCount;
- observationCount;
- SignalBatch records;
- connector runtime states;
- failures and notes.

The current minimum operational-source gate is 3. The verified implementation returned 4.

## Evidence and safety boundaries

- No mock/fallback observations.
- No undocumented scraping.
- No credential leakage.
- Public/no-auth does not mean globally representative.
- Source-native metrics are not directly compared across networks.
- A conservative preview filter is applied before topic/title metadata is persisted/displayed.
- Collection does not create Trend Candidates, Virality, Brand Fit or Opportunity scores.

## Handoff

After Stage 04B-4 release verification, Trend Pulse has enough independent source families to proceed to Stage 04C: workspace-aware topic/entity resolution and cross-source corroboration.

04C must resolve whether observations from social/community/publisher/developer/cultural sources refer to the same underlying phenomenon before promoting `trend-candidate.v1`.
