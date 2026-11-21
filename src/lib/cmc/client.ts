import {
  SNAPSHOT_CRYPTO_BENCHMARKS,
  SNAPSHOT_FEAR_AND_GREED,
  SNAPSHOT_GLOBAL_METRICS,
  SNAPSHOT_ISSUERS,
  SNAPSHOT_RWA_INFO,
  SNAPSHOT_RWA_LIST,
  SNAPSHOT_RWA_MAP,
  SNAPSHOT_RWA_QUOTES,
  getSnapshotIssuerDetail,
  getSnapshotMarketPairs,
} from "./snapshot";
import type {
  ApiTraceEntry,
  CmcStatus,
  CryptoQuoteItem,
  DataSourceMode,
  FearAndGreedSummary,
  GlobalMetricsSummary,
  KeyInfoSummary,
  RwaInfoItem,
  RwaIssuerDetail,
  RwaIssuerSummary,
  RwaListItem,
  RwaMapItem,
  RwaMarketPairsData,
  RwaQuoteLatestItem,
} from "./types";

const CMC_PRO_BASE = "https://pro-api.coinmarketcap.com";
const CMC_KEYLESS_BASE = "https://pro-api.coinmarketcap.com/public-api";

interface CacheRecord<T> {
  expiresAt: number;
  value: T;
  trace: ApiTraceEntry;
}

const MAX_CACHE_ENTRIES = 200;
const serverCache = new Map<string, CacheRecord<unknown>>();

export function clearServerCache(): void {
  serverCache.clear();
}

function getServerCache<T>(key: string): CacheRecord<T> | null {
  const cached = serverCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    serverCache.delete(key);
    return null;
  }
  // Refresh insertion order for lightweight LRU behavior
  serverCache.delete(key);
  serverCache.set(key, cached);
  return cached as CacheRecord<T>;
}

function setServerCache<T>(key: string, record: CacheRecord<T>): void {
  const now = Date.now();
  if (serverCache.size >= MAX_CACHE_ENTRIES) {
    for (const [k, v] of serverCache.entries()) {
      if (v.expiresAt <= now) serverCache.delete(k);
    }
  }
  while (serverCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = serverCache.keys().next().value;
    if (oldestKey === undefined) break;
    serverCache.delete(oldestKey);
  }
  serverCache.delete(key);
  serverCache.set(key, record);
}

function getDefaultTtlMs(): number {
  const parsed = Number(process.env.CMC_CACHE_TTL_SECONDS ?? "60");
  return Number.isFinite(parsed) && parsed >= 10 ? parsed * 1000 : 60_000;
}

/**
 * CoinMarketCap Keyless endpoints return error_code as string "0",
 * while authenticated Pro endpoints return numeric 0. Normalize both.
 */
export function isCmcSuccess(status?: Partial<CmcStatus>): boolean {
  if (!status) return false;
  return String(status.error_code) === "0";
}

export function summarizePayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  try {
    const serialized = JSON.stringify(payload);
    if (serialized.length <= 1600) return payload;
    if (Array.isArray(payload)) {
      return {
        items: payload.slice(0, 2),
        _total_returned: payload.length,
      };
    }
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) {
      return {
        status: obj.status,
        data: obj.data.slice(0, 2),
        _total_returned: obj.data.length,
      };
    }
    if (obj.data && typeof obj.data === "object") {
      const dataObj = obj.data as Record<string, unknown>;
      const trimmed: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(dataObj)) {
        if (Array.isArray(val)) {
          trimmed[key] = val.slice(0, 2);
          trimmed[`_${key}_total_returned`] = val.length;
        } else {
          trimmed[key] = val;
        }
      }
      return { status: obj.status, data: trimmed };
    }
    return payload;
  } catch {
    return { note: "Unable to serialize preview payload" };
  }
}

export function resolveEffectiveApiKey(overrideKey?: string | null): string | null {
  const candidate = (overrideKey ?? process.env.CMC_PRO_API_KEY ?? "").trim();
  return candidate.length > 0 ? candidate : null;
}

