# Stage 05A — Brand Profile Intake & Resolution Foundation

Status: implementation candidate pending final release QA.

## Objective

Create an evidence-aware Brand Profile foundation for Focus Brand decision targets before Brand Fit or Opportunity scoring.

Canonical path:

`Workspace → Focus Brand → Brand Profile intake → provenance / unresolved inputs → readiness gate → downstream Brand Fit`

05A does **not** compute Brand Fit, Opportunity, Virality or execution recommendations.

## D-019 — Evidence-aware Brand Profile & Brand Fit Readiness Gate

1. A Focus Brand name alone is insufficient for Brand Fit.
2. Brand Profile is attached to `(workspaceId, focusBrandId)` and is not shared automatically with Monitored Entities.
3. Workspace scope may seed Brand Profile fields, but inherited values retain `workspace-derived` provenance.
4. Direct structured edits retain `user-input` provenance by field.
5. Pasted briefs, URLs and Drive references that have not been resolved remain `pending-resolver`; they do not silently become brand facts and do not count as resolved evidence.
6. Readiness is deterministic and separate from Brand Fit scoring.
7. No 0–10 Brand Fit score is produced in 05A.
8. Conflicts/contradictions are represented in the foundation contract but automated claim extraction and adjudication remain downstream.
9. Browser localStorage is preview persistence only; production multi-user persistence is still an open backend gate.

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
- field provenance
- stable `(workspace, focusBrand)` upsert semantics
- pending-reference preservation

`apps/web/app/brand-profile-console.tsx`

- multi-Focus-Brand profile selection
- structured field editing
- pasted brief / URL / Drive intake
- readiness gate UI
- provenance and recommended-gap UI
- browser persistence under `trend-pulse.brand-profiles.v1`

`apps/web/app/page.tsx`

- surfaces Stage 05A immediately after Workspace configuration so Brand context is defined before downstream intelligence outputs.

## Integrity boundaries

- FocusBrand ≠ MonitoredEntity.
- Workspace-derived context ≠ externally verified brand truth.
- Pending reference ≠ resolved evidence.
- Readiness ≠ Brand Fit.
- Brand Fit ≠ Opportunity.
- User-provided context may be sufficient for a provisional assessment, but provenance must remain visible.
- Unsupported brand fields remain empty.
- No system research claim is fabricated in the static browser runtime.

## QA gates

Final release must demonstrate:

1. TypeScript passes.
2. Static export passes.
3. Pages artifact includes Stage 05A UI/code.
4. Pages deploy passes.
5. Push/manual QA continues to remain isolated from canonical scheduled trend-history persistence.
6. No Brand Fit numeric score is emitted by 05A.
7. `pending-resolver` references remain unresolved inputs.

## Handoff

Stage 05B should implement evidence-backed Brand Profile resolution/research and claim reconciliation, or proceed to provisional Brand Fit factor evaluation only for profiles whose readiness gate explicitly allows it. The two concerns must remain distinguishable: profile resolution quality and Brand Fit computation are not the same problem.
