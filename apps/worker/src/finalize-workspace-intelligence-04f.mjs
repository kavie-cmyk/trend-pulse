import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const signalPath = path.join(repoRoot, "apps/web/public/data/workspace-signals-04f.json");
const reportPath = path.join(repoRoot, "apps/web/public/data/workspace-intelligence.json");
const semanticGroups = [
  { id: "publishing", aliases: ["publishing", "publisher", "publish", "phat hanh", "phát hành"] },
  { id: "launch", aliases: ["launch", "launched", "release", "released", "soft launch", "ra mat", "ra mắt"] },
  { id: "mobile", aliases: ["mobile", "di dong", "di động"] },
  { id: "esports", aliases: ["esports", "e sports", "the thao dien tu", "thể thao điện tử"] },
  { id: "artificial-intelligence", aliases: ["artificial intelligence", "ai", "tri tue nhan tao", "trí tuệ nhân tạo"] },
  { id: "app-store", aliases: ["app store", "apple app store", "google play", "play store"] },
  { id: "creator", aliases: ["creator", "influencer", "streamer", "content creator"] },
];

function norm(value) { return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim(); }
function tokens(value) { return norm(value).split(" ").filter(Boolean); }
function distinct(values) { return [...new Set(values.filter(Boolean))]; }
function signalText(signal) { return [signal.topic, ...(signal.entities ?? []), ...(signal.hashtags ?? []), ...(signal.keywords ?? []), signal.creator, signal.community].filter(Boolean).join(" "); }
function aliasPresent(text, alias) {
  const a = norm(alias);
  if (!a) return false;
  const value = norm(text);
  if (a.includes(" ")) return ` ${value} `.includes(` ${a} `);
  return new Set(tokens(value)).has(a);
}
function semanticAnchors(signal) {
  const text = signalText(signal);
  return semanticGroups.filter((group) => group.aliases.some((alias) => aliasPresent(text, alias))).map((group) => group.id);
}
function sharedSemantic(signals) {
  if (signals.length < 2) return [];
  let shared = new Set(semanticAnchors(signals[0]));
  for (const signal of signals.slice(1)) shared = new Set([...shared].filter((anchor) => semanticAnchors(signal).includes(anchor)));
  return [...shared];
}

async function main() {
  const signalArtifact = JSON.parse(await readFile(signalPath, "utf8"));
  const reportArtifact = JSON.parse(await readFile(reportPath, "utf8"));
  const signalMaps = new Map((signalArtifact.workspaces ?? []).map((entry) => [entry.workspace.id, new Map((entry.signals ?? []).map((signal) => [signal.id, signal]))]));
  const workspaces = (reportArtifact.workspaces ?? []).map((report) => {
    const signalMap = signalMaps.get(report.workspace.id) ?? new Map();
    const candidates = (report.candidates ?? []).map((candidate) => {
      const signals = (candidate.signalIds ?? []).map((id) => signalMap.get(id)).filter(Boolean);
      const trace = candidate.resolutionTrace04f ?? {};
      const subjectAnchors = distinct(trace.subjectAnchors ?? []);
      const baselineAnchors = distinct(trace.baselineResolutionAnchors ?? []);
      const semanticSupportAnchors = sharedSemantic(signals);
      const resolutionAnchors = distinct([...baselineAnchors, ...subjectAnchors]);
      if (!resolutionAnchors.length) return null;
      const confidence = { ...(candidate.confidence ?? {}) };
      if (Array.isArray(confidence.factors)) confidence.factors = confidence.factors.map((factor) => factor.key === "resolution-trace" ? { ...factor, note: resolutionAnchors.slice(0, 6).join(", ") } : factor);
      return {
        ...candidate,
        resolutionAnchors,
        resolutionTrace04f: {
          ...trace,
          methodologyVersion: "workspace-resolution-04f.v1-remediated",
          subjectAnchors,
          semanticAnchors: semanticSupportAnchors,
          semanticSupportOnly: true,
          rationale: [...(trace.rationale ?? []), "Semantic aliases are recomputed with token/phrase boundaries; short aliases such as AI cannot match inside unrelated words.", "Semantic anchors are support-only and are excluded from primary resolutionAnchors."],
        },
        confidence,
      };
    }).filter(Boolean);
    const candidateCount = candidates.filter((candidate) => candidate.status === "candidate").length;
    const corroboratedCount = candidates.filter((candidate) => candidate.status === "corroborated").length;
    return { ...report, candidates, candidateCount, corroboratedCount, quality: { ...(report.quality ?? {}), crossSourceCandidateCount: candidates.length, independentlyCorroboratedCount: corroboratedCount }, resolutionFinalization04f: { methodologyVersion: "workspace-resolution-04f-finalization.v1", semanticBoundaryRevalidated: true, candidateCount: candidates.length } };
  });
  const next = { ...reportArtifact, methodologyVersion: "workspace-resolution-04f.v1-remediated", workspaces, notes: [...(reportArtifact.notes ?? []), "04F finalization revalidates semantic aliases with token/phrase boundaries and excludes semantic support terms from primary resolution anchors."] };
  await writeFile(reportPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log("04F intelligence finalization complete.");
  for (const report of workspaces) console.log(`- ${report.workspace.name}: ${report.candidates.length} cross-source candidate(s) · ${report.corroboratedCount} corroborated · semantic boundary revalidated`);
}

main().catch((error) => { console.error(error instanceof Error ? error.stack : error); process.exit(1); });
