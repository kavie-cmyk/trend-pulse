import type { IntelligenceWorkspace, SignalBatch, SourcePlanItem } from "@trend-pulse/contracts";

const GLOBAL_TERMS = new Set(["global", "worldwide", "all markets", "international"]);
const LANGUAGE_ALIASES: Record<string, string[]> = {
  english: ["english", "en"],
  vietnamese: ["vietnamese", "vi", "tiếng việt", "tieng viet"],
};

function norm(value: string) {
  return value.trim().toLowerCase();
}

function workspaceHasSupportedLanguage(workspace: IntelligenceWorkspace, batch: SignalBatch) {
  const requested = workspace.scope.languages.map(norm);
  const available = (batch.collectionScope?.languages ?? []).flatMap((language) => LANGUAGE_ALIASES[norm(language)] ?? [norm(language)]);
  if (!requested.length || !available.length) return true;
  return requested.some((language) => available.includes(language) || Object.values(LANGUAGE_ALIASES).some((aliases) => aliases.includes(language) && aliases.some((alias) => available.includes(alias))));
}

function hasSpecificGeography(workspace: IntelligenceWorkspace) {
  return workspace.scope.geographies.some((value) => !GLOBAL_TERMS.has(norm(value)));
}

function hasSpecificDecisionScope(workspace: IntelligenceWorkspace) {
  return Boolean(
    workspace.scope.industries.length ||
    workspace.scope.categories.length ||
    workspace.scope.products.length ||
    workspace.focusBrands.length
  );
}

export function planWikimediaForWorkspace(workspace: IntelligenceWorkspace | null, batch: SignalBatch): SourcePlanItem {
  const base = {
    sourceId: batch.sourceId,
    sourceName: "Wikimedia Pageviews",
    runtimeStatus: "operational" as const,
    freshness: batch.effectiveFreshness,
  };

  if (!workspace) {
    return {
      ...base,
      fit: "medium",
      role: "supporting",
      applicableToWorkspace: false,
      reason: "No saved workspace is active. The batch is shown only as a broad-source preview.",
    };
  }

  if (!workspaceHasSupportedLanguage(workspace, batch)) {
    return {
      ...base,
      fit: "not-applicable",
      role: "background",
      applicableToWorkspace: false,
      reason: "The current Wikimedia feed only covers the configured language editions and does not match this workspace language scope.",
    };
  }

  if (hasSpecificDecisionScope(workspace)) {
    return {
      ...base,
      fit: "low",
      role: "background",
      applicableToWorkspace: false,
      reason: "The current top-page feed is broad cultural attention. It cannot filter by this workspace's industry, category, product or Focus Brand, so it must not drive active workspace intelligence.",
    };
  }

  if (hasSpecificGeography(workspace)) {
    return {
      ...base,
      fit: "low",
      role: "background",
      applicableToWorkspace: false,
      reason: "The current top-page collection is based on Wikipedia language editions, not the workspace's specific market/geography, so it is background corroboration only.",
    };
  }

  return {
    ...base,
    fit: "medium",
    role: "supporting",
    applicableToWorkspace: true,
    reason: "This broad market workspace can use Wikimedia as a supporting cultural-attention source, but not as a standalone trend conclusion.",
  };
}

export function nextTwiceDailyRunUtc(hours = [7, 19], minute = 17, now = new Date()) {
  const candidates = hours
    .slice()
    .sort((a, b) => a - b)
    .map((hour) => {
      const candidate = new Date(now);
      candidate.setUTCSeconds(0, 0);
      candidate.setUTCHours(hour, minute, 0, 0);
      return candidate;
    });

  const today = candidates.find((candidate) => candidate.getTime() > now.getTime());
  if (today) return today;

  const next = candidates[0] ? new Date(candidates[0]) : new Date(now);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
