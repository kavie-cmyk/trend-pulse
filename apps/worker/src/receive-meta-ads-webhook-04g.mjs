import crypto from "node:crypto";
import http from "node:http";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const config = JSON.parse(await readFile(path.join(repoRoot, "apps/worker/config/stage04g-paid-creative.json"), "utf8"));
const host = process.env.META_ADS_WEBHOOK_HOST || config.runtime.defaultWebhookHost;
const port = Number(process.env.META_ADS_WEBHOOK_PORT || config.runtime.defaultWebhookPort);
const route = process.env.META_ADS_WEBHOOK_PATH || config.runtime.defaultWebhookPath;
const secret = process.env.META_ADS_WEBHOOK_SECRET || "";
const maxBody = Number(config.runtime.maxWebhookBodyBytes || 5 * 1024 * 1024);
const logPath = path.resolve(repoRoot, process.env.META_ADS_WEBHOOK_LOG || config.runtime.defaultRawLogPath);

function timingSafeMatch(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function signatureValid(rawBody, provided) {
  if (!secret) return true;
  if (!provided) return false;
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  return timingSafeMatch(expected, provided);
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body) });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > maxBody) throw new Error("payload-too-large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      json(res, 200, {
        ok: true,
        stage: "04G",
        boundary: "experimental-local-sidecar",
        hmacRequired: Boolean(secret),
        scheduledCollection: false,
      });
      return;
    }
    if (req.method !== "POST" || req.url !== route) {
      json(res, 404, { ok: false, error: "not-found" });
      return;
    }

    const rawBody = await readBody(req);
    if (!signatureValid(rawBody, req.headers["x-webhook-signature"])) {
      json(res, 401, { ok: false, error: "invalid-signature" });
      return;
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      json(res, 400, { ok: false, error: "invalid-json" });
      return;
    }
    if (!payload || typeof payload !== "object" || !Array.isArray(payload.ads)) {
      json(res, 400, { ok: false, error: "expected-ads-array" });
      return;
    }

    await mkdir(path.dirname(logPath), { recursive: true });
    await appendFile(logPath, `${JSON.stringify({ receivedAt: new Date().toISOString(), payload })}\n`, "utf8");
    json(res, 202, { ok: true, acceptedAds: payload.ads.length });
  } catch (error) {
    if (error instanceof Error && error.message === "payload-too-large") {
      json(res, 413, { ok: false, error: "payload-too-large" });
      return;
    }
    console.error(error instanceof Error ? error.message : String(error));
    json(res, 500, { ok: false, error: "internal-error" });
  }
});

server.listen(port, host, () => {
  console.log(`Trend Pulse 04G Meta Ads webhook bridge listening on http://${host}:${port}${route}`);
  console.log(`Health: http://${host}:${port}/health`);
  console.log(`Raw payloads stay local at ${path.relative(repoRoot, logPath)}.`);
  console.log("This receiver does not scrape Meta. Configure meta-ads-scraper to send its webhook here.");
  if (!secret) console.log("HMAC verification is OFF. Set META_ADS_WEBHOOK_SECRET and use the same secret in the upstream webhook for signed local ingestion.");
});