interface FetchCmcOptions {
  endpoint: string;
  query?: Record<string, string | number | boolean | undefined>;
  apiKey: string | null;
  supportsKeyless?: boolean;
  ttlMs?: number;
  bypassCache?: boolean;
}

interface FetchCmcResult<T> {
  ok: boolean;
  data: T | null;
  status?: CmcStatus;
  trace: ApiTraceEntry;
}

async function fetchCmcEndpoint<T>(options: FetchCmcOptions): Promise<FetchCmcResult<T>> {
  const {
    endpoint,
    query = {},
    apiKey,
    supportsKeyless = false,
    ttlMs = getDefaultTtlMs(),
    bypassCache = false,
  } = options;

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  const queryString = params.toString();
  const usePro = Boolean(apiKey);
  const useKeyless = !usePro && supportsKeyless;

  if (!usePro && !useKeyless) {
    return {
      ok: false,
      data: null,
      trace: {
        id: `${endpoint}:${queryString}:${Date.now()}`,
        endpoint,
        query: queryString,
        mode: "snapshot",
        httpStatus: 200,
        elapsedMs: 0,
        creditCount: 0,
        cached: false,
        timestamp: new Date().toISOString(),
        note: "Pro API key not configured — serving schema-verified reference snapshot",
        samplePayload: null,
      },
    };
  }

  const mode: DataSourceMode = usePro ? "live_pro" : "live_keyless";
  // Key cache by mode (not raw API key string) when using server key; skip shared cache for BYOK override
  const cacheKey = `${mode}:${endpoint}?${queryString}`;
  const isServerKey = apiKey === (process.env.CMC_PRO_API_KEY ?? "").trim();

  if (!bypassCache && (useKeyless || isServerKey)) {
    const cached = getServerCache<T>(cacheKey);
    if (cached) {
      return {
        ok: true,
        data: cached.value,
        trace: { ...cached.trace, cached: true },
      };
    }
  }

  const base = usePro ? CMC_PRO_BASE : CMC_KEYLESS_BASE;
  const url = `${base}${endpoint}${queryString ? `?${queryString}` : ""}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (usePro && apiKey) {
    headers["X-CMC_PRO_API_KEY"] = apiKey;
  }

  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });

    const rawText = await response.text();
    let json: { data?: T; status?: CmcStatus } | null = null;
    try {
      json = JSON.parse(rawText) as { data?: T; status?: CmcStatus };
    } catch {
      json = null;
    }
    const elapsedMs = json?.status?.elapsed ?? Date.now() - startedAt;

    if (response.ok && isCmcSuccess(json?.status) && json?.data !== undefined) {
      const trace: ApiTraceEntry = {
        id: `${endpoint}:${queryString}:${Date.now()}`,
        endpoint: usePro ? endpoint : `/public-api${endpoint}`,
        query: queryString,
        mode,
        httpStatus: response.status,
        elapsedMs,
        creditCount: json.status?.credit_count ?? 1,
        cached: false,
        timestamp: json.status?.timestamp ?? new Date().toISOString(),
        samplePayload: summarizePayload(json),
      };

      if (useKeyless || isServerKey) {
        setServerCache(cacheKey, {
          expiresAt: Date.now() + ttlMs,
          value: json.data,
          trace,
        });
      }

      return {
        ok: true,
        data: json.data,
        status: json.status,
        trace,
      };
    }

    return {
      ok: false,
      data: null,
      status: json?.status,
      trace: {
        id: `${endpoint}:${queryString}:${Date.now()}`,
        endpoint: usePro ? endpoint : `/public-api${endpoint}`,
        query: queryString,
        mode: "snapshot",
        httpStatus: response.status,
        elapsedMs,
        creditCount: json?.status?.credit_count ?? 0,
        cached: false,
        timestamp: new Date().toISOString(),
        note: `Fallback to snapshot (CMC error ${json?.status?.error_code ?? response.status}: ${json?.status?.error_message ?? response.statusText})`,
        samplePayload: json ? summarizePayload(json) : { rawPreview: rawText.slice(0, 240) },
      },
    };
  } catch (err) {
    return {
      ok: false,
      data: null,
      trace: {
        id: `${endpoint}:${queryString}:${Date.now()}`,
        endpoint,
        query: queryString,
        mode: "snapshot",
        httpStatus: 0,
        elapsedMs: Date.now() - startedAt,
        creditCount: 0,
        cached: false,
        timestamp: new Date().toISOString(),
        note: `Network timeout/error — serving snapshot (${err instanceof Error ? err.message : "unknown"})`,
        samplePayload: null,
      },
    };
  }
}

// ============================================================
// 7 CoinMarketCap RWA v5 Endpoints
// ============================================================

export async function fetchRwaMap(apiKey: string | null, bypassCache = false) {
  const res = await fetchCmcEndpoint<{
    rwa_assets: RwaMapItem[];
    total_size: number;
    has_more: boolean;
  }>({
    endpoint: "/v5/real-world-assets/map",
    query: { sort: "rwa_rank", limit: 100 },
    apiKey,
    ttlMs: 300_000,
    bypassCache,
  });

  if (res.ok && res.data) {
    return { data: res.data, mode: res.trace.mode, trace: res.trace };
  }

  const fallback = {
    rwa_assets: SNAPSHOT_RWA_MAP,
    total_size: SNAPSHOT_RWA_MAP.length,
    has_more: false,
  };
  return {
    data: fallback,
    mode: "snapshot" as DataSourceMode,
    trace: { ...res.trace, samplePayload: summarizePayload({ data: fallback }) },
  };
}

export async function fetchRwaAssetsList(
  apiKey: string | null,
  options?: { assetType?: string; limit?: number; sort?: string; sortDir?: string },
  bypassCache = false
) {
  const res = await fetchCmcEndpoint<{
    rwa_assets: RwaListItem[];
    total_size: number;
    has_more: boolean;
  }>({
    endpoint: "/v5/real-world-assets/assets/list",
    query: {
      asset_type: options?.assetType || undefined,
      sort: options?.sort || "tokenized_market_cap",
      sort_dir: options?.sortDir || "desc",
      limit: options?.limit ?? 100,
      convert: "USD",
    },
    apiKey,
    ttlMs: 60_000,
    bypassCache,
  });

  if (res.ok && res.data) {
    return { data: res.data, mode: res.trace.mode, trace: res.trace };
  }

  const filtered = options?.assetType
    ? SNAPSHOT_RWA_LIST.filter((a) => a.asset_type === options.assetType)
    : SNAPSHOT_RWA_LIST;
  const fallback = {
    rwa_assets: [...filtered].sort((a, b) => b.tokenized_market_cap - a.tokenized_market_cap),
    total_size: filtered.length,
    has_more: false,
  };
  return {
    data: fallback,
    mode: "snapshot" as DataSourceMode,
    trace: { ...res.trace, samplePayload: summarizePayload({ data: fallback }) },
  };
}

export async function fetchRwaQuoteLatest(
  rwaId: number,
  apiKey: string | null,
  bypassCache = false
) {
  const res = await fetchCmcEndpoint<{ rwa_assets: RwaQuoteLatestItem[] }>({
    endpoint: "/v5/real-world-assets/quotes/latest",
    query: { rwa_id: rwaId, convert: "USD" },
    apiKey,
    ttlMs: 60_000,
    bypassCache,
  });

  if (res.ok && res.data?.rwa_assets?.[0]) {
    return {
      data: res.data.rwa_assets[0],
      mode: res.trace.mode,
      trace: res.trace,
    };
  }

  const fallback = SNAPSHOT_RWA_QUOTES.find((q) => q.rwa_id === rwaId) ?? null;
  return {
    data: fallback,
    mode: "snapshot" as DataSourceMode,
    trace: {
      ...res.trace,
      mode: "snapshot" as DataSourceMode,
      note:
        fallback !== null
          ? res.trace.note
          : res.trace.note ?? `RWA #${rwaId} not found in live response or reference snapshot`,
      samplePayload: summarizePayload({ data: { rwa_assets: fallback ? [fallback] : [] } }),
    },
  };
}

