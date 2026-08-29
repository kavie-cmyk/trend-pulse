# Stage 02S — Intelligence Workspace + Focus Brand + Entity Intake + Signal Contract

## Goal

Prove the product logic `define once → persist scope → set optional decision target brands → discover/import entities → curate monitoring set → receive normalized signals` before live source ingestion and trend detection.

## Workspace v1 — provisional

`IntelligenceWorkspace` is a persistent monitoring configuration, not a per-session search form.

The workspace keeps four concepts separate:

1. **Intelligence scope** — geography/market, language, industry/category, product, audience, objectives and risk boundaries. This defines where the system should look.
2. **Focus Brand(s)** — optional brands for which Trend Pulse should evaluate relevance, opportunity and later marketing action. Leaving this empty means market/category intelligence only.
3. **Monitored entities** — competitors, benchmarks, products, creators, communities or other entities the user/system wants to watch or compare.
4. **Entity candidates** — system-researched suggestions that are not treated as confirmed competitors until evidence/user approval promotes them.

Focus Brand(s) are therefore not the same object as competitors or watched entities.

Monitoring defaults preserve Market Pulse/Open Discovery, Watchlists, Ad-hoc Explore, adjacent culture, global breakouts and automatic entity discovery.

Stage 02S stores one workspace in browser `localStorage` to validate persistence UX on GitHub Pages. This remains prototype persistence, not the final storage architecture.

## Competitor & Entity Intelligence

Canonical discovery flow:

`workspace scope → research/evidence → EntityCandidate → user/evidence approval → MonitoredEntity`

Canonical user-intake flow:

`user entity input → parse/reference → resolve/dedupe → user review → MonitoredEntity`

`EntityCandidate` is a research output, not a fact. It carries candidate identity, proposed relationship, recommendation reason, evidence references, optional relevance score and status.

`MonitoredEntity` stores provenance for how the entity entered the set, plus relationship, resolution status, optional source reference and pin state.

Supported relationship types include direct competitor, indirect competitor, substitute, emerging challenger, benchmark, platform, creator, community and product.

The exclusion set remains available so rejected candidates do not need to be suggested repeatedly.

## Entity intake methods

Stage 02S defines these canonical intake methods for user-supplied entity lists:

- typed text
- pasted list
- pasted table
- text-based file
- Google Drive link
- URL list
- system research

### Implemented now on GitHub Pages

- Typed text: parsed directly.
- Pasted list: comma/semicolon/newline/tab delimiters supported.
- Pasted table: first column is treated as the candidate entity name; common header names are ignored.
- TXT / CSV / TSV / Markdown files: read locally in the browser and parsed into entity names.
- Dedupe: case-insensitive before entities are added to the monitored set.

### Defined but intentionally pending a resolver

- Google Drive link: validated as a Drive URL and stored as an `EntityIntakeReference` with `pending-resolver` status.
- URL list: valid HTTP(S) URLs are stored as pending resolver references.
- XLSX/PDF and other binary document parsing are not claimed in Stage 02S.

A saved Drive/URL reference is **not** treated as an extracted or verified entity. Resolution will be implemented only when the corresponding connector/auth/runtime exists.

## Backward compatibility

Stage 02S preserves existing browser workspaces:

- legacy `scope.brands` values migrate to `focusBrands`;
- legacy `scope.competitors` values migrate to user-supplied `MonitoredEntity` records;
- Stage 02R monitored entities without intake/resolution fields receive conservative defaults rather than being discarded.

## Signal v1 — provisional

`Signal` remains the normalized intelligence primitive and is not equivalent to a social post.

Required groups remain identity/workspace lineage; observation/collection/normalization timestamps; source identity/access/freshness; market/language context; topic/entities/keywords; optional creator/community/content dimensions; metrics; dynamics placeholders; confidence basis; and evidence reference.

Fields unsupported by a connector remain optional rather than fabricated.

## Non-goals

- No production database.
- No live source/API connector.
- No live competitor research yet.
- No Google Drive/URL entity resolver yet.
- No XLSX/PDF entity extraction yet.
- No trend clustering/lifecycle classification.
- No Viral / Brand Relevance / Opportunity scoring.
- No agent orchestration.

`workspace.v1` and `signal.v1` remain provisional until exercised against real source data.
