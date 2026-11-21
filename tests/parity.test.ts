import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { computeParityMetrics, computeVenueFragmentation } from "@/lib/analytics/parity";
import type { RwaMarketPairsData, RwaQuoteLatestItem } from "@/lib/cmc/types";

function makeBaseQuote(overrides: Partial<RwaQuoteLatestItem> = {}): RwaQuoteLatestItem {
  return {
    rwa_id: 1,
    name: "Gold",
    symbol: "GOLD",
    slug: "gold",
    asset_type: "commodity",
    rwa_rank: 1,
    has_tokens: true,
    average_tokenized_price: 2000,
    tokenized_market_cap: 1_000_000,
    tokenized_volume_24h: 100_000,
    last_updated: "2026-11-21T18:00:00.000Z",
    tokens: [],
    tradfi_markets: [],
    ...overrides,
  };
}

test("computeParityMetrics calculates tight multi-issuer spread and balanced HHI", () => {
  const quote = makeBaseQuote({
    average_tokenized_price: 2000,
    tokens: [
      {
        symbol: "XAUt",
        name: "Tether Gold",
        price: 1999,
        crypto_id: 5176,
        issuer_id: "issuer-a",
        issuer_name: "Tether",
        market_cap: 500_000,
        volume_24h: 60_000,
      },
      {
        symbol: "PAXG",
        name: "PAX Gold",
        price: 2001,
        crypto_id: 4705,
        issuer_id: "issuer-b",
        issuer_name: "Paxos",
        market_cap: 500_000,
        volume_24h: 40_000,
      },
    ],
  });

  const res = computeParityMetrics(quote);
  assert.equal(res.grade, "TIGHT");
  assert.equal(res.issuerCount, 2);
  assert.equal(res.hhiScore, 5000);
  assert.equal(res.concentrationLabel, "CONCENTRATED");
  assert.ok(Math.abs(res.spreadBps - 10) < 0.001, `expected 10 bps, got ${res.spreadBps}`);
  assert.equal(res.tokens.length, 2);
});

test("computeParityMetrics treats multiple tokens from one issuer_id as SINGLE_ISSUER", () => {
  const quote = makeBaseQuote({
    average_tokenized_price: 100,
    tokens: [
      {
        symbol: "NVDAX",
        name: "Backed NVDA xStock",
        price: 99.5,
        crypto_id: 101,
        issuer_id: "same-issuer-id",
        issuer_name: "Backed Assets",
        market_cap: 600_000,
        volume_24h: 50_000,
      },
      {
        symbol: "bNVDA",
        name: "Backed NVDA",
        price: 101.0,
        crypto_id: 102,
        issuer_id: "same-issuer-id",
        issuer_name: "Backed Assets AG",
        market_cap: 400_000,
        volume_24h: 30_000,
      },
    ],
  });

  const res = computeParityMetrics(quote);
  assert.equal(res.issuerCount, 1);
  assert.equal(res.grade, "SINGLE_ISSUER");
  assert.equal(res.spreadBps, 0);
  assert.equal(res.hhiScore, 10000);
  assert.equal(res.dominantIssuerSharePct, 100);
});

test("computeParityMetrics handles empty tokens gracefully without NaN", () => {
  const quote = makeBaseQuote({ average_tokenized_price: 0, tokenized_market_cap: 0, tokens: [] });
  const res = computeParityMetrics(quote);
  assert.equal(res.grade, "SINGLE_ISSUER");
  assert.equal(res.hhiScore, 0);
  assert.equal(res.turnoverRatioPct, 0);
  assert.ok(Number.isFinite(res.spreadBps));
});