export async function fetchRwaInfo(
  rwaId: number,
  apiKey: string | null,
  bypassCache = false
) {
  const res = await fetchCmcEndpoint<{ rwa_assets: RwaInfoItem[] }>({
    endpoint: "/v5/real-world-assets/info",
    query: { rwa_id: rwaId },
    apiKey,
    ttlMs: 300_000,
    bypassCache,
  });

  if (res.ok && res.data?.rwa_assets?.[0]) {
    return {
      data: res.data.rwa_assets[0],
      mode: res.trace.mode,
      trace: res.trace,
    };
  }

  const fallback = SNAPSHOT_RWA_INFO[rwaId] ?? null;
  return {
    data: fallback,
    mode: "snapshot" as DataSourceMode,
    trace: { ...res.trace, samplePayload: summarizePayload({ data: { rwa_assets: fallback ? [fallback] : [] } }) },
  };
}

export async function fetchRwaMarketPairs(
  rwaId: number,
  apiKey: string | null,
  bypassCache = false
) {
  const res = await fetchCmcEndpoint<RwaMarketPairsData>({
    endpoint: "/v5/real-world-assets/market-pairs/list",
    query: { rwa_id: rwaId, sort: "volume_24h", sort_dir: "desc", limit: 50, convert: "USD" },
    apiKey,
    ttlMs: 60_000,
    bypassCache,
  });

  if (res.ok && res.data) {
    return {
      data: res.data,
      mode: res.trace.mode,
      planRestricted: false,
      trace: res.trace,
    };
  }

  const planRestricted =
    res.trace.httpStatus === 403 || String(res.status?.error_code) === "1006";

  // When a live Pro key hits a Startup+ tier restriction (403 / 1006), do not mix
  // stale snapshot prices into live RWA quotes.
  if (planRestricted) {
    return {
      data: null as RwaMarketPairsData | null,
      mode: "snapshot" as DataSourceMode,
      planRestricted: true,
      trace: {
        ...res.trace,
        mode: "snapshot" as DataSourceMode,
        note: "Endpoint requires CoinMarketCap Startup+ plan (HTTP 403 / code 1006) — showing live token-level liquidity instead",
      },
    };
  }

  const fallback = getSnapshotMarketPairs(rwaId);
  return {
    data: fallback,
    mode: "snapshot" as DataSourceMode,
    planRestricted: false,
    trace: {
      ...res.trace,
      mode: "snapshot" as DataSourceMode,
      samplePayload: summarizePayload({ data: fallback }),
    },
  };
}

