import type {
  ParityAnalytics,
  RwaMarketPairsData,
  RwaQuoteLatestItem,
  TokenParityRow,
  TokenParityStatus,
  VenueFragmentation,
} from "@/lib/cmc/types";

/**
 * Computes institutional parity, spread, and issuer-concentration metrics
 * for a tokenized Real-World Asset across all competing on-chain issuers.
 *
 * Automatically identifies and excludes unit-mismatched fractional tokens
 * (e.g., 1-gram gold tokens priced ~1/31.1x vs 1-troy-oz benchmark) and
 * zero-liquidity derivative placeholders from inter-issuer spread calculations.
 */
export function computeParityMetrics(quote: RwaQuoteLatestItem): ParityAnalytics {
  const tokens = quote.tokens ?? [];
  const averagePrice =
    quote.average_tokenized_price > 0
      ? quote.average_tokenized_price
      : tokens.length > 0
        ? tokens.reduce((sum, t) => sum + (t.price || 0), 0) / tokens.length
        : 0;

  const hasLiquidTokens = tokens.some(
    (t) => (t.market_cap || 0) > 0 || (t.volume_24h || 0) > 0
  );

  const classifyToken = (t: RwaQuoteLatestItem["tokens"][number]): TokenParityStatus => {
    if (!Number.isFinite(t.price) || t.price <= 0) return "NO_LIQUIDITY";
    if (hasLiquidTokens && (t.market_cap || 0) <= 0 && (t.volume_24h || 0) <= 0) {
      return "NO_LIQUIDITY";
    }
    if (averagePrice > 0 && (t.price < averagePrice * 0.5 || t.price > averagePrice * 2)) {
      return "UNIT_MISMATCH";
    }
    return "INCLUDED";
  };

  const classified = tokens.map((token) => ({
    token,
    parityStatus: classifyToken(token),
  }));

  const comparableTokens = classified
    .filter((c) => c.parityStatus === "INCLUDED")
    .map((c) => c.token);
  const pricedFallback = tokens.filter((t) => Number.isFinite(t.price) && t.price > 0);
  const spreadSample = comparableTokens.length > 0 ? comparableTokens : pricedFallback;

  const prices = spreadSample.map((t) => t.price);
  const minPrice = prices.length > 0 ? Math.min(...prices) : averagePrice;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : averagePrice;

  const totalTokenMarketCap = tokens.reduce((sum, t) => sum + Math.max(0, t.market_cap || 0), 0);
  const totalTokenVolume24h = tokens.reduce((sum, t) => sum + Math.max(0, t.volume_24h || 0), 0);

  const mcapDenominator =
    totalTokenMarketCap > 0 ? totalTokenMarketCap : Math.max(1, quote.tokenized_market_cap || 1);
  const volDenominator =
    totalTokenVolume24h > 0 ? totalTokenVolume24h : Math.max(1, quote.tokenized_volume_24h || 1);

  const issuerCapMap = new Map<string, { name: string; cap: number }>();
  for (const token of tokens) {
    if (hasLiquidTokens && (token.market_cap || 0) <= 0 && (token.volume_24h || 0) <= 0) {
      continue;
    }
    const key = token.issuer_id || token.issuer_name || "Unknown Issuer";
    const prev = issuerCapMap.get(key);
    issuerCapMap.set(key, {
      name: prev?.name || token.issuer_name || "Unknown Issuer",
      cap: (prev?.cap ?? 0) + Math.max(0, token.market_cap || 0),
    });
  }

  const pricedIssuerKeys = new Set(
    spreadSample.map((t) => t.issuer_id || t.issuer_name || "Unknown Issuer")
  );
  const hasMultiIssuerPricing = pricedIssuerKeys.size >= 2;

  const spreadBps =
    hasMultiIssuerPricing && averagePrice > 0
      ? ((maxPrice - minPrice) / averagePrice) * 10_000
      : 0;

  let grade: ParityAnalytics["grade"] = "SINGLE_ISSUER";
  if (hasMultiIssuerPricing) {
    if (spreadBps < 15) grade = "TIGHT";
    else if (spreadBps <= 50) grade = "MODERATE";
    else grade = "WIDE";
  }

  let hhiScore = 0;
  let dominantIssuer = tokens[0]?.issuer_name ?? "N/A";
  let dominantIssuerSharePct = 0;

  if (issuerCapMap.size > 0) {
    const issuerSum = Array.from(issuerCapMap.values()).reduce((a, b) => a + b.cap, 0);
    for (const { name: issuerName, cap } of issuerCapMap.values()) {
      const sharePct = issuerSum > 0 ? (cap / issuerSum) * 100 : 100 / issuerCapMap.size;
      hhiScore += sharePct * sharePct;
      if (sharePct > dominantIssuerSharePct) {
        dominantIssuerSharePct = sharePct;
        dominantIssuer = issuerName;
      }
    }
  }

  const roundedHhi = Math.round(hhiScore);
  const concentrationLabel: ParityAnalytics["concentrationLabel"] =
    roundedHhi >= 5000 ? "CONCENTRATED" : roundedHhi >= 2500 ? "MODERATE" : "DIVERSIFIED";

  const rows: TokenParityRow[] = classified
    .map(({ token: t, parityStatus }) => {
      const deviationBps =
        averagePrice > 0 && t.price > 0 ? ((t.price - averagePrice) / averagePrice) * 10_000 : 0;
      const marketCapSharePct = (Math.max(0, t.market_cap || 0) / mcapDenominator) * 100;
      const volumeSharePct = (Math.max(0, t.volume_24h || 0) / volDenominator) * 100;
      const turnoverPct = t.market_cap > 0 ? (t.volume_24h / t.market_cap) * 100 : 0;
      return {
        ...t,
        deviationBps,
        marketCapSharePct,
        volumeSharePct,
        turnoverPct,
        parityStatus,
      };
    })
    .sort((a, b) => b.market_cap - a.market_cap);

  const effectiveMcap = totalTokenMarketCap || quote.tokenized_market_cap || 0;
  const effectiveVol = totalTokenVolume24h || quote.tokenized_volume_24h || 0;
  const turnoverRatioPct = effectiveMcap > 0 ? (effectiveVol / effectiveMcap) * 100 : 0;

  return {
    averagePrice,
    minPrice,
    maxPrice,
    spreadBps,
    grade,
    issuerCount: issuerCapMap.size,
    comparableTokenCount: comparableTokens.length,
    excludedTokenCount: tokens.length - comparableTokens.length,
    hhiScore: roundedHhi,
    concentrationLabel,
    dominantIssuer,
    dominantIssuerSharePct,
    totalTokenMarketCap: effectiveMcap,
    totalTokenVolume24h: effectiveVol,
    turnoverRatioPct,
    tokens: rows,
  };
}

