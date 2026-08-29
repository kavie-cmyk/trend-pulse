# Trend Pulse — Stage 04 Trend Intelligence Report & Scoring Spec v0.1

Status: APPROVED PRODUCT DIRECTION / IMPLEMENTATION CONTRACT PROVISIONAL  
Date: 2026-08-29

## 1. Product outcome

Trend Pulse is not a conventional trend report or hot-content feed. The required product outcome is a Trend Intelligence Report that turns corroborated cultural/market signals into marketing decisions.

Canonical flow:

`COLLECT → DETECT → UNDERSTAND → ASSESS → DECIDE → ACT → WATCH / LEARN`

The output must answer four questions:

1. What is happening?
2. How strong / viral is it?
3. What does it mean for the Focus Brand or market?
4. What should marketing do now, and what should it keep watching?

A single observation must never be presented as a finished trend conclusion.

## 2. Required Trend Intelligence Report blocks

### Block 01 — Trend Intelligence Snapshot

Required fields:
- trend title and summary;
- trend type;
- lifecycle stage;
- time window;
- source/evidence summary;
- source diversity;
- Virality Score;
- Brand Fit Score when a Focus Brand + Brand Profile exist;
- Opportunity Score;
- Execution Urgency;
- Confidence Score.

### Block 02 — So What / Why It Matters

Required analysis dimensions where applicable:
- why the trend matters;
- audience relevance;
- channel relevance;
- content and creative potential;
- creator/influencer potential;
- community potential;
- paid-media potential;
- SEO/search potential;
- PR/brand potential;
- competitive whitespace;
- timing implications;
- brand/cultural/legal/claims risk;
- commercial and funnel relevance;
- CRM/retention potential;
- product-marketing potential.

### Block 03 — Action Plan Today

Required decision layer:
- decision = `ACT / PREPARE / WATCH / AVOID`;
- recommended move;
- time to act;
- content angles;
- creator brief when relevant;
- community plan when relevant;
- paid test when relevant;
- SEO/search action when relevant;
- PR/brand action when relevant;
- CRM action when relevant;
- product-marketing action when relevant;
- CTA when relevant;
- KPIs to watch;
- Do / Don’t guidance.

### Block 04 — Trend Watch

Required watch outputs:
- rising trends;
- early signals;
- next-window / next-week opportunities;
- competitor watch;
- risk watch.

## 3. Trend lifecycle

Canonical lifecycle remains:

`Weak Signal → Emerging → Accelerating → Breakout → Mainstream → Saturated → Declining`

Lifecycle is separate from Virality Score. A trend can have high historical volume while already saturated or declining.

## 4. Score architecture

All score values use a 0–10 presentation scale only after the underlying factor normalization is defensible. Raw cross-platform metrics cannot be compared directly.

Every score object must contain:
- status = unavailable / provisional / calibrated;
- optional numeric score;
- methodology version;
- factor availability;
- rationale;
- evidence references;
- computation time when computed.

Weights and thresholds are not frozen in this spec. They remain research-gated until real multi-source distributions exist.

### 4.1 Virality Score

Purpose: estimate momentum and propagation strength, not brand relevance.

Candidate factors:
- velocity;
- acceleration;
- cross-source / cross-platform spread;
- engagement intensity/quality where supplied;
- creator propagation;
- search intent/lift;
- persistence;
- geography/market relevance;
- novelty and saturation/decay adjustments when validated.

Rules:
- platform/source normalization is mandatory;
- do not compare raw views/likes between platforms;
- one broad source alone is insufficient for a credible Virality Score;
- current Wikimedia-only Stage 03R observations must not receive a fabricated virality number.

### 4.2 Brand Fit Score

Purpose: estimate how naturally a trend fits a specific Focus Brand.

Candidate factors:
- category relevance;
- audience overlap;
- product relevance;
- positioning/value alignment;
- tone-of-voice fit;
- aesthetic/visual-code fit;
- market relevance;
- seasonality/context relevance;
- brand safety/risk;
- execution naturalness.

Rules:
- a brand name alone is insufficient;
- Brand Fit requires `brand-profile.v1` or an explicitly bounded low-confidence fallback;
- the same trend can have materially different Brand Fit for different Focus Brands.

### 4.3 Opportunity Score

Purpose: decide whether marketing resources should be allocated to the opportunity.

Candidate factors:
- Virality / momentum;
- Brand Fit;
- audience relevance;
- timing;
- competitive saturation/whitespace;
- execution feasibility;
- content/creative potential;
- paid amplification potential;
- expected commercial/funnel relevance;
- confidence;
- risk and execution cost adjustments.

Opportunity is not equivalent to Virality. A highly viral trend can still be a poor marketing opportunity.

### 4.4 Execution Urgency

Purpose: estimate how quickly the opportunity window may close.

