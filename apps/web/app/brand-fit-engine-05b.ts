import type { BrandProfileFoundationRecord, BrandProfileFieldKey } from "@trend-pulse/contracts/brand-profile";
import type {
  BrandFitAssessment05B,
  BrandFitFactorAssessment05B,
  BrandFitFactorTrace05B,
  BrandFitTrendEvidence05B,
  BrandFitTrendEvidenceMaturity05B,
  BrandProfileClaim05B,
  BrandProfileConflict05B,
  BrandProfileResearchClaim05B,
  BrandProfileResolution05B,
} from "@trend-pulse/contracts/brand-fit";

const PROFILE_FIELDS: BrandProfileFieldKey[] = [
  "categories",
  "markets",
  "targetAudiences",
  "positioning",
  "valueProposition",
  "toneOfVoice",
  "visualCodes",
  "productLines",
  "contentPillars",
  "do",
  "dont",
  "riskBoundaries",
  "commercialObjectives",
  "creatorPriorities",
  "paidPriorities",
  "seoPriorities",
];

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "into", "about", "your", "their", "new", "more", "most", "trend", "market", "brand", "content",
  "va", "và", "cua", "của", "cho", "voi", "với", "trong", "tren", "trên", "mot", "một", "khong", "không", "la", "là", "co", "có", "duoc", "được", "tu", "từ", "den", "đến", "moi", "mới",
]);

