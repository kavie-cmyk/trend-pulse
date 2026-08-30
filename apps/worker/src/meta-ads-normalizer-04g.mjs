import { createHash } from "node:crypto";

const PREVIEW_EXPLICIT_TERMS = /(^|[ _-])(porn|pornography|hentai|xxx|onlyfans|sexual intercourse|sex position)([ _-]|$)/i;

function safeText(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function stableId(value) {
  return createHash("sha1").update(String(value)).digest("hex").slice(0, 18);
}

function validIso(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function httpUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function stringArray(value) {
  return Array.isArray(value) ? value.map(safeText).filter(Boolean) : [];
}

function firstBody(ad) {
  const bodies = stringArray(ad.body_variants);
  return bodies.find(Boolean) ?? "";
}

function hashtagsFrom(text) {
  const matches = String(text ?? "").match(/#[\p{L}\p{N}_-]+/gu) ?? [];
  return [...new Set(matches.map((item) => item.slice(1)).filter(Boolean))].slice(0, 20);
}

function previewSafe(ad) {
  const text = [ad.advertiser_name, ad.headline, ...stringArray(ad.body_variants)].join(" ");
  return !PREVIEW_EXPLICIT_TERMS.test(text);
}

function sourceNativeMetrics(ad) {
  const native = {};
  const setNumber = (key, value) => {
    const number = finiteNumber(value);
    if (number !== undefined) native[key] = number;
  };
  const setText = (key, value) => {
    const text = safeText(value);
    if (text) native[key] = text;
  };

  setText("adStatus", ad.status);
  setText("mediaType", ad.media_type);
  const platforms = stringArray(ad.platforms);
  if (platforms.length) native.platforms = platforms.join("|");
  setNumber("daysRunning", ad.days_running);
  setNumber("spendMin", ad.spend_min);
  setNumber("spendMax", ad.spend_max);
  setText("spendCurrency", ad.spend_currency);
  setNumber("impressionsMin", ad.impressions_min);
  setNumber("impressionsMax", ad.impressions_max);
  setNumber("totalReach", ad.total_reach);
  setText("collectionCountry", ad.country);
  setText("collectionLanguage", ad.language);
  setText("adCategory", ad.category);
  setText("advertiserPageId", ad.advertiser_page_id);
  setText("ctaText", ad.cta_text);
  setText("landingUrl", httpUrl(ad.link_url));
  setText("fundingEntity", ad.funding_entity);
  setText("beneficiary", ad.beneficiary);
  setText("payer", ad.payer);
  return native;
}

function evidenceUrl(ad) {
  const provided = httpUrl(ad.ad_snapshot_url);
  if (provided) return provided;
  return `https://www.facebook.com/ads/library/?id=${encodeURIComponent(String(ad.id))}`;
}

function topicFor(ad) {
  const advertiser = safeText(ad.advertiser_name);
  const headline = safeText(ad.headline);
  const body = firstBody(ad).split("\n")[0].trim();
  const creative = headline || body;
  return creative ? `${advertiser} — ${creative}`.slice(0, 420) : `${advertiser} — paid creative observation`;
}

function entitiesFor(ad, context) {
  const values = [
    ad.advertiser_name,
    context?.company?.matched_name,
    context?.company?.company_name,
  ].map(safeText).filter(Boolean);
  return [...new Set(values)];
}

export function parseMetaAdsInput(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return { mode: "none", records: [], rejectedDocuments: 0 };

  let documents = [];
  let mode = "json";
  try {
    documents = [JSON.parse(trimmed)];
  } catch {
    mode = "jsonl-webhook";
    for (const line of trimmed.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
      try {
        documents.push(JSON.parse(line));
      } catch {
        documents.push({ __invalid: true });
      }
    }
  }

  const records = [];
  let rejectedDocuments = 0;

  function visit(document, inherited = {}) {
    if (!document || typeof document !== "object") {
      rejectedDocuments += 1;
      return;
    }
    if (document.__invalid) {
      rejectedDocuments += 1;
      return;
    }
    if (Array.isArray(document)) {
      for (const item of document) visit(item, inherited);
      return;
    }
    if (document.payload && typeof document.payload === "object") {
      visit(document.payload, { ...inherited, receivedAt: document.receivedAt ?? inherited.receivedAt });
      return;
    }
    if (Array.isArray(document.ads)) {
      const context = {
        ...inherited,
        event: safeText(document.event),
        sentAt: document.sent_at,
        source: safeText(document.source),
        company: document.company && typeof document.company === "object" ? document.company : undefined,
      };
      for (const ad of document.ads) records.push({ ad, context });
      return;
    }
    if (document.id || document.ad_archive_id) {
      records.push({ ad: document, context: inherited });
      return;
    }
    rejectedDocuments += 1;
  }

  for (const document of documents) visit(document);
  return { mode, records, rejectedDocuments };
}

export function normalizeMetaAdRecord(record, options = {}) {
  const ad = record?.ad;
  const context = record?.context ?? {};
  if (!ad || typeof ad !== "object") return { accepted: false, reason: "record-not-object" };

  const externalId = safeText(ad.id || ad.ad_archive_id);
  const advertiser = safeText(ad.advertiser_name || ad.page_name);
  if (!externalId) return { accepted: false, reason: "missing-ad-id" };
  if (!advertiser) return { accepted: false, reason: "missing-advertiser" };
  if (!previewSafe({ ...ad, advertiser_name: advertiser })) return { accepted: false, reason: "preview-safety-filter" };

  const normalizedAt = options.normalizedAt ?? new Date().toISOString();
  const observedAt = validIso(ad.scraped_at) || validIso(context.sentAt) || validIso(context.receivedAt) || normalizedAt;
  const publishedAt = validIso(ad.started_at);
  const body = firstBody(ad);
  const headline = safeText(ad.headline);
  const allCreativeText = [headline, ...stringArray(ad.body_variants)].join(" ");
  const mediaType = safeText(ad.media_type) || "unknown";
  const status = safeText(ad.status) || "UNKNOWN";
  const native = sourceNativeMetrics(ad);

  const signal = {
    schemaVersion: "signal.v1",
    id: `meta-ad-${stableId(externalId)}`,
    ...(options.workspaceId ? { workspaceId: options.workspaceId } : {}),
    collectionScopeId: options.workspaceId
      ? `meta-ad-library-${options.workspaceId}-private-import`
      : "meta-ad-library-private-import",
    observedAt,
    ...(publishedAt ? { publishedAt } : {}),
    collectedAt: normalizedAt,
    normalizedAt,
    source: {
      sourceId: "meta-ad-library-public-experimental",
      sourceName: "Meta Ad Library · experimental local bridge",
      sourceType: "paid-ad",
      accessMode: "open-web",
      freshness: "manual",
    },
    topic: topicFor({ ...ad, advertiser_name: advertiser }),
    entities: entitiesFor({ ...ad, advertiser_name: advertiser }, context),
    keywords: [],
    hashtags: hashtagsFrom(allCreativeText),
    contentType: `paid-ad-${mediaType}`,
    metrics: { native },
    dynamics: {},
    confidence: {
      score: 0.55,
      basis: [
        "Imported from a public Meta Ad Library record through the Stage 04G experimental local sidecar.",
        "Signal confidence describes capture/provenance only; it is not Trend Confidence or ad-performance confidence.",
        "Paid-ad intelligence is separate from organic virality and does not independently promote Trend Candidate corroboration in Stage 04G.",
      ],
    },
    evidence: {
      sourceUrl: evidenceUrl({ ...ad, id: externalId }),
      externalId,
      reference: `${advertiser} · ${status} · ${mediaType} · source-native paid creative observation${body ? " with captured ad copy" : ""}; no performance inference.`,
    },
  };

  return { accepted: true, signal };
}

function countBy(values) {
  const out = {};
  for (const value of values.filter(Boolean)) out[value] = (out[value] ?? 0) + 1;
  return out;
}

export function buildPaidCreativeSnapshot(parsed, config, options = {}) {
  const normalizedAt = options.normalizedAt ?? new Date().toISOString();
  const seenExternalIds = new Set();
  const signals = [];
  let rejected = Number(parsed?.rejectedDocuments ?? 0);
  let seen = 0;

  for (const record of parsed?.records ?? []) {
    seen += 1;
    const externalId = safeText(record?.ad?.id || record?.ad?.ad_archive_id);
    if (externalId && seenExternalIds.has(externalId)) continue;
    if (externalId) seenExternalIds.add(externalId);
    const normalized = normalizeMetaAdRecord(record, { workspaceId: options.workspaceId, normalizedAt });
    if (!normalized.accepted) {
      rejected += 1;
      continue;
    }
    signals.push(normalized.signal);
  }

  const advertisers = new Set(signals.flatMap((signal) => signal.entities.slice(0, 1)).filter(Boolean));
  const active = signals.filter((signal) => signal.metrics.native?.adStatus === "ACTIVE").length;
  const inactive = signals.filter((signal) => signal.metrics.native?.adStatus === "INACTIVE").length;
  const mediaTypes = countBy(signals.map((signal) => String(signal.metrics.native?.mediaType ?? "unknown")));
  const platforms = [];
  for (const signal of signals) {
    const value = signal.metrics.native?.platforms;
    if (typeof value === "string") platforms.push(...value.split("|").filter(Boolean));
  }

  const status = signals.length ? "ingested" : (parsed?.mode === "none" ? "awaiting-local-ingest" : "invalid-input");
  return {
    schemaVersion: "paid-creative-intelligence-04g.v1",
    methodologyVersion: "paid-creative-bridge-04g.v1",
    generatedAt: normalizedAt,
    status,
    source: {
      sourceId: "meta-ad-library-public-experimental",
      sourceName: "Meta Ad Library · experimental local bridge",
      upstreamRepository: config.upstream.repository,
      upstreamRef: config.upstream.ref,
      upstreamLicense: config.upstream.license,
      accessBoundary: "experimental-local-sidecar",
      complianceStatus: "needs-review",
      scheduledCollection: false,
    },
    input: {
      mode: parsed?.mode ?? "none",
      ...(options.inputPath ? { inputPath: options.inputPath } : {}),
      ...(options.workspaceId ? { workspaceId: options.workspaceId } : {}),
      recordsSeen: seen,
      recordsAccepted: signals.length,
      recordsRejected: rejected,
    },
    summary: {
      signalCount: signals.length,
      advertiserCount: advertisers.size,
      activeAdCount: active,
      inactiveAdCount: inactive,
      mediaTypes,
      platforms: countBy(platforms),
      candidateContextLinkCount: 0,
    },
    signals,
    trendContext: [],
    warnings: [
      "Stage 04G is an experimental private-learning bridge. Automated Meta access authorization/compliance is not established for production use.",
      "Paid-ad intelligence is not organic virality. Meta ads do not independently change Trend Candidate or corroboration status in Stage 04G.",
      "daysRunning, spend, impressions and reach remain source-native observations. No winner, battle-tested, ROAS, CTR or performance inference is emitted.",
      "Upstream collection country/language/category values are retained only as native collection metadata and are not promoted into ad targeting geography/language.",
      "GitHub Actions validates the bridge with fixtures and an empty/default artifact; scheduled CI does not scrape Meta.",
    ],
  };
}
