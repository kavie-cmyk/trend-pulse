# Stage 04B-1 — Source Intelligence Layer

Status: implementation candidate pending CI/read-back QA.

## Decision

Trend Pulse must not treat the connected connector list as the source universe.

Canonical flow:

`Workspace → Source Research → Source Candidates → Source Evaluation → Source Plan → Connector Activation → Collection`

The platform keeps a reusable Source Registry, but a workspace may trigger research for sources that do not yet exist in that registry.

## Source-state semantics

Three concepts remain distinct:

- **Known/registered**: Trend Pulse has a capability/access record for the source.
- **Eligible**: the source has sufficient intelligence fit for a workspace.
- **Active**: collection is actually enabled after operational/access/compliance gates pass.

A source can be intelligence-fit PRIMARY while not active because it is paid, restricted, manual-assisted, runtime-deferred, or needs credentials.

## Source Registry v1

`source-registry-entry.v1` records:

- identity and source/source-class/connector kind;
- source type and signal kinds;
- access mode;
- connector/runtime status;
- free/free-tier/paid cost tier;
- compliance status;
- effective freshness;
- geography/language/industry/audience tags;
- queryability by geography/language/category/keyword/entity/creator/time;
- quality priors for uniqueness, reliability, historical depth and granularity;
- evidence references, access notes and last-verified date.

Registry memory is reusable across workspaces and should be refreshed when policies/capabilities change.

## Source Research v0

Source Research asks: **What sources best answer this workspace, including sources Trend Pulse does not already know?**

Research output is a `SourceResearchCandidate`, not a confirmed connector. Candidate status does not imply that Trend Pulse has legal or technical access.

Stage 04B-1 deployed Pages does not perform autonomous web research. The SAVA validation cases use a curated evidence-backed research pack produced during this build. The browser's current workspace uses registry-only planning. Live research requires a future server/runtime research service.

## Source Evaluation v0.1

Two top-level scores are deliberately separated.

### Intelligence Fit

Measures how useful the source would be if access were available. Current provisional dimensions:

- workspace relevance — 24%
- signal uniqueness — 10%
- audience coverage — 10%
- geography coverage — 10%
- queryability — 10%
- freshness — 8%
- historical depth — 5%
- reliability — 10%
- granularity — 13%

Output scale is 0–10 and is provisional, intended for source planning rather than marketing/trend scoring.

### Operational Feasibility

Measures whether Trend Pulse can realistically activate the source now:

- access/compliance — 30%
- cost efficiency — 20%
- automation feasibility — 30%
- reliability — 10%
- freshness — 10%

Operational feasibility must never be folded into Intelligence Fit because that would hide high-value access gaps.

## Planner roles

Provisional v1 thresholds:

- PRIMARY: Intelligence Fit >= 8.0
- SUPPORTING: 6.3–7.9
- BACKGROUND: 4.5–6.2
- EXCLUDE: < 4.5

Activation is decided separately:

- activate-now
- needs-credential
- manual-assisted
- connector-backlog
- runtime-deferred
- paid-later
- restricted
- exclude

These thresholds are design/prototype defaults and must be calibrated after a larger source corpus is evaluated.

## Gap Analysis

The planner must explicitly surface missing evidence classes rather than silently substitute a weak source.

Examples:

- game publishing: app/store competitive performance, player/community discussion, search demand, paid creative intelligence;
- AI: developer/open-source momentum, launch ecosystem, search demand, research frontier;
- XR: specialist XR news, platform/store demand, creator/video adoption, search demand.

Gap state: COVERED / PARTIAL / UNCOVERED.

## SAVA META validation cases

Stage 04B-1 validates architecture on three different workspace scopes:

1. SAVA META — Game Publishing
2. SAVA META — AI / Lumi-Lumus
3. SAVA META — VR / XR

The expected test is not that all three receive the same sources. The planner should produce materially different rankings/gaps because their intelligence needs differ.

### Current research evidence used for access/capability validation

- YouTube Data API: `videos.list` supports `mostPopular`, `regionCode` and `videoCategoryId`; `search.list` supports query/region/language relevance. Granular quota changes were documented in June 2026.
- Google Trends API: still limited alpha access; supports consistent scaling, up to five years of history, and regional/subregional data.
- TikTok Creative Center: free/public trend and creative surface with industry/time filters; no automated trend API is assumed by this stage.
- Meta Ad Library: public advertiser/keyword/country search surface; automation/API rights must be separately verified for production use.
- GitHub REST API: official public developer ecosystem API; search has separate rate-limit categories.
- Hacker News API: official public near-real-time API; current official documentation states no rate limit.
- Product Hunt API: API exists but documentation says commercial use requires contacting Product Hunt, so it remains access-constrained for Trend Pulse.
- arXiv API: public API exists; commercial products must review relevant terms before production use.
- Road to VR: publication explicitly documents full and section-specific RSS feeds.
- Sensor Tower: high-value gaming/app/ad intelligence and intentionally categorized as paid-later in the free-first architecture.

Evidence URLs are stored on the registry/candidate records in code.

## Current registry seed

Stage 04B-1 begins with reusable records for:

- Wikimedia Pageviews
- YouTube Data API
- Publisher RSS/Atom source class
- GitHub REST API
- Hacker News API
- Google Trends API Alpha
- TikTok Creative Center
- Meta Ad Library
- arXiv API
- GDELT DOC (runtime-deferred)

This is a seed, not the final source universe.

## Non-goals

Stage 04B-1 does **not**:

- connect every source in the registry;
- claim autonomous web source research is running on GitHub Pages;
- scrape sources because they are technically reachable;
- convert Source Research candidates into active connectors automatically;
- compute Trend Virality/Brand Fit/Opportunity scores;
- treat paid/restricted sources as usable simply because their Intelligence Fit is high.

## Handoff to Stage 04B-2

Use Source Plan and Gap Analysis to choose the Global Connector Backbone implementation order. Priority should be driven by repeated cross-workspace value, intelligence gaps, free-first feasibility, and compliance — not by connector novelty.
