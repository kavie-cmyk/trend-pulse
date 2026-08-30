"use client";

import { useEffect, useState } from "react";
import type { PaidCreativeIntelligenceSnapshot } from "@trend-pulse/contracts/paid-creative";

type DataState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: PaidCreativeIntelligenceSnapshot };

function statusLabel(snapshot: PaidCreativeIntelligenceSnapshot) {
  if (snapshot.status === "ingested") return "LOCAL PAID-CREATIVE EVIDENCE INGESTED";
  if (snapshot.status === "invalid-input") return "LOCAL INPUT REJECTED";
  return "BRIDGE READY · NO LOCAL META IMPORT IN THIS BUILD";
}

export default function PaidCreativeStage04G() {
  const [state, setState] = useState<DataState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("./data/paid-creative-intelligence.json", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`paid-creative-intelligence HTTP ${response.status}`);
        return response.json() as Promise<PaidCreativeIntelligenceSnapshot>;
      })
      .then((data) => { if (!cancelled) setState({ status: "ready", data }); })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : "Unknown paid creative error" });
      });
    return () => { cancelled = true; };
  }, []);

  return <section className="workspaceIntelligenceEntry" aria-label="Experimental paid creative intelligence bridge">
    <div className="intelligenceEntryCard">
      <div>
        <div className="eyebrow">STAGE 04G · PAID CREATIVE INTELLIGENCE</div>
        <h2>Meta Ad Library · experimental local bridge</h2>
        <p>Local JSON/webhook records can be normalized into paid-creative Signals without embedding Meta scraping into Trend Pulse or scheduled GitHub Actions.</p>
      </div>
      <div className="intelligenceWorkspaceMeta">
        <span>PRIVATE VALIDATION</span>
        <strong>{state.status === "ready" ? statusLabel(state.data) : state.status === "error" ? "ARTIFACT UNAVAILABLE" : "LOADING"}</strong>
      </div>
    </div>

    <div className="intelligenceShell">
      {state.status === "loading" ? <div className="reportEmpty">Loading paid-creative bridge status…</div> : null}
      {state.status === "error" ? <div className="demoWarning">Paid-creative artifact unavailable: {state.message}</div> : null}
      {state.status === "ready" ? <div className="intelligenceOverview">
        <section className="reportHero">
          <div>
            <div className="eyebrow">EXPERIMENTAL LOCAL SIDECAR</div>
            <h2>{statusLabel(state.data)}</h2>
            <p>Source family: <strong>{state.data.source.evidenceFamily}</strong>. Scheduled collection: <strong>disabled</strong>. Automated-access authorization/compliance is not established for production use.</p>
          </div>
          <div className="reportFreshness"><span>{state.data.status.toUpperCase()}</span><strong>{new Date(state.data.generatedAt).toLocaleString()}</strong></div>
        </section>

        <div className="reportKpis">
          <article><span>Paid creative signals</span><strong>{state.data.summary.signalCount}</strong><small>local import only</small></article>
          <article><span>Advertisers</span><strong>{state.data.summary.advertiserCount}</strong><small>not independent source families</small></article>
          <article><span>Active ads observed</span><strong>{state.data.summary.activeAdCount}</strong><small>status observation, not performance</small></article>
          <article><span>Trend context links</span><strong>{state.data.summary.candidateContextLinkCount}</strong><small>context-only; no corroboration promotion</small></article>
        </div>

        {state.data.signals.length ? <section className="reportBlock">
          <div className="reportBlockHeading"><div><div className="eyebrow">PAID-CREATIVE OBSERVATIONS</div><h3>Imported Meta Ad Library evidence</h3></div></div>
          <div className="reportTrendList">{state.data.signals.slice(0, 20).map((signal) => <article key={signal.id}>
            <div className="reportTrendTopline"><span>PAID AD</span><span>{String(signal.metrics.native?.adStatus ?? "UNKNOWN")}</span></div>
            <h4>{signal.topic}</h4>
            <div className="reportEvidenceLine"><span>{String(signal.metrics.native?.mediaType ?? "unknown")}</span><span>{signal.metrics.native?.daysRunning != null ? `${signal.metrics.native.daysRunning} days running` : "age unavailable"}</span></div>
            {signal.evidence.sourceUrl ? <a className="textButton" href={signal.evidence.sourceUrl} target="_blank" rel="noreferrer">Open Ad Library evidence ↗</a> : null}
          </article>)}</div>
        </section> : <section className="reportBlock"><div className="reportEmpty">No Meta records were bundled into this public build. This is expected: the 04G bridge is local/private and CI never scrapes Meta.</div></section>}

        {state.data.trendContext.length ? <section className="reportBlock">
          <div className="reportBlockHeading"><div><div className="eyebrow">TREND CONTEXT</div><h3>Paid adoption context for existing candidates</h3></div></div>
          <div className="reportTrendList">{state.data.trendContext.map((link) => <article key={`${link.workspaceId}-${link.trendCandidateId}`}>
            <div className="reportTrendTopline"><span>CONTEXT ONLY</span><span>{link.advertiserCount} advertiser{link.advertiserCount === 1 ? "" : "s"}</span></div>
            <h4>{link.trendTitle}</h4>
            <p>{link.note}</p>
            <div className="reportEvidenceLine"><span>{link.matchedAnchors.join(" · ")}</span><span>{link.paidSignalIds.length} paid observation{link.paidSignalIds.length === 1 ? "" : "s"}</span></div>
          </article>)}</div>
        </section> : null}

        <section className="reportBlock reportBoundary">
          <div className="eyebrow">NON-NEGOTIABLE BOUNDARY</div>
          <h3>Paid ads ≠ organic virality ≠ creative performance.</h3>
          <p>Ad count, ad age, impressions, spend and reach remain source-native observations. Stage 04G does not infer winner status, ROAS, CTR or creative effectiveness; Meta evidence does not change Trend Candidate status, source diversity or corroboration.</p>
        </section>
      </div> : null}
    </div>
  </section>;
}
