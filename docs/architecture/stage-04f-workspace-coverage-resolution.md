# Stage 04F — Workspace Intelligence Coverage & Bounded Resolution Expansion

Status: **COMPLETE / PASS WITH DECLARED GAPS**.

## 1. Why 04F exists

The verified 04E runtime is correct but coverage-limited. The latest scheduled baseline inspected before 04F was run `33312664726` on HEAD `9d44ea188bc7a00c20540d751f8ba4f47f6276a5`: the Workspace result remained all Weak Signals with no qualified Workspace Trend Candidate.

The bottleneck was not raw signal volume. The relevant observations were mostly distinct narratives across PocketGamer, GameK, Mastodon and Lemmy, while current Workspace collection lacked direct search-demand and app/store evidence and the shared resolver remained predominantly lexical/entity based.

A result of zero candidates remains valid. Stage 04F improves observability and resolution correctness; it does not force candidate yield.

## 2. Architecture boundary

04F does not rewrite or replace the verified 04E baseline artifact.

Canonical order after remediation:

`04E collect/remediate/finalize → workspace-signals.json → 04E resolve/verify → 04F coverage expansion → workspace-signals-04f.json → 04F coverage/accounting remediation → 04F bounded resolution → semantic-trace finalization → workspace-intelligence.json → 04F verify → 05B Brand Fit gate`

The verified `workspace-signals.json` remains the historical 04E correctness baseline. Stage 04F writes and resolves a separate expansion artifact.

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

An operational source returning zero Workspace-relevant observations is valid and must not be silently labelled as relevant evidence.

## 4. Free-first source expansion under runtime verification

Stage 04F runtime-tests bounded public/no-auth paths configured per Workspace:

- Google Trends Trending Now RSS for search-demand visibility;
- Apple App Store Marketing Tools v2 Top Free Apps feed for app/store competitive visibility;
- Reddit public RSS search as a provisional personal/private community evidence path.

These sources are not considered operational merely because a URL/protocol exists. GitHub Actions runtime success is required. Failed paths produce explicit failures, never mock/fallback observations.

### Source-native metric boundaries

- Google Trends approximate traffic remains source-native Google Trends metadata; it is not views, Virality or cross-platform reach.
- Apple `sourceRank` remains the overall Top Free Apps order returned by Apple. It is never represented as a Games-category rank.
- After artifact QA, Apple Workspace relevance was tightened further: **the primary returned Apple genre must be `Games`**. A secondary `Games` genre alone is insufficient.
- Reddit RSS query text is provenance only; returned content must independently pass Workspace relevance filtering.

## 5. Universal configuration boundary

Connector implementations remain market/category agnostic. Geography, storefront and query values are runtime Workspace configuration. `VN`, `vn` and the Vietnam Mobile Gaming validation scope are pilot runtime configuration only, not core architecture constants.

Arbitrary browser-created Workspaces still cannot synchronize automatically into scheduled GitHub Actions without a persistent backend/database; 04F does not close that gate.

## 6. Bounded resolution expansion

04F retains valid baseline deterministic resolution evidence and adds a conservative cross-source subject bridge.

A new bridge requires a distinctive subject anchor from returned evidence, such as:

- explicit source-native entity/product name;
- exact non-generic hashtag;
- sufficiently distinctive shared title bigram.

Bounded semantic alias groups may only support an already anchored subject. They cannot create a cluster on their own and are excluded from primary `resolutionAnchors` unless the same value is independently a baseline/subject anchor.

After QA finding `Q-004F-SEMANTIC-001`, semantic aliases are revalidated with token/phrase boundaries. Short aliases such as `AI` cannot match inside unrelated words such as `Dubai` or `gaining`.

Workspace scope concepts such as `mobile-gaming`, `vietnam-gaming` or `game-publishing` are relevance context, not narrative identity.

## 7. Candidate and corroboration gates remain strict

- one signal → Weak Signal only;
- same-source repetition → repeated-single-source weak cluster;
- cross-source Trend Candidate → at least two distinct source IDs;
- independently corroborated → at least two independent source IDs and two independent source families after derivative-evidence calibration;
- Brand Fit does not promote evidence maturity;
- Weak Signal does not become Marketing Action merely because it appears brand-relevant.

Zero Trend Candidates remains valid when evidence does not support a cross-source narrative.

## 8. Targeted-source accounting

Stage 04F separates historical 04E targeted execution from the 04F expansion rather than summing successful expansion sources into an old attempted denominator.

The canonical artifact records:

- `baselineTargeted04e.attempted`;
- `baselineTargeted04e.successfulWithRelevantEvidence`;
- `expansionTargeted04f.attempted`;
- `expansionTargeted04f.successfulWithRelevantEvidence`;
- combined attempted/successful counts derived exactly from those two layers.

Verifier invariant: `successfulTargetedSources <= attemptedTargetedSources` and combined totals must equal baseline + expansion totals.

## 9. Contracts and implementation

Contracts:

- `packages/contracts/src/workspace-coverage.ts`
- `packages/contracts/src/index.ts` extends `SourceType` with `store` and allows source-native metadata under `SignalMetrics.native`.

Runtime:

- `apps/worker/src/expand-workspace-coverage-04f.mjs`
- `apps/worker/src/remediate-workspace-coverage-04f.mjs`
- `apps/worker/src/resolve-workspace-intelligence-04f.mjs`
- `apps/worker/src/finalize-workspace-intelligence-04f.mjs`
- `apps/worker/src/verify-workspace-intelligence-04f.mjs`
- `apps/worker/config/runtime-workspaces.json`

