# Stage 05A-UX — Workspace Intelligence Navigation

Status: **COMPLETE / PASS** at verified implementation baseline `8fdd7446b4b5f5caa9086c99e3cfbdfc31a87911`.

## Problem corrected

The preview previously rendered Workspace configuration followed by Brand Profile, source diagnostics, raw source feeds, Trend Candidates, Trend History and the output architecture as one long engineering page. A saved Workspace had no obvious action that opened a workspace intelligence report.

That behavior was technically inspectable but not a usable product flow.

## Locked UX flow

`Workspace configuration → View Intelligence → Overview / Trends / Sources / Brand Profile`

A saved Workspace now exposes a prominent `View Intelligence` entry. The report shell becomes the primary intelligence surface and the legacy engineering panels are no longer stacked directly on the homepage.

## Information architecture

### Overview

User-facing latest intelligence summary built from the current real artifacts:

- `data/trend-candidates.json`
- `data/trend-history.json`

Overview exposes:

- latest resolved snapshot time;
- Trend Candidate / corroboration counts;
- new / continuing / reappeared / disappeared lineage summary;
- tracked lineage count;
- latest Trend Candidate cards;
- deterministic Workspace relevance projection (`direct`, `adjacent`, `global-breakout`, `out-of-scope`);
- explicit Brand Fit `NOT COMPUTED` boundary;
- explicit report-vs-recommendation boundary.

The Overview does not fabricate Virality, Brand Fit, Opportunity or marketing actions.

### Trends

Contains the existing evidence-rich Stage 04C + 04D surfaces:

- Trend Candidate resolution/corroboration;
- independent-source/repost dependency handling;
- multi-cycle lineage/history.

### Sources

Contains source planning, collection and evidence diagnostics:

- Source Intelligence;
- Bluesky social backbone;
- permissionless social expansion;
- global connector backbone;
- Wikimedia broad cultural signal feed.

### Brand Profile

Contains Stage 05A Brand Profile intake, provenance and Brand Fit readiness.

## Homepage cleanup

`apps/web/app/page.tsx` now renders only:

1. `WorkspaceConsole`
2. `WorkspaceIntelligence`

The old Workspace demo contract sections remain in code/history but are hidden from the primary UX by `intelligence-navigation.css`:

- `.workspaceConsole > .signalSection`
- `.workspaceConsole > .nextStep`

This preserves implementation history without forcing users to scroll through obsolete engineering-stage content.

## Canonical implementation

- `apps/web/app/workspace-intelligence.tsx`
- `apps/web/app/intelligence-navigation.css`
- `apps/web/app/page.tsx`
- `apps/web/app/layout.tsx`
- `apps/worker/src/verify-workspace-intelligence-ux.mjs`
- `package.json`
- `.github/workflows/pages.yml`

## Regression gate

Every Pages workflow now runs:

`npm run verify:workspace-intelligence-ux`

The verifier requires:

- homepage uses the Workspace Intelligence shell;
- homepage no longer directly imports/stacks the engineering intelligence panels;
- `View Intelligence` exists;
- Overview / Trends / Sources / Brand Profile navigation exists;
- Overview contains latest intelligence, Trend Candidates and What Changed surfaces;
- real trend-candidate/history data paths remain wired;
- legacy Workspace engineering blocks remain removed from primary UX.

## Verified implementation QA

Implementation baseline: `8fdd7446b4b5f5caa9086c99e3cfbdfc31a87911`.

GitHub Actions run: `33302824755`.

PASS:

- TypeScript;
- Brand Profile verifier;
- Workspace Intelligence navigation verifier;
- all source collectors;
- Trend Candidate resolver/calibration/verifier;
- Trend History builder/verifier;
- static export;
- QA history isolation;
- Pages artifact upload;
- Pages deployment.

Artifact: `9729498606`.

SHA-256: `dff6158c8023054847efbab970639af4efabc78f621277e4727b524b42c895ad`.

Direct artifact inspection verified:

- `View Intelligence`;
- `WORKSPACE INTELLIGENCE`;
- Overview / Trends / Sources / Brand Profile;
- `Latest Trend Candidates`;
- `WHAT CHANGED`;
- legacy Workspace engineering blocks hidden by deployed CSS;
- all six current JSON data artifacts present.

The inspected snapshot contained 266 unique signals, 0 independently corroborated trends and 3 candidates. The deployed QA history snapshot contained 3 current/tracked lineages and remained persistence-ineligible, so the UX change did not contaminate canonical scheduled history.

## Boundary

This stage fixes navigation and information architecture. It does not make broad collection workspace-specific, create missing Brand Fit/Opportunity/Virality scores, or generate marketing recommendations. Those remain downstream intelligence stages.

## Handoff

Proceed to Stage 05B only after this report-entry flow remains the primary user path. Stage 05B should add evidence-backed Brand Profile resolution/research and provisional Brand Fit factor evaluation without collapsing profile-resolution quality into Brand Fit itself.
