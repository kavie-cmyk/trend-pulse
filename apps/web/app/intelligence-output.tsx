const scoreFrameworks = [
  {
    name: "Virality",
    purpose: "How strongly and how quickly the trend is spreading.",
    factors: ["velocity", "acceleration", "cross-source spread", "engagement intensity", "creator propagation", "search intent", "persistence", "geo relevance"],
  },
  {
    name: "Brand Fit",
    purpose: "How naturally the trend fits a specific Focus Brand.",
    factors: ["category relevance", "audience overlap", "tone / aesthetic fit", "product relevance", "value alignment", "market relevance", "seasonality", "brand safety", "execution naturalness"],
  },
  {
    name: "Opportunity",
    purpose: "Whether the team should spend marketing resources on it now.",
    factors: ["virality", "brand fit", "timing", "competition saturation", "execution feasibility", "content potential", "paid potential", "commercial relevance"],
  },
  {
    name: "Execution Urgency",
    purpose: "How quickly the opportunity window may close.",
    factors: ["lifecycle stage", "window length", "decay risk", "production lead time", "competitive response"],
  },
  {
    name: "Confidence",
    purpose: "How much evidence supports the intelligence conclusion.",
    factors: ["source diversity", "corroboration", "freshness", "evidence quality", "coverage", "missing-data uncertainty"],
  },
];

const marketingLenses = [
  ["Audience", "Segments, audience overlap, intent and new-vs-core audience relevance."],
  ["Channel", "Where to act — social, video, community, search, PR or other channel mix."],
  ["Content & Creative", "Content pillars, formats, hooks, messages and visual direction."],
  ["Creator", "Creator archetype, seeding potential, collaboration angle and UGC likelihood."],
  ["Community", "Conversation entry points, prompts, community participation and advocacy."],
  ["Paid Media", "Boost suitability, campaign objective, creative hypothesis and test direction."],
  ["SEO & Search", "Search demand, query opportunity, discoverability and content capture."],
  ["PR & Brand", "Narrative participation, earned-media angle and brand-building potential."],
  ["Competitive", "Who is already acting, saturation, whitespace and first-mover potential."],
  ["Timing", "Best action window, too-early / actionable-now / too-late assessment."],
  ["Risk", "Brand safety, cultural sensitivity, backlash, claims and overused/cringe risk."],
  ["Commercial & Funnel", "Product linkage, funnel stage, CTA suitability and business objective."],
  ["CRM & Retention", "Owned-channel follow-up, lifecycle messaging and retention opportunity."],
  ["Product Marketing", "Product narrative, launch relevance, positioning and merchandising use."],
];

const reportBlocks = [
  {
    number: "01",
    title: "Trend Intelligence Snapshot",
    items: ["What is happening", "Why now", "Trend type + lifecycle", "Evidence + source diversity", "Virality", "Brand Fit", "Opportunity", "Execution Urgency", "Confidence"],
  },
  {
    number: "02",
    title: "So What / Why It Matters",
    items: ["Audience relevance", "Channel relevance", "Creative potential", "Creator + community potential", "Competitive whitespace", "Risk", "Commercial implication"],
  },
  {
    number: "03",
    title: "Action Plan Today",
    items: ["ACT / PREPARE / WATCH / AVOID", "Recommended move", "Time to act", "Content angles", "Creator brief", "Community plan", "Paid test", "SEO / PR / CRM / product-marketing actions", "KPIs", "Do / Don’t"],
  },
  {
    number: "04",
    title: "Trend Watch",
    items: ["Rising trends", "Early signals", "Next-window opportunities", "Competitor watch", "Risk watch"],
  },
];

function Tags({ items }: { items: string[] }) {
  return (
    <div className="signalMeta" style={{ marginTop: 12 }}>
      {items.map((item) => <span key={item}>{item}</span>)}
    </div>
  );
}