test("computeVenueFragmentation filters illiquid outlier dust pairs from cross-venue spread", () => {
  const makePair = (id: number, exchangeName: string, price: number, volume: number) => ({
    exchange: { exchange_id: id, name: exchangeName, slug: exchangeName.toLowerCase() },
    market_id: id,
    market_pair: "PAXG/USDT",
    category: "spot",
    fee_type: "percentage",
    market_pair_base: { crypto_id: 4705, symbol: "PAXG", exchange_symbol: "PAXG", currency_type: "cryptocurrency" },
    market_pair_quotes: { crypto_id: 825, symbol: "USDT", exchange_symbol: "USDT", currency_type: "cryptocurrency" },
    exchange_reported_quotes: { price, volume_24h_base: 1, volume_24h_quote: volume, last_updated: "2026-11-21T18:00:00Z" },
    quotes: [{ crypto_id: 2781, symbol: "USD", price, volume_24h: volume, last_updated: "2026-11-21T18:00:00Z" }],
  });

  const pairsData: RwaMarketPairsData = {
    rwa_id: 1,
    name: "Gold",
    symbol: "GOLD",
    num_market_pairs: 3,
    total_size: 3,
    has_more: false,
    market_pairs: [
      makePair(1, "Binance", 4400, 100_000_000),
      makePair(2, "Kraken", 4404.4, 50_000_000),
      // Illiquid dust pair with wildly stale/manipulated price
      makePair(3, "TinyDEX", 6000, 25),
    ],
  };

  const frag = computeVenueFragmentation(pairsData);
  assert.equal(frag.uniqueExchanges, 3);
  assert.equal(frag.topExchangeName, "Binance");
  // Spread across Binance (4400) and Kraken (4404.4) is ~10 bps, NOT ~3600 bps from TinyDEX
  assert.ok(
    frag.priceSpreadAcrossVenuesBps > 9 && frag.priceSpreadAcrossVenuesBps < 11,
    `expected ~10 bps after dust filter, got ${frag.priceSpreadAcrossVenuesBps}`
  );
});

test("computeParityMetrics excludes unit-scaled 1g gold tokens and zero-liquidity derivatives on live CMC Gold payload", () => {
  const evidencePath = path.resolve(process.cwd(), "evidence", "live-api-evidence.json");
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  const rwaQuoteEntry = evidence.results.find(
    (r: { name: string }) => r.name === "RWA Quotes Latest"
  );
  assert.ok(rwaQuoteEntry, "Expected RWA Quotes Latest entry in evidence/live-api-evidence.json");

  const goldQuote = rwaQuoteEntry.responseSample.data.rwa_assets[0] as RwaQuoteLatestItem;
  const res = computeParityMetrics(goldQuote);

  const cgo = res.tokens.find((t) => t.symbol === "CGO");
  const vnxau = res.tokens.find((t) => t.symbol === "VNXAU");
  const deriv = res.tokens.find((t) => t.symbol === "XAU");
  const paxg = res.tokens.find((t) => t.symbol === "PAXG");

  assert.equal(cgo?.parityStatus, "UNIT_MISMATCH");
  assert.equal(vnxau?.parityStatus, "UNIT_MISMATCH");
  assert.equal(deriv?.parityStatus, "NO_LIQUIDITY");
  assert.equal(paxg?.parityStatus, "INCLUDED");
  assert.equal(res.excludedTokenCount, 3);
  assert.equal(res.grade, "MODERATE");
  assert.ok(
    res.spreadBps > 30 && res.spreadBps < 60,
    `Expected realistic 1oz gold spread (~45.8 bps), got ${res.spreadBps}`
  );
});

test("computeParityMetrics excludes 4x pre-split equity tokens (e.g. SpaceX $532 vs $130) as UNIT_MISMATCH", () => {
  const quote = makeBaseQuote({
    rwa_id: 9,
    name: "SpaceX",
    symbol: "SPCX",
    asset_type: "stock",
    average_tokenized_price: 130.62,
    tokens: [
      {
        symbol: "SPCXB",
        name: "SpaceX bStocks",
        price: 130.61,
        crypto_id: 40217,
        issuer_id: "bstocks",
        issuer_name: "bStocks",
        market_cap: 109_862_024,
        volume_24h: 15_243_387,
      },
      {
        symbol: "SPCXx",
        name: "SpaceX Backed",
        price: 130.66,
        crypto_id: 40218,
        issuer_id: "backed",
        issuer_name: "Backed Assets",
        market_cap: 74_248_690,
        volume_24h: 7_879_449,
      },
      {
        symbol: "SPACEX",
        name: "SpaceX PreStocks (4x pre-split)",
        price: 532.1,
        crypto_id: 37656,
        issuer_id: "prestocks",
        issuer_name: "PreStocks Assets",
        market_cap: 3_898_361,
        volume_24h: 0,
      },
    ],
  });

  const res = computeParityMetrics(quote);
  assert.equal(res.tokens.find((t) => t.symbol === "SPACEX")?.parityStatus, "UNIT_MISMATCH");
  assert.equal(res.excludedTokenCount, 1);
  assert.equal(res.grade, "TIGHT");
  assert.ok(res.spreadBps < 10, `Expected tight spread after excluding 4x pre-split, got ${res.spreadBps}`);
});
