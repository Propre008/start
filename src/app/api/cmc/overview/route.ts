import { NextRequest, NextResponse } from "next/server";
import {
  fetchCryptoBenchmarks,
  fetchFearAndGreed,
  fetchGlobalMetrics,
  fetchKeyInfo,
  fetchRwaAssetsList,
  fetchRwaIssuersList,
  fetchRwaMap,
  resolveEffectiveApiKey,
} from "@/lib/cmc/client";
import type { ApiTraceEntry, DataSourceMode, OverviewResponse } from "@/lib/cmc/types";

export async function GET(request: NextRequest) {
  const overrideKey = request.headers.get("x-user-cmc-key");
  const apiKey = resolveEffectiveApiKey(overrideKey);
  const bypassCache = request.nextUrl.searchParams.get("refresh") === "1";

  const [rwaListRes, rwaMapRes, issuersRes, cryptoRes, globalRes, fgRes, keyInfoRes] =
    await Promise.all([
      fetchRwaAssetsList(apiKey, { limit: 100, sort: "tokenized_market_cap", sortDir: "desc" }, bypassCache),
      fetchRwaMap(apiKey, bypassCache),
      fetchRwaIssuersList(apiKey, bypassCache),
      fetchCryptoBenchmarks(apiKey, bypassCache),
      fetchGlobalMetrics(apiKey, bypassCache),
      fetchFearAndGreed(apiKey, bypassCache),
      fetchKeyInfo(apiKey, bypassCache),
    ]);

  const traces: ApiTraceEntry[] = [
    rwaListRes.trace,
    rwaMapRes.trace,
    issuersRes.trace,
    cryptoRes.trace,
    globalRes.trace,
    fgRes.trace,
    ...(keyInfoRes.trace ? [keyInfoRes.trace] : []),
  ];

  const hasLivePro = traces.some((t) => t.mode === "live_pro");
  const hasLiveKeyless = traces.some((t) => t.mode === "live_keyless");
  const mode: DataSourceMode = hasLivePro
    ? "live_pro"
    : hasLiveKeyless
      ? "live_keyless"
      : "snapshot";

  const payload: OverviewResponse = {
    mode,
    proKeyConfigured: Boolean(apiKey),
    rwaAssets: rwaListRes.data.rwa_assets,
    rwaTotalCount: rwaListRes.data.total_size,
    rwaMapTotal: rwaMapRes.data.total_size,
    issuers: issuersRes.data.issuers,
    issuersTotal: issuersRes.data.total_size,
    cryptoBenchmarks: cryptoRes.data,
    globalMetrics: globalRes.data,
    fearAndGreed: fgRes.data,
    keyInfo: keyInfoRes.data,
    traces,
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(payload, {
    headers: overrideKey ? { "Cache-Control": "no-store" } : undefined,
  });
}