export default function IntelligenceOutput() {
  return (
    <section className="signalSection" style={{ marginTop: 20 }}>
      <div className="sectionHeading">
        <div>
          <div className="eyebrow">STAGE 04A · TREND INTELLIGENCE OUTPUT ARCHITECTURE</div>
          <h2>Not a trend feed. A marketing decision report.</h2>
          <p>
            Once signals are corroborated into a real Trend Candidate, Trend Pulse must move beyond “what is happening” and explain how viral it is, whether it fits the brand, whether the opportunity is worth acting on, what marketing should do next, and what to keep watching.
          </p>
        </div>
        <span className="schemaTag">trend-intelligence-report.v1 · provisional</span>
      </div>

      <div className="demoWarning">
        SCORING GOVERNANCE · The current Stage 03R Wikimedia feed is a single broad attention source. Trend Pulse will not manufacture Virality, Brand Fit or Opportunity scores from it. Numeric scores become available only after the required evidence, cross-source normalization and Brand Profile inputs exist.
      </div>

      <div className="monitoringCard" style={{ alignItems: "flex-start" }}>
        <div>
          <strong>Canonical intelligence flow</strong>
          <p>COLLECT → DETECT → UNDERSTAND → ASSESS → DECIDE → ACT → WATCH / LEARN</p>
        </div>
        <span>OUTPUT CONTRACT LOCKED</span>
      </div>

      <div className="sectionHeading compact" style={{ marginTop: 28 }}>
        <div>
          <div className="eyebrow">CORE SCORECARD</div>
          <h2>Five assessments, kept separate.</h2>
          <p>Confidence never substitutes for Virality. Brand Fit requires a real Brand Intelligence Profile, not only a brand name. Weights and thresholds remain research-gated until real distributions are available.</p>
        </div>
      </div>

      <div className="signalGrid">
        {scoreFrameworks.map((score) => (
          <article className="signalCard" key={score.name}>
            <div className="signalTopline"><span>{score.name.toUpperCase()}</span><span>NOT COMPUTED YET</span></div>
            <h3>{score.name} Score</h3>
            <p>{score.purpose}</p>
            <Tags items={score.factors} />
            <div className="contractTrace"><span>evidence</span><b>→</b><span>normalized factors</span><b>→</b><span>score</span><b>→</b><span>explanation</span></div>
          </article>
        ))}
      </div>

      <div className="sectionHeading compact" style={{ marginTop: 30 }}>
        <div>
          <div className="eyebrow">TREND INTELLIGENCE REPORT</div>
          <h2>Four output blocks for every actionable trend.</h2>
        </div>
      </div>

      <div className="signalGrid">
        {reportBlocks.map((block) => (
          <article className="signalCard" key={block.number}>
            <div className="signalTopline"><span>BLOCK {block.number}</span><span>REQUIRED OUTPUT</span></div>
            <h3>{block.title}</h3>
            <Tags items={block.items} />
          </article>
        ))}
      </div>

      <div className="sectionHeading compact" style={{ marginTop: 30 }}>
        <div>
          <div className="eyebrow">MARKETING INTELLIGENCE LENSES</div>
          <h2>The analysis cannot stop at social content.</h2>
          <p>Each Trend Intelligence Report can activate only the relevant lenses, but the contract supports the broader marketing decision surface.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 10, marginTop: 14 }}>
        {marketingLenses.map(([name, description]) => (
          <article className="signalCard" style={{ padding: 15 }} key={name}>
            <div className="signalTopline"><span>{name.toUpperCase()}</span><span>MARKETING</span></div>
            <p style={{ marginTop: 16 }}>{description}</p>
          </article>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12, marginTop: 28 }}>
        <article className="signalCard">
          <div className="signalTopline"><span>BRAND PROFILE</span><span>brand-profile.v1</span></div>
          <h3>Brand Fit needs more than a brand name.</h3>
          <p>Positioning, audience, value proposition, tone, visual codes, product lines, content pillars, Do/Don’t, risks and commercial objectives become the evidence base for brand-specific relevance.</p>
          <Tags items={["positioning", "audience", "tone", "visual codes", "products", "content pillars", "risk boundaries", "commercial objectives"]} />
        </article>
        <article className="signalCard">
          <div className="signalTopline"><span>TREND CANDIDATE</span><span>trend-candidate.v1</span></div>
          <h3>Signals must become a corroborated object first.</h3>
          <p>A Trend Candidate carries its contributing signals, source diversity, lifecycle, geography/language context and evidence lineage before the system can claim an actionable trend.</p>
          <Tags items={["signal lineage", "source diversity", "lifecycle", "geography", "evidence", "confidence"]} />
        </article>
      </div>

      <div className="nextStep" style={{ marginTop: 28 }}>
        <div>
          <div className="eyebrow">ROADMAP · STAGES 04–06</div>
          <h2>04: Trend Candidate + scoring → 05: Brand Intelligence → 06: Marketing Action Planner.</h2>
          <p className="prototypeNote" style={{ marginTop: 10 }}>Stage 04A locks the contracts and output design only. Real score computation remains blocked until multiple relevant source families and normalized baselines exist.</p>
        </div>
        <div className="stage">04</div>
      </div>
    </section>
  );
}
