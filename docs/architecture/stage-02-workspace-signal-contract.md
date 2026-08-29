# Stage 02 — Intelligence Workspace + Signal Contract

## Goal

Prove the product logic `define once → persist scope → receive normalized signals` before adding real source connectors or trend detection.

## Workspace v1

`IntelligenceWorkspace` is a persistent monitoring configuration, not a per-session search form. The scope contains geography/market, language, industry/category, optional brand/product, audience, competitors, objectives and risk boundaries.

Monitoring defaults preserve the locked product logic:

- Market Pulse / open discovery
- Watchlists
- Ad-hoc Explore
- Broad discovery
- Adjacent cultural discovery
- Global breakout discovery

Stage 02 stores one workspace in browser `localStorage` to validate persistence UX on GitHub Pages. This is explicitly a prototype storage mechanism, not the final storage architecture.

## Signal v1

`Signal` is the normalized intelligence primitive. It is not equivalent to a social post.

Required groups:

1. Identity and workspace lineage
2. Observation / collection / normalization timestamps
3. Source identity, access mode and freshness
4. Market / language context
5. Topic, entities, keywords and optional creator/community dimensions
6. Source-specific metrics mapped into normalized metric slots
7. Dynamics placeholders for velocity / acceleration / novelty
8. Confidence with explicit basis
9. Evidence reference back to the source observation

Fields that a connector cannot support remain optional rather than fabricated.

## Non-goals

- No production database
- No live API connector
- No trend clustering or lifecycle classification
- No Viral / Brand Relevance / Opportunity scoring
- No agent orchestration

Those layers depend on real source distributions and later research gates.
