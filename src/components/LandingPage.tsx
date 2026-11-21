"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ExternalLink,
  Layers,
  ShieldCheck,
  Sparkles,
  Terminal,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { IssuerLogo, RwaLogo, TokenLogo } from "@/components/AssetLogo";
import { Tilt3DCard } from "@/components/MotionPrimitives";
import { ParityLensLogo } from "@/components/ParityLensLogo";
import {
  formatAssetTypeLabel,
  formatBps,
  formatCurrency,
  formatPercent,
} from "@/lib/analytics/parity";
import type { OverviewResponse, RwaAssetType, RwaDetailResponse } from "@/lib/cmc/types";

const GITHUB_REPO_URL = "https://github.com/Propre008/paritylens";
const GITHUB_FEEDBACK_URL = `${GITHUB_REPO_URL}/blob/main/API_FEEDBACK.md`;

const CMC_CLASS_COLORS: Record<RwaAssetType, string> = {
  commodity: "#F3BA2F",
  stock: "#3861FB",
  etf: "#13B2CF",
  government_security: "#16C784",
  currency: "#8A3FFC",
  real_estate: "#FF775F",
};

const DONUT_PALETTE = ["#3861FB", "#16C784", "#F3BA2F", "#13B2CF", "#8A3FFC", "#FF775F"];

const HERO_SWITCH_ASSETS = [
  { rwaId: 1, symbol: "GOLD", label: "Gold" },
  { rwaId: 2, symbol: "NVDA", label: "NVIDIA" },
  { rwaId: 9, symbol: "SPCX", label: "SpaceX" },
];

const ENDPOINT_DIRECTORY = [
  {
    route: "/v5/real-world-assets/map",
    tier: "Basic+ · 0 cr",
    tierType: "basic" as const,
    role: "Universal RWA ID catalog & canonical ranking index",
  },
  {
    route: "/v5/real-world-assets/assets/list",
    tier: "Basic+",
    tierType: "basic" as const,
    role: "Ranked screener, asset-class composition, avg prices & caps",
  },
  {
    route: "/v5/real-world-assets/quotes/latest",
    tier: "Basic+",
    tierType: "basic" as const,
    role: "Per-asset competing tokens[] by issuer for parity spread & HHI",
  },
  {
    route: "/v5/real-world-assets/info",
    tier: "Basic+",
    tierType: "basic" as const,
    role: "Underlying asset reference metadata, exchange, CIK & profile",
  },
  {
    route: "/v5/real-world-assets/market-pairs/list",
    tier: "Startup+",
    tierType: "startup" as const,
    role: "Active CEX/DEX pairs & venue fragmentation (live Basic fallback)",
  },
  {
    route: "/v5/real-world-assets/issuers/list",
    tier: "Basic+",
    tierType: "basic" as const,
    role: "Directory of active RWA issuers, official logos & token counts",
  },
  {
    route: "/v5/real-world-assets/issuers",
    tier: "Basic+",
    tierType: "basic" as const,
    role: "Single-issuer drill-down returning linked on-chain token catalog",
  },
  {
    route: "/v3/cryptocurrency/quotes/latest",
    tier: "Keyless / Basic+",
    tierType: "keyless" as const,
    role: "Live spot crypto quotes by stable CMC ID (BTC, ETH, SOL, USDT)",
  },
  {
    route: "/v1/global-metrics/quotes/latest",
    tier: "Keyless / Basic+",
    tierType: "keyless" as const,
    role: "Live macro ribbon: Global Crypto Cap, 24h Volume & BTC.D",
  },
  {
    route: "/v3/fear-and-greed/latest",
    tier: "Keyless / Basic+",
    tierType: "keyless" as const,
    role: "Proprietary CMC Fear & Greed sentiment context for portfolios",
  },
  {
    route: "/v1/key/info",
    tier: "Basic+ · 0 cr",
    tierType: "basic" as const,
    role: "Live plan tier, monthly credit consumption & rate-limit telemetry",
  },
];

const FALLBACK_GOLD_ROWS = [
  {
    cryptoId: 5176,
    symbol: "XAUt",
    name: "Tether Gold",
    issuer: "Tether Holdings",
    price: 3545.08,
    bps: -0.8,
  },
  {
    cryptoId: 4705,
    symbol: "PAXG",
    name: "PAX Gold",
    issuer: "Paxos",
    price: 3547.99,
    bps: 7.4,
  },
  {
    cryptoId: 34212,
    symbol: "XAUM",
    name: "Matrixdock Gold",
    issuer: "Matrixdock",
    price: 3536.88,
    bps: -23.9,
  },
  {
    cryptoId: 37082,
    symbol: "XAUT0",
    name: "Tether Gold Tokens",
    issuer: "Tether Holdings",
    price: 3557.03,
    bps: 32.9,
  },
];