export async function fetchRwaIssuersList(apiKey: string | null, bypassCache = false) {
  const res = await fetchCmcEndpoint<{
    issuers: RwaIssuerSummary[];
    total_size: number;
    has_more: boolean;
  }>({
    endpoint: "/v5/real-world-assets/issuers/list",
    query: { active: true, limit: 100 },
    apiKey,
    ttlMs: 300_000,
    bypassCache,
  });

  if (res.ok && res.data) {
    return { data: res.data, mode: res.trace.mode, trace: res.trace };
  }

  const fallback = {
    issuers: SNAPSHOT_ISSUERS,
    total_size: SNAPSHOT_ISSUERS.length,
    has_more: false,
  };
  return {
    data: fallback,
    mode: "snapshot" as DataSourceMode,
    trace: { ...res.trace, samplePayload: summarizePayload({ data: fallback }) },
  };
}

export async function fetchRwaIssuerDetail(
  issuerId: string,
  apiKey: string | null,
  bypassCache = false
) {
  const res = await fetchCmcEndpoint<RwaIssuerDetail>({
    endpoint: "/v5/real-world-assets/issuers",
    query: { issuer_id: issuerId, limit: 100 },
    apiKey,
    ttlMs: 300_000,
    bypassCache,
  });

  if (res.ok && res.data) {
    return { data: res.data, mode: res.trace.mode, trace: res.trace };
  }

  const fallback = getSnapshotIssuerDetail(issuerId);
  return {
    data: fallback,
    mode: "snapshot" as DataSourceMode,
    trace: {
      ...res.trace,
      mode: "snapshot" as DataSourceMode,
      note:
        fallback !== null
          ? res.trace.note
          : res.trace.note ?? `Issuer ${issuerId} not found in live response or reference snapshot`,
      samplePayload: summarizePayload({ data: fallback }),
    },
  };
}

