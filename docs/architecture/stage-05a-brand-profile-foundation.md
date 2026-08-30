# Stage 05A — Brand Profile Intake & Resolution Foundation

Status: **COMPLETE / PASS**, with post-release provenance calibration incorporated.

## Objective

Create an evidence-aware Brand Profile foundation for Focus Brand decision targets before Brand Fit or Opportunity scoring.

Canonical path:

`Workspace → Focus Brand → Brand Profile intake → provenance / unresolved inputs → readiness gate → downstream Brand Fit`

05A does **not** compute Brand Fit, Opportunity, Virality or execution recommendations.

## D-019 — Evidence-aware Brand Profile & Brand Fit Readiness Gate

1. A Focus Brand name alone is insufficient for Brand Fit.
2. Brand Profile is attached to `(workspaceId, focusBrandId)` and is not shared automatically with Monitored Entities.
3. Workspace scope may seed Brand Profile fields, but inherited values retain `workspace-derived` provenance.
4. Direct structured edits retain `user-input` provenance by field, including when the edited value happens to equal the current Workspace value.
5. Fields that remain `workspace-derived` follow later Workspace revisions; fields owned by `user-input` are preserved across Workspace revisions.
6. Pasted briefs, URLs and Drive references that have not been resolved remain `pending-resolver`; they do not silently become brand facts and do not count as resolved evidence.
7. Readiness is deterministic and separate from Brand Fit scoring.
8. No 0–10 Brand Fit score is produced in 05A.
9. Conflicts/contradictions are represented in the foundation contract but automated claim extraction and adjudication remain downstream.
10. Browser localStorage is preview persistence only; production multi-user persistence is still an open backend gate.

## Brand Fit readiness methodology `brand-fit-readiness-05a.v1`

### Blocking core fields

All must be present:

- categories
- markets
- target audiences

If any are absent → `blocked`.

### Strategic identity group

At least one must be present:

- positioning
- value proposition

### Expressive/content context group

At least one must be present:

- tone of voice
- content pillars

If core fields are present but either required group is absent → `partial`.

If core fields and both required groups are present → `ready-for-provisional-brand-fit`.

This gate means only that downstream Brand Fit is allowed to run provisionally. It is not evidence that a trend fits the brand.

## Recommended non-blocking context

05A surfaces gaps without treating all of them as hard blockers:

- product lines
- visual codes
- risk boundaries
- commercial objectives
- creator priorities
- paid priorities
- SEO/search priorities
- do
- don't

## Contracts

`packages/contracts/src/brand-profile.ts`

- `BrandProfileFieldKey`
- `BrandProfileFieldProvenance`
- `BrandProfileReference`
- `BrandFitReadinessAssessment`
- `BrandProfileFoundationRecord`
- `BrandProfileStore`

Existing D-010 contract `brand-profile.v1` remains the structured brand payload inside the foundation record.

## Browser implementation

`apps/web/app/brand-profile-foundation.ts`

- Workspace-derived draft seeding
- structured normalization/deduplication
- readiness assessment
- event-aware field provenance
- Workspace revision inheritance for fields still owned by Workspace
- preservation of direct user-owned fields across Workspace revisions
- stable `(workspace, focusBrand)` upsert semantics
- pending-reference preservation

`apps/web/app/brand-profile-console.tsx`

- multi-Focus-Brand profile selection
- structured field editing
- explicit field-touch tracking for provenance
- pasted brief / URL / Drive intake
- readiness gate UI
- provenance and recommended-gap UI
- browser persistence under `trend-pulse.brand-profiles.v1`

`apps/worker/src/verify-brand-profile-foundation.mjs`

- deterministic fixtures for `blocked`, `partial` and `ready-for-provisional-brand-fit`
- event-aware provenance checks
- Workspace revision inheritance checks
- pending-vs-resolved evidence boundary checks
- multi-Focus-Brand isolation checks
- explicit no-numeric-score invariant

`.github/workflows/pages.yml`

