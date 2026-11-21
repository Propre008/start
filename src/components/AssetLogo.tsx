"use client";

import { useState } from "react";
import type { RwaAssetType } from "@/lib/cmc/types";

/**
 * Verified official CoinMarketCap RWA 64x64 CDN icons
 * (https://s2.coinmarketcap.com/static/img/rwa/64x64/<hash>.png)
 */
const CMC_RWA_ICON_HASH_BY_SYMBOL: Record<string, string> = {
  GOLD: "68789ecbcbbf471de3367150",
  NVDA: "687899c0cbbf471de3366fae",
  AAPL: "68789a83cbbf471de3366fd7",
  GOOGL: "68789b89cbbf471de3367023",
  MSFT: "68789a43cbbf471de3366fca",
  AMZN: "68789af9cbbf471de3367004",
  SILVER: "6879f10fcbbf471de336bb8c",
  SPCX: "69f1b594240d36218d59e9c6",
  SPACEX: "69f1b594240d36218d59e9c6",
  ANT: "69f1b8f4240d36218d59ebaa",
};

/**
 * Verified official CoinMarketCap lead-token coin IDs for popular tokenized RWAs
 * (https://s2.coinmarketcap.com/static/img/coins/64x64/<id>.png)
 */
const CMC_RWA_LEAD_COIN_ID_BY_SYMBOL: Record<string, number> = {
  CRCL: 37005,
  QQQ: 37057,
  MSTR: 37003,
  SPY: 37006,
  TSLA: 37004,
  MU: 38014,
  INTC: 38035,
  SNDK: 39507,
  IVV: 38051,
  COIN: 36989,
  EUR: 20641,
  USTB: 26780,
};

/**
 * Official CMC issuer CDN logos & curated coin-icon fallbacks for issuers whose
 * API record returns `logo: null`.
 */
const CMC_ISSUER_LOGO_BY_NAME: Record<string, string> = {
  "tether holdings": "https://s2.coinmarketcap.com/static/img/issuer/tether.png",
  matrixdock: "https://s2.coinmarketcap.com/static/img/issuer/matrixdock.png",
  coinbase: "https://s2.coinmarketcap.com/static/img/issuer/m_UOfXvz_400x400.png",
  backpack: "https://s2.coinmarketcap.com/static/img/issuer/M7sS2GzR_400x400.png",
  bstocks: "https://s2.coinmarketcap.com/static/img/issuer/Untitled_design__2_.png",
  "comtech gold": "https://s2.coinmarketcap.com/static/img/issuer/comtech.png",
  vnx: "https://s2.coinmarketcap.com/static/img/issuer/vnx.png",
  "ondo assets": "https://s2.coinmarketcap.com/static/img/coins/64x64/21159.png",
  paxos: "https://s2.coinmarketcap.com/static/img/coins/64x64/4705.png",
  circle: "https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png",
};

const FALLBACK_GRADIENTS = [
  "from-[#3861FB] to-[#1D4ED8]",
  "from-[#16C784] to-[#0D9488]",
  "from-[#F3BA2F] to-[#D97706]",
  "from-[#13B2CF] to-[#0284C7]",
  "from-[#8A3FFC] to-[#6D28D9]",
  "from-[#FF775F] to-[#E11D48]",
];

const ASSET_TYPE_GRADIENT: Record<string, string> = {
  commodity: "from-[#F3BA2F] to-[#B45309]",
  government_security: "from-[#16C784] to-[#047857]",
  stock: "from-[#3861FB] to-[#1E40AF]",
  etf: "from-[#13B2CF] to-[#0369A1]",
  currency: "from-[#8A3FFC] to-[#5B21B6]",
  real_estate: "from-[#FF775F] to-[#BE123C]",
};

function hashIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % FALLBACK_GRADIENTS.length;
}

export function getCmcCoinLogoUrl(cryptoId: number): string {
  return `https://s2.coinmarketcap.com/static/img/coins/64x64/${cryptoId}.png`;
}

export function getRwaLogoUrl(symbol: string, explicitLogo?: string | null): string | null {
  if (explicitLogo && explicitLogo.startsWith("http")) return explicitLogo;
  const upper = symbol.trim().toUpperCase();
  const rwaHash = CMC_RWA_ICON_HASH_BY_SYMBOL[upper];
  if (rwaHash) return `https://s2.coinmarketcap.com/static/img/rwa/64x64/${rwaHash}.png`;
  const leadCoinId = CMC_RWA_LEAD_COIN_ID_BY_SYMBOL[upper];
  if (leadCoinId) return getCmcCoinLogoUrl(leadCoinId);
  return null;
}

export function getIssuerLogoUrl(name: string, explicitLogo?: string | null): string | null {
  if (explicitLogo && explicitLogo.startsWith("http")) return explicitLogo;
  return CMC_ISSUER_LOGO_BY_NAME[name.trim().toLowerCase()] ?? null;
}

function LogoBadge({
  src,
  alt,
  monogram,
  size = 24,
  gradient,
  rounded = "full",
}: {
  src: string | null;
  alt: string;
  monogram: string;
  size?: number;
  gradient: string;
  rounded?: "full" | "md";
}) {
  const [failed, setFailed] = useState(false);
  const radiusClass = rounded === "full" ? "rounded-full" : "rounded-lg";

  if (!src || failed) {
    const label = monogram.slice(0, size >= 28 ? 3 : 2).toUpperCase();
    return (
      <span
        style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.36)) }}
        className={`num inline-flex shrink-0 items-center justify-center bg-gradient-to-br ${gradient} ${radiusClass} font-bold tracking-tight text-white shadow-xs ring-1 ring-white/15`}
        aria-hidden="true"
      >
        {label}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={{ width: size, height: size }}
      className={`shrink-0 ${radiusClass} bg-[#171924] object-cover ring-1 ring-white/12`}
    />
  );
}

export function TokenLogo({
  cryptoId,
  symbol,
  name,
  size = 22,
}: {
  cryptoId?: number | null;
  symbol: string;
  name?: string;
  size?: number;
}) {
  const src = cryptoId && cryptoId > 0 ? getCmcCoinLogoUrl(cryptoId) : null;
  const gradient = FALLBACK_GRADIENTS[hashIndex(symbol)];
  return (
    <LogoBadge
      src={src}
      alt={name ?? symbol}
      monogram={symbol}
      size={size}
      gradient={gradient}
      rounded="full"
    />
  );
}

export function RwaLogo({
  symbol,
  name,
  assetType,
  logoUrl,
  size = 26,
}: {
  symbol: string;
  name?: string;
  assetType?: RwaAssetType | string;
  logoUrl?: string | null;
  size?: number;
}) {
  const src = getRwaLogoUrl(symbol, logoUrl);
  const gradient =
    (assetType && ASSET_TYPE_GRADIENT[assetType]) || FALLBACK_GRADIENTS[hashIndex(symbol)];
  return (
    <LogoBadge
      src={src}
      alt={name ?? symbol}
      monogram={symbol}
      size={size}
      gradient={gradient}
      rounded="full"
    />
  );
}

export function IssuerLogo({
  name,
  logoUrl,
  size = 24,
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
}) {
  const src = getIssuerLogoUrl(name, logoUrl);
  const words = name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/);
  const monogram =
    words.length >= 2 ? `${words[0][0]}${words[1][0]}` : (words[0] ?? "IS").slice(0, 2);
  const gradient = FALLBACK_GRADIENTS[hashIndex(name)];
  return (
    <LogoBadge
      src={src}
      alt={name}
      monogram={monogram}
      size={size}
      gradient={gradient}
      rounded="md"
    />
  );
}
