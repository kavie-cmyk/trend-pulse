import fs from "node:fs";

const page = fs.readFileSync("apps/web/app/page.tsx", "utf8");
const shell = fs.readFileSync("apps/web/app/workspace-intelligence.tsx", "utf8");
const styles = fs.readFileSync("apps/web/app/intelligence-navigation.css", "utf8");

const failures = [];

function requireText(haystack, needle, message) {
  if (!haystack.includes(needle)) failures.push(message);
}

requireText(page, 'import WorkspaceIntelligence from "./workspace-intelligence";', "Homepage must render the Workspace Intelligence shell.");
if (/import\s+(BackboneSignals|BrandProfileConsole|LiveSignals|PermissionlessSocialSignals|SocialSignals|SourceIntelligencePanel|TrendCandidates|TrendHistory|IntelligenceOutput)/.test(page)) {
  failures.push("Homepage must not directly stack engineering intelligence panels outside the report shell.");
}

for (const marker of [
  "View Intelligence",
  "WORKSPACE INTELLIGENCE",
  "Overview",
  "Trends",
  "Sources",
  "Brand Profile",
  "LATEST INTELLIGENCE",
  "Latest Trend Candidates",
  "WHAT CHANGED",
  "NOT COMPUTED",
  "trend-candidates.json",
  "trend-history.json",
]) {
  requireText(shell, marker, `Workspace Intelligence shell is missing required marker: ${marker}`);
}

requireText(styles, ".workspaceConsole > .signalSection", "Legacy Workspace engineering signal section must be hidden from the primary UX.");
requireText(styles, ".workspaceConsole > .nextStep", "Legacy Workspace stage-next block must be hidden from the primary UX.");
requireText(styles, ".intelligenceTabs", "Report tab navigation styles are missing.");
requireText(styles, ".intelligenceCta", "View Intelligence CTA styles are missing.");

if (failures.length) {
  console.error("Stage 05A-UX verification FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Stage 05A-UX verification PASS · Workspace → View Intelligence → Overview/Trends/Sources/Brand Profile · legacy engineering stack removed from primary homepage flow.");
