# Stage 05B — Brand Profile Resolution & Provisional Brand Fit

Status: implementation specification. Numeric Brand Fit calibration remains OPEN under RG-004.

## 1. Purpose

Stage 05B connects the Stage 05A Brand Profile foundation to Workspace Trend Candidates without creating a shortcut from a brand name, Weak Signal or same-source repetition to a marketing action.

Canonical bounded flow:

`Brand Profile foundation → claim/provenance reconciliation → conflict/uncertainty gate → Brand Fit factor trace → provisional semantic assessment`

This concern remains separate from:

`Workspace collection → Weak Signal → cross-source Trend Candidate → independent corroboration → Opportunity / Decision / Action`

## 2. Decision boundary

05B implements two distinct concerns.

### A. Brand Profile resolution / claim reconciliation

- Structured Brand Profile fields become explicit profile-context claims with field provenance.
- Pending brief, URL and Drive references do not generate claims.
- External/research claims are accepted only as explicit inputs with field values and evidence references.
- An external claim marked resolved without evidence references remains pending.
- Explicit `contradicts` relationships create a conflict record and block Brand Fit until adjudicated.
- The resolver does not infer contradictions merely because two multi-value fields differ.
- Current static/preview runtime does not claim autonomous external brand research. `researchRuntimeStatus=not-executed` is truthful when no evidence claim input exists.
- Profile resolution does not mutate the Stage 05A Brand Profile automatically.

Contract: `brand-profile-resolution-05b.v1` / methodology `brand-claim-reconciliation-05b.v1`.

### B. Brand Fit factor evaluation

Eligibility requires:

1. Stage 05A readiness = `ready-for-provisional-brand-fit`;
2. no unresolved Brand Profile conflict;
3. target evidence class = cross-source Workspace `trend-candidate`;
4. at least two distinct source IDs.

A Weak Signal is not eligible. A repeated same-source cluster is not eligible.

A cross-source candidate that is not yet independently corroborated may receive a **provisional Brand Fit factor trace**, but its evidence maturity is `candidate-unconfirmed`. This assessment does not authorize Opportunity, Decision or Action. A corroborated candidate receives maturity `independently-corroborated` only when independent source diversity and independent source-family diversity are both at least two.

Contract: `brand-fit-assessment-05b.v1` / methodology `brand-fit-factor-trace-05b.v1`.

## 3. Factor framework

The ten D-010 candidate factors remain visible:

1. category relevance;
2. audience overlap;
3. product relevance;
4. positioning / value alignment;
5. tone-of-voice fit;
6. visual-code fit;
7. market relevance;
8. context / seasonality;
9. brand safety / risk;
10. execution naturalness.

05B uses bounded deterministic lexical overlap only where the current profile/evidence contracts make it inspectable. Absence of lexical overlap is **not** converted into a negative Brand Fit claim. Unsupported factors remain `unavailable`.

Context/seasonality and execution naturalness remain unavailable in the bounded 05B method because the current contracts/runtime do not provide a defensible general resolver for them.

Risk is marked `tension` only when Trend Candidate text/anchors explicitly overlap a Brand Profile risk boundary / do-not statement. No match is not proof of safety.

Every non-unavailable factor contains:

- Brand Profile field keys;
- Brand claim IDs;
- Trend Candidate ID;
- Trend signal IDs;
- Trend evidence references.

## 4. No numeric Brand Fit score

05B deliberately does not emit a 0–10 Brand Fit score.

Reason: canonical D-010/RG-004 has not locked empirically defensible weights, thresholds and normalization. Producing a number now would create false precision. Output is limited to factor status plus a semantic provisional result:

- `provisional-alignment`;
- `mixed-evidence`;
- `caution`;
- `insufficient-evidence`;
- `unavailable`.

`numericScoreStatus=unavailable` is mandatory in 05B.

## 5. Weak Signal / Trend Candidate / corroboration interaction

- Weak Signal → WATCH/monitoring evidence only; no Brand Fit factor computation.
- Repeated same-source cluster → remains below Trend Candidate; no Brand Fit.
- Cross-source Trend Candidate → provisional Brand Fit may be inspected; evidence maturity remains candidate-unconfirmed unless independently corroborated.
- Independently corroborated Trend Candidate → provisional Brand Fit may be inspected with corroborated maturity.
- Brand Fit → does not promote evidence maturity and does not authorize Opportunity/Decision/Action.

This preserves the invariant that a high apparent brand relevance cannot turn one weak observation into a marketing recommendation.

## 6. Current runtime behavior

The canonical 04E Workspace Intelligence artifact is the only live Trend input for the 05B UI. Global Pulse candidate counts are not substituted.

At the 04E baseline for Vietnam Mobile Gaming, 17 relevant Weak Signals and 0 qualified Workspace Trend Candidates are valid. Therefore the 05B live surface should show **zero eligible Brand Fit assessments** while preserving all Weak Signals.

## 7. Implementation

- `packages/contracts/src/brand-fit.ts`
- `apps/web/app/brand-fit-engine-05b.ts`
- `apps/web/app/brand-fit-panel-05b.tsx`
- `apps/web/app/brand-fit-stage-05b.tsx`
- `apps/worker/src/verify-brand-fit-05b.mjs`
- root `package.json`
- `.github/workflows/pages.yml`

## 8. Verification gates

The 05B verifier must fail if:

- a pending reference becomes claim evidence;
- an evidence-less external claim becomes usable;
- a Weak Signal receives Brand Fit factors;
- same-source repetition receives Brand Fit factors;
- a blocked/conflicted Brand Profile receives Brand Fit;
- a non-unavailable factor lacks Brand claim trace or Trend evidence trace;
- numeric Brand Fit is emitted;
- live eligible candidate pool includes a same-source-only object.

Zero live Trend Candidates is a valid PASS condition, not a reason to fabricate a candidate or score.

## 9. Declared open gates

05B does not close:

- autonomous Brand Profile web/Drive research runtime;
- semantic multilingual Brand Fit reasoning beyond bounded inspectable matching;
- numeric Brand Fit calibration (RG-004);
- Opportunity scoring;
- Decision thresholds;
- marketing Action generation;
- production multi-workspace backend/database.
