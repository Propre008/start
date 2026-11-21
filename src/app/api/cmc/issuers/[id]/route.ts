import { NextRequest, NextResponse } from "next/server";
import {
  fetchRwaAssetsList,
  fetchRwaIssuerDetail,
  resolveEffectiveApiKey,
} from "@/lib/cmc/client";
import type { DataSourceMode, IssuerDetailResponse } from "@/lib/cmc/types";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
    return NextResponse.json(
      { error: "Invalid issuer_id parameter. Must be an alphanumeric identifier (1-64 chars)." },
      { status: 400 }
    );
  }

  const overrideKey = request.headers.get("x-user-cmc-key");
  const apiKey = resolveEffectiveApiKey(overrideKey);
  const bypassCache = request.nextUrl.searchParams.get("refresh") === "1";

  const [issuerRes, rwaListRes] = await Promise.all([
    fetchRwaIssuerDetail(id, apiKey, bypassCache),
    fetchRwaAssetsList(apiKey, { limit: 100 }, bypassCache),
  ]);

  const traces = [issuerRes.trace, rwaListRes.trace];

  if (!issuerRes.data) {
    return NextResponse.json(
      {
        error: `Issuer ${id} could not be retrieved from CoinMarketCap or reference snapshots.`,
        traces,
      },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const rwaById = new Map(rwaListRes.data.rwa_assets.map((a) => [a.rwa_id, a]));
  const linkedAssets = (issuerRes.data.tokens ?? []).map((token) => ({
    ...token,
    rwa: rwaById.get(token.rwa_id),
  }));

  const mode: DataSourceMode = traces.some((t) => t.mode === "live_pro")
    ? "live_pro"
    : "snapshot";

  const payload: IssuerDetailResponse = {
    mode,
    issuer: issuerRes.data,
    linkedAssets,
    traces,
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(payload, {
    headers: overrideKey ? { "Cache-Control": "no-store" } : undefined,
  });
}
