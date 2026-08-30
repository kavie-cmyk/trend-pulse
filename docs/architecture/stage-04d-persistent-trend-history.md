# Stage 04D — Persistent Multi-cycle Trend History & Momentum Foundation

Status: COMPLETE / PASS — implementation verified; canonical scheduled baseline intentionally remains empty until the first real scheduled run.
Date: 2026-08-30

## Goal

Persist Trend Candidate lineage across collection cycles so Trend Pulse can distinguish new, continuing, reappeared and newly disappeared narratives before any Virality, velocity, acceleration or lifecycle scoring is attempted.

Canonical flow:

`Calibrated 04C Trend Candidates → lineage matching → cycle delta → verified build → scheduled-only history persistence → next scheduled comparison`

## Snapshot identity vs persistent identity

A `TrendCandidate.id` belongs to one resolved snapshot and is not treated as permanent identity. Source sets, observations and resolution anchors may change between cycles.

Stage 04D therefore introduces a separate `lineageId`. A candidate may reuse an existing lineage only when deterministic, inspectable resolution evidence exceeds the lineage-match gate.

Methodology: `trend-lineage-match-04d.v1`.

Current match evidence uses:

- normalized resolution-anchor overlap;
- normalized title-token overlap;
- weighted similarity = 76% anchor Jaccard + 24% title-token Jaccard;
- base threshold 0.38;
- threshold 0.46 after more than four missed cycles;
- at least one normalized anchor overlap is mandatory;
- one-to-one greedy assignment prevents one previous lineage from being assigned to multiple current candidates.

These thresholds are deterministic V1 engineering gates, not empirically calibrated market scores.

## Presence classes

Current history classes are:

- `new` — no previous lineage match;
- `continuing` — matched a lineage present in the baseline cycle;
- `reappeared` — matched a lineage that had one or more missed cycles;
- `disappeared` — a previously active baseline lineage has no current match.

Presence is not lifecycle stage. A continuing candidate is not automatically accelerating, mainstream or important.

## Structural evidence direction

04D records `not-comparable`, `expanding`, `stable`, `contracting` or `mixed` from changes in:

- current cluster signal count;
- independent source count;
- independent source-family count.

This is structural evidence spread only. It is explicitly not:

- Virality;
- velocity;
- acceleration;
- engagement momentum;
- lifecycle movement.

Source-native metrics remain excluded from cross-platform comparison.

## Comparison-window semantics

The twice-daily V1 collection policy is currently anchored at 07:17 UTC and 19:17 UTC. 04D classifies the elapsed comparison window as:

- `bootstrap` — no previous canonical scheduled baseline;
- `too-close-for-cadence` — less than 6 hours;
- `comparable` — 6 through 18 hours;
- `stale-gap` — over 18 hours or temporally invalid.

The 6–18 hour band is a bounded cadence QA rule around the 12-hour policy, not a statistical model.

## Persistence architecture

Canonical history uses the dedicated Git branch `trend-history` rather than an ephemeral runner cache.

Canonical scheduled state:

`history/production-state.json`

Each eligible scheduled run may also persist its cycle delta and exact calibrated 04C snapshot under:

- `history/cycles/<cycleId>.json`;
- `history/snapshots/<cycleId>.json`;
- `history/latest-production.json`.

The state is only written after 04C verification, 04D verification and the static build have all passed. A malformed previous state fails rather than silently resetting history.

## QA cycle isolation

A critical implementation QA finding was that push/rerun cycles must not become the comparison baseline for the real 07:17/19:17 schedule. Otherwise a development deployment at midday could cause the evening collection to compare against a QA snapshot only a few hours old instead of the morning scheduled cycle.

Stage 04D therefore separates cycle purpose:

- `scheduled` — persistence eligible after verification/build gates;
- `qa` — artifact/preview only, never advances `history/production-state.json`.

Workflow `push` and `workflow_dispatch` currently resolve to `qa`. Only GitHub Actions `schedule` resolves to `scheduled` and executes the canonical persistence step.

Historical QA writes created during implementation remain traceable in Git history. They are not deleted or rewritten. A new production baseline file was initialized separately, so prior QA cycles cannot contaminate scheduled comparisons.

## Persistence proof and remediation history