UI:

- `apps/web/app/workspace-intelligence-04f.tsx`
- `apps/web/app/page.tsx`

CI:

- `.github/workflows/pages.yml`

## 10. QA history retained

### Pre-main staging audit

A staging diff initially rewrote more of `packages/contracts/src/index.ts` than intended. The broad rewrite was detected before promotion and restored. No affected version ran on canonical `main`.

### Initial runtime validation — run 156

Initial implementation HEAD: `b636baf732d960e460a0d4ad96a65804893ba1ad`.

GitHub Actions run: `33317012677` — build/deploy PASS, but artifact QA identified three correctness issues, so Stage 04F was **not** declared complete.

Artifact: `9733771325`; SHA-256 `f51d1ccd16717331601bd26ffe77c150e82ebf4537922c2a64c60a68123c0059`.

QA findings:

- `Q-004F-ACCOUNTING-001` — targeted-source accounting mixed the 04E baseline denominator with 04F expansion successes.
- `Q-004F-APPLE-001` — Apple evidence accepted `Discord` because `Games` was only a secondary returned genre.
- `Q-004F-SEMANTIC-001` — short semantic alias `AI` used substring matching and incorrectly appeared in a Gamescom candidate trace.

These failures are retained as QA history; methodology was not weakened to make tests pass.

### Remediation validation — run 157

Remediation HEAD: `3f8b57ef2d6dc3e06853c3c30b57c0e489497fdc`.

GitHub Actions run: `33317788007` — build PASS, deploy PASS, 04E verifier PASS, 04F remediation verifier PASS, 05B verifier PASS, Global Pulse verifier PASS, trend-history verifier PASS, static export PASS.

Validation artifact: `9733997962`; SHA-256 `0804d4164c3984e8382f3e88887f52b2870bf0632ba191434f85905d0496fbf1`.

Direct artifact QA verified:

- 04E baseline: 16 relevant / 16 Weak Signals / 4 actual sources / 3 source families / 0 Workspace candidates;
- all 16 04E baseline signal IDs are retained by 04F;
- remediated 04F: **17 relevant / 17 Weak Signals / 5 actual evidence sources / 3 source families**;
- targeted evidence accounting: **3 successful-with-relevant-evidence / 7 attempted**;
  - 04E baseline: 2/4;
  - 04F expansion: 1/3;
- coverage classes:
  - publisher: operational-with-relevant-evidence — 8;
  - social: operational-with-relevant-evidence — 6;
  - community: operational-with-relevant-evidence — 3, with 3 retained Reddit request failures;
  - search-demand: operational-no-relevant-evidence — 0;
  - app-store: operational-no-relevant-evidence — 0;
- Apple secondary-genre observation was removed; `Discord` is absent from the final 04F artifact;
- Reddit contributed one current relevant observation in this cycle;
- Google Trends and Apple endpoints were runtime-operational but yielded zero qualified Workspace evidence after the final relevance gates;
- one Workspace candidate remains independently corroborated from PocketGamer + Mastodon around **Gamescom 2026**;
- its primary `resolutionAnchors` is exactly `gamescom 2026` for this artifact;
- `semanticAnchors` is empty; false `artificial-intelligence` support is removed;
- candidate semantic trace is marked support-only and boundary-revalidated;
- no numeric Confidence/Virality is emitted.

The one corroborated candidate does not imply a marketing decision or action. Stage 05B may evaluate Brand Fit provisionally only because it is a qualified cross-source candidate.

## 11. Verification gates

04F verifier fails if:

- verified 04E baseline signals disappear;
- final signals lose real Workspace ID/evidence;
- operational state is conflated with relevant-evidence state;
- targeted success exceeds attempted, or combined counts do not reconcile to 04E baseline + 04F expansion;
- Apple evidence has a non-`Games` primary returned genre;
- Apple overall Top Free rank is represented as a Games-category rank;
- Google Trends traffic is relabelled as views/cross-platform reach;
- Reddit query provenance becomes relevance evidence;
- a bounded bridge lacks a distinctive subject anchor;
- semantic-only support is promoted into primary resolution anchors;
- short `AI` support exists without an actual token/phrase match;
- Workspace scope concepts alone form a candidate;
- a candidate has fewer than two source IDs;
- corroborated status lacks two independent sources and two independent families;
- numeric Confidence/Virality precision is fabricated;
- zero candidates is treated as an error.

Implementation PASS requires at least one newly introduced search-demand/app-store coverage class to be runtime-operational alongside the verified 04E baseline. Relevant evidence from that class is not required in every cycle.

## 12. Final release rule

Run `33317788007` is the functional remediation validation. The documentation-lock commit and its subsequent successful GitHub Actions run are the canonical final release identifiers for Stage 04F and supersede the validation identifiers above for release/archive purposes.

## 13. Open gates not closed by 04F

- production backend/database and arbitrary Workspace synchronization;
- YouTube credential gate;
- Bluesky targeted-search runner restriction;
- TikTok Creative Center / Meta Ad Library manual-assisted state;
- general multilingual embeddings/semantic resolver beyond bounded aliases;
- autonomous live Source Research across the discoverable source universe;
- paid creative intelligence completeness;
- Reddit public RSS remains provisional and can rate-limit (HTTP 429 observed);
- Google Trends/Apple operational access does not guarantee relevant evidence every cycle;
- numeric Virality / Brand Fit / Opportunity calibration;
- Marketing Action Planner and feedback loop;
- future commercial deployment requires fresh source licensing/compliance review.
