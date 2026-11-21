import { NextRequest, NextResponse } from "next/server";
import { computeParityMetrics, computeVenueFragmentation } from "@/lib/analytics/parity";
import {
  fetchRwaInfo,
  fetchRwaMarketPairs,
  fetchRwaQuoteLatest,
  resolveEffectiveApiKey,
} from "@/lib/cmc/client";
import type { DataSourceMode, RwaDetailResponse } from "@/lib/cmc/types";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const rwaId = Number(id);
  if (!Number.isInteger(rwaId) || rwaId < 1) {
    return NextResponse.json(
      { error: "Invalid rwa_id parameter. Must be a positive integer." },
      { status: 400 }
    );
  }

  const overrideKey = request.headers.get("x-user-cmc-key");
  const apiKey = resolveEffectiveApiKey(overrideKey);
  const bypassCache = request.nextUrl.searchParams.get("refresh") === "1";

  const [quoteRes, infoRes, pairsRes] = await Promise.all([
    fetchRwaQuoteLatest(rwaId, apiKey, bypassCache),
    fetchRwaInfo(rwaId, apiKey, bypassCache),
    fetchRwaMarketPairs(rwaId, apiKey, bypassCache),
  ]);

  const traces = [quoteRes.trace, infoRes.trace, pairsRes.trace];

  if (!quoteRes.data) {
    return NextResponse.json(
      {
        error: `RWA asset #${rwaId} could not be retrieved from CoinMarketCap or reference snapshots.`,
        traces,
      },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const emptyPairsData = {
    rwa_id: quoteRes.data.rwa_id,
    name: quoteRes.data.name,
    symbol: quoteRes.data.symbol,
    num_market_pairs: 0,
    market_pairs: [],
    total_size: 0,
    has_more: false,
  };

  // Never mix stale snapshot pairs into a live Pro RWA quote page
  const pairsData =
    quoteRes.mode === "live_pro" && pairsRes.mode !== "live_pro"
      ? emptyPairsData
      : (pairsRes.data ?? emptyPairsData);

  const parity = computeParityMetrics(quoteRes.data);
  const fragmentation = computeVenueFragmentation(pairsData);

  const mode: DataSourceMode = traces.some((t) => t.mode === "live_pro")
    ? "live_pro"
    : "snapshot";

  const payload: RwaDetailResponse = {
    mode,
    quote: quoteRes.data,
    info: infoRes.data,
    pairs: pairsData,
    pairsPlanRestricted: pairsRes.planRestricted,
    pairsNote: pairsRes.planRestricted
      ? "CoinMarketCap /v5/real-world-assets/market-pairs/list requires a Startup+ plan (HTTP 403 / code 1006). Displaying live per-token 24h liquidity shares from /v5/real-world-assets/quotes/latest."
      : undefined,
    parity,
    fragmentation,
    traces,
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(payload, {
    headers: overrideKey ? { "Cache-Control": "no-store" } : undefined,
  });
}