/**
 * Measures exchange liquidity fragmentation and cross-venue price dispersion
 * from /v5/real-world-assets/market-pairs/list.
 */
export function computeVenueFragmentation(pairsData: RwaMarketPairsData): VenueFragmentation {
  const pairs = pairsData.market_pairs ?? [];
  const venueMap = new Map<
    string,
    { pairCount: number; volume24h: number; weightedPriceSum: number; simplePriceSum: number }
  >();

  let totalVenueVolume24h = 0;
  const pricedPairs: Array<{ price: number; volume: number }> = [];

  for (const pair of pairs) {
    const usdQuote = pair.quotes?.find((q) => q.symbol === "USD") ?? pair.quotes?.[0];
    const rawPrice = usdQuote?.price ?? pair.exchange_reported_quotes?.price ?? 0;
    const rawVolume = usdQuote?.volume_24h ?? pair.exchange_reported_quotes?.volume_24h_quote ?? 0;
    const price = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 0;
    const volume = Number.isFinite(rawVolume) && rawVolume > 0 ? rawVolume : 0;

    if (price > 0) pricedPairs.push({ price, volume });
    totalVenueVolume24h += volume;

    const exchangeName = pair.exchange?.name || "Unknown Venue";
    const prev = venueMap.get(exchangeName) ?? {
      pairCount: 0,
      volume24h: 0,
      weightedPriceSum: 0,
      simplePriceSum: 0,
    };
    venueMap.set(exchangeName, {
      pairCount: prev.pairCount + 1,
      volume24h: prev.volume24h + volume,
      weightedPriceSum: prev.weightedPriceSum + price * volume,
      simplePriceSum: prev.simplePriceSum + price,
    });
  }

  const byExchange = Array.from(venueMap.entries())
    .map(([exchangeName, stats]) => ({
      exchangeName,
      pairCount: stats.pairCount,
      volume24h: stats.volume24h,
      sharePct: totalVenueVolume24h > 0 ? (stats.volume24h / totalVenueVolume24h) * 100 : 0,
      avgPrice:
        stats.volume24h > 0
          ? stats.weightedPriceSum / stats.volume24h
          : stats.pairCount > 0
            ? stats.simplePriceSum / stats.pairCount
            : 0,
    }))
    .sort((a, b) => b.volume24h - a.volume24h);

  const topVenue = byExchange[0];
  let priceSpreadAcrossVenuesBps = 0;
  if (pricedPairs.length >= 2) {
    // Ignore illiquid dust pairs when enough active venues exist so outliers do not skew spread
    const minVolFloor =
      totalVenueVolume24h > 0 ? Math.max(100, totalVenueVolume24h * 0.001) : 0;
    const liquidPairs =
      minVolFloor > 0 ? pricedPairs.filter((p) => p.volume >= minVolFloor) : pricedPairs;
    const sample = liquidPairs.length >= 2 ? liquidPairs : pricedPairs;

    const minP = Math.min(...sample.map((p) => p.price));
    const maxP = Math.max(...sample.map((p) => p.price));
    const sampleVol = sample.reduce((sum, p) => sum + p.volume, 0);
    const refP =
      sampleVol > 0
        ? sample.reduce((sum, p) => sum + p.price * p.volume, 0) / sampleVol
        : sample.reduce((sum, p) => sum + p.price, 0) / sample.length;
    if (refP > 0) {
      priceSpreadAcrossVenuesBps = ((maxP - minP) / refP) * 10_000;
    }
  }

  return {
    totalPairs: pairsData.num_market_pairs || pairs.length,
    uniqueExchanges: byExchange.length,
    totalVenueVolume24h,
    topExchangeName: topVenue?.exchangeName ?? "N/A",
    topExchangeSharePct: topVenue?.sharePct ?? 0,
    priceSpreadAcrossVenuesBps,
    byExchange,
  };
}

export function formatCurrency(value: number, compact = false): string {
  if (!Number.isFinite(value)) return "$0.00";
  if (compact) {
    const abs = Math.abs(value);
    if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  }
  const decimals = Math.abs(value) >= 1000 ? 2 : Math.abs(value) >= 1 ? 2 : 4;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatBps(bps: number, signed = false): string {
  if (!Number.isFinite(bps)) return "0.0 bps";
  const prefix = signed && bps > 0 ? "+" : "";
  return `${prefix}${bps.toFixed(1)} bps`;
}

export function formatPercent(pct: number, signed = false): string {
  if (!Number.isFinite(pct)) return "0.00%";
  const prefix = signed && pct > 0 ? "+" : "";
  return `${prefix}${pct.toFixed(2)}%`;
}

export function formatAssetTypeLabel(type: string): string {
  switch (type) {
    case "stock":
      return "Equities";
    case "commodity":
      return "Commodities";
    case "government_security":
      return "Gov Securities";
    case "etf":
      return "ETFs";
    case "currency":
      return "FX / Currencies";
    case "real_estate":
      return "Real Estate";
    default:
      return type;
  }
}
