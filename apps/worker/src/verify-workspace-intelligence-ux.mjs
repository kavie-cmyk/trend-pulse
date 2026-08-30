import fs from "node:fs";

const page = fs.readFileSync("apps/web/app/page.tsx", "utf8");
const shell04f = fs.readFileSync("apps/web/app/workspace-intelligence-04f.tsx", "utf8");
const shell04e = fs.readFileSync("apps/web/app/workspace-intelligence-04e.tsx", "utf8");
const styles = fs.readFileSync("apps/web/app/intelligence-navigation.css", "utf8");

const failures = [];

function requireText(haystack, needle, message) {
  if (!haystack.includes(needle)) failures.push(message);
}

requireText(page, 'import WorkspaceIntelligence04F from "./workspace-intelligence-04f";', "Homepage must render the active 04F Workspace Intelligence shell.");
requireText(page, "<WorkspaceIntelligence04F />", "Homepage must mount the active 04F Workspace Intelligence shell.");
requireText(shell04e, "WORKSPACE INTELLIGENCE · 04E", "Historical 04E Workspace Intelligence shell must remain present for auditability.");
if (/import\s+(BackboneSignals|BrandProfileConsole|LiveSignals|PermissionlessSocialSignals|SocialSignals|SourceIntelligencePanel|TrendCandidates|TrendHistory|IntelligenceOutput)/.test(page)) {
  failures.push("Homepage must not directly stack engineering intelligence panels outside the report shell.");
}

for (const marker of [
  "View Intelligence",
  "WORKSPACE INTELLIGENCE · 04F",
  "Overview",
  "Trends",
  "Sources",
  "Brand Profile",
  "LATEST WORKSPACE INTELLIGENCE · 04F",
  "Weak signals",
  "Cross-source candidates",
  "Coverage classes",
  "Operational state vs current evidence",
  "RUNTIME-SYNCED",
  "BROWSER-ONLY",
  "workspace-intelligence.json",
  "Global Pulse",
]) {
  requireText(shell04f, marker, `Workspace Intelligence 04F shell is missing required marker: ${marker}`);
}

if (shell04f.includes('fetch("./data/trend-candidates.json"')) failures.push("Workspace report must not use the global Trend Candidate artifact as its primary count.");
requireText(styles, ".workspaceConsole > .signalSection", "Legacy Workspace engineering signal section must be hidden from the primary UX.");
requireText(styles, ".workspaceConsole > .nextStep", "Legacy Workspace stage-next block must be hidden from the primary UX.");
requireText(styles, ".intelligenceTabs", "Report tab navigation styles are missing.");
requireText(styles, ".intelligenceCta", "View Intelligence CTA styles are missing.");

if (failures.length) {
  console.error("Workspace Intelligence navigation verification FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Workspace Intelligence UX verification PASS · 04F active shell · 04E historical shell retained · Workspace → View Intelligence → runtime-sync guard → workspace-scoped Overview/Trends/Sources/Brand Profile · no Global Pulse trend-count substitution.");
