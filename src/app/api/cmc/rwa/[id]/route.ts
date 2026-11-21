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

  const parity = computeParityMetrics(quoteRes.data);
  const fragmentation = computeVenueFragmentation(pairsRes.data);
  const traces = [quoteRes.trace, infoRes.trace, pairsRes.trace];

  const mode: DataSourceMode = traces.some((t) => t.mode === "live_pro")
    ? "live_pro"
    : "snapshot";

  const payload: RwaDetailResponse = {
    mode,
    quote: quoteRes.data,
    info: infoRes.data,
    pairs: pairsRes.data,
    parity,
    fragmentation,
    traces,
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(payload);
}
