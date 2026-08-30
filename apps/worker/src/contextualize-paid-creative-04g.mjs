import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { contextualizePaidCreativeSnapshot } from "./paid-creative-context-04g.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const paidPath = path.join(repoRoot, "apps/web/public/data/paid-creative-intelligence.json");
const workspacePath = path.join(repoRoot, "apps/web/public/data/workspace-intelligence.json");

async function main() {
  const paid = JSON.parse(await readFile(paidPath, "utf8"));
  const workspace = JSON.parse(await readFile(workspacePath, "utf8"));
  const next = contextualizePaidCreativeSnapshot(paid, workspace);
  await writeFile(paidPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log(`04G paid creative context complete · ${next.summary.candidateContextLinkCount} candidate context link(s).`);
  console.log("Context links are non-promotional: candidate status/source diversity/corroboration are unchanged.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
