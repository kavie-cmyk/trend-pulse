# Stage 04B-3 — Social Signal Backbone

Status: COMPLETE / PASS.

## Goal

Add social/creator/community evidence before cross-source Trend Candidate clustering. Trend Pulse is currently a personal/private, non-commercial tool, but source-specific access, eligibility, quota and automation rules still apply.

Canonical source flow remains:

`Workspace → Source Research → Source Evaluation → Source Plan → Connector Activation → Collection`

A platform-native “trend” is still only a source observation. It does not become a Trend Pulse Trend Candidate until independent-source corroboration exists.

## Locked collection policy

Every ACTIVE source is invoked twice daily under D-012. Current preview anchors remain 07:17 UTC and 19:17 UTC.

## Social source decisions

### Bluesky Public Trends API — OPERATIONAL

Bluesky documents that many public AppView requests can be made without authentication through `public.api.bsky.app`. Stage 04B-3 uses the public `app.bsky.unspecced.getTrends` endpoint as the first credential-free social trend source.

Collected source-native fields where available:
- topic/display name;
- category;
- source-native status;
- start time;
- post count;
- sample actors;
- evidence link.

Boundary: Bluesky `postCount` and its own trend status are source-native. They are not cross-platform Virality scores.

### YouTube Data API — READY / NEEDS VALID CREDENTIAL

The connector is wired behind `YOUTUBE_API_KEY` and never exposes the key in the browser/static artifact. No key is currently assumed.

If a valid runtime credential is present, the Stage 04B-3 preview can collect source-native `mostPopular` chart observations for configured regions. Current YouTube documentation notes that since July 2025 `mostPopular` no longer represents the former broad Trending page and is concentrated in Music, Movies and Gaming. Therefore this path is evidence, not a universal YouTube trend proxy.

Workspace-aware query/search collection should be added when a persistent workspace runtime exists.

### Reddit Data API — ACCESS-CONSTRAINED

Current Reddit Data API terms require registration, OAuth identity and eligibility to accept the terms. The current runtime does not activate Reddit and does not substitute undocumented scraping. Commercial-license gating is not the current default because Trend Pulse is personal/private, but general eligibility and approved-use constraints remain.

### TikTok Research Tools — RESTRICTED ELIGIBILITY

Personal/non-commercial use alone does not qualify. Current TikTok Research Tools access requires an approved qualifying researcher/organization and an approved research application. Trend Pulse must not pretend that personal use creates API eligibility.

### TikTok Creative Center — MANUAL-ASSISTED

Retained as a high-value public trend/creative intelligence surface. Stage 04B-3 does not assume an undocumented automation endpoint.

### Meta Ad Library — MANUAL-ASSISTED

Retained as paid-creative / competitor evidence. It must not be used as proof of organic Facebook/Instagram virality.

### Threads / Instagram organic / Facebook organic / X organic — RESEARCH-PENDING

Do not assume broad free listening or scraping rights. These source families remain research-gated until current official read/search scopes and access economics are verified.

## Runtime artifact

Worker:

`apps/worker/src/collect-social.mjs`

Config:

`apps/worker/config/stage04b3-social.json`

Output:

`apps/web/public/data/social-signals.json`

Envelope:
- `schemaVersion: social-backbone-snapshot.v1`
- collectedAt
- twice-daily policy
- sourceCount
- observationCount
- independent SignalBatch records
- connector access-state map
- runtime failures/notes

## Source Planner integration

Stage 04B-3 extends the runtime Source Registry with:
- `bluesky-trends-api` — operational after runtime verification;
- `reddit-data-api` — high intelligence potential but access-constrained in the current operating environment.

The existing source-eval.v0.1 method is reused. Social entries are evaluated through the same Intelligence Fit and Operational Feasibility method; no separate social scoring model is introduced.

Gap reconciliation is re-run after the social extension so an operational community source can legitimately improve a workspace community-coverage gap without rewriting unrelated gaps.

## Safety and evidence boundaries

The public preview applies conservative filtering before social topics are persisted/displayed. This is a preview-surface policy and does not change the source access architecture.

No fake fallback data. No undocumented scraping. No credential leakage. No direct comparison of platform-native metrics.

## QA history and final verification

Historical failed run: `33244304155` at commit `c724202bcff6c5f1fe03a93401ca2c60d6a343de`.

Failure reason: the Bluesky `getTrends` endpoint rejected `limit=30` and returned its actual API maximum of 25. The config and collector were corrected to cap the request at 25. The failed run remains part of the audit history.

Verified implementation head before this documentation-finalization commit: `e024ef0ca8b2e5ad0dc8778be99c6da156812ae5`.

Verified run: `33244376921` — PASS across typecheck, global backbone collection, social collection, Wikimedia collection, static export, Pages artifact upload and Pages deploy.

Verified social result:
- `social-backbone-snapshot.v1`;
- 1 active social source batch;
- 25 real Bluesky observations;
- 0 runtime failures;
- every observation is `signal.v1`;
- every observation has an evidence URL;
- YouTube remains `ready-needs-credential` because no valid runtime key is present;
- Reddit remains `access-constrained`;
- TikTok Research Tools remain `restricted-eligibility`;
- TikTok Creative Center and Meta Ad Library remain `manual-assisted`;
- Threads, Instagram organic, Facebook organic and X organic remain `research-pending`.

Verified Pages artifact: `9712366616` with SHA-256 `97db2e0d7ba341a63b71b55f93132839ad5fe16f33e5420703b02de31a460f9b`. The artifact contains `data/social-signals.json` alongside the existing backbone and Wikimedia snapshots.

Stage 04B-3 is COMPLETE / PASS subject to the final documentation-head CI run also passing.

## Handoff

Stage 04C can now perform workspace-aware topic/entity resolution and cross-source corroboration using social + publisher + community + developer + cultural evidence before Virality scoring. YouTube and additional social families can be promoted later when valid access becomes available without changing the core architecture.
