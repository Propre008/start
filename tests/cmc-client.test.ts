import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  clearServerCache,
  fetchRwaIssuerDetail,
  fetchRwaMarketPairs,
  fetchRwaQuoteLatest,
  isCmcSuccess,
  parseV3CryptoQuotes,
  summarizePayload,
} from "@/lib/cmc/client";

test("isCmcSuccess normalizes numeric 0 and string '0' while rejecting error codes", () => {
  assert.equal(isCmcSuccess({ error_code: 0 }), true);
  assert.equal(isCmcSuccess({ error_code: "0" }), true);
  assert.equal(isCmcSuccess({ error_code: 1022 }), false);
  assert.equal(isCmcSuccess({ error_code: "1001" }), false);
  assert.equal(isCmcSuccess(undefined), false);
});

test("parseV3CryptoQuotes parses real CMC v3 array-shaped quote payload from evidence", () => {
  const evidencePath = path.resolve(process.cwd(), "evidence", "live-api-evidence.json");
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  const v3Entry = evidence.results.find((r: { name: string }) => r.name === "Crypto Quotes Latest v3");
  assert.ok(v3Entry, "Expected Crypto Quotes Latest v3 entry in evidence/live-api-evidence.json");

  const parsed = parseV3CryptoQuotes(v3Entry.responseSample.data);
  assert.ok(parsed.length >= 3, `Expected at least 3 parsed quotes, got ${parsed.length}`);

  const rawBtc = v3Entry.responseSample.data.find((c: { symbol: string }) => c.symbol === "BTC");
  const btc = parsed.find((c) => c.symbol === "BTC");
  assert.ok(rawBtc && btc, "Expected BTC to be present and parsed");
  assert.equal(btc.price, rawBtc.quote[0].price);
  assert.ok(btc.market_cap > 1e11, "Expected BTC market cap > $100B");
  assert.equal(btc.percent_change_24h, rawBtc.quote[0].percent_change_24h);
});

test("parseV3CryptoQuotes also supports legacy keyed quote objects", () => {
  const parsed = parseV3CryptoQuotes({
    "1": {
      id: 1,
      name: "Bitcoin",
      symbol: "BTC",
      slug: "bitcoin",
      quote: {
        USD: {
          price: 75000,
          volume_24h: 25_000_000_000,
          percent_change_24h: 2.5,
          percent_change_7d: 5.1,
          market_cap: 1_480_000_000_000,
        },
      },
    },
  });

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].price, 75000);
  assert.equal(parsed[0].percent_change_24h, 2.5);
});

test("summarizePayload truncates large array data without turning it into an object", () => {
  const bigItems = Array.from({ length: 10 }, (_, idx) => ({
    id: idx,
    pad: "x".repeat(300),
  }));
  const summarized = summarizePayload({ status: { error_code: 0 }, data: bigItems }) as {
    data: unknown[];
    _total_returned: number;
  };

  assert.equal(Array.isArray(summarized.data), true);
  assert.equal(summarized.data.length, 2);
  assert.equal(summarized._total_returned, 10);
});

test("snapshot fallbacks return null for unknown rwa_id / issuer_id instead of fabricating Gold", async () => {
  clearServerCache();
  const knownRwa = await fetchRwaQuoteLatest(1, null);
  assert.equal(knownRwa.data?.rwa_id, 1);

  const missingRwa = await fetchRwaQuoteLatest(99999, null);
  assert.equal(missingRwa.data, null);
  assert.equal(missingRwa.trace.mode, "snapshot");

  const missingPairs = await fetchRwaMarketPairs(99999, null);
  assert.equal(missingPairs.data, null);

  const missingIssuer = await fetchRwaIssuerDetail("nonexistent-issuer-id", null);
  assert.equal(missingIssuer.data, null);
  assert.equal(missingIssuer.trace.mode, "snapshot");
});