function normalize(value: string) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stableId(parts: string[]) {
  const value = parts.join("|");
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function tokens(value: string) {
  return normalize(value)
    .split(" ")
    .filter((token) => token && !STOP_WORDS.has(token) && (token.length >= 3 || ["ai", "vr", "xr", "ar", "3d"].includes(token)));
}

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalize(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function profileValues(record: BrandProfileFoundationRecord, field: BrandProfileFieldKey) {
  return record.profile[field] ?? [];
}

function buildProfileContextClaims(record: BrandProfileFoundationRecord): BrandProfileClaim05B[] {
  const claims: BrandProfileClaim05B[] = [];
  for (const field of PROFILE_FIELDS) {
    const values = profileValues(record, field);
    if (!values.length) continue;
    const provenance = record.provenance.find((item) => item.field === field);
    claims.push({
      schemaVersion: "brand-profile-claim-05b.v1",
      id: `claim-profile-${stableId([record.profile.id, field, ...values])}`,
      workspaceId: record.profile.workspaceId,
      focusBrandId: record.profile.focusBrandId,
      field,
      values: [...values],
      origin: provenance?.sourceType ?? "user-input",
      sourceLabel: provenance?.sourceLabel ?? "Structured Brand Profile context",
      claimKind: "profile-context",
      relationshipToProfile: "profile-context",
      status: "usable",
      evidenceRefs: provenance?.reference ? [provenance.reference] : [],
      capturedAt: provenance?.capturedAt ?? record.updatedAt,
    });
  }
  return claims;
}

function reconcileExternalClaims(
  record: BrandProfileFoundationRecord,
  externalClaims: BrandProfileResearchClaim05B[],
): { claims: BrandProfileClaim05B[]; conflicts: BrandProfileConflict05B[] } {
  const claims: BrandProfileClaim05B[] = [];
  const conflicts: BrandProfileConflict05B[] = [];
  const profileClaims = buildProfileContextClaims(record);

  for (const input of externalClaims) {
    const belongsToProfile = input.workspaceId === record.profile.workspaceId && input.focusBrandId === record.profile.focusBrandId;
    const hasEvidence = input.evidenceRefs.length > 0;
    const usable = input.status === "resolved" && hasEvidence && belongsToProfile;
    const status: BrandProfileClaim05B["status"] = input.status === "rejected" ? "rejected" : usable ? "usable" : "pending";
    const claim: BrandProfileClaim05B = {
      schemaVersion: "brand-profile-claim-05b.v1",
      id: input.id,
      workspaceId: input.workspaceId,
      focusBrandId: input.focusBrandId,
      field: input.field,
      values: unique(input.values),
      origin: input.sourceType,
      sourceLabel: input.sourceLabel,
      claimKind: "external-evidence",
      relationshipToProfile: input.relationshipToProfile,
      status,
      evidenceRefs: usable ? [...input.evidenceRefs] : [],
      capturedAt: input.capturedAt,
    };
    claims.push(claim);

    if (usable && input.relationshipToProfile === "contradicts") {
      const profileClaimIds = profileClaims.filter((item) => item.field === input.field).map((item) => item.id);
      conflicts.push({
        id: `conflict-${stableId([record.profile.id, input.field, input.id])}`,
        field: input.field,
        claimIds: [...profileClaimIds, input.id],
        description: `Evidence-backed claim ${input.id} explicitly contradicts the current structured ${input.field} context.`,
        evidenceRefs: [...input.evidenceRefs],
      });
    }
  }

  return { claims, conflicts };
}

export function resolveBrandProfile05B(
  record: BrandProfileFoundationRecord,
  externalClaims: BrandProfileResearchClaim05B[] = [],
  now = new Date().toISOString(),
): BrandProfileResolution05B {
  const profileClaims = buildProfileContextClaims(record);
  const external = reconcileExternalClaims(record, externalClaims);
  const legacyConflicts: BrandProfileConflict05B[] = (record.conflicts ?? []).map((description, index) => ({
    id: `conflict-foundation-${stableId([record.profile.id, String(index), description])}`,
    claimIds: [],
    description,
    evidenceRefs: [],
  }));
  const conflicts = [...legacyConflicts, ...external.conflicts];
  const claims = [...profileClaims, ...external.claims];
  const externallyResolvedClaimCount = external.claims.filter((claim) => claim.claimKind === "external-evidence" && claim.status === "usable").length;

  let status: BrandProfileResolution05B["status"] = "usable-provisional";
  if (conflicts.length) status = "conflicted";
  else if (record.readiness.status === "blocked") status = "blocked";
  else if (record.readiness.status === "partial") status = "partial";

  const rationale = [
    "05B reconciles explicit structured Brand Profile context and evidence-backed claims; it does not infer brand facts from a brand name.",
    "Pending brief/URL/Drive references do not generate field claims until a resolver supplies explicit claim values plus evidence references.",
    "Profile resolution quality is separate from Brand Fit factor evaluation and from Trend corroboration.",
  ];
  if (!externalClaims.length) {
    rationale.push("Autonomous external brand research is not executed in the current static/preview runtime; researchRuntimeStatus remains not-executed.");
  }
  if (conflicts.length) {
    rationale.push("One or more explicit conflicts remain unresolved, so downstream Brand Fit is unavailable until conflict adjudication.");
  }

  return {
    schemaVersion: "brand-profile-resolution-05b.v1",
    methodologyVersion: "brand-claim-reconciliation-05b.v1",
    workspaceId: record.profile.workspaceId,
    focusBrandId: record.profile.focusBrandId,
    profileId: record.profile.id,
    brandName: record.profile.brandName,
    readinessStatus: record.readiness.status,
    status,
    researchRuntimeStatus: externalClaims.length ? "evidence-input-reconciled" : "not-executed",
    claims,
    conflicts,
    pendingReferenceIds: (record.pendingReferences ?? []).filter((reference) => reference.status === "pending-resolver").map((reference) => reference.id),
    usableFieldCount: new Set(profileClaims.map((claim) => claim.field)).size,
    externallyResolvedClaimCount,
    rationale,
    resolvedAt: now,
  };
}

function trendCorpus(target: BrandFitTrendEvidence05B) {
  return unique([
    target.title,
    target.summary ?? "",
    ...(target.resolutionAnchors ?? []),
    ...(target.geographies ?? []),
    ...(target.languages ?? []),
  ]).filter(Boolean);
}

function phraseMatches(profileValue: string, corpusValues: string[]) {
  const phrase = normalize(profileValue);
  if (!phrase) return [];
  const valueTokens = new Set(tokens(profileValue));
  const matches: string[] = [];
  for (const candidate of corpusValues) {
    const normalizedCandidate = normalize(candidate);
    if (!normalizedCandidate) continue;
    if (normalizedCandidate.includes(phrase) || phrase.includes(normalizedCandidate)) {
      matches.push(candidate);
      continue;
    }
    const candidateTokens = new Set(tokens(candidate));
    const shared = [...valueTokens].filter((token) => candidateTokens.has(token));
    const required = valueTokens.size <= 1 ? 1 : Math.min(2, valueTokens.size);
    if (shared.length >= required) matches.push(candidate);
  }
  return unique(matches);
}

function claimsForFields(resolution: BrandProfileResolution05B, fields: BrandProfileFieldKey[]) {
  return resolution.claims.filter((claim) => claim.status === "usable" && fields.includes(claim.field));
}

function traceFor(
  resolution: BrandProfileResolution05B,
  fields: BrandProfileFieldKey[],
  target: BrandFitTrendEvidence05B,
): BrandFitFactorTrace05B {
  const claims = claimsForFields(resolution, fields);
  return {
    brandFields: [...fields],
    brandClaimIds: claims.map((claim) => claim.id),
    trendCandidateId: target.id,
    trendSignalIds: [...target.signalIds],
    trendEvidenceRefs: [...(target.evidenceRefs ?? [])],
  };
}

function overlapFactor(
  key: BrandFitFactorAssessment05B["key"],
  label: string,
  fields: BrandProfileFieldKey[],
  resolution: BrandProfileResolution05B,
  target: BrandFitTrendEvidence05B,
): BrandFitFactorAssessment05B {
  const claims = claimsForFields(resolution, fields);
  const values = unique(claims.flatMap((claim) => claim.values));
  const corpus = trendCorpus(target);
  if (!values.length) {
    return {
      key,
      label,
      status: "unavailable",
      matchedProfileValues: [],
      matchedTrendTerms: [],
      rationale: [`No usable ${fields.join(" / ")} Brand Profile context is available for this factor.`],
      trace: traceFor(resolution, fields, target),
    };
  }

  const matchedProfileValues: string[] = [];
  const matchedTrendTerms: string[] = [];
  for (const value of values) {
    const matches = phraseMatches(value, corpus);
    if (matches.length) {
      matchedProfileValues.push(value);
      matchedTrendTerms.push(...matches);
    }
  }

  if (!matchedProfileValues.length) {
    return {
      key,
      label,
      status: "unavailable",
      matchedProfileValues: [],
      matchedTrendTerms: [],
      rationale: [
        "No explicit inspectable lexical overlap was found between this Brand Profile context and the current Trend Candidate evidence.",
        "05B does not convert absence of lexical overlap into a negative Brand Fit claim and does not use hidden semantic inference.",
      ],
      trace: traceFor(resolution, fields, target),
    };
  }

  return {
    key,
    label,
    status: "supported",
    matchedProfileValues: unique(matchedProfileValues),
    matchedTrendTerms: unique(matchedTrendTerms),
    rationale: ["Explicit Brand Profile values overlap with inspectable Trend Candidate text/anchors under the bounded 05B resolver."],
    trace: traceFor(resolution, fields, target),
  };
}

function riskFactor(resolution: BrandProfileResolution05B, target: BrandFitTrendEvidence05B): BrandFitFactorAssessment05B {
  const fields: BrandProfileFieldKey[] = ["riskBoundaries", "dont"];
  const claims = claimsForFields(resolution, fields);
  const values = unique(claims.flatMap((claim) => claim.values));
  const corpus = trendCorpus(target);
  const matchedProfileValues: string[] = [];
  const matchedTrendTerms: string[] = [];
  for (const value of values) {
    const matches = phraseMatches(value, corpus);
    if (matches.length) {
      matchedProfileValues.push(value);
      matchedTrendTerms.push(...matches);
    }
  }

  return {
    key: "brand-safety-risk",
    label: "Brand safety / risk",
    status: matchedProfileValues.length ? "tension" : "unavailable",
    matchedProfileValues: unique(matchedProfileValues),
    matchedTrendTerms: unique(matchedTrendTerms),
    rationale: matchedProfileValues.length
      ? ["Trend evidence explicitly overlaps with a Brand Profile risk boundary / do-not context; this is a caution signal, not a safety score."]
      : ["No explicit risk-boundary conflict was found, but absence of a match is not proof of safety; the factor remains unavailable."],
    trace: traceFor(resolution, fields, target),
  };
}

function unavailableFactor(
  key: BrandFitFactorAssessment05B["key"],
  label: string,
  fields: BrandProfileFieldKey[],
  resolution: BrandProfileResolution05B,
  target: BrandFitTrendEvidence05B,
  reason: string,
): BrandFitFactorAssessment05B {
  return {
    key,
    label,
    status: "unavailable",
    matchedProfileValues: [],
    matchedTrendTerms: [],
    rationale: [reason],
    trace: traceFor(resolution, fields, target),
  };
}

function maturity(target: BrandFitTrendEvidence05B): BrandFitTrendEvidenceMaturity05B {
  if (target.evidenceClass === "weak-signal") return "weak-signal";
  if (target.evidenceClass === "repeated-single-source-cluster" || new Set(target.sourceIds).size < 2) return "same-source-only";
  if (target.status === "corroborated" && (target.independentSourceDiversity ?? 0) >= 2 && (target.independentSourceFamilyDiversity ?? 0) >= 2) {
    return "independently-corroborated";
  }
  return "candidate-unconfirmed";
}

function unavailableAssessment(
  resolution: BrandProfileResolution05B,
  target: BrandFitTrendEvidence05B,
  reasons: string[],
  now: string,
): BrandFitAssessment05B {
  return {
    schemaVersion: "brand-fit-assessment-05b.v1",
    methodologyVersion: "brand-fit-factor-trace-05b.v1",
    workspaceId: resolution.workspaceId,
    focusBrandId: resolution.focusBrandId,
    trendCandidateId: target.id,
    assessmentStatus: "unavailable",
    semanticResult: "unavailable",
    trendEvidenceMaturity: maturity(target),
    numericScoreStatus: "unavailable",
    numericScoreReason: "RG-004 numeric Brand Fit calibration remains open; 05B does not invent weights, thresholds or 0–10 precision.",
    factorCoverage: { supported: 0, partial: 0, tension: 0, unavailable: 0, notApplicable: 0 },
    factors: [],
    rationale: reasons,
    generatedAt: now,
  };
}

export function assessBrandFit05B(
  resolution: BrandProfileResolution05B,
  target: BrandFitTrendEvidence05B,
  now = new Date().toISOString(),
): BrandFitAssessment05B {
  const targetMaturity = maturity(target);
  if (resolution.readinessStatus !== "ready-for-provisional-brand-fit") {
    return unavailableAssessment(resolution, target, ["Brand Profile readiness has not passed the 05A ready-for-provisional-brand-fit gate."], now);
  }
  if (resolution.status === "conflicted") {
    return unavailableAssessment(resolution, target, ["Brand Profile has unresolved evidence/claim conflicts; Brand Fit is unavailable until adjudicated."], now);
  }
  if (target.evidenceClass === "weak-signal") {
    return unavailableAssessment(resolution, target, ["Weak Signals are preserved for monitoring but are not eligible for Brand Fit assessment in 05B."], now);
  }
  if (target.evidenceClass === "repeated-single-source-cluster" || new Set(target.sourceIds).size < 2) {
    return unavailableAssessment(resolution, target, ["Same-source repetition is not a qualified cross-source Trend Candidate and cannot enter Brand Fit assessment."], now);
  }
  if (target.evidenceClass !== "trend-candidate") {
    return unavailableAssessment(resolution, target, ["Only qualified Workspace Trend Candidates are eligible for 05B Brand Fit factor evaluation."], now);
  }

  const factors: BrandFitFactorAssessment05B[] = [
    overlapFactor("category-relevance", "Category relevance", ["categories"], resolution, target),
    overlapFactor("audience-overlap", "Audience overlap", ["targetAudiences"], resolution, target),
    overlapFactor("product-relevance", "Product relevance", ["productLines"], resolution, target),
    overlapFactor("positioning-value-alignment", "Positioning / value alignment", ["positioning", "valueProposition", "contentPillars"], resolution, target),
    overlapFactor("tone-of-voice-fit", "Tone of voice fit", ["toneOfVoice"], resolution, target),
    overlapFactor("visual-code-fit", "Visual code fit", ["visualCodes"], resolution, target),
    overlapFactor("market-relevance", "Market relevance", ["markets"], resolution, target),
    unavailableFactor(
      "context-seasonality",
      "Context / seasonality",
      ["contentPillars", "commercialObjectives"],
      resolution,
      target,
      "05B has no defensible general seasonality/calendar resolver in the current Trend Candidate evidence contract; this factor remains unavailable rather than inferred.",
    ),
    riskFactor(resolution, target),
    unavailableFactor(
      "execution-naturalness",
      "Execution naturalness",
      ["positioning", "toneOfVoice", "contentPillars", "do", "dont"],
      resolution,
      target,
      "Execution naturalness requires strategy/execution reasoning beyond bounded lexical evidence; 05B does not fabricate this judgment.",
    ),
  ];

  const factorCoverage = {
    supported: factors.filter((factor) => factor.status === "supported").length,
    partial: factors.filter((factor) => factor.status === "partial").length,
    tension: factors.filter((factor) => factor.status === "tension").length,
    unavailable: factors.filter((factor) => factor.status === "unavailable").length,
    notApplicable: factors.filter((factor) => factor.status === "not-applicable").length,
  };

  const coreSupported = factors.some((factor) => ["category-relevance", "audience-overlap", "product-relevance", "market-relevance"].includes(factor.key) && factor.status === "supported");
  const identitySupported = factors.some((factor) => ["positioning-value-alignment", "tone-of-voice-fit", "visual-code-fit"].includes(factor.key) && factor.status === "supported");

  let semanticResult: BrandFitAssessment05B["semanticResult"] = "insufficient-evidence";
  if (factorCoverage.tension > 0) semanticResult = "caution";
  else if (factorCoverage.supported >= 2 && coreSupported && identitySupported) semanticResult = "provisional-alignment";
  else if (factorCoverage.supported > 0) semanticResult = "mixed-evidence";

  const rationale = [
    "Brand Fit is evaluated only after the Brand Profile readiness gate and only against a qualified cross-source Workspace Trend Candidate.",
    "Factor output is directional and inspectable; unsupported factors remain unavailable rather than being filled by inference.",
    targetMaturity === "candidate-unconfirmed"
      ? "This Trend Candidate is not yet independently corroborated; Brand Fit may be provisionally inspected, but corroboration/Opportunity/Decision/Action gates remain separate and blocked downstream."
      : "This Trend Candidate is independently corroborated, but Brand Fit still does not itself authorize Opportunity/Decision/Action.",
    "No numeric Brand Fit score is emitted because RG-004 weights, thresholds and normalization are not yet calibrated.",
  ];

  return {
    schemaVersion: "brand-fit-assessment-05b.v1",
    methodologyVersion: "brand-fit-factor-trace-05b.v1",
    workspaceId: resolution.workspaceId,
    focusBrandId: resolution.focusBrandId,
    trendCandidateId: target.id,
    assessmentStatus: "provisional",
    semanticResult,
    trendEvidenceMaturity: targetMaturity,
    numericScoreStatus: "unavailable",
    numericScoreReason: "RG-004 numeric Brand Fit calibration remains open; 05B does not invent weights, thresholds or 0–10 precision.",
    factorCoverage,
    factors,
    rationale,
    generatedAt: now,
  };
}