Candidate factors:
- lifecycle stage;
- opportunity window length;
- momentum decay risk;
- production lead time;
- competitive response speed;
- known event/calendar deadline.

Output must be interpretable as action timing, e.g. immediate / today / this week / prepare / watch, even when a numeric score is not yet calibrated.

### 4.5 Confidence Score

Purpose: communicate evidence strength and uncertainty.

Candidate factors:
- number and diversity of independent sources;
- corroboration consistency;
- freshness;
- source/evidence quality;
- coverage of the target market/language/category;
- missing data and unresolved contradictions.

Rules:
- Confidence is independent from Virality;
- high virality with low confidence is possible;
- confidence must not be used to inflate or hide uncertainty in other scores.

## 5. Brand Intelligence Profile

Contract: `brand-profile.v1`.

Minimum information architecture:
- Focus Brand identity;
- categories and markets;
- target audiences;
- positioning;
- value proposition;
- tone of voice;
- visual codes/aesthetic;
- product lines;
- content pillars;
- Do / Don’t;
- risk boundaries;
- commercial objectives;
- creator priorities;
- paid-media priorities;
- SEO priorities;
- evidence references.

Focus Brand ≠ monitored competitor/entity. Brand Profile provides the context required to assess brand-specific relevance and action.

## 6. Trend Candidate

Contract: `trend-candidate.v1`.

A Trend Candidate is the first object above individual Signals. It must preserve:
- signal lineage;
- source IDs and source diversity;
- trend type;
- lifecycle stage;
- geography/language context;
- first/last observation timestamps;
- evidence references;
- confidence assessment;
- candidate / corroborated / rejected status.

Signal → Trend Candidate promotion must be evidence-based. A single source observation must not silently become a corroborated trend.

## 7. Trend Intelligence Report contract

Contract: `trend-intelligence-report.v1`.

The report combines:
- a corroborated `trend-candidate.v1`;
- optional `brand-profile.v1` for brand-specific analysis;
- scorecard;
- broader marketing analysis;
- action plan;
- watch section;
- complete evidence lineage.

The report is the canonical decision object that feeds future Pulse, Brand Radar, Action Studio, alerts and executive reports.

## 8. Marketing intelligence lenses

Trend Pulse must support more than social content recommendations. The analysis/action layer may activate the relevant subset of:

- Audience;
- Channel;
- Content & Creative;
- Creator/Influencer;
- Community;
- Paid Media;
- SEO & Search;
- PR & Brand;
- Competitive Intelligence;
- Timing;
- Risk;
- Commercial/Funnel;
- CRM/Retention;
- Product Marketing.

These are analysis/action lenses, not mandatory outputs with fabricated content. If evidence is insufficient, the field remains unavailable or explicitly uncertain.

## 9. Scoring governance

Hard rules:

1. Source fit gate comes before scoring.
2. A connected source is not automatically applicable to every workspace.
3. Unsupported source fields stay missing; they are not inferred just to complete a score.
4. Cross-platform raw metrics require source/platform/category/market normalization.
5. Confidence remains separate from Virality, Brand Fit and Opportunity.
6. Brand Fit requires brand context, not just a brand string.
7. Numeric precision is withheld until methodology and baseline distributions support it.
8. Every important assessment must expose evidence/rationale.
9. Trend action requires corroboration; Signal → direct marketing action remains disallowed by default.

## 10. Build roadmap

### Stage 04 — Trend Candidate & Scoring Layer

Deliver:
- signal clustering / candidate construction;
- evidence lineage;
- lifecycle classification;
- Virality Score v1 research/implementation;
- Confidence Score v1;
- Opportunity Score v1;
- Execution Urgency;
- report scorecard surface.

Stage 04A (current revision) locks contracts and output/UI architecture only. It does not claim that real scoring computation is complete.

### Stage 05 — Brand Intelligence Layer

Deliver:
- Brand Profile input/resolution;
- Brand Fit Score v1;
- brand relevance explanation;
- brand risk/Do-Don’t context;
- brand-specific opportunity analysis.

### Stage 06 — Marketing Action Planner

Deliver:
- ACT/PREPARE/WATCH/AVOID decision;
- content/creative angles;
- creator/community actions;
- paid test recommendations;
- SEO/search and PR/brand opportunities;
- CRM/product-marketing actions where relevant;
- KPIs;
- Trend Watch / next-window monitoring;
- eventual feedback loop from action performance back into intelligence.

## 11. Current implementation boundary

As of Stage 03R, the operational live source is a broad Wikimedia Pageviews attention feed. It is useful as background/corroborating cultural attention data where source fit permits, but it is not sufficient to compute the Trend Intelligence Report scores above.

Stage 04A therefore exposes the approved report/scoring architecture in the product preview while deliberately showing scores as not computed. The next engineering milestone is evidence-backed Trend Candidate construction after adding relevant independent signal families.
