#!/usr/bin/env node
/**
 * ParityLens — Live CoinMarketCap API Verification & Evidence Capture Script
 *
 * Reads CMC_PRO_API_KEY from environment or .env.local (never printed or saved),
 * executes real HTTP requests against the integrated CoinMarketCap endpoints,
 * and saves sanitized responses to evidence/live-api-evidence.json.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ENV_LOCAL = path.join(ROOT, ".env.local");
const EVIDENCE_DIR = path.join(ROOT, "evidence");
const EVIDENCE_FILE = path.join(EVIDENCE_DIR, "live-api-evidence.json");

function loadEnvLocalKey() {
  if (process.env.CMC_PRO_API_KEY?.trim()) return process.env.CMC_PRO_API_KEY.trim();
  if (!fs.existsSync(ENV_LOCAL)) return "";
  const content = fs.readFileSync(ENV_LOCAL, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key === "CMC_PRO_API_KEY" && val) return val;
  }
  return "";
}

function redactPayload(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const clone = structuredClone(payload);
  if (clone.data && typeof clone.data === "object" && !Array.isArray(clone.data)) {
    for (const [k, v] of Object.entries(clone.data)) {
      if (Array.isArray(v) && v.length > 3) {
        clone.data[k] = v.slice(0, 3);
        clone.data[`_${k}_truncated_from`] = v.length;
      }
    }
  } else if (Array.isArray(clone.data) && clone.data.length > 3) {
    clone.data = clone.data.slice(0, 3);
  }
  return clone;
}

async function callEndpoint({ name, pathWithQuery, apiKey, keyless }) {
  const base = apiKey
    ? "https://pro-api.coinmarketcap.com"
    : "https://pro-api.coinmarketcap.com/public-api";
  const url = `${base}${pathWithQuery}`;
  const headers = { Accept: "application/json" };
  if (apiKey) headers["X-CMC_PRO_API_KEY"] = apiKey;

  const startedAt = Date.now();
  const res = await fetch(url, { headers });
  const json = await res.json();
  const elapsedMs = json?.status?.elapsed ?? Date.now() - startedAt;
  const ok = res.ok && String(json?.status?.error_code) === "0";

  return {
    name,
    endpoint: apiKey ? pathWithQuery : `/public-api${pathWithQuery}`,
    mode: apiKey ? "live_pro" : keyless ? "live_keyless" : "skipped",
    httpStatus: res.status,
    ok,
    elapsedMs,
    creditCount: json?.status?.credit_count ?? 0,
    errorCode: json?.status?.error_code ?? null,
    errorMessage: json?.status?.error_message ?? null,
    timestamp: json?.status?.timestamp ?? new Date().toISOString(),
    responseSample: redactPayload(json),
  };
}

async function main() {
  const apiKey = loadEnvLocalKey();
  const modeLabel = apiKey ? "Authenticated CMC Pro API" : "Keyless Public API (no key set)";
  console.log(`\nParityLens CMC Verification — Mode: ${modeLabel}\n`);

  const results = [];

  if (apiKey) {
    // 1-4: Core RWA discovery endpoints
    const mapRes = await callEndpoint({
      name: "RWA ID Map",
      pathWithQuery: "/v5/real-world-assets/map?sort=rwa_rank&limit=10",
      apiKey,
    });
    results.push(mapRes);

    const listRes = await callEndpoint({
      name: "RWA Assets List",
      pathWithQuery:
        "/v5/real-world-assets/assets/list?sort=tokenized_market_cap&sort_dir=desc&limit=10&convert=USD",
      apiKey,
    });
    results.push(listRes);

    const sampleRwaId = listRes.responseSample?.data?.rwa_assets?.[0]?.rwa_id ?? 1;

    results.push(
      await callEndpoint({
        name: "RWA Quotes Latest",
        pathWithQuery: `/v5/real-world-assets/quotes/latest?rwa_id=${sampleRwaId}&convert=USD`,
        apiKey,
      })
    );

    results.push(
      await callEndpoint({
        name: "RWA Metadata Info",
        pathWithQuery: `/v5/real-world-assets/info?rwa_id=${sampleRwaId}`,
        apiKey,
      })
    );

    results.push(
      await callEndpoint({
        name: "RWA Market Pairs",
        pathWithQuery: `/v5/real-world-assets/market-pairs/list?rwa_id=${sampleRwaId}&limit=10&convert=USD`,
        apiKey,
      })
    );

    const issuersListRes = await callEndpoint({
      name: "RWA Issuers List",
      pathWithQuery: "/v5/real-world-assets/issuers/list?active=true&limit=10",
      apiKey,
    });
    results.push(issuersListRes);

    const sampleIssuerId =
      issuersListRes.responseSample?.data?.issuers?.[0]?.issuer_id ??
      "6878977dcbbf471de3366e85";

    results.push(
      await callEndpoint({
        name: "RWA Single Issuer",
        pathWithQuery: `/v5/real-world-assets/issuers?issuer_id=${sampleIssuerId}&limit=10`,
        apiKey,
      })
    );

    results.push(
      await callEndpoint({
        name: "Key Info",
        pathWithQuery: "/v1/key/info",
        apiKey,
      })
    );
  } else {
    console.log(
      "Note: Set CMC_PRO_API_KEY in .env.local to capture live HTTP 200 evidence for all 7 RWA v5 endpoints.\n"
    );
  }

  // Standard / Keyless context endpoints
  results.push(
    await callEndpoint({
      name: "Crypto Quotes Latest v3",
      pathWithQuery: "/v3/cryptocurrency/quotes/latest?id=1,1027,5426,825&convert=USD",
      apiKey,
      keyless: true,
    })
  );

  results.push(
    await callEndpoint({
      name: "Global Metrics Latest",
      pathWithQuery: "/v1/global-metrics/quotes/latest?convert=USD",
      apiKey,
      keyless: true,
    })
  );

  results.push(
    await callEndpoint({
      name: "CMC Fear & Greed Latest",
      pathWithQuery: "/v3/fear-and-greed/latest",
      apiKey,
      keyless: true,
    })
  );

  for (const r of results) {
    const icon = r.ok ? "PASS" : "FAIL";
    console.log(
      `[${icon}] ${r.httpStatus} | ${String(r.elapsedMs).padStart(4)}ms | ${r.creditCount}cr | ${r.endpoint}`
    );
    if (!r.ok && r.errorMessage) {
      console.log(`       -> (${r.errorCode}) ${r.errorMessage}`);
    }
  }

  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const summary = {
    project: "ParityLens",
    capturedAt: new Date().toISOString(),
    mode: apiKey ? "live_pro" : "live_keyless",
    passedCount: results.filter((r) => r.ok).length,
    totalTested: results.length,
    results,
  };
  fs.writeFileSync(EVIDENCE_FILE, JSON.stringify(summary, null, 2));
  console.log(`\nSaved sanitized API evidence to ${path.relative(ROOT, EVIDENCE_FILE)}\n`);
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
