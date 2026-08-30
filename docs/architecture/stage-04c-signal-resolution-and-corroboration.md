# Stage 04C — Signal Resolution & Cross-source Corroboration

Status: COMPLETE / PASS — subject to final documentation-head CI verification.
Date: 2026-08-30

## Goal

Turn real source observations into inspectable topic/entity clusters and promote only evidence-supported clusters toward Trend Candidates. Stage 04C does not calculate Virality, Brand Fit, Opportunity or a numeric Confidence score.

Canonical flow:

`Real Signal pool → deterministic resolution → candidate clusters → derivative-evidence calibration → independent corroboration gate → Global Trend Candidate → workspace projection`

## Global resolution vs workspace projection

Most current collectors are broad/global source feeds. They must not fabricate a `workspaceId` merely because a browser Workspace exists.

Stage 04C therefore separates:

1. `GlobalResolvedTrendCandidate` — resolved from broad/global evidence and intentionally has no `workspaceId`;
2. `WorkspaceTrendProjection` — a browser-side projection of the global candidate against a real saved Workspace;
3. D-010 `TrendCandidate` remains the workspace-specific contract for later materialization when a true workspace-scoped runtime exists.

Workspace projection classes are `direct`, `adjacent`, `global-breakout`, and `out-of-scope`. Projection does not rewrite the global evidence artifact.

## Resolution methodology

Methodology: `trend-resolution-04c.v1`.

The resolver is deterministic and inspectable rather than an opaque model similarity score. Current features include:

- normalized topic/title tokens;
- explicit entities when supplied by a source;
- hashtags;
- source keywords/tags;
- creator/community identifiers;
- current-snapshot document-frequency weighting so distinctive/rare terms carry more weight;
- generic terms such as broad category words are down-weighted or excluded as corroboration anchors.

Pair matching requires distinctive shared anchors plus bounded weighted similarity. Same-source matches use a stricter threshold than cross-source matches.

A single observation never creates a Trend Candidate. Clusters must contain at least two observations and at least two evidence URLs.

## Independent corroboration gate

Raw source diversity is not sufficient. A publisher article redistributed into a community/social surface can create two source IDs without providing two independent origins of the narrative.

Calibration methodology: `corroboration-dependency-04c.v1`.

Stage 04C detects near-duplicate publisher/news ↔ community/social headlines using a bounded title-overlap rule. When the overlap indicates likely repost/syndication/distribution, the distribution signal remains useful attention evidence but is discounted from the independent corroboration count.

A candidate is `corroborated` only when, after dependency calibration, it retains:

- at least 2 independent source IDs; and
- at least 2 independent source families.

Otherwise it remains `candidate`.

The artifact exposes raw `sourceIds/sourceFamilies`, independent source/family sets, and `dependencyRisks` so the downgrade is auditable.

## QA discovery and remediation

The first implementation run (`33293160773`, head `cce315a496a66677fef9041b6cbd16b9e0d8e825`) processed 269 unique real signals and initially returned:

- 1 raw corroborated cluster;
- 2 candidates;
- 6 clustered signals;
- 263 unclustered signals.

Artifact inspection showed the raw corroborated Sony Music / Warner / Anthropic cluster combined a TechCrunch publisher observation with a Lemmy community post carrying a near-duplicate headline. That could represent redistribution of the same article rather than independent corroboration.

This was treated as a QA defect, not accepted as a real corroborated trend. Stage 04C added derivative-evidence calibration and expanded the verifier.

A later calibrated run (`33293342407`, head `a0d4bc5f21bb39e05bdfd61b02756bd9f3e2a17e`) returned:

- 269 unique real signals;
- 0 independently corroborated trends;
- 3 candidates;
- 1 dependency demotion;
- verifier PASS.

This is a valid and preferred result over manufacturing a corroborated trend from dependent evidence.

## Lifecycle and confidence boundary

All current 04C candidates remain `weak-signal`. One current snapshot cannot establish acceleration, breakout, mainstream, saturation or decline.

Confidence remains a provisional structured assessment with factor availability/rationale/evidence, but no numeric score is emitted. Historical persistence is explicitly missing until multi-cycle snapshots are persisted and compared.

## Native metric boundary

04C does not compare source-native metrics across platforms. Examples that remain incomparable here include:

- HN points/comments;
- GitHub stars/forks/issues;
- RSS feed position;
- Bluesky post count;
- Mastodon uses/accounts;
- Lemmy votes/comments;
- Forem trend score;
- Stack Overflow score/views/answers;
- Wikimedia pageviews.

Those metrics can support later source-specific normalization but do not influence 04C lexical/entity clustering directly.

## Contracts and implementation

Contracts:

- `packages/contracts/src/index.ts` — D-010 workspace-specific `TrendCandidate`;
- `packages/contracts/src/trend-resolution.ts` — global resolved candidate, dependency-risk and workspace-projection contracts.

Runtime:

- `apps/worker/src/resolve-trends.mjs` — deterministic resolution/clustering;
- `apps/worker/src/calibrate-trend-corroboration.mjs` — derivative-evidence independence calibration;
- `apps/worker/src/verify-trend-resolution.mjs` — invariant/fixture verification;
- `apps/web/app/trend-candidates.tsx` — transparent current-snapshot UI and browser Workspace projection.

Generated artifact:

`apps/web/public/data/trend-candidates.json`

Schema: `trend-resolution-snapshot.v1`.

## Locked invariants

- No single observation → Trend Candidate.
- No fabricated `workspaceId` on broad/global evidence.
- Raw source count ≠ independent source count.
- Community/social redistribution of a publisher item does not automatically provide independent corroboration.
- `corroborated` requires 2+ independent source IDs and 2+ independent source families.
- Unrelated signals remain unclustered rather than being force-fit.
- No numeric Confidence, Virality, Brand Fit or Opportunity score in 04C.
- No lifecycle movement beyond `weak-signal` without time-series evidence.
- Source-native cross-platform metrics remain non-comparable.

## Handoff

Stage 04C combines the earlier planned topic/entity resolution and cross-source clustering/corroboration work into one stage. The next stage should establish persistent multi-cycle signal/trend history and compare the two daily collection cycles before attempting lifecycle momentum, velocity/acceleration or Virality scoring.

Final release head/run/artifact are to be appended after documentation-head verification.