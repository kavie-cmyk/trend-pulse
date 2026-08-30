import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dataDir = path.join(repoRoot, "apps/web/public/data");
const files = ["backbone-signals.json", "social-signals.json", "permissionless-social-signals.json", "live-signals.json"];

function sanitizeSignal(signal) {
  if (!signal || signal.schemaVersion !== "signal.v1") return signal;
  if (signal.source?.sourceId === "github-rest-api" && signal.language) {
    const programmingLanguage = String(signal.language).trim();
    const keywords = new Set(signal.keywords ?? []);
    if (programmingLanguage) keywords.add(`programming-${programmingLanguage}`);
    const { language: _humanLanguage, ...rest } = signal;
    return {
      ...rest,
      keywords: [...keywords],
      confidence: {
        ...signal.confidence,
        basis: [
          ...(signal.confidence?.basis ?? []),
          "Contract sanitation: GitHub repository language is a programming-language attribute, not human-language evidence; it was moved to a programming-* keyword."
        ]
      }
    };
  }
  return signal;
}

function sanitizePayload(payload) {
  if (payload?.schemaVersion === "signal-batch.v1" && Array.isArray(payload.signals)) {
    return { ...payload, signals: payload.signals.map(sanitizeSignal) };
  }
  if (Array.isArray(payload?.batches)) {
    return { ...payload, batches: payload.batches.map((batch) => ({ ...batch, signals: Array.isArray(batch?.signals) ? batch.signals.map(sanitizeSignal) : batch?.signals })) };
  }
  return payload;
}

async function main() {
  let changed = 0;
  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const payload = JSON.parse(await readFile(filePath, "utf8"));
    const before = JSON.stringify(payload);
    const sanitized = sanitizePayload(payload);
    const after = JSON.stringify(sanitized);
    if (before !== after) changed += 1;
    await writeFile(filePath, `${JSON.stringify(sanitized, null, 2)}\n`, "utf8");
  }
  console.log(`Signal contract sanitation PASS · ${changed} artifact(s) changed.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
