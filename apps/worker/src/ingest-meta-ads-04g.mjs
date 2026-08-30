import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPaidCreativeSnapshot, parseMetaAdsInput } from "./meta-ads-normalizer-04g.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const configPath = path.join(repoRoot, "apps/worker/config/stage04g-paid-creative.json");
const workspaceRegistryPath = path.join(repoRoot, "apps/worker/config/runtime-workspaces.json");
const outputPath = path.join(repoRoot, "apps/web/public/data/paid-creative-intelligence.json");

function args() {
  const parsed = { allowMissing: false, input: process.env.META_ADS_INPUT || "", workspaceId: process.env.META_ADS_WORKSPACE_ID || "" };
  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg === "--allow-missing") parsed.allowMissing = true;
    else if (arg === "--input") parsed.input = process.argv[++i] || "";
    else if (arg.startsWith("--input=")) parsed.input = arg.slice("--input=".length);
    else if (arg === "--workspace-id") parsed.workspaceId = process.argv[++i] || "";
    else if (arg.startsWith("--workspace-id=")) parsed.workspaceId = arg.slice("--workspace-id=".length);
  }
  return parsed;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveWorkspaceId(requested) {
  if (!requested) return undefined;
  const registry = JSON.parse(await readFile(workspaceRegistryPath, "utf8"));
  const match = (registry.workspaces ?? []).find((workspace) => workspace.id === requested);
  if (!match) throw new Error(`Unknown runtime Workspace ID: ${requested}. Refusing to fabricate workspaceId.`);
  return match.id;
}

async function main() {
  const cli = args();
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const defaultInput = path.join(repoRoot, config.runtime.defaultRawLogPath);
  const inputPath = path.resolve(repoRoot, cli.input || defaultInput);
  const workspaceId = await resolveWorkspaceId(cli.workspaceId);

  let inputText = "";
  if (await exists(inputPath)) {
    inputText = await readFile(inputPath, "utf8");
  } else if (!cli.allowMissing) {
    throw new Error(`Meta Ads input not found: ${inputPath}. Run the local webhook bridge or pass --allow-missing for CI/default output.`);
  }

  const parsed = parseMetaAdsInput(inputText);
  const snapshot = buildPaidCreativeSnapshot(parsed, config, {
    ...(workspaceId ? { workspaceId } : {}),
    inputPath: path.relative(repoRoot, inputPath),
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  console.log(`04G paid creative ingest ${snapshot.status}.`);
  console.log(`- input: ${snapshot.input.mode} · ${snapshot.input.recordsSeen} seen · ${snapshot.input.recordsAccepted} accepted · ${snapshot.input.recordsRejected} rejected`);
  console.log(`- output: ${snapshot.summary.signalCount} paid creative signal(s) · ${snapshot.summary.advertiserCount} advertiser(s)`);
  console.log(`- workspaceId: ${snapshot.input.workspaceId ?? "absent by design"}`);
  console.log(`Output: ${path.relative(repoRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
