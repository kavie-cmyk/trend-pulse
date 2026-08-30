# Stage 04F — Workspace Intelligence Coverage & Bounded Resolution Expansion

Status: implementation / runtime QA pending.

## 1. Why 04F exists

The verified 04E runtime is correct but coverage-limited. The latest scheduled baseline inspected before 04F is run `33312664726` on HEAD `9d44ea188bc7a00c20540d751f8ba4f47f6276a5`: 327 global real signals → 17 final Workspace-relevant signals → 17 Weak Signals → 0 qualified Workspace Trend Candidates → 0 independently corroborated Workspace trends.

The bottleneck is not raw signal volume. The 17 final observations are mostly distinct narratives across PocketGamer, GameK, Mastodon and Lemmy, while current Workspace collection lacks direct search-demand and app/store evidence and the shared resolver remains predominantly lexical/entity based.

A result of zero candidates remains valid. Stage 04F must improve observability and resolution correctness, not force candidate yield.

## 2. Architecture boundary

04F does not rewrite or replace the verified 04E baseline artifact.

Canonical order:

`04E collect/remediate/finalize → workspace-signals.json → 04E resolve/verify → 04F coverage expansion → workspace-signals-04f.json → 04F bounded resolution → workspace-intelligence.json → 04F verify → 05B Brand Fit gate`

This preserves the historical 04E correctness gate while allowing downstream Workspace Intelligence to consume the richer 04F artifact.

## 3. Coverage classes

04F explicitly separates source operational state from current-cycle relevant evidence.

Required coverage classes:

- publisher;
- social;
- community;
- search-demand;
- app-store.

Runtime states:

- `operational-with-relevant-evidence`;
- `operational-no-relevant-evidence`;
- `runtime-failed`;
- `not-configured`.

An operational source returning zero Workspace-relevant observations is a valid state and must not be silently labelled as covered evidence.

## 4. Free-first source expansion under runtime verification

Stage 04F runtime-tests bounded public/no-auth paths configured per Workspace:

- Google Trends Trending Now RSS for search-demand visibility;
- Apple App Store Marketing Tools v2 Top Free Apps feed for app/store competitive visibility;
- Reddit public RSS search as a provisional personal/private community evidence path.

These are not assumed operational merely because the URL or protocol exists. GitHub Actions runtime success is required before a source may be described as runtime-operational in this stage.

No failed source path produces mock or fallback observations.

### Source-native metric boundaries

- Google Trends approximate traffic remains Google Trends source-native metadata; it is not views, Virality or cross-platform reach.
- Apple `sourceRank` is the overall Top Free Apps order returned by the feed. Filtering returned Apple genre metadata to `Games` does not convert the overall rank into a Games-category rank.
- Reddit RSS query text is provenance only; returned title/content must independently pass Workspace relevance filtering.

## 5. Universal configuration boundary

Connector implementations are market/category agnostic. Geography/storefront/query values are runtime Workspace configuration. `VN`, `vn` and the Vietnam Mobile Gaming validation scope are pilot runtime configuration only and are not core architecture constants.

Arbitrary browser-created Workspaces still cannot synchronize automatically into scheduled GitHub Actions without a persistent backend/database; 04F does not close that gate.

## 6. Bounded resolution expansion

04F retains all baseline 04C deterministic resolution edges and adds a conservative cross-source subject bridge.

A new 04F bridge requires a distinctive subject anchor from returned evidence, such as:

- explicit source-native entity/product name;
- exact non-generic hashtag;
- sufficiently distinctive shared title bigram.

Bounded semantic alias groups may support an already anchored subject across language/wording variants, but aliases cannot create a cluster on their own.

Workspace scope concepts such as `mobile-gaming`, `vietnam-gaming` or `game-publishing` are relevance context, not narrative identity. They must never be sufficient to form a Trend Candidate.

## 7. Candidate and corroboration gates remain strict

- one signal → Weak Signal only;
- same-source repetition → repeated-single-source weak cluster;
- cross-source Trend Candidate → at least two distinct source IDs;
- independently corroborated → at least two independent source IDs and at least two independent source families after derivative-evidence calibration;
- Brand Fit does not promote evidence maturity;
- Weak Signal does not become Marketing Action because it appears brand-relevant.

Zero Trend Candidates remains a valid PASS result when the source evidence does not support a matching cross-source narrative.

## 8. Contracts and implementation

Contracts:

- `packages/contracts/src/workspace-coverage.ts`
- `packages/contracts/src/index.ts` extends `SourceType` with `store` and allows a source-native metric envelope under `SignalMetrics.native`.

Runtime:

- `apps/worker/src/expand-workspace-coverage-04f.mjs`
- `apps/worker/src/resolve-workspace-intelligence-04f.mjs`
- `apps/worker/src/verify-workspace-intelligence-04f.mjs`
- `apps/worker/config/runtime-workspaces.json`

UI:

- `apps/web/app/workspace-intelligence-04f.tsx`
- `apps/web/app/page.tsx`

CI:

- `.github/workflows/pages.yml`

## 9. Verification gates

04F verifier must fail if:

- verified 04E baseline signals disappear from the 04F expansion artifact;
- any final signal loses its real Workspace ID or evidence URL;
- operational state is conflated with relevant-evidence state;
- Apple overall Top Free rank is represented as a Games-category rank;
- Google Trends approximate traffic is relabelled as views/cross-platform reach;
- Reddit query text becomes relevance evidence;
- a bounded semantic bridge has no distinctive subject anchor;
- Workspace scope concepts alone form a candidate;
- a candidate has fewer than two source IDs;
- corroborated status lacks two independent sources and two independent source families;
- numeric Confidence/Virality precision is fabricated;
- zero candidates is treated as an error.

Implementation PASS additionally requires at least one of the newly introduced search-demand/app-store coverage classes to be runtime-operational alongside the verified 04E baseline classes.

## 10. Open gates not closed by 04F

- production backend/database and arbitrary Workspace synchronization;
- YouTube credential gate;
- Bluesky targeted-search runner restriction;
- TikTok Creative Center / Meta Ad Library manual-assisted state;
- general multilingual embeddings/semantic resolver;
- autonomous live Source Research across the discoverable source universe;
- paid creative intelligence completeness;
- numeric Virality / Brand Fit / Opportunity calibration;
- Marketing Action Planner and feedback loop.
