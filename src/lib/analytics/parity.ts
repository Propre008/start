import type {
  ParityAnalytics,
  RwaMarketPairsData,
  RwaQuoteLatestItem,
  TokenParityRow,
  VenueFragmentation,
} from "@/lib/cmc/types";

/**
 * Computes institutional parity, spread, and issuer-concentration metrics
 * for a tokenized Real-World Asset across all competing on-chain issuers.
 */
export function computeParityMetrics(quote: RwaQuoteLatestItem): ParityAnalytics {
  const tokens = quote.tokens ?? [];
  const averagePrice =
    quote.average_tokenized_price > 0
      ? quote.average_tokenized_price
      : tokens.length > 0
        ? tokens.reduce((sum, t) => sum + (t.price || 0), 0) / tokens.length
        : 0;

  const pricedTokens = tokens.filter((t) => Number.isFinite(t.price) && t.price > 0);
  const prices = pricedTokens.map((t) => t.price);
  const minPrice = prices.length > 0 ? Math.min(...prices) : averagePrice;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : averagePrice;

  const spreadBps =
    pricedTokens.length >= 2 && averagePrice > 0
      ? ((maxPrice - minPrice) / averagePrice) * 10_000
      : 0;

  let grade: ParityAnalytics["grade"] = "SINGLE_ISSUER";
  if (pricedTokens.length >= 2) {
    if (spreadBps < 15) grade = "TIGHT";
    else if (spreadBps <= 50) grade = "MODERATE";
    else grade = "WIDE";
  }

  const totalTokenMarketCap = tokens.reduce((sum, t) => sum + Math.max(0, t.market_cap || 0), 0);
  const totalTokenVolume24h = tokens.reduce((sum, t) => sum + Math.max(0, t.volume_24h || 0), 0);

  const mcapDenominator =
    totalTokenMarketCap > 0 ? totalTokenMarketCap : Math.max(1, quote.tokenized_market_cap || 1);
  const volDenominator =
    totalTokenVolume24h > 0 ? totalTokenVolume24h : Math.max(1, quote.tokenized_volume_24h || 1);

  const issuerCapMap = new Map<string, number>();
  for (const token of tokens) {
    const key = token.issuer_name || "Unknown Issuer";
    issuerCapMap.set(key, (issuerCapMap.get(key) ?? 0) + Math.max(0, token.market_cap || 0));
  }

  let hhiScore = 0;
  let dominantIssuer = tokens[0]?.issuer_name ?? "N/A";
  let dominantIssuerSharePct = 0;

  if (issuerCapMap.size > 0) {
    const issuerSum = Array.from(issuerCapMap.values()).reduce((a, b) => a + b, 0);
    for (const [issuerName, cap] of issuerCapMap.entries()) {
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

  const rows: TokenParityRow[] = tokens
    .map((t) => {
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
  const venuePrices: number[] = [];

  for (const pair of pairs) {
    const usdQuote = pair.quotes?.find((q) => q.symbol === "USD") ?? pair.quotes?.[0];
    const price = usdQuote?.price ?? pair.exchange_reported_quotes?.price ?? 0;
    const volume = usdQuote?.volume_24h ?? pair.exchange_reported_quotes?.volume_24h_quote ?? 0;

    if (price > 0) venuePrices.push(price);
    totalVenueVolume24h += Math.max(0, volume);

    const exchangeName = pair.exchange?.name || "Unknown Venue";
    const prev = venueMap.get(exchangeName) ?? {
      pairCount: 0,
      volume24h: 0,
      weightedPriceSum: 0,
      simplePriceSum: 0,
    };
    venueMap.set(exchangeName, {
      pairCount: prev.pairCount + 1,
      volume24h: prev.volume24h + Math.max(0, volume),
      weightedPriceSum: prev.weightedPriceSum + price * Math.max(0, volume),
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
  if (venuePrices.length >= 2) {
    const minP = Math.min(...venuePrices);
    const maxP = Math.max(...venuePrices);
    const avgP = venuePrices.reduce((a, b) => a + b, 0) / venuePrices.length;
    if (avgP > 0) {
      priceSpreadAcrossVenuesBps = ((maxP - minP) / avgP) * 10_000;
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