Initial implementation head `bb154a751154ff0f716c15745f840bc8b6723f8f`, run `33294206445` attempt 1, proved an actual versioned history write to the `trend-history` branch:

- 4 current candidates;
- 4 new lineages;
- bootstrap comparison;
- verifier PASS;
- history commit `e5ad8bfe95217cf5aa21520fd73fb9f035c1d897`.

The same workflow run was rerun as attempt 2. It restored attempt-1 state from the branch and produced:

- 0 new;
- 4 continuing;
- 0 reappeared;
- 0 newly disappeared;
- comparison gap about 0.02h, correctly classified `too-close-for-cadence`;
- the same four lineage IDs with `seenCycles` incremented to 2;
- history commit `976b9cd9972435065f8d1a7a5f93be4d4b0f2add`.

This proved real cross-run state restoration rather than fixture-only persistence.

Attempt-2 Pages deploy failed because rerunning the same workflow created two artifacts with the same `github-pages` name. This was a release QA defect, not a history-data failure. The workflow was remediated to name artifacts by `github.run_attempt` and pass the matching name to `deploy-pages`.

Post-remediation head `37ad42a2fa6bedc556b4dbcd91ab89073283cb94`, run `33294346323`, passed build and deploy and persisted another QA history cycle. Direct artifact inspection verified `trend-history-cycle.v1`, 4 continuing lineages, zero disappeared, no Virality/velocity/acceleration fields, and a `too-close-for-cadence` comparison.

A second correctness review then identified QA-baseline contamination risk. The canonical scheduled baseline was separated into `history/production-state.json`; prior QA history was preserved. Head `41c04baec7ead74fff623cc80280b6a827e1ced2`, run `33294641382`, verified the final isolation semantics:

- real collection and 04C verification PASS;
- 04D cycle purpose `qa`;
- persistence eligible `false`;
- baseline path `history/production-state.json`;
- comparison `bootstrap` because no real scheduled baseline exists yet;
- persistence step skipped;
- explicit QA isolation step PASS;
- static build and Pages deploy PASS;
- read-back of `history/production-state.json` remained `cyclesRecorded: 0`.

This is intentional. The first real scheduled workflow run will create the first canonical production baseline; the second real scheduled run will provide the first production twice-daily comparison.

## Contracts and implementation

Contracts:

- `packages/contracts/src/trend-history.ts`
- export: `@trend-pulse/contracts/trend-history`

Runtime:

- `apps/worker/src/build-trend-history.mjs` — deterministic lineage matching and cycle delta builder;
- `apps/worker/src/verify-trend-history.mjs` — fixture + real artifact invariants;
- `apps/web/app/trend-history.tsx` — transparent history/QA-baseline UI;
- `.github/workflows/pages.yml` — history checkout, QA/schedule classification, scheduled-only persistence and attempt-scoped Pages artifacts.

Preview artifact:

`apps/web/public/data/trend-history.json`

Schema: `trend-history-cycle.v1`.

Persistent branch: `trend-history`.

Canonical production state: `history/production-state.json`.

## Locked invariants

- Snapshot Trend Candidate ID is not persistent trend identity.
- Persistent identity uses a separate `lineageId` with inspectable match evidence.
- A lineage cannot be assigned to multiple current candidates in one cycle.
- QA push/manual cycles cannot advance the canonical scheduled baseline.
- Only a scheduled workflow run may persist `production-state.json`.
- Scheduled persistence happens only after 04C verification, 04D verification and static build success.
- Failed, cancelled and remediated runs remain traceable.
- Malformed previous state fails rather than silently resetting history.
- Structural evidence direction is not Virality, velocity, acceleration or lifecycle movement.
- Source-native metrics remain non-comparable across platforms in 04D.
- A real production comparison requires scheduled baseline history; QA-close reruns do not substitute for elapsed market time.

## Handoff

04D provides the temporal storage and lineage foundation needed by later Virality/Confidence work, but numeric Virality and lifecycle movement remain gated until real scheduled history accumulates. The first scheduled cycle is a production bootstrap; at least the next scheduled cycle is required before any twice-daily temporal delta can be observed from production data.

Final documentation-head release run/artifact are verified separately in the build record and Master Log.
