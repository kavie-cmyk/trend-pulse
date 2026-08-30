function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsPhrase(haystack, phrase) {
  const text = ` ${normalize(haystack)} `;
  const needle = ` ${normalize(phrase)} `;
  return needle.trim().length > 0 && text.includes(needle);
}

function signalText(signal) {
  return [
    signal?.topic,
    ...(Array.isArray(signal?.entities) ? signal.entities : []),
    ...(Array.isArray(signal?.hashtags) ? signal.hashtags : []),
  ].join(" ");
}

export function contextualizePaidCreativeSnapshot(snapshot, workspaceSnapshot) {
  if (!snapshot || snapshot.schemaVersion !== "paid-creative-intelligence-04g.v1") return snapshot;
  const links = [];
  const workspaces = Array.isArray(workspaceSnapshot?.workspaces) ? workspaceSnapshot.workspaces : [];

  for (const workspace of workspaces) {
    const workspaceId = workspace?.workspace?.id;
    if (!workspaceId) continue;
    const paidSignals = (snapshot.signals ?? []).filter((signal) => signal.workspaceId === workspaceId);
    if (!paidSignals.length) continue;

    for (const candidate of workspace.candidates ?? []) {
      const anchors = Array.isArray(candidate.resolutionAnchors)
        ? candidate.resolutionAnchors.map(String).filter(Boolean)
        : [];
      if (!anchors.length) continue;

      const matchedSignals = [];
      const matchedAnchors = new Set();
      for (const signal of paidSignals) {
        const text = signalText(signal);
        const signalAnchors = anchors.filter((anchor) => containsPhrase(text, anchor));
        if (!signalAnchors.length) continue;
        matchedSignals.push(signal);
        signalAnchors.forEach((anchor) => matchedAnchors.add(anchor));
      }
      if (!matchedSignals.length) continue;

      links.push({
        trendCandidateId: candidate.id,
        trendTitle: candidate.title,
        workspaceId,
        matchedAnchors: [...matchedAnchors],
        paidSignalIds: matchedSignals.map((signal) => signal.id),
        advertiserCount: new Set(matchedSignals.flatMap((signal) => signal.entities?.slice(0, 1) ?? [])).size,
        note: "Context-only paid creative match. This link does not change Trend Candidate status, source diversity, corroboration, Virality or Brand Fit.",
      });
    }
  }

  return {
    ...snapshot,
    generatedAt: new Date().toISOString(),
    summary: {
      ...snapshot.summary,
      candidateContextLinkCount: links.length,
    },
    trendContext: links,
  };
}

export { containsPhrase };
