export function enforcePaidCreativeSignalContract(snapshot) {
  if (!snapshot || snapshot.schemaVersion !== "paid-creative-intelligence-04g.v1") return snapshot;
  return {
    ...snapshot,
    source: {
      ...snapshot.source,
      evidenceFamily: "paid-ad",
    },
    signals: (snapshot.signals ?? []).map((signal) => ({
      ...signal,
      source: {
        ...signal.source,
        sourceType: "social",
      },
      metrics: {
        ...signal.metrics,
        native: {
          ...(signal.metrics?.native ?? {}),
          evidenceFamily: "paid-ad",
        },
      },
    })),
  };
}
