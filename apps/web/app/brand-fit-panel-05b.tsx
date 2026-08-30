"use client";

import { useEffect, useMemo, useState } from "react";
import type { IntelligenceWorkspace } from "@trend-pulse/contracts";
import type { BrandProfileStore } from "@trend-pulse/contracts/brand-profile";
import type { BrandFitTrendEvidence05B } from "@trend-pulse/contracts/brand-fit";
import {
  BRAND_PROFILE_STORAGE_KEY,
  emptyBrandProfileStore,
  normalizeBrandProfileStore,
} from "./brand-profile-foundation";
import { assessBrandFit05B, resolveBrandProfile05B } from "./brand-fit-engine-05b";

type Candidate = {
  id: string;
  workspaceId: string;
  title: string;
  summary: string;
  status: "candidate" | "corroborated";
  signalIds: string[];
  sourceIds: string[];
  independentSourceDiversity: number;
  independentSourceFamilyDiversity: number;
  resolutionAnchors?: string[];
  evidenceRefs?: string[];
  geographies?: string[];
  languages?: string[];
  lifecycleStage?: string;
};

type ReportForBrandFit = {
  weakSignals: Array<{ signalId: string }>;
  repeatedSingleSourceClusters: Array<{ id: string }>;
  candidates: Candidate[];
  corroboratedCount: number;
};

function readStore(): BrandProfileStore {
  try {
    const raw = window.localStorage.getItem(BRAND_PROFILE_STORAGE_KEY);
    return raw ? normalizeBrandProfileStore(JSON.parse(raw)) : emptyBrandProfileStore();
  } catch {
    return emptyBrandProfileStore();
  }
}

function toTrendEvidence(candidate: Candidate): BrandFitTrendEvidence05B {
  return {
    evidenceClass: "trend-candidate",
    id: candidate.id,
    workspaceId: candidate.workspaceId,
    title: candidate.title,
    summary: candidate.summary,
    status: candidate.status,
    lifecycleStage: candidate.lifecycleStage,
    signalIds: candidate.signalIds,
    sourceIds: candidate.sourceIds,
    independentSourceDiversity: candidate.independentSourceDiversity,
    independentSourceFamilyDiversity: candidate.independentSourceFamilyDiversity,
    resolutionAnchors: candidate.resolutionAnchors,
    geographies: candidate.geographies,
    languages: candidate.languages,
    evidenceRefs: candidate.evidenceRefs,
  };
}

function statusLabel(value: string) {
  return value.replaceAll("-", " ").toUpperCase();
}