// ============================================================
// 4 Standard / Keyless CMC Context Endpoints
// ============================================================

export interface RawV3UsdQuote {
  id?: number;
  symbol?: string;
  price?: number;
  volume_24h?: number;
  percent_change_24h?: number;
  percent_change_7d?: number;
  market_cap?: number;
  last_updated?: string;
}

export interface RawV3Quote {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  cmc_rank?: number;
  last_updated?: string;
  quote?: RawV3UsdQuote[] | Record<string, RawV3UsdQuote | undefined>;
}

/**
 * CoinMarketCap /v3/cryptocurrency/quotes/latest returns `quote` as an array of
 * conversion objects (`[{ id: 2781, symbol: "USD", price, ... }]`), whereas v1/v2
 * endpoints return a keyed map (`{ USD: { price, ... } }`). Support both cleanly.
 */
export function parseV3CryptoQuotes(
  rawData: RawV3Quote[] | Record<string, RawV3Quote>
): CryptoQuoteItem[] {
  const rawList: RawV3Quote[] = Array.isArray(rawData) ? rawData : Object.values(rawData);
  const parsed: CryptoQuoteItem[] = [];

  for (const item of rawList) {
    if (!item || !item.quote) continue;
    let usd: RawV3UsdQuote | undefined;
    if (Array.isArray(item.quote)) {
      usd =
        item.quote.find((q) => q?.symbol === "USD" || q?.id === 2781) ??
        item.quote[0];
    } else if (typeof item.quote === "object") {
      usd = item.quote.USD ?? Object.values(item.quote).find(Boolean);
    }

    if (!usd || typeof usd.price !== "number" || !Number.isFinite(usd.price)) continue;

    parsed.push({
      id: item.id,
      name: item.name,
      symbol: item.symbol,
      slug: item.slug,
      cmc_rank: item.cmc_rank,
      price: usd.price,
      volume_24h: usd.volume_24h ?? 0,
      percent_change_24h: usd.percent_change_24h ?? 0,
      percent_change_7d: usd.percent_change_7d ?? 0,
      market_cap: usd.market_cap ?? 0,
      last_updated: usd.last_updated ?? item.last_updated ?? new Date().toISOString(),
    });
  }

  return parsed;
}

export async function fetchCryptoBenchmarks(apiKey: string | null, bypassCache = false) {
  // Stable CoinMarketCap IDs: 1=BTC, 1027=ETH, 5426=SOL, 825=USDT
  const res = await fetchCmcEndpoint<RawV3Quote[] | Record<string, RawV3Quote>>({
    endpoint: "/v3/cryptocurrency/quotes/latest",
    query: { id: "1,1027,5426,825", convert: "USD" },
    apiKey,
    supportsKeyless: true,
    ttlMs: 60_000,
    bypassCache,
  });

  if (res.ok && res.data) {
    const parsed = parseV3CryptoQuotes(res.data);
    if (parsed.length > 0) {
      return { data: parsed, mode: res.trace.mode, trace: res.trace };
    }
  }

  return {
    data: SNAPSHOT_CRYPTO_BENCHMARKS,
    mode: "snapshot" as DataSourceMode,
    trace: {
      ...res.trace,
      mode: "snapshot" as DataSourceMode,
      note:
        res.trace.note ??
        "Unexpected /v3/cryptocurrency/quotes/latest payload shape — serving snapshot fallback",
      samplePayload: summarizePayload({ data: SNAPSHOT_CRYPTO_BENCHMARKS }),
    },
  };
}

