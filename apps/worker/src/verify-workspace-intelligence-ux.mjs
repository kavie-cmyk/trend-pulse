import fs from "node:fs";

const page = fs.readFileSync("apps/web/app/page.tsx", "utf8");
const shell = fs.readFileSync("apps/web/app/workspace-intelligence-04e.tsx", "utf8");
const styles = fs.readFileSync("apps/web/app/intelligence-navigation.css", "utf8");

const failures = [];

function requireText(haystack, needle, message) {
  if (!haystack.includes(needle)) failures.push(message);
}

requireText(page, 'import WorkspaceIntelligence04E from "./workspace-intelligence-04e";', "Homepage must render the 04E Workspace Intelligence shell.");
if (/import\s+(BackboneSignals|BrandProfileConsole|LiveSignals|PermissionlessSocialSignals|SocialSignals|SourceIntelligencePanel|TrendCandidates|TrendHistory|IntelligenceOutput)/.test(page)) {
  failures.push("Homepage must not directly stack engineering intelligence panels outside the report shell.");
}

for (const marker of [
  "View Intelligence",
  "WORKSPACE INTELLIGENCE · 04E",
  "Overview",
  "Trends",
  "Sources",
  "Brand Profile",
  "LATEST WORKSPACE INTELLIGENCE",
  "Weak signals",
  "Cross-source candidates",
  "RUNTIME-SYNCED",
  "BROWSER-ONLY",
  "workspace-intelligence.json",
  "Global Pulse candidate count",
]) {
  requireText(shell, marker, `Workspace Intelligence 04E shell is missing required marker: ${marker}`);
}

if (shell.includes('fetch("./data/trend-candidates.json"')) failures.push("Workspace report must not use the global Trend Candidate artifact as its primary count.");
requireText(styles, ".workspaceConsole > .signalSection", "Legacy Workspace engineering signal section must be hidden from the primary UX.");
requireText(styles, ".workspaceConsole > .nextStep", "Legacy Workspace stage-next block must be hidden from the primary UX.");
requireText(styles, ".intelligenceTabs", "Report tab navigation styles are missing.");
requireText(styles, ".intelligenceCta", "View Intelligence CTA styles are missing.");

if (failures.length) {
  console.error("Stage 05A-UX / 04E navigation verification FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Workspace Intelligence UX verification PASS · Workspace → View Intelligence → runtime-sync guard → workspace-scoped Overview/Trends/Sources/Brand Profile · no Global Pulse trend-count substitution.");
