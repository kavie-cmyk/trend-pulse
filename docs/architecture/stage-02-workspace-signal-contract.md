# Stage 02R — Intelligence Workspace + Entity Intelligence + Signal Contract

## Goal

Prove the product logic `define once → persist scope → discover/curate entities → receive normalized signals` before adding live source connectors or trend detection.

## Workspace v1 — provisional

`IntelligenceWorkspace` is a persistent monitoring configuration, not a per-session search form. The scope contains geography/market, language, industry/category, optional brand/product, audience, objectives and risk boundaries.

Competitors are intentionally **not** a required scope input. A user may manually add entities, but Trend Pulse must also be able to discover competitor/entity candidates automatically from the configured scope and evidence.

Monitoring defaults preserve the locked product logic:

- Market Pulse / open discovery
- Watchlists
- Ad-hoc Explore
- Broad discovery
- Adjacent cultural discovery
- Global breakout discovery
- Automatic competitor/entity discovery

Stage 02R stores one workspace in browser `localStorage` to validate persistence UX on GitHub Pages. This is explicitly a prototype storage mechanism, not the final storage architecture.

## Competitor & Entity Intelligence

The model separates system discovery from confirmed monitoring:

`workspace scope → research/evidence → EntityCandidate → user/evidence approval → MonitoredEntity`

`EntityCandidate` is a research output, not a fact. It carries:

- candidate identity
- proposed relationship type
- reason for recommendation
- evidence references
- optional relevance score
- candidate status

`MonitoredEntity` is the persistent entity set used for ongoing monitoring. An entity can be added manually by the user or promoted from a system candidate after approval.

Supported relationship types include direct competitor, indirect competitor, substitute, emerging challenger, benchmark, platform, creator, community and product.

The workspace also keeps an exclusion set so rejected entities do not need to be repeatedly suggested.

Stage 02R does **not** fabricate competitor suggestions. The live UI deliberately shows an empty candidate state until real research/evidence sources are connected.

## Signal v1 — provisional

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
- No live competitor research yet
- No trend clustering or lifecycle classification
- No Viral / Brand Relevance / Opportunity scoring
- No agent orchestration

`workspace.v1` and `signal.v1` remain provisional until they are exercised against real source data.