interface RawGlobalMetrics {
  btc_dominance?: number;
  eth_dominance?: number;
  active_cryptocurrencies?: number;
  last_updated?: string;
  quote?: {
    USD?: {
      total_market_cap?: number;
      total_volume_24h?: number;
      last_updated?: string;
    };
  };
}

export async function fetchGlobalMetrics(apiKey: string | null, bypassCache = false) {
  const res = await fetchCmcEndpoint<RawGlobalMetrics>({
    endpoint: "/v1/global-metrics/quotes/latest",
    query: { convert: "USD" },
    apiKey,
    supportsKeyless: true,
    ttlMs: 120_000,
    bypassCache,
  });

  if (res.ok && res.data) {
    const parsed: GlobalMetricsSummary = {
      btc_dominance: res.data.btc_dominance ?? 0,
      eth_dominance: res.data.eth_dominance ?? 0,
      active_cryptocurrencies: res.data.active_cryptocurrencies ?? 0,
      total_market_cap: res.data.quote?.USD?.total_market_cap ?? 0,
      total_volume_24h: res.data.quote?.USD?.total_volume_24h ?? 0,
      last_updated:
        res.data.quote?.USD?.last_updated ?? res.data.last_updated ?? new Date().toISOString(),
    };
    return { data: parsed, mode: res.trace.mode, trace: res.trace };
  }

  return {
    data: SNAPSHOT_GLOBAL_METRICS,
    mode: "snapshot" as DataSourceMode,
    trace: { ...res.trace, samplePayload: summarizePayload({ data: SNAPSHOT_GLOBAL_METRICS }) },
  };
}

export async function fetchFearAndGreed(apiKey: string | null, bypassCache = false) {
  const res = await fetchCmcEndpoint<FearAndGreedSummary>({
    endpoint: "/v3/fear-and-greed/latest",
    apiKey,
    supportsKeyless: true,
    ttlMs: 300_000,
    bypassCache,
  });

  if (res.ok && res.data && typeof res.data.value === "number") {
    return { data: res.data, mode: res.trace.mode, trace: res.trace };
  }

  return {
    data: SNAPSHOT_FEAR_AND_GREED,
    mode: "snapshot" as DataSourceMode,
    trace: {
      ...res.trace,
      mode: "snapshot" as DataSourceMode,
      note: res.trace.note ?? "Unexpected Fear & Greed payload — serving snapshot fallback",
      samplePayload: summarizePayload({ data: SNAPSHOT_FEAR_AND_GREED }),
    },
  };
}

interface RawKeyInfo {
  plan?: {
    credit_limit_monthly?: number;
    rate_limit_minute?: number;
  };
  usage?: {
    current_month?: {
      credits_used?: number;
      credits_left?: number;
    };
  };
}

export async function fetchKeyInfo(apiKey: string | null, bypassCache = false) {
  if (!apiKey) {
    return { data: null as KeyInfoSummary | null, trace: null as ApiTraceEntry | null };
  }

  const res = await fetchCmcEndpoint<RawKeyInfo>({
    endpoint: "/v1/key/info",
    apiKey,
    ttlMs: 30_000,
    bypassCache,
  });

  if (res.ok && res.data) {
    const monthlyLimit = res.data.plan?.credit_limit_monthly ?? 0;
    const planName =
      monthlyLimit >= 5_000_000
        ? "Professional"
        : monthlyLimit >= 2_000_000
          ? "Growth"
          : monthlyLimit >= 400_000
            ? "Startup"
            : monthlyLimit >= 100_000
              ? "Builder"
              : "Basic";

    const summary: KeyInfoSummary = {
      plan_name: planName,
      credit_limit_monthly: monthlyLimit,
      credits_used_monthly: res.data.usage?.current_month?.credits_used ?? 0,
      credits_left_monthly: res.data.usage?.current_month?.credits_left ?? 0,
      rate_limit_minute: res.data.plan?.rate_limit_minute ?? 0,
    };
    return { data: summary, trace: res.trace };
  }

  return { data: null as KeyInfoSummary | null, trace: res.trace };
}