export default function BrandFitPanel05B({ workspace, report }: { workspace: IntelligenceWorkspace; report: ReportForBrandFit }) {
  const [store, setStore] = useState<BrandProfileStore>(() => emptyBrandProfileStore());

  useEffect(() => {
    const sync = () => setStore(readStore());
    sync();
    const timer = window.setInterval(sync, 800);
    window.addEventListener("storage", sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const brandRows = useMemo(() => workspace.focusBrands.map((focusBrand) => {
    const record = store.records.find((item) => item.profile.workspaceId === workspace.id && item.profile.focusBrandId === focusBrand.id);
    if (!record) return { focusBrand, record: null, resolution: null, assessments: [] };
    const resolution = resolveBrandProfile05B(record);
    const assessments = report.candidates.map((candidate) => assessBrandFit05B(resolution, toTrendEvidence(candidate)));
    return { focusBrand, record, resolution, assessments };
  }), [workspace, report, store]);

  return <div className="intelligenceOverview">
    <section className="reportBlock reportBoundary">
      <div className="eyebrow">STAGE 05B · BRAND PROFILE RESOLUTION + BRAND FIT</div>
      <h3>Claim trace first. Numeric score remains unavailable.</h3>
      <p>05B reconciles explicit Brand Profile context and evidence-backed claims separately from Brand Fit factor evaluation. Autonomous external brand research is not claimed by this static preview. RG-004 numeric weights/thresholds remain open.</p>
    </section>

    <div className="reportKpis">
      <article><span>Qualified Trend Candidates</span><strong>{report.candidates.length}</strong><small>{report.corroboratedCount} independently corroborated</small></article>
      <article><span>Weak Signals excluded from Brand Fit</span><strong>{report.weakSignals.length}</strong><small>preserved for WATCH, not promoted by fit</small></article>
      <article><span>Same-source clusters excluded</span><strong>{report.repeatedSingleSourceClusters.length}</strong><small>repetition is not independent corroboration</small></article>
      <article><span>Numeric Brand Fit</span><strong>UNAVAILABLE</strong><small>no fabricated 0–10 precision</small></article>
    </div>

    {!workspace.focusBrands.length ? <div className="reportEmpty">This Workspace has no Focus Brand. Market/category intelligence remains valid; Brand Fit is not forced.</div> : null}

    {workspace.focusBrands.length > 0 && report.candidates.length === 0 ? (
      <div className="demoWarning">No qualified cross-source Trend Candidate exists in this Workspace snapshot. {report.weakSignals.length} Weak Signal{report.weakSignals.length === 1 ? " is" : "s are"} intentionally NOT assessed for Brand Fit. A high Brand Fit result cannot be used to promote a Weak Signal into an action.</div>
    ) : null}

    {brandRows.map(({ focusBrand, record, resolution, assessments }) => (
      <section className="reportBlock" key={focusBrand.id}>
        <div className="reportBlockHeading">
          <div><div className="eyebrow">FOCUS BRAND</div><h3>{focusBrand.name}</h3></div>
          <div className="reportFreshness"><span>{resolution ? statusLabel(resolution.status) : "PROFILE REQUIRED"}</span><strong>{resolution ? `${resolution.usableFieldCount} usable fields` : "Configure Brand Profile above"}</strong></div>
        </div>

        {!record || !resolution ? <div className="reportEmpty">No saved Brand Profile exists for this Focus Brand. Brand name alone is insufficient for Brand Fit.</div> : <>
          <div className="changeSummary">
            <div><strong>{statusLabel(resolution.readinessStatus)}</strong><span>05A readiness</span></div>
            <div><strong>{resolution.claims.filter((claim) => claim.status === "usable").length}</strong><span>usable claims</span></div>
            <div><strong>{resolution.pendingReferenceIds.length}</strong><span>pending references</span></div>
            <div><strong>{resolution.conflicts.length}</strong><span>open conflicts</span></div>
            <p>Research runtime: {statusLabel(resolution.researchRuntimeStatus)}. Pending URL/Drive/brief inputs do not silently become brand facts.</p>
          </div>

          {assessments.length ? <div className="reportTrendList">{assessments.map((assessment) => (
            <article key={assessment.trendCandidateId}>
              <div className="reportTrendTopline"><span>{statusLabel(assessment.assessmentStatus)}</span><span>{statusLabel(assessment.trendEvidenceMaturity)}</span></div>
              <h4>{report.candidates.find((candidate) => candidate.id === assessment.trendCandidateId)?.title ?? assessment.trendCandidateId}</h4>
              <p>Semantic result: <strong>{statusLabel(assessment.semanticResult)}</strong>. Numeric Brand Fit: <strong>UNAVAILABLE</strong>.</p>
              <div className="reportEvidenceLine"><span>{assessment.factorCoverage.supported} supported factors</span><span>{assessment.factorCoverage.tension} tension</span><span>{assessment.factorCoverage.unavailable} unavailable</span></div>
              <div className="reportTrendList">{assessment.factors.map((factor) => (
                <article key={factor.key}>
                  <div className="reportTrendTopline"><span>{factor.label}</span><span>{statusLabel(factor.status)}</span></div>
                  <p>{factor.rationale[0]}</p>
                  <div className="reportEvidenceLine"><span>Brand fields: {factor.trace.brandFields.join(" · ") || "none"}</span><span>Trend signals: {factor.trace.trendSignalIds.length}</span><span>Evidence refs: {factor.trace.trendEvidenceRefs.length}</span></div>
                </article>
              ))}</div>
            </article>
          ))}</div> : <div className="reportEmpty">No eligible Trend Candidate to evaluate for this brand in the current Workspace snapshot.</div>}
        </>}
      </section>
    ))}

    <section className="reportBlock reportBoundary">
      <div className="eyebrow">DOWNSTREAM GATE</div>
      <h3>Brand Fit ≠ Opportunity ≠ Action.</h3>
      <p>A provisional Brand Fit assessment does not authorize marketing execution. Candidate maturity, independent corroboration, Opportunity, risk, urgency and decision gates remain separate downstream concerns.</p>
    </section>
  </div>;
}