export function LandingPage() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [heroRwaId, setHeroRwaId] = useState<number>(1);
  const [rwaCache, setRwaCache] = useState<Record<number, RwaDetailResponse>>({});
  const [heroLoading, setHeroLoading] = useState(false);
  const [demoNormalized, setDemoNormalized] = useState(true);

  // Initial live hydration: overview + Gold (rwa_id=1)
  useEffect(() => {
    const controller = new AbortController();

    Promise.allSettled([
      fetch("/api/cmc/overview", { signal: controller.signal }).then((r) =>
        r.ok ? (r.json() as Promise<OverviewResponse>) : null
      ),
      fetch("/api/cmc/rwa/1", { signal: controller.signal }).then((r) =>
        r.ok ? (r.json() as Promise<RwaDetailResponse>) : null
      ),
    ]).then(([ovRes, goldRes]) => {
      if (controller.signal.aborted) return;
      if (ovRes.status === "fulfilled" && ovRes.value) setOverview(ovRes.value);
      if (goldRes.status === "fulfilled" && goldRes.value) {
        setRwaCache((prev) => ({ ...prev, 1: goldRes.value! }));
      }
    });

    return () => controller.abort();
  }, []);

  // Fetch switched Hero asset on demand (cached in memory so switching back is instant)
  useEffect(() => {
    if (rwaCache[heroRwaId]) return;
    const controller = new AbortController();

    fetch(`/api/cmc/rwa/${heroRwaId}`, { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<RwaDetailResponse>) : null))
      .then((data) => {
        if (controller.signal.aborted || !data) return;
        setRwaCache((prev) => ({ ...prev, [heroRwaId]: data }));
      })
      .finally(() => {
        if (!controller.signal.aborted) setHeroLoading(false);
      });

    return () => controller.abort();
  }, [heroRwaId, rwaCache]);

  function handleSwitchHeroAsset(nextId: number) {
    if (nextId === heroRwaId) return;
    if (!rwaCache[nextId]) setHeroLoading(true);
    setHeroRwaId(nextId);
  }

  const btc = overview?.cryptoBenchmarks.find((c) => c.symbol === "BTC");
  const eth = overview?.cryptoBenchmarks.find((c) => c.symbol === "ETH");
  const sol = overview?.cryptoBenchmarks.find((c) => c.symbol === "SOL");
  const gm = overview?.globalMetrics;
  const fg = overview?.fearAndGreed;
  const isLivePro = overview?.mode === "live_pro";

  const screenerStats = useMemo(() => {
    const validAssets = (overview?.rwaAssets ?? []).filter(
      (a) => a && typeof a.rwa_id === "number" && a.rwa_id > 0
    );
    const totalMcap = validAssets.reduce((s, a) => s + (a.tokenized_market_cap || 0), 0);
    const totalVol = validAssets.reduce((s, a) => s + (a.tokenized_volume_24h || 0), 0);

    const byType = new Map<RwaAssetType, { mcap: number; count: number }>();
    for (const a of validAssets) {
      const prev = byType.get(a.asset_type) ?? { mcap: 0, count: 0 };
      byType.set(a.asset_type, {
        mcap: prev.mcap + (a.tokenized_market_cap || 0),
        count: prev.count + 1,
      });
    }
    const breakdown = Array.from(byType.entries())
      .map(([type, data]) => ({
        type,
        mcap: data.mcap,
        count: data.count,
        sharePct: totalMcap > 0 ? (data.mcap / totalMcap) * 100 : 0,
      }))
      .sort((a, b) => b.mcap - a.mcap);

    const issuers = [...(overview?.issuers ?? [])].sort((a, b) => b.num_tokens - a.num_tokens);
    const totalLinkedTokens = issuers.reduce((s, i) => s + i.num_tokens, 0);
    const topFiveIssuers = issuers.slice(0, 5);
    const otherTokens = Math.max(
      0,
      totalLinkedTokens - topFiveIssuers.reduce((s, i) => s + i.num_tokens, 0)
    );

    const issuerDonut = [
      ...topFiveIssuers.map((i, idx) => ({
        id: i.issuer_id,
        name: i.name,
        logo: i.logo,
        count: i.num_tokens,
        pct: totalLinkedTokens > 0 ? (i.num_tokens / totalLinkedTokens) * 100 : 0,
        color: DONUT_PALETTE[idx % DONUT_PALETTE.length],
      })),
      ...(otherTokens > 0
        ? [
            {
              id: "others",
              name: "Other Issuers",
              logo: null,
              count: otherTokens,
              pct: totalLinkedTokens > 0 ? (otherTokens / totalLinkedTokens) * 100 : 0,
              color: "#4B5563",
            },
          ]
        : []),
    ];

    return {
      validAssets,
      topFiveRwas: validAssets.slice(0, 5),
      totalMcap: totalMcap > 0 ? totalMcap : 7_510_000_000,
      totalVol: totalVol > 0 ? totalVol : 2_060_000_000,
      turnoverPct: totalMcap > 0 ? (totalVol / totalMcap) * 100 : 27.4,
      rwaCryptoSharePct:
        gm && gm.total_market_cap > 0 ? (totalMcap / gm.total_market_cap) * 100 : 0.36,
      breakdown,
      issuers,
      issuerDonut,
      totalLinkedTokens: totalLinkedTokens > 0 ? totalLinkedTokens : 2795,
      issuersTotal: overview?.issuersTotal ?? 24,
      rwaMapTotal: overview?.rwaMapTotal ?? 7811,
      backedIssuerId:
        issuers.find((i) => i.name.toLowerCase().includes("backed"))?.issuer_id ??
        "6878977dcbbf471de3366e85",
    };
  }, [overview, gm]);

  // Active Hero 3D Card telemetry
  const activeHeroDetail = rwaCache[heroRwaId] ?? rwaCache[1] ?? null;
  const heroTelemetry = useMemo(() => {
    const parity = activeHeroDetail?.parity;
    const quote = activeHeroDetail?.quote;
    if (!parity || !quote) {
      return {
        rwaId: 1,
        symbol: "GOLD",
        name: "Gold",
        assetType: "commodity" as RwaAssetType,
        avgPrice: 3545.36,
        spreadBps: 56.8,
        grade: "WIDE" as const,
        hhi: 5127,
        concentration: "CONCENTRATED" as const,
        volume24h: 329_090_000,
        rows: FALLBACK_GOLD_ROWS,
        maxAbsBps: 35,
        unitScaled: [
          { cryptoId: 20245, symbol: "CGO", price: 112.38 },
          { cryptoId: 22492, symbol: "VNXAU", price: 115.48 },
        ],
        naiveSpreadBps: 9718,
      };
    }

    const comparable = parity.tokens.filter((t) => t.parityStatus === "INCLUDED").slice(0, 4);
    const chosen = comparable.length > 0 ? comparable : parity.tokens.slice(0, 4);
    const rows = chosen.map((t) => ({
      cryptoId: t.crypto_id,
      symbol: t.symbol,
      name: t.name,
      issuer: t.issuer_name,
      price: t.price,
      bps: t.deviationBps,
    }));
    const maxAbsBps = Math.max(15, ...rows.map((r) => Math.abs(r.bps)));
    const unitScaled = parity.tokens
      .filter((t) => t.parityStatus === "UNIT_MISMATCH")
      .map((t) => ({ cryptoId: t.crypto_id, symbol: t.symbol, price: t.price }));

    const allPrices = parity.tokens.map((t) => t.price).filter((p) => p > 0);
    const naiveSpreadBps =
      allPrices.length >= 2 && parity.averagePrice > 0
        ? Math.round(
            ((Math.max(...allPrices) - Math.min(...allPrices)) / parity.averagePrice) * 10_000
          )
        : Math.round(parity.spreadBps);

    return {
      rwaId: quote.rwa_id,
      symbol: quote.symbol,
      name: quote.name,
      assetType: quote.asset_type,
      avgPrice: parity.averagePrice,
      spreadBps: parity.spreadBps,
      grade: parity.grade,
      hhi: parity.hhiScore,
      concentration: parity.concentrationLabel,
      volume24h: parity.totalTokenVolume24h,
      rows,
      maxAbsBps,
      unitScaled,
      naiveSpreadBps,
    };
  }, [activeHeroDetail]);

  // Gold live data for the Interactive Before/After Normalization Switch
  const goldDemo = useMemo(() => {
    const goldParity = rwaCache[1]?.parity;
    if (!goldParity) {
      return {
        avgPrice: 3545.36,
        cleanSpreadBps: 56.8,
        rawSpreadBps: 9718,
        cleanGrade: "WIDE" as const,
        hhi: 5127,
        cleanTokens: FALLBACK_GOLD_ROWS.map((r) => ({ ...r, status: "INCLUDED" as const })),
        rawTokens: [
          ...FALLBACK_GOLD_ROWS.slice(0, 3).map((r) => ({ ...r, status: "INCLUDED" as const })),
          {
            cryptoId: 20245,
            symbol: "CGO",
            name: "Comtech Gold (1g)",
            issuer: "Comtech Gold",
            price: 112.38,
            bps: -9683.0,
            status: "UNIT_MISMATCH" as const,
          },
          {
            cryptoId: 22492,
            symbol: "VNXAU",
            name: "VNX Gold (1g)",
            issuer: "VNX",
            price: 115.48,
            bps: -9674.3,
            status: "UNIT_MISMATCH" as const,
          },
        ],
      };
    }

    const cleanTokens = goldParity.tokens
      .filter((t) => t.parityStatus === "INCLUDED")
      .slice(0, 4)
      .map((t) => ({
        cryptoId: t.crypto_id,
        symbol: t.symbol,
        name: t.name,
        issuer: t.issuer_name,
        price: t.price,
        bps: t.deviationBps,
        status: t.parityStatus,
      }));

    const unitTokens = goldParity.tokens
      .filter((t) => t.parityStatus === "UNIT_MISMATCH")
      .slice(0, 2)
      .map((t) => ({
        cryptoId: t.crypto_id,
        symbol: t.symbol,
        name: t.name,
        issuer: t.issuer_name,
        price: t.price,
        bps: t.deviationBps,
        status: t.parityStatus,
      }));

    const allPrices = goldParity.tokens.map((t) => t.price).filter((p) => p > 0);
    const rawSpreadBps =
      allPrices.length >= 2 && goldParity.averagePrice > 0
        ? ((Math.max(...allPrices) - Math.min(...allPrices)) / goldParity.averagePrice) * 10_000
        : 9718;

    return {
      avgPrice: goldParity.averagePrice,
      cleanSpreadBps: goldParity.spreadBps,
      rawSpreadBps,
      cleanGrade: goldParity.grade,
      hhi: goldParity.hhiScore,
      cleanTokens: cleanTokens.length > 0 ? cleanTokens : FALLBACK_GOLD_ROWS.map((r) => ({ ...r, status: "INCLUDED" as const })),
      rawTokens: [...cleanTokens.slice(0, 3), ...unitTokens],
    };
  }, [rwaCache]);

  const marqueeItems = useMemo(() => {
    const cryptos = (overview?.cryptoBenchmarks ?? []).map((c) => ({
      key: `crypto-${c.id}`,
      kind: "crypto" as const,
      cryptoId: c.id,
      symbol: c.symbol,
      price: c.price,
      change: c.percent_change_24h,
      href: "/terminal?tab=portfolio",
    }));
    const rwas = screenerStats.validAssets.slice(0, 9).map((r) => ({
      key: `rwa-${r.rwa_id}`,
      kind: "rwa" as const,
      rwaId: r.rwa_id,
      symbol: r.symbol,
      assetType: r.asset_type,
      price: r.average_tokenized_price,
      mcap: r.tokenized_market_cap,
      href: `/terminal?tab=parity&rwa=${r.rwa_id}`,
    }));
    return [...cryptos, ...rwas];
  }, [overview, screenerStats.validAssets]);

  const demoRows = demoNormalized ? goldDemo.cleanTokens : goldDemo.rawTokens;
  const demoMaxBps = Math.max(15, ...demoRows.map((r) => Math.abs(r.bps)));

  return (
    <div className="min-h-screen bg-[#0D1421] text-white selection:bg-[#3861FB] selection:text-white">
      {/* 1. LIVE COINMARKETCAP MACRO BAR */}
      <aside
        aria-label="CoinMarketCap Live Macro Feed"
        className="w-full border-b border-[#252B3D] bg-[#0A101B] px-4 py-1.5 sm:px-6"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-y-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#A1A7BB]">
            <span className="inline-flex items-center gap-1.5">
              <TokenLogo cryptoId={1} symbol="BTC" name="Bitcoin" size={16} />
              <span>BTC</span>
              <span className="num font-medium text-white">
                {btc ? formatCurrency(btc.price) : "$60,251.76"}
              </span>
              <span
                className={`num inline-flex items-center font-medium ${
                  (btc?.percent_change_24h ?? 2.76) >= 0 ? "text-[#16C784]" : "text-[#EA3943]"
                }`}
              >
                {formatPercent(btc?.percent_change_24h ?? 2.76, true)}
              </span>
            </span>

            <span className="hidden items-center gap-1.5 sm:inline-flex">
              <TokenLogo cryptoId={1027} symbol="ETH" name="Ethereum" size={16} />
              <span>ETH</span>
              <span className="num font-medium text-white">
                {eth ? formatCurrency(eth.price) : "$1,681.26"}
              </span>
              <span
                className={`num font-medium ${
                  (eth?.percent_change_24h ?? 4.38) >= 0 ? "text-[#16C784]" : "text-[#EA3943]"
                }`}
              >
                {formatPercent(eth?.percent_change_24h ?? 4.38, true)}
              </span>
            </span>

            <span className="hidden text-[#32384C] md:inline">·</span>
            <span className="hidden md:inline">
              Market Cap:{" "}
              <span className="num font-medium text-[#6188FF]">
                {gm ? formatCurrency(gm.total_market_cap, true) : "$2.06T"}
              </span>
            </span>

            <span className="hidden lg:inline">
              Dominance:{" "}
              <span className="num font-medium text-white">
                BTC {(gm?.btc_dominance ?? 58.8).toFixed(1)}%
              </span>
            </span>

            <span>
              Fear &amp; Greed:{" "}
              <span
                className={`num font-semibold ${
                  (fg?.value ?? 8) <= 25
                    ? "text-[#EA3943]"
                    : (fg?.value ?? 8) >= 70
                      ? "text-[#16C784]"
                      : "text-[#F3BA2F]"
                }`}
              >
                {fg?.value ?? 8}/100
              </span>
            </span>
          </div>

          <div className="num ml-auto flex items-center gap-2 text-[10px] tracking-wider uppercase">
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                  isLivePro ? "bg-[#16C784]" : "bg-[#F3BA2F]"
                }`}
              />
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  isLivePro ? "bg-[#16C784] pulse-dot" : "bg-[#F3BA2F]"
                }`}
              />
            </span>
            <span className={`font-semibold ${isLivePro ? "text-[#16C784]" : "text-[#F3BA2F]"}`}>
              {isLivePro ? "LIVE CMC PRO API v5" : "HYBRID KEYLESS + SNAPSHOT"}
            </span>
          </div>
        </div>
      </aside>

      {/* 2. COINMARKETCAP-NATIVE STICKY NAVBAR */}
      <header className="sticky top-0 z-40 border-b border-[#252B3D] bg-[#0D1421]/90 backdrop-blur-md">
        <div className="mx-auto flex h-15 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <a href="#hero" className="group inline-flex items-center">
              <ParityLensLogo size="md" />
            </a>
            <span className="num hidden rounded-full border border-[#3861FB]/35 bg-[#1E274F]/80 px-2.5 py-0.5 text-[10px] font-semibold text-[#89A5FF] md:inline-block">
              CMC API v5 · RWA
            </span>
          </div>

          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-7 text-xs font-medium text-[#A1A7BB] lg:flex"
          >
            <a href="#market-pulse" className="transition-colors hover:text-white">
              Market Pulse
            </a>
            <a href="#normalization" className="transition-colors hover:text-white">
              1oz / 1g Engine
            </a>
            <a href="#workspaces" className="transition-colors hover:text-white">
              Workspaces
            </a>
            <a href="#api-coverage" className="transition-colors hover:text-white">
              11 CMC Endpoints
            </a>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 transition-colors hover:text-white"
            >
              GitHub
              <ExternalLink className="h-3 w-3" />
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <Link
              id="landing-nav-inspector"
              href="/terminal?inspector=1"
              className="num inline-flex items-center gap-1.5 rounded-lg border border-[#2D354C] bg-[#171C2B] px-3 py-1.5 text-xs font-medium text-[#D1D5E6] transition-colors hover:border-[#6188FF]/50 hover:text-white"
            >
              <Terminal className="h-3.5 w-3.5 text-[#6188FF]" />
              <span className="hidden sm:inline">API Inspector</span>
            </Link>
            <Link
              id="landing-nav-launch"
              href="/terminal"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#3861FB] px-4 py-1.5 text-xs font-semibold text-white shadow-[0_4px_18px_rgba(56,97,251,0.38)] transition-all hover:bg-[#2B52E8]"
            >
              <span>Launch Terminal</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* 3. LIVE INTERACTIVE TOKEN & RWA MARQUEE RIBBON */}
      {marqueeItems.length > 0 && (
        <div className="overflow-hidden border-b border-[#22283A] bg-[#111726] py-2">
          <div className="animate-marquee flex w-max items-center gap-2.5 px-3">
            {[...marqueeItems, ...marqueeItems].map((item, idx) => (
              <Link
                key={`${item.key}-${idx}`}
                href={item.href}
                className="inline-flex items-center gap-2 rounded-full border border-[#262E43] bg-[#171D2E] px-3 py-1 text-xs transition-colors hover:border-[#3861FB]/60 hover:bg-[#1E263D]"
              >
                {item.kind === "crypto" ? (
                  <TokenLogo cryptoId={item.cryptoId} symbol={item.symbol} size={18} />
                ) : (
                  <RwaLogo symbol={item.symbol} assetType={item.assetType} size={18} />
                )}
                <span className="num font-semibold text-white">{item.symbol}</span>
                <span className="num text-[#C4CADC]">{formatCurrency(item.price)}</span>
                {item.kind === "crypto" ? (
                  <span
                    className={`num text-[11px] font-medium ${
                      item.change >= 0 ? "text-[#16C784]" : "text-[#EA3943]"
                    }`}
                  >
                    {formatPercent(item.change, true)}
                  </span>
                ) : (
                  <span className="num text-[10px] text-[#6188FF]">
                    {formatCurrency(item.mcap, true)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 4. SPLIT 3D-MOTION HERO WORKBENCH */}
      <section
        id="hero"
        className="grid-lines relative overflow-hidden border-b border-[#23293B] pt-11 pb-14 lg:pt-14 lg:pb-18"
      >
        {/* Subtle Living Ambient Aurora */}
        <div
          aria-hidden="true"
          className="animate-aurora pointer-events-none absolute -top-28 right-1/4 h-[420px] w-[560px] rounded-full opacity-25 blur-[120px]"
          style={{
            background:
              "radial-gradient(circle, rgba(56,97,251,0.55) 0%, rgba(19,178,207,0.28) 45%, rgba(243,186,47,0.18) 100%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 -left-24 h-[340px] w-[420px] rounded-full opacity-20 blur-[110px]"
          style={{
            background: "radial-gradient(circle, rgba(22,199,132,0.4) 0%, transparent 70%)",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            {/* Left 6 cols: Authentic Copy + CTAs + Logo Quick Links */}
            <div className="flex flex-col items-start lg:col-span-6">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#3861FB]/35 bg-[#161F38]/90 px-3 py-1 text-[11px] font-medium text-[#A9BEFF]">
                <Sparkles className="h-3.5 w-3.5 text-[#F3BA2F]" />
                <span>Built on CoinMarketCap RWA API v5 &amp; Crypto v3</span>
              </div>

              <h1 className="mb-4 text-3xl leading-[1.1] font-semibold tracking-tight text-white sm:text-4xl lg:text-[46px]">
                See the real parity spread behind{" "}
                <span className="bg-gradient-to-r from-[#6188FF] via-[#13B2CF] to-[#F3BA2F] bg-clip-text text-transparent">
                  tokenized assets.
                </span>
              </h1>

              <p className="mb-7 max-w-xl text-sm leading-relaxed text-[#A1A7BB] sm:text-[15px]">
                One underlying stock, treasury, or ounce of gold often trades across multiple
                issuers, mixed unit scales, and uneven liquidity. ParityLens audits{" "}
                <span className="num font-medium text-white">
                  {screenerStats.rwaMapTotal.toLocaleString("en-US")}
                </span>{" "}
                CoinMarketCap RWAs and{" "}
                <span className="num font-medium text-white">{screenerStats.issuersTotal}</span>{" "}
                issuers in real time — separating genuine basis-point depegs from 1g/1oz noise.
              </p>

              <div className="mb-8 flex flex-wrap items-center gap-3">
                <Link
                  id="landing-hero-launch"
                  href="/terminal"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#3861FB] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_28px_rgba(56,97,251,0.42)] transition-all hover:bg-[#2B52E8]"
                >
                  <span>Open Live Terminal</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/terminal?inspector=1"
                  className="inline-flex items-center gap-2 rounded-lg border border-[#2E364E] bg-[#161C2C] px-4 py-2.5 text-sm font-medium text-[#D6DCED] transition-colors hover:border-[#6188FF]/50 hover:text-white"
                >
                  <Terminal className="h-4 w-4 text-[#16C784]" />
                  <span>Live API Inspector</span>
                </Link>
              </div>

              {/* 3 Direct Deep-Link Shortcuts with REAL CMC Logos */}
              <div className="w-full border-t border-[#232A3E] pt-5">
                <div className="mb-2.5 text-[11px] font-medium text-[#7C849C]">
                  Jump straight into a live audit:
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    id="landing-shortcut-gold"
                    href="/terminal?tab=parity&rwa=1"
                    className="inline-flex items-center gap-2 rounded-lg border border-[#283047] bg-[#141A29] px-3 py-1.5 text-xs font-medium text-[#DDE3F2] transition-all hover:border-[#F3BA2F]/60 hover:bg-[#1B2235]"
                  >
                    <RwaLogo symbol="GOLD" assetType="commodity" size={18} />
                    <span>Gold 1oz vs 1g Spread</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-[#F3BA2F]" />
                  </Link>
                  <Link
                    id="landing-shortcut-issuer"
                    href={`/terminal?tab=issuers&issuer=${screenerStats.backedIssuerId}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#283047] bg-[#141A29] px-3 py-1.5 text-xs font-medium text-[#DDE3F2] transition-all hover:border-[#3861FB]/60 hover:bg-[#1B2235]"
                  >
                    <IssuerLogo name="Backed Assets" size={18} />
                    <span>Backed Assets ({screenerStats.issuers[0]?.num_tokens.toLocaleString("en-US") ?? "1,218"})</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-[#6188FF]" />
                  </Link>
                  <Link
                    id="landing-shortcut-portfolio"
                    href="/terminal?tab=portfolio"
                    className="inline-flex items-center gap-2 rounded-lg border border-[#283047] bg-[#141A29] px-3 py-1.5 text-xs font-medium text-[#DDE3F2] transition-all hover:border-[#16C784]/60 hover:bg-[#1B2235]"
                  >
                    <TokenLogo cryptoId={1} symbol="BTC" size={18} />
                    <span>Hybrid Portfolio Lab</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-[#16C784]" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Right 6 cols: Interactive 3D-Motion Live Parity Card */}
            <div className="relative lg:col-span-6">
              {/* Subtle 3D Orbital Optical Ring behind the card */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-6 flex items-center justify-center opacity-50"
                style={{ perspective: "1000px" }}
              >
                <div className="animate-ring-3d h-[390px] w-[390px] rounded-full border border-dashed border-[#3861FB]/30 shadow-[0_0_60px_rgba(56,97,251,0.18)]" />
              </div>

              <Tilt3DCard maxTiltDeg={5} glareColor="rgba(97, 136, 255, 0.16)" className="rounded-2xl">
                <div className="cmc-hero-glow overflow-hidden rounded-2xl border border-[#2D3650] bg-[#151A28]/95 backdrop-blur-md">
                  {/* Live Interactive Asset Switcher Bar (NO fake macOS dots!) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#252D43] bg-[#111623] px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {HERO_SWITCH_ASSETS.map((opt) => {
                        const active = heroRwaId === opt.rwaId;
                        return (
                          <button
                            key={opt.rwaId}
                            id={`hero-switch-rwa-${opt.rwaId}`}
                            type="button"
                            onClick={() => handleSwitchHeroAsset(opt.rwaId)}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                              active
                                ? "bg-[#1E274F] text-white ring-1 ring-[#3861FB]/60"
                                : "text-[#8E96AF] hover:bg-[#1A2033] hover:text-white"
                            }`}
                          >
                            <RwaLogo symbol={opt.symbol} size={16} />
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <span
                      className={`num inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
                        heroTelemetry.grade === "WIDE"
                          ? "border-[#EA3943]/40 bg-[#411F2A]/80 text-[#FF7B82]"
                          : heroTelemetry.grade === "MODERATE"
                            ? "border-[#F3BA2F]/40 bg-[#3B301B]/80 text-[#F8D06B]"
                            : heroTelemetry.grade === "SINGLE_ISSUER"
                              ? "border-[#3C445C] bg-[#22283A] text-[#A1A7BB]"
                              : "border-[#16C784]/40 bg-[#173C37]/80 text-[#3EE3A4]"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          heroTelemetry.grade === "WIDE"
                            ? "bg-[#EA3943]"
                            : heroTelemetry.grade === "MODERATE"
                              ? "bg-[#F3BA2F]"
                              : heroTelemetry.grade === "SINGLE_ISSUER"
                                ? "bg-[#8E96AF]"
                                : "bg-[#16C784] pulse-dot"
                        }`}
                      />
                      {heroTelemetry.grade === "SINGLE_ISSUER"
                        ? "SINGLE ISSUER"
                        : `${heroTelemetry.grade} · ${formatBps(heroTelemetry.spreadBps)}`}
                    </span>
                  </div>

                  {/* Selected Asset Summary Header */}
                  <div className="grid grid-cols-3 divide-x divide-[#252D43] border-b border-[#252D43] bg-[#131826] px-3 py-3 text-center">
                    <div>
                      <span className="block text-[10px] font-medium text-[#7F879E]">
                        Avg Token Price
                      </span>
                      <span className="num mt-0.5 block text-sm font-semibold text-white">
                        {formatCurrency(heroTelemetry.avgPrice)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-medium text-[#7F879E]">
                        Issuer HHI
                      </span>
                      <span className="num mt-0.5 block text-sm font-semibold text-[#F3BA2F]">
                        {heroTelemetry.hhi.toLocaleString("en-US")}
                        <span className="text-[10px] font-normal text-[#7F879E]"> / 10k</span>
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-medium text-[#7F879E]">
                        24h Liquidity
                      </span>
                      <span className="num mt-0.5 block text-sm font-semibold text-[#6188FF]">
                        {formatCurrency(heroTelemetry.volume24h, true)}
                      </span>
                    </div>
                  </div>

                  {/* Live Competing Tokens + Real CMC Coin Logos + Deviation Ruler */}
                  <div className="space-y-3 p-4">
                    <div className="num flex items-center justify-between border-b border-[#232A3E] pb-1.5 text-[10px] text-[#7C849C]">
                      <span>
                        {heroTelemetry.name.toUpperCase()} TOKENS (rwa_id:{heroTelemetry.rwaId})
                      </span>
                      <div className="flex items-center gap-4">
                        <span>PRICE</span>
                        <span className="min-w-[82px] text-right">PARITY DEV</span>
                      </div>
                    </div>

                    {heroLoading ? (
                      <div className="flex h-44 items-center justify-center text-xs text-[#8E96AF]">
                        Loading live CMC v5 quotes...
                      </div>
                    ) : (
                      heroTelemetry.rows.map((row) => {
                        const pct = Math.min(
                          48,
                          (Math.abs(row.bps) / heroTelemetry.maxAbsBps) * 48
                        );
                        const isPremium = row.bps >= 0;
                        const isAlert = Math.abs(row.bps) > 35;
                        const barColor = isAlert
                          ? "bg-[#EA3943]"
                          : isPremium
                            ? "bg-[#16C784]"
                            : "bg-[#3861FB]";
                        const textColor = isAlert
                          ? "text-[#FF6E76]"
                          : isPremium
                            ? "text-[#16C784]"
                            : "text-[#6188FF]";

                        return (
                          <div key={`${row.cryptoId}-${row.symbol}`} className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <div className="flex min-w-0 items-center gap-2">
                                <TokenLogo
                                  cryptoId={row.cryptoId}
                                  symbol={row.symbol}
                                  name={row.name}
                                  size={22}
                                />
                                <span className="num font-semibold text-white">{row.symbol}</span>
                                <span className="truncate text-[11px] text-[#8E96AF]">
                                  {row.issuer}
                                </span>
                              </div>
                              <div className="num flex shrink-0 items-center gap-4">
                                <span className="whitespace-nowrap text-[#D4D9E8]">
                                  {formatCurrency(row.price)}
                                </span>
                                <span
                                  className={`min-w-[82px] text-right font-semibold whitespace-nowrap ${textColor}`}
                                >
                                  {formatBps(row.bps, true)}
                                </span>
                              </div>
                            </div>
                            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[#0D1320]">
                              <div className="absolute inset-y-0 left-1/2 z-10 w-px bg-[#47516E]" />
                              <div
                                className={`absolute inset-y-0 rounded-full transition-all duration-500 ${barColor}`}
                                style={{
                                  left: isPremium ? "50%" : `${50 - pct}%`,
                                  width: `${Math.max(pct, 2)}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Card Footer: Unit Filter Callout + Deep Link */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#252D43] bg-[#101522] px-4 py-2.5 text-[11px]">
                    {heroTelemetry.unitScaled.length > 0 ? (
                      <div className="flex items-center gap-1.5 text-[#A1A7BB]">
                        <span className="num rounded bg-[#F3BA2F]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#F3BA2F]">
                          {heroTelemetry.rwaId === 1 ? "1oz / 1g filter" : "Unit / split filter"}
                        </span>
                        <span className="num">
                          {heroTelemetry.unitScaled.map((u) => u.symbol).join(" & ")} excluded
                        </span>
                      </div>
                    ) : (
                      <span className="text-[#8E96AF]">
                        Live from <code>/v5/real-world-assets/quotes/latest</code>
                      </span>
                    )}

                    <Link
                      href={`/terminal?tab=parity&rwa=${heroTelemetry.rwaId}`}
                      className="num inline-flex items-center gap-1 font-semibold text-[#6188FF] hover:text-white"
                    >
                      <span>Open full audit</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </Tilt3DCard>
            </div>
          </div>
        </div>
      </section>

      {/* 5. COINMARKETCAP-STYLE 4-CARD LIVE MARKET PULSE BENTO */}
      <section
        id="market-pulse"
        aria-label="Live RWA Market Pulse"
        className="border-b border-[#22283A] bg-[#101625] py-12"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                Live RWA Market Pulse
              </h2>
              <p className="mt-1 text-xs text-[#A1A7BB] sm:text-sm">
                Real-time capitalization, issuer market share, and top tokenized assets indexed from
                CoinMarketCap API v5.
              </p>
            </div>
            <Link
              href="/terminal"
              className="num inline-flex items-center gap-1.5 text-xs font-semibold text-[#6188FF] hover:text-white"
            >
              <span>View all 100 ranked RWAs</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {/* Card 1: Tokenized RWA Cap */}
            <div className="terminal-panel flex flex-col justify-between rounded-xl p-5">
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-[#A1A7BB]">
                  <span>Total Tokenized RWA Cap</span>
                  <span className="num rounded bg-[#16C784]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#16C784]">
                    LIVE
                  </span>
                </div>
                <div className="num mt-3 text-3xl font-semibold tracking-tight text-white">
                  {formatCurrency(screenerStats.totalMcap, true)}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-[#A1A7BB]">
                  <span>24h Vol:</span>
                  <span className="num font-semibold text-white">
                    {formatCurrency(screenerStats.totalVol, true)}
                  </span>
                  <span className="num text-[#16C784]">
                    ({formatPercent(screenerStats.turnoverPct)} turnover)
                  </span>
                </div>
              </div>

              <div className="mt-5 space-y-2 border-t border-[#252D43] pt-3.5 text-xs">
                <div className="flex justify-between text-[#A1A7BB]">
                  <span>Indexed RWA Catalog</span>
                  <span className="num font-semibold text-white">
                    {screenerStats.rwaMapTotal.toLocaleString("en-US")} IDs
                  </span>
                </div>
                <div className="flex justify-between text-[#A1A7BB]">
                  <span>Share of Global Crypto</span>
                  <span className="num font-semibold text-[#F3BA2F]">
                    {screenerStats.rwaCryptoSharePct.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Top Issuers Vibrant CMC Donut */}
            <div className="terminal-panel flex flex-col justify-between rounded-xl p-5">
              <div className="flex items-center justify-between text-xs font-medium text-[#A1A7BB]">
                <span>Top RWA Issuers</span>
                <span className="num text-[11px] text-[#6188FF]">
                  {screenerStats.issuersTotal} active
                </span>
              </div>

              <div className="my-3 flex items-center gap-4">
                <IssuerShareDonut
                  segments={screenerStats.issuerDonut}
                  totalTokens={screenerStats.totalLinkedTokens}
                />
                <div className="min-w-0 flex-1 space-y-1.5 text-[11px]">
                  {screenerStats.issuerDonut.slice(0, 4).map((seg) => (
                    <div key={seg.id} className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 text-[#D2D7E8]">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: seg.color }}
                        />
                        <span className="truncate">{seg.name}</span>
                      </span>
                      <span className="num shrink-0 font-medium text-white">
                        {seg.pct.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Link
                href={`/terminal?tab=issuers&issuer=${screenerStats.backedIssuerId}`}
                className="num inline-flex items-center justify-between border-t border-[#252D43] pt-3 text-[11px] font-medium text-[#6188FF] hover:text-white"
              >
                <span>Explore all {screenerStats.issuersTotal} issuers</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Card 3: Asset Class Capital Composition */}
            <div className="terminal-panel flex flex-col justify-between rounded-xl p-5">
              <div className="flex items-center justify-between text-xs font-medium text-[#A1A7BB]">
                <span>Capital by Asset Class</span>
                <Layers className="h-3.5 w-3.5 text-[#6188FF]" />
              </div>

              <div className="my-4 space-y-3">
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#0D1421]">
                  {(screenerStats.breakdown.length > 0
                    ? screenerStats.breakdown
                    : [
                        { type: "commodity" as RwaAssetType, sharePct: 57.9, count: 1, mcap: 0 },
                        { type: "stock" as RwaAssetType, sharePct: 31.0, count: 67, mcap: 0 },
                        { type: "etf" as RwaAssetType, sharePct: 11.1, count: 32, mcap: 0 },
                      ]
                  ).map((seg) => (
                    <div
                      key={seg.type}
                      style={{
                        width: `${Math.max(seg.sharePct, 2)}%`,
                        backgroundColor: CMC_CLASS_COLORS[seg.type],
                      }}
                      className="h-full"
                    />
                  ))}
                </div>

                <div className="space-y-2 text-xs">
                  {(screenerStats.breakdown.length > 0
                    ? screenerStats.breakdown.slice(0, 4)
                    : [
                        { type: "commodity" as RwaAssetType, sharePct: 57.9, count: 1, mcap: 0 },
                        { type: "stock" as RwaAssetType, sharePct: 31.0, count: 67, mcap: 0 },
                        { type: "etf" as RwaAssetType, sharePct: 11.1, count: 32, mcap: 0 },
                      ]
                  ).map((seg) => (
                    <div key={seg.type} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[#D2D7E8]">
                        <span
                          className="h-2.5 w-2.5 rounded-sm"
                          style={{ backgroundColor: CMC_CLASS_COLORS[seg.type] }}
                        />
                        <span>{formatAssetTypeLabel(seg.type)}</span>
                      </span>
                      <span className="num text-white">
                        {seg.sharePct.toFixed(1)}%{" "}
                        <span className="text-[#7C849C]">({seg.count})</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Link
                href="/terminal"
                className="num inline-flex items-center justify-between border-t border-[#252D43] pt-3 text-[11px] font-medium text-[#6188FF] hover:text-white"
              >
                <span>Filter by class in Screener</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Card 4: Top Live RWAs Mini-Leaderboard with Real CMC Logos */}
            <div className="terminal-panel flex flex-col justify-between rounded-xl p-5">
              <div className="flex items-center justify-between text-xs font-medium text-[#A1A7BB]">
                <span>Top Ranked RWAs</span>
                <span className="num text-[10px] text-[#16C784]">Click to audit</span>
              </div>

              <div className="mt-3 space-y-2">
                {(screenerStats.topFiveRwas.length > 0
                  ? screenerStats.topFiveRwas
                  : [
                      {
                        rwa_id: 1,
                        symbol: "GOLD",
                        name: "Gold",
                        asset_type: "commodity" as RwaAssetType,
                        average_tokenized_price: 3545.36,
                        tokenized_market_cap: 4_340_000_000,
                      },
                      {
                        rwa_id: 2,
                        symbol: "NVDA",
                        name: "Nvidia Corp",
                        asset_type: "stock" as RwaAssetType,
                        average_tokenized_price: 130.61,
                        tokenized_market_cap: 371_450_000,
                      },
                      {
                        rwa_id: 9,
                        symbol: "SPCX",
                        name: "SpaceX",
                        asset_type: "stock" as RwaAssetType,
                        average_tokenized_price: 130.45,
                        tokenized_market_cap: 299_870_000,
                      },
                    ]
                ).map((asset, idx) => (
                  <Link
                    key={asset.rwa_id}
                    href={`/terminal?tab=parity&rwa=${asset.rwa_id}`}
                    className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#232A3E]"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="num w-3 text-[11px] text-[#7C849C]">{idx + 1}</span>
                      <RwaLogo
                        symbol={asset.symbol}
                        name={asset.name}
                        assetType={asset.asset_type}
                        size={22}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-white group-hover:text-[#6188FF]">
                          {asset.symbol}
                        </div>
                        <div className="truncate text-[10px] text-[#7C849C]">{asset.name}</div>
                      </div>
                    </div>
                    <div className="num shrink-0 text-right">
                      <div className="text-xs font-medium text-white">
                        {formatCurrency(asset.average_tokenized_price)}
                      </div>
                      <div className="text-[10px] text-[#8E96AF]">
                        {formatCurrency(asset.tokenized_market_cap, true)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. INTERACTIVE LIVE PROOF: UNIT NORMALIZATION TOGGLE */}
      <section id="normalization" className="border-b border-[#22283A] bg-[#0D1421] py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <span className="num inline-flex items-center gap-1.5 rounded-full border border-[#F3BA2F]/35 bg-[#F3BA2F]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#F3BA2F]">
                Live Data Demonstration · Gold (rwa_id:1)
              </span>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Why 1g and 1oz tokens break naive RWA monitors.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#A1A7BB]">
                CoinMarketCap&apos;s live Gold endpoint returns 1-troy-ounce tokens (
                <span className="num text-white">PAXG</span>,{" "}
                <span className="num text-white">XAUt</span>,{" "}
                <span className="num text-white">XAUM</span>) alongside 1-gram tokens (
                <span className="num text-white">CGO</span>,{" "}
                <span className="num text-white">VNXAU</span> at ~
                <span className="num text-white">$112</span>) and zero-volume derivatives. Toggle
                the engine below to see the exact difference on live data.
              </p>

              {/* Interactive Segmented Toggle */}
              <div className="mt-5 inline-flex rounded-xl border border-[#2A3248] bg-[#141A29] p-1">
                <button
                  id="demo-toggle-normalized"
                  type="button"
                  onClick={() => setDemoNormalized(true)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                    demoNormalized
                      ? "bg-[#3861FB] text-white shadow-sm"
                      : "text-[#8E96AF] hover:text-white"
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>ParityLens Normalized</span>
                </button>
                <button
                  id="demo-toggle-raw"
                  type="button"
                  onClick={() => setDemoNormalized(false)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                    !demoNormalized
                      ? "bg-[#EA3943] text-white shadow-sm"
                      : "text-[#8E96AF] hover:text-white"
                  }`}
                >
                  <TrendingDown className="h-3.5 w-3.5" />
                  <span>Raw Unfiltered Feed</span>
                </button>
              </div>
            </div>

            {/* Interactive Live Comparison Panel */}
            <div className="lg:col-span-7">
              <div
                className={`terminal-panel overflow-hidden rounded-2xl border transition-colors duration-300 ${
                  demoNormalized ? "border-[#16C784]/35" : "border-[#EA3943]/45"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#252D43] bg-[#121725] px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <RwaLogo symbol="GOLD" assetType="commodity" size={24} />
                    <div>
                      <div className="text-xs font-semibold text-white">
                        {demoNormalized
                          ? "Normalized 1 Troy Oz Gold Parity"
                          : "Unfiltered Raw Gold Tokens (1oz + 1g Mixed)"}
                      </div>
                      <div className="num text-[11px] text-[#8E96AF]">
                        Benchmark {formatCurrency(goldDemo.avgPrice)} · HHI{" "}
                        {goldDemo.hhi.toLocaleString("en-US")} / 10,000
                      </div>
                    </div>
                  </div>
                  <span
                    className={`num rounded-full px-3 py-1 text-xs font-semibold ${
                      demoNormalized
                        ? "bg-[#173C37] text-[#3EE3A4]"
                        : "bg-[#411F2A] text-[#FF6E76]"
                    }`}
                  >
                    {demoNormalized
                      ? `True Spread: ${formatBps(goldDemo.cleanSpreadBps)}`
                      : `False Alarm: ${Math.round(goldDemo.rawSpreadBps).toLocaleString("en-US")} bps`}
                  </span>
                </div>

                <div className="space-y-3 p-5">
                  {demoRows.map((row) => {
                    const pct = Math.min(48, (Math.abs(row.bps) / demoMaxBps) * 48);
                    const isUnitMismatch = row.status === "UNIT_MISMATCH";
                    const isPremium = row.bps >= 0;
                    const barColor = isUnitMismatch
                      ? "bg-[#EA3943]"
                      : isPremium
                        ? "bg-[#16C784]"
                        : "bg-[#3861FB]";

                    return (
                      <div key={`${row.cryptoId}-${row.symbol}`} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex min-w-0 items-center gap-2">
                            <TokenLogo cryptoId={row.cryptoId} symbol={row.symbol} size={20} />
                            <span className="num font-semibold text-white">{row.symbol}</span>
                            <span className="truncate text-[11px] text-[#8E96AF]">
                              {row.issuer}
                            </span>
                            {isUnitMismatch && (
                              <span className="num rounded bg-[#EA3943]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#FF7B82]">
                                1g Unit Mismatch
                              </span>
                            )}
                          </div>
                          <div className="num flex shrink-0 items-center gap-4">
                            <span className="text-[#D4D9E8]">{formatCurrency(row.price)}</span>
                            <span
                              className={`min-w-[92px] text-right font-semibold whitespace-nowrap ${
                                isUnitMismatch
                                  ? "text-[#FF6E76]"
                                  : isPremium
                                    ? "text-[#16C784]"
                                    : "text-[#6188FF]"
                              }`}
                            >
                              {formatBps(row.bps, true)}
                            </span>
                          </div>
                        </div>
                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-[#0C1220]">
                          <div className="absolute inset-y-0 left-1/2 z-10 w-px bg-[#47516E]" />
                          <div
                            className={`absolute inset-y-0 rounded-full transition-all duration-500 ${barColor}`}
                            style={{
                              left: isPremium ? "50%" : `${50 - pct}%`,
                              width: `${Math.max(pct, 1.5)}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FOUR 3D-TILT WORKSPACE LAUNCHER CARDS */}
      <section id="workspaces" className="border-b border-[#22283A] bg-[#101625] py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Four Live Workspaces, One Unified Feed
              </h2>
              <p className="mt-1 text-sm text-[#A1A7BB]">
                Every module reads live CoinMarketCap server responses with zero page reloads and
                instant cross-navigation.
              </p>
            </div>
            <Link
              href="/terminal"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#3861FB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2B52E8]"
            >
              <span>Open Full Terminal</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Workspace 1: Screener */}
            <Tilt3DCard maxTiltDeg={3} glareColor="rgba(56, 97, 251, 0.14)" className="rounded-xl">
              <Link
                href="/terminal"
                className="terminal-panel group flex h-full flex-col justify-between rounded-xl p-6 transition-colors hover:border-[#3861FB]/50"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="num rounded bg-[#3861FB]/15 px-2 py-0.5 text-[10px] font-semibold text-[#6188FF]">
                      MARKET SCREENER
                    </span>
                    <span className="num text-[11px] text-[#7C849C]">/v5/assets/list</span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-white group-hover:text-[#6188FF]">
                    Tokenized RWA Screener
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#A1A7BB]">
                    Search and sort live tokenized equities, commodities, ETFs, and treasuries by
                    market cap, 24h volume, and <code>Vol / Cap</code> turnover with real asset
                    logos.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {["GOLD", "NVDA", "SPCX", "QQQ", "GOOGL", "SPY"].map((sym) => (
                      <span
                        key={sym}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#283047] bg-[#121827] px-2.5 py-1 text-[11px] font-medium text-[#D6DCED]"
                      >
                        <RwaLogo symbol={sym} size={16} />
                        <span className="num">{sym}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <span className="num mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#6188FF]">
                  <span>Launch Screener</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </Tilt3DCard>

            {/* Workspace 2: Parity Analyzer */}
            <Tilt3DCard maxTiltDeg={3} glareColor="rgba(243, 186, 47, 0.14)" className="rounded-xl">
              <Link
                href="/terminal?tab=parity&rwa=1"
                className="terminal-panel group flex h-full flex-col justify-between rounded-xl p-6 transition-colors hover:border-[#F3BA2F]/50"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="num rounded bg-[#F3BA2F]/15 px-2 py-0.5 text-[10px] font-semibold text-[#F3BA2F]">
                      PARITY ANALYZER
                    </span>
                    <span className="num text-[11px] text-[#7C849C]">/v5/quotes/latest</span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-white group-hover:text-[#F3BA2F]">
                    Multi-Issuer Parity &amp; HHI Monitor
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#A1A7BB]">
                    Audit basis-point spreads across competing on-chain tokens, isolate unit-scaled
                    and zero-liquidity outliers, inspect HHI concentration, and track live liquidity
                    shares.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {[
                      { id: 5176, sym: "XAUt" },
                      { id: 4705, sym: "PAXG" },
                      { id: 34212, sym: "XAUM" },
                      { id: 36992, sym: "NVDAX" },
                      { id: 38093, sym: "NVDAon" },
                    ].map((tok) => (
                      <span
                        key={tok.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#283047] bg-[#121827] px-2.5 py-1 text-[11px] font-medium text-[#D6DCED]"
                      >
                        <TokenLogo cryptoId={tok.id} symbol={tok.sym} size={16} />
                        <span className="num">{tok.sym}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <span className="num mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#F3BA2F]">
                  <span>Inspect Gold Parity</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </Tilt3DCard>

            {/* Workspace 3: Issuer Explorer */}
            <Tilt3DCard maxTiltDeg={3} glareColor="rgba(22, 199, 132, 0.14)" className="rounded-xl">
              <Link
                href={`/terminal?tab=issuers&issuer=${screenerStats.backedIssuerId}`}
                className="terminal-panel group flex h-full flex-col justify-between rounded-xl p-6 transition-colors hover:border-[#16C784]/50"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="num rounded bg-[#16C784]/15 px-2 py-0.5 text-[10px] font-semibold text-[#16C784]">
                      ISSUER EXPLORER
                    </span>
                    <span className="num text-[11px] text-[#7C849C]">/v5/issuers/list</span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-white group-hover:text-[#16C784]">
                    Issuer Due-Diligence Directory
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#A1A7BB]">
                    Browse all{" "}
                    <span className="num text-white">{screenerStats.issuersTotal}</span> active RWA
                    issuers with official CoinMarketCap logos, catalog sizes, and a default{" "}
                    <code>Priced only</code> toggle hiding untraded shells.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {(screenerStats.issuers.length > 0
                      ? screenerStats.issuers.slice(0, 4)
                      : [
                          { issuer_id: "1", name: "Backed Assets", logo: null, num_tokens: 1218 },
                          { issuer_id: "2", name: "Ondo Assets", logo: null, num_tokens: 592 },
                          { issuer_id: "3", name: "Coinbase", logo: null, num_tokens: 212 },
                          { issuer_id: "4", name: "Backpack", logo: null, num_tokens: 16 },
                        ]
                    ).map((iss) => (
                      <span
                        key={iss.issuer_id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#283047] bg-[#121827] px-2.5 py-1 text-[11px] font-medium text-[#D6DCED]"
                      >
                        <IssuerLogo name={iss.name} logoUrl={iss.logo} size={16} />
                        <span>{iss.name}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <span className="num mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#16C784]">
                  <span>Audit Issuers</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </Tilt3DCard>

            {/* Workspace 4: Hybrid Portfolio Lab */}
            <Tilt3DCard maxTiltDeg={3} glareColor="rgba(19, 178, 207, 0.14)" className="rounded-xl">
              <Link
                href="/terminal?tab=portfolio"
                className="terminal-panel group flex h-full flex-col justify-between rounded-xl p-6 transition-colors hover:border-[#13B2CF]/50"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="num rounded bg-[#13B2CF]/15 px-2 py-0.5 text-[10px] font-semibold text-[#23DCF5]">
                      PORTFOLIO LAB
                    </span>
                    <span className="num text-[11px] text-[#7C849C]">
                      /v3/quotes + /fear-and-greed
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-white group-hover:text-[#23DCF5]">
                    Hybrid Crypto + Tokenized TradFi Lab
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#A1A7BB]">
                    Blend live crypto benchmarks (BTC, ETH, SOL) with tokenized Gold, equities, and
                    ETFs. Live dot-decimal rebalancing, active-only rows, SVG allocation donut, and
                    Fear &amp; Greed regime checks.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#283047] bg-[#121827] px-2.5 py-1 text-[11px] text-[#D6DCED]">
                      <TokenLogo cryptoId={1} symbol="BTC" size={16} />
                      <span className="num">{btc ? formatCurrency(btc.price) : "$60.2k"}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#283047] bg-[#121827] px-2.5 py-1 text-[11px] text-[#D6DCED]">
                      <TokenLogo cryptoId={1027} symbol="ETH" size={16} />
                      <span className="num">{eth ? formatCurrency(eth.price) : "$1.68k"}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#283047] bg-[#121827] px-2.5 py-1 text-[11px] text-[#D6DCED]">
                      <TokenLogo cryptoId={5426} symbol="SOL" size={16} />
                      <span className="num">{sol ? formatCurrency(sol.price) : "$70.57"}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#283047] bg-[#121827] px-2.5 py-1 text-[11px] text-[#D6DCED]">
                      <RwaLogo symbol="GOLD" assetType="commodity" size={16} />
                      <span className="num">Gold Hedge</span>
                    </span>
                  </div>
                </div>
                <span className="num mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#23DCF5]">
                  <span>Open Portfolio Lab</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </Tilt3DCard>
          </div>
        </div>
      </section>

      {/* 8. COINMARKETCAP API v5/v3 TRANSPARENCY & FEEDBACK */}
      <section id="api-coverage" className="border-b border-[#22283A] bg-[#0D1421] py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                11 CoinMarketCap Endpoints, Full Server-Side Transparency
              </h2>
              <p className="mt-1.5 text-sm text-[#A1A7BB]">
                All Pro API calls run strictly inside Next.js server routes with bounded TTL
                caching, zero client key leaks, and a built-in Live API Inspector for verifying raw
                JSON payloads and credit usage.
              </p>
            </div>
            <Link
              id="landing-open-inspector-callout"
              href="/terminal?inspector=1"
              className="num inline-flex items-center gap-1.5 rounded-lg border border-[#3861FB]/45 bg-[#1A2342] px-4 py-2 text-xs font-semibold text-[#89A5FF] transition-colors hover:bg-[#233059] hover:text-white"
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Inspect Live JSON &amp; BYOK Key</span>
            </Link>
          </div>

          <div className="terminal-panel mb-8 overflow-hidden rounded-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#252D43] bg-[#121725] px-5 py-3">
              <span className="num text-xs font-semibold text-white">
                Integrated CoinMarketCap Endpoint Matrix (11)
              </span>
              <span className="num rounded-full border border-[#16C784]/35 bg-[#173C37]/70 px-2.5 py-0.5 text-[10px] font-semibold text-[#3EE3A4]">
                10 / 11 Basic+ Live · 1 Startup+ Graceful Fallback
              </span>
            </div>

            <div className="terminal-scroll overflow-x-auto">
              <table className="num w-full border-collapse text-left text-xs">
                <thead className="border-b border-[#252D43] bg-[#0E1320] text-[10px] tracking-wider text-[#7C849C] uppercase">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Endpoint</th>
                    <th className="px-4 py-2.5 font-semibold">Tier</th>
                    <th className="px-4 py-2.5 font-semibold">Role in ParityLens</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Basic Plan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#20273B]">
                  {ENDPOINT_DIRECTORY.map((ep) => (
                    <tr key={ep.route} className="hover:bg-[#192033]">
                      <td className="px-4 py-2.5 font-medium text-white">{ep.route}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            ep.tierType === "startup"
                              ? "border border-[#F3BA2F]/35 bg-[#F3BA2F]/10 text-[#F3BA2F]"
                              : ep.tierType === "keyless"
                                ? "bg-[#3861FB]/15 text-[#89A5FF]"
                                : "bg-[#22293D] text-[#C4CADC]"
                          }`}
                        >
                          {ep.tier}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-sans text-[#A1A7BB]">{ep.role}</td>
                      <td className="px-4 py-2.5 text-right">
                        {ep.tierType === "startup" ? (
                          <span className="font-semibold text-[#F3BA2F]">403 → Live Fallback</span>
                        ) : (
                          <span className="font-semibold text-[#16C784]">200 OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Real Field Feedback Strip */}
          <div className="terminal-panel rounded-xl p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#16C784]" />
                <h3 className="text-sm font-semibold text-white">
                  Field Notes Shared with the CoinMarketCap API Team
                </h3>
              </div>
              <a
                href={GITHUB_FEEDBACK_URL}
                target="_blank"
                rel="noreferrer"
                className="num inline-flex items-center gap-1 text-xs font-medium text-[#6188FF] hover:text-white"
              >
                <span>Full 8-point report in API_FEEDBACK.md</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-[#252D43] bg-[#111624] p-3.5">
                <div className="num text-[11px] font-semibold text-[#F3BA2F]">
                  1. Unit Denomination Tag
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[#9DA4B8]">
                  Live Gold (<code>rwa_id:1</code>) mixes 1oz and 1g tokens without a{" "}
                  <code>unit_ratio</code> field.
                </p>
              </div>
              <div className="rounded-lg border border-[#252D43] bg-[#111624] p-3.5">
                <div className="num text-[11px] font-semibold text-[#6188FF]">
                  2. Market-Pairs Tier Gating
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[#9DA4B8]">
                  <code>/v5/real-world-assets/market-pairs/list</code> returns <code>403/1006</code>{" "}
                  on Basic while 6/7 other RWA v5 routes return <code>200</code>.
                </p>
              </div>
              <div className="rounded-lg border border-[#252D43] bg-[#111624] p-3.5">
                <div className="num text-[11px] font-semibold text-[#16C784]">
                  3. v3 quote[] Array Shape
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[#9DA4B8]">
                  <code>/v3/cryptocurrency/quotes/latest</code> returns <code>quote</code> as an
                  array vs v1/v2 <code>quote.USD</code> map + string <code>&quot;0&quot;</code>{" "}
                  codes.
                </p>
              </div>
              <div className="rounded-lg border border-[#252D43] bg-[#111624] p-3.5">
                <div className="num text-[11px] font-semibold text-[#23DCF5]">
                  4. TradFi Spot &amp; History
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[#9DA4B8]">
                  Adding off-chain spot prices inside <code>tradfi_markets[]</code> and historical
                  RWA quotes would unlock weekend depeg curves.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9. CLEAN CLOSING CTA & FOOTER */}
      <section className="grid-lines relative overflow-hidden bg-[#101625] py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <div className="mb-4 flex justify-center">
            <ParityLensLogo size="lg" showWordmark={false} />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-4xl">
            Inspect live RWA parity &amp; issuer risk now.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-[#A1A7BB]">
            Zero sign-up required. Jump straight into live CoinMarketCap RWA v5 feeds, test your own
            Startup key in memory-only mode, or audit the full open-source codebase.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              id="landing-footer-launch"
              href="/terminal"
              className="inline-flex items-center gap-2 rounded-lg bg-[#3861FB] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_28px_rgba(56,97,251,0.42)] transition-all hover:bg-[#2B52E8]"
            >
              <span>Launch ParityLens Terminal</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="num inline-flex items-center gap-2 rounded-lg border border-[#2E364E] bg-[#171C2C] px-5 py-3 text-xs font-medium text-[#DDE3F2] transition-colors hover:border-[#6188FF]/50 hover:text-white"
            >
              <span>Propre008/paritylens</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="num mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[#8E96AF]">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[#16C784]" />
              Server-Side API Proxy
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[#16C784]" />
              Memory-Only BYOK Key
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[#16C784]" />
              11/11 Automated Tests Passing
            </span>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#22283A] bg-[#0A101B] py-7 text-xs text-[#8E96AF]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:px-6 md:flex-row">
          <div className="flex items-center gap-3">
            <ParityLensLogo size="sm" />
            <span className="text-[#32384C]">·</span>
            <span className="text-[11px]">Built for #BuildwithCMC Round 2 (RWA Track)</span>
          </div>
          <div className="num flex flex-wrap items-center gap-5 text-[11px]">
            <Link href="/terminal" className="hover:text-white">
              Terminal
            </Link>
            <a href="#market-pulse" className="hover:text-white">
              Market Pulse
            </a>
            <a href="#api-coverage" className="hover:text-white">
              11 Endpoints
            </a>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#6188FF]"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function IssuerShareDonut({
  segments,
  totalTokens,
}: {
  segments: Array<{ id: string; name: string; pct: number; color: string }>;
  totalTokens: number;
}) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const arcs = segments.reduce<
    Array<{ id: string; color: string; strokeDasharray: string; strokeDashoffset: number }>
  >((acc, seg) => {
    const prior = acc.reduce((sum, item) => sum + Number(item.strokeDasharray.split(" ")[0]), 0);
    const len = (seg.pct / 100) * circumference;
    acc.push({
      id: seg.id,
      color: seg.color,
      strokeDasharray: `${len} ${Math.max(0, circumference - len)}`,
      strokeDashoffset: -prior,
    });
    return acc;
  }, []);

  return (
    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
      <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90">
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="rgba(161,167,187,0.12)"
          strokeWidth="11"
        />
        {arcs.map((arc) => (
          <circle
            key={arc.id}
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth="11"
            strokeDasharray={arc.strokeDasharray}
            strokeDashoffset={arc.strokeDashoffset}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="num text-xs font-semibold text-white">
          {totalTokens.toLocaleString("en-US")}
        </span>
        <span className="text-[9px] text-[#7C849C]">tokens</span>
      </div>
    </div>
  );
}
