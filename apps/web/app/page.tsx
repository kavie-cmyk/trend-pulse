const workflow = [
  "DEFINE",
  "COLLECT",
  "DETECT",
  "UNDERSTAND",
  "ASSESS",
  "DECIDE",
  "ACT",
  "LEARN",
];

const foundations = [
  {
    title: "Persistent Workspace",
    detail: "Define a market, audience, category, brand or product once, then keep monitoring it continuously.",
    status: "Architecture locked",
  },
  {
    title: "Signal-first Engine",
    detail: "Normalize source-specific observations into evidence-backed signals before trend detection.",
    status: "Schema next",
  },
  {
    title: "Always-on Discovery",
    detail: "Open discovery, watchlists and adjacent cultural signals feed the same intelligence workflow.",
    status: "Build planned",
  },
];

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="eyebrow">BUILD STAGE 01 · FOUNDATION</div>
        <h1>Trend Pulse</h1>
        <p className="lead">
          A market- and product-agnostic Trend & Marketing Intelligence Platform.
        </p>
        <div className="workflow" aria-label="Canonical Trend Pulse workflow">
          {workflow.map((step, index) => (
            <div className="workflowItem" key={step}>
              <span>{step}</span>
              {index < workflow.length - 1 ? <b aria-hidden="true">→</b> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="statusBar" aria-label="Current build status">
        <span className="statusDot" />
        <strong>Live build preview active</strong>
        <span>Frontend foundation only — real signal ingestion comes next.</span>
      </section>

      <section className="grid">
        {foundations.map((item) => (
          <article className="card" key={item.title}>
            <div className="cardStatus">{item.status}</div>
            <h2>{item.title}</h2>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>

      <section className="nextStep">
        <div>
          <div className="eyebrow">NEXT VERTICAL SLICE</div>
          <h2>Create Workspace → collect real signals → detect one trend → show evidence.</h2>
        </div>
        <div className="stage">02</div>
      </section>
    </main>
  );
}
