export type DataSourceMode = "live_pro" | "live_keyless" | "snapshot";

export type RwaAssetType =
  | "stock"
  | "commodity"
  | "currency"
  | "government_security"
  | "etf"
  | "real_estate";

export interface CmcStatus {
  timestamp: string;
  error_code: number | string;
  error_message: string | null;
  elapsed: number;
  credit_count: number;
  notice?: string | null;
  total_count?: number;
}

export interface ApiTraceEntry {
  id: string;
  endpoint: string;
  query: string;
  mode: DataSourceMode;
  httpStatus: number;
  elapsedMs: number;
  creditCount: number;
  cached: boolean;
  timestamp: string;
  note?: string;
  samplePayload: unknown;
}

// 1. /v5/real-world-assets/map
export interface RwaMapItem {
  rwa_id: number;
  name: string;
  symbol: string;
  slug: string;
  asset_type: RwaAssetType;
  rwa_rank: number;
  has_tokens: boolean;
  first_historical_data?: string | null;
  last_historical_data?: string | null;
}

// 2. /v5/real-world-assets/info
export interface RwaInfoItem {
  rwa_id: number;
  name: string;
  symbol: string;
  slug: string;
  asset_type: RwaAssetType;
  rwa_rank: number;
  has_tokens: boolean;
  website: string | null;
  employees: number | null;
  founded: string | null;
  industry: string | null;
  cik: string | null;
  primary_exchange: string | null;
  about: {
    description: string | null;
    logo: string | null;
    website: string | null;
    date_added: string | null;
  };
}

// 3. /v5/real-world-assets/assets/list
export interface RwaQuoteConversion {
  symbol: string;
  crypto_id: number;
  average_tokenized_price: number;
  tokenized_market_cap: number;
  tokenized_volume_24h: number;
  last_updated: string;
}

export interface RwaListItem {
  rwa_id: number;
  name: string;
  symbol: string;
  slug: string;
  asset_type: RwaAssetType;
  rwa_rank: number;
  has_tokens: boolean;
  average_tokenized_price: number;
  tokenized_market_cap: number;
  tokenized_volume_24h: number;
  last_updated: string;
  quotes?: RwaQuoteConversion[];
}

// 4. /v5/real-world-assets/quotes/latest
export interface RwaUnderlyingToken {
  symbol: string;
  name: string;
  price: number;
  crypto_id: number;
  issuer_id: string;
  issuer_name: string;
  market_cap: number;
  volume_24h: number;
}

export interface RwaTradFiMarket {
  exchange: {
    slug: string;
    name: string;
    exchange_id: number;
  };
  ticker: string;
  market_url: string;
}

export interface RwaQuoteLatestItem extends RwaListItem {
  tokens: RwaUnderlyingToken[];
  tradfi_markets: RwaTradFiMarket[];
}

// 5. /v5/real-world-assets/market-pairs/list
export interface RwaMarketPair {
  exchange: {
    exchange_id: number;
    name: string;
    slug: string;
  };
  market_id: number;
  market_pair: string;
  category: string;
  fee_type: string;
  market_pair_base: {
    crypto_id: number;
    symbol: string;
    exchange_symbol: string;
    currency_type: string;
  };
  market_pair_quotes: {
    crypto_id: number;
    symbol: string;
    exchange_symbol: string;
    currency_type: string;
  };
  exchange_reported_quotes: {
    price: number;
    volume_24h_base: number;
    volume_24h_quote: number;
    last_updated: string;
  };
  quotes: Array<{
    crypto_id: number;
    symbol: string;
    price: number;
    volume_24h: number;
    last_updated: string;
  }>;
}

export interface RwaMarketPairsData {
  rwa_id: number;
  name: string;
  symbol: string;
  num_market_pairs: number;
  market_pairs: RwaMarketPair[];
  total_size: number;
  has_more: boolean;
}

// 6. /v5/real-world-assets/issuers/list
export interface RwaIssuerSummary {
  issuer_id: string;
  name: string;
  website: string | null;
  logo: string | null;
  num_tokens: number;
}

// 7. /v5/real-world-assets/issuers
export interface RwaIssuerLinkedToken {
  name: string;
  symbol: string;
  crypto_id: number;
  rwa_id: number;
}

export interface RwaIssuerDetail extends RwaIssuerSummary {
  tokens: RwaIssuerLinkedToken[];
  total_size: number;
  has_more: boolean;
}

// Standard CMC Endpoints (Context & Hybrid Portfolio)
export interface CryptoQuoteItem {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  cmc_rank?: number;
  price: number;
  volume_24h: number;
  percent_change_24h: number;
  percent_change_7d: number;
  market_cap: number;
  last_updated: string;
}

export interface GlobalMetricsSummary {
  btc_dominance: number;
  eth_dominance: number;
  active_cryptocurrencies: number;
  total_market_cap: number;
  total_volume_24h: number;
  last_updated: string;
}

export interface FearAndGreedSummary {
  value: number;
  value_classification: string;
  update_time: string;
}

export interface KeyInfoSummary {
  plan_name: string;
  credit_limit_monthly: number;
  credits_used_monthly: number;
  credits_left_monthly: number;
  rate_limit_minute: number;
}

// Aggregated API responses for ParityLens UI
export interface OverviewResponse {
  mode: DataSourceMode;
  proKeyConfigured: boolean;
  rwaAssets: RwaListItem[];
  rwaTotalCount: number;
  rwaMapTotal: number;
  issuers: RwaIssuerSummary[];
  issuersTotal: number;
  cryptoBenchmarks: CryptoQuoteItem[];
  globalMetrics: GlobalMetricsSummary;
  fearAndGreed: FearAndGreedSummary;
  keyInfo: KeyInfoSummary | null;
  traces: ApiTraceEntry[];
  generatedAt: string;
}

export interface TokenParityRow {
  symbol: string;
  name: string;
  crypto_id: number;
  issuer_id: string;
  issuer_name: string;
  price: number;
  market_cap: number;
  volume_24h: number;
  deviationBps: number;
  marketCapSharePct: number;
  volumeSharePct: number;
  turnoverPct: number;
}

export interface ParityAnalytics {
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  spreadBps: number;
  grade: "TIGHT" | "MODERATE" | "WIDE" | "SINGLE_ISSUER";
  issuerCount: number;
  hhiScore: number;
  concentrationLabel: "DIVERSIFIED" | "MODERATE" | "CONCENTRATED";
  dominantIssuer: string;
  dominantIssuerSharePct: number;
  totalTokenMarketCap: number;
  totalTokenVolume24h: number;
  turnoverRatioPct: number;
  tokens: TokenParityRow[];
}

export interface VenueFragmentation {
  totalPairs: number;
  uniqueExchanges: number;
  totalVenueVolume24h: number;
  topExchangeName: string;
  topExchangeSharePct: number;
  priceSpreadAcrossVenuesBps: number;
  byExchange: Array<{
    exchangeName: string;
    pairCount: number;
    volume24h: number;
    sharePct: number;
    avgPrice: number;
  }>;
}

export interface RwaDetailResponse {
  mode: DataSourceMode;
  quote: RwaQuoteLatestItem;
  info: RwaInfoItem | null;
  pairs: RwaMarketPairsData;
  parity: ParityAnalytics;
  fragmentation: VenueFragmentation;
  traces: ApiTraceEntry[];
  generatedAt: string;
}

export interface IssuerDetailResponse {
  mode: DataSourceMode;
  issuer: RwaIssuerDetail;
  linkedAssets: Array<RwaIssuerLinkedToken & { rwa?: RwaListItem }>;
  traces: ApiTraceEntry[];
  generatedAt: string;
}
