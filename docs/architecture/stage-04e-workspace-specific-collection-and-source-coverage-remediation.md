# Stage 04E — Workspace-Specific Collection & Source Coverage Remediation

Status: **COMPLETE / PASS WITH DECLARED COVERAGE GAPS**

Canonical verification baseline before documentation-only release:

- implementation HEAD: `a86f7615ffc995aa42ed05e01552f842e52964e4`
- workflow run: `33306094068`
- build: success
- deploy: success
- artifact: `9730518513`
- artifact SHA-256: `03526e0b1a7142ec385121a047601f132f8be49e07c6952b906c0b096ee6dab9`

## 1. Why Stage 04E was required

Post-05A-UX audit found that the UI correctly exposed Workspace Intelligence, but the underlying report was still derived from a fixed global source mix. The Source Planner evaluated source fit after collection; it did not yet drive scheduled collection for the Workspace. As a result, the prior count of three Trend Candidates was a Global Pulse result and could not be interpreted as three trends for the saved Workspace.

Stage 04E remediates that architectural mismatch without weakening the no-fabrication rules established in 04C.

## 2. Corrected architecture

The implemented preview flow is now:

`Runtime-synced Workspace → workspace query/concept plan → broad-source relevance filtering + targeted public collection → content/freshness calibration → same-source dedupe → Weak Signals → cross-source Workspace Trend Candidates → Workspace Intelligence report`

Global Pulse remains a separate output and is not substituted into a Workspace report.

## 3. Runtime Workspace boundary

GitHub Actions cannot read browser `localStorage`. Scheduled collection therefore uses `apps/worker/config/runtime-workspaces.json` as the current preview runtime registry.

The UI matches a browser Workspace to a runtime Workspace by explicit names. If no runtime match exists, the report must show a browser-only/runtime-sync-required state rather than present Global Pulse results as Workspace intelligence.

This is a preview-runtime boundary, not the target production architecture. A persistent backend/database remains required for automatic multi-workspace synchronization.

## 4. Workspace collection remediation

Implemented components include:

- `apps/worker/src/collect-workspace-signals.mjs`
- `apps/worker/src/remediate-workspace-signals.mjs`
- `apps/worker/src/finalize-workspace-signals.mjs`
- `apps/worker/src/resolve-workspace-intelligence.mjs`
- `apps/worker/src/verify-workspace-intelligence-data.mjs`
- `apps/worker/src/sanitize-signal-contracts.mjs`
- `apps/worker/config/runtime-workspaces.json`

The workflow now executes workspace-specific collection and quality gates before Workspace Intelligence resolution.

## 5. Relevance and freshness corrections

The remediation explicitly fixes the following defects:

1. Collection query text cannot count as evidence that returned content is relevant.
2. Publisher evidence used in current-trend Workspace snapshots is freshness bounded.
3. Lemmy and Stack Exchange targeted evidence is bounded by recent time windows.
4. GitHub targeted discovery uses a quality floor and a recent repository window.
5. Same-source near-duplicate evidence is removed before resolution.
6. Final source diversity is recomputed from the final surviving signal set, not inherited from an earlier collection phase.
7. Source request failures are carried explicitly and cannot be hidden by stale coverage metadata.

## 6. Signal contract correction

GitHub repository programming language is not human language.

Stage 04E prevents values such as `TypeScript`, `Python`, or `Java` from leaking into `Signal.language`. Programming language may be retained only as source-native metadata/keywords. `Signal.language` remains reserved for human-language semantics.

## 7. Weak Signal layer

A signal no longer disappears merely because it cannot yet form a cross-source Trend Candidate.

Workspace Intelligence now separates:

`Signal → Weak Signal / source-native evidence → cross-source Trend Candidate → independently corroborated Trend`

A same-source repeated cluster remains weak/repeated evidence. It cannot be promoted to a Workspace Trend Candidate solely because the source repeated the narrative.

## 8. Workspace report correctness

The primary Workspace report reads `workspace-intelligence.json`, not `trend-candidates.json`.

The Global Pulse pipeline remains available independently for broad discovery and historical testing, but Global candidates must not be counted as Workspace candidates unless independently resolved through the Workspace pipeline.

## 9. Final verified artifact — Vietnam Mobile Gaming preview Workspace

Final 04E quality gate from run `33306094068`:

- global real input signals: 327
- final Workspace-relevant signals: 17
- visible Weak Signals: 17
- cross-source Workspace Trend Candidates: 0
- independently corroborated Workspace trends: 0
- actual source diversity: 4
- actual source-family diversity: 3
- actual active sources:
  - PocketGamer.biz RSS
  - GameK Mobile RSS
  - Mastodon public hashtag timeline
  - Lemmy public recent search
- source families represented:
  - publisher
  - social
  - community
- human-language evidence includes English and Vietnamese
- final targeted request failures: 0
- Workspace coverage status: `pass-with-gaps`

The zero candidate count is intentional. The system exposes the 17 Weak Signals rather than manufacture a trend from insufficient cross-source agreement.

## 10. Additional source behavior verified in the run

The global backbone collected eight batches in the same release, including PocketGamer, GameK Mobile, GameK Market, VnExpress technology, Hacker News, GitHub, TechCrunch and Road to VR. Stage 04E finalization excluded stale or irrelevant records from the Workspace snapshot even if they remained valid Global Pulse observations.

Bluesky public source-native trends remain operational in the broad social backbone. Targeted Bluesky `searchPosts` is runtime-deferred because repeated GitHub-hosted runner requests returned HTTP 403; the product must not claim that path is operational.

YouTube remains credential-gated in the current repository because `YOUTUBE_API_KEY` is not configured. No fake YouTube fallback is generated.

## 11. Verification invariants

`verify:workspace-intelligence-data` fails the build if any of the following occurs:

- no runtime Workspace snapshot exists;
- Workspace-targeted collection did not execute;
- no relevant signals survive;
- final source diversity is below the minimum gate;
- the Weak Signal layer is empty;
- Workspace signals lack a real `workspaceId` or Workspace collection scope;
- evidence URLs are missing;
- GitHub programming language leaks into `Signal.language`;
- stale evidence exceeds the implemented current-snapshot windows;
- recorded source diversity disagrees with actual artifact source diversity;
- a same-source cluster is promoted to a cross-source Workspace Trend Candidate.

## 12. Declared coverage gaps — not defects hidden as PASS

Stage 04E does **not** claim universal source completeness. Remaining gates are explicit:

- browser-created Workspaces do not automatically synchronize into scheduled GitHub Actions; a persistent backend/runtime is required for true arbitrary multi-workspace always-on collection;
- YouTube requires a repository secret / authorized credential before operational collection;
- TikTok Creative Center and Meta Ad Library remain manual-assisted unless a compliant automated path is verified;
- Reddit remains access-constrained for broad automated usage;
- Bluesky targeted search is runtime-deferred on the current GitHub runner although broad public trends work;
- current deterministic multilingual concept aliases are an inspectable bridge, not general semantic translation;
- source discovery is not yet an autonomous runtime crawler of the entire web/source universe.

These limitations explain `pass-with-gaps`. They must remain visible in product and technical status until separately implemented.

## 13. Decision

Stage 04E closes the audited correctness defects that caused a Global Pulse candidate count to be presented as if it represented a Workspace market. The Workspace report is now evidence-preserving, weak-signal aware, freshness bounded, source-diversity verified and explicitly scoped to runtime-synced Workspaces.

Proceeding to downstream intelligence work is allowed only while preserving the declared coverage gaps above. Source breadth should continue to expand free-first, but additional breadth must not weaken relevance, freshness, provenance or cross-source corroboration rules.