- every Pages build is gated by `npm run verify:brand-profile` after TypeScript and before collection/build/deploy.

## Integrity boundaries

- FocusBrand ≠ MonitoredEntity.
- Workspace-derived context ≠ externally verified brand truth.
- Pending reference ≠ resolved evidence.
- Readiness ≠ Brand Fit.
- Brand Fit ≠ Opportunity.
- User-provided context may be sufficient for a provisional assessment, but provenance must remain visible.
- Unsupported brand fields remain empty.
- No system research claim is fabricated in the static browser runtime.
- Equality of values does not erase explicit user authorship.

## QA history and post-release calibration

The initial Stage 05A release established the contracts, UI and readiness gate, but deeper read-back found a provenance ambiguity: provenance was inferred mainly by comparing a field's value with current Workspace scope. A user could explicitly edit a field to the same value and have it classified again as `workspace-derived`. Stored Workspace-derived fields could also become stale after a later Workspace revision.

This behavior is superseded by event-aware provenance:

- explicitly touched field → `user-input`;
- untouched unchanged field → preserve its previous provenance;
- previously `workspace-derived` field → use current Workspace value when Workspace changes;
- previously `user-input` field → preserve Brand Profile value when Workspace changes.

Remediation commits:

- `47184cc7c1eab4f47baadb22839c598c2d7f2360` — event-aware provenance and revision-aware draft inheritance.
- `e9db0d07f0fee35c87a533d2384e9e9baff1b088` — UI field-touch tracking.
- `16447a6ae88c3dc47b28eb05ed22f4063f2aba0c` — dedicated Stage 05A invariant verifier.
- `ced70bda82ff4c0e4f4194a93ad049b008de5969` — verifier npm script.
- `17b4a3ffa6f0a6ce2aff4671b9145994e78361de` — verifier added as a mandatory Pages CI gate.
- `87cf2f562495f637b9ec6567cae9666dad49178e` — fixture merge correction after the new gate exposed a test-helper defect.

Historical QA failure is preserved:

- run `33295889728` failed at the new Brand Profile verifier while TypeScript passed;
- cause: fixture helper spread order replaced the entire default `scope` object with a partial override, producing undefined fixture fields;
- this was a verifier-fixture defect, not a reason to bypass the gate;
- downstream collection/build/deploy remained skipped, which is the intended fail-closed behavior.

Verified remediation code baseline:

- HEAD `87cf2f562495f637b9ec6567cae9666dad49178e`;
- run `33295958861` — Brand Profile verifier PASS, full collection/resolution/history QA PASS, static build PASS and Pages deploy PASS;
- verifier output: `Stage 05A verification PASS · blocked/partial/ready gates · event-aware provenance · Workspace revision inheritance · pending-evidence boundary · multi-Focus-Brand isolation.`
- artifact `9727414638`, SHA-256 `1661980d9456f4f13dbb37c35961c6bfefaf1aaaafe67d16bbfc48937f6dc10e`;
- direct artifact inspection verified Stage 05A UI plus `brand-profile-foundation.v1`, `brand-fit-readiness-05a.v1`, `pending-resolver`, `trend-pulse.brand-profiles.v1`, `READY FOR PROVISIONAL BRAND FIT`, `NOT COMPUTED`, `workspace-derived` and `user-input` markers.
- push QA remained persistence-ineligible, so canonical scheduled trend history was not advanced.

The documentation commit containing this calibration is followed by one final release run. The canonical documentation-head run/artifact and archived Drive copy are recorded in the Drive build record and Master Decision Log so this document does not require a self-referential release commit.

## Handoff

Stage 05B should keep two concerns separate:

1. Brand Profile resolver/research + evidence/claim/conflict reconciliation.
2. Provisional Brand Fit factor evaluation only for profiles whose readiness gate explicitly allows it.

Profile resolution quality and Brand Fit computation are not the same problem; readiness must not be treated as Brand Fit confidence or Brand Fit itself.
