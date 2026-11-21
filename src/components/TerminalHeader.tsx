"use client";

import Link from "next/link";
import { Compass, Home, RefreshCw, Terminal } from "lucide-react";
import { TokenLogo } from "@/components/AssetLogo";
import { ParityLensLogo } from "@/components/ParityLensLogo";
import { formatCurrency, formatPercent } from "@/lib/analytics/parity";
import type { DataSourceMode, OverviewResponse } from "@/lib/cmc/types";

export type ActiveTab = "screener" | "parity" | "issuers" | "portfolio";

interface TerminalHeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  overview: OverviewResponse | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenInspector: () => void;
  traceCount: number;
  hasCustomKey: boolean;
  introHidden?: boolean;
  onShowIntro?: () => void;
}

const TABS: Array<{ id: ActiveTab; label: string; shortLabel: string }> = [
  { id: "screener", label: "Market Screener", shortLabel: "Screener" },
  { id: "parity", label: "Parity Analyzer", shortLabel: "Parity" },
  { id: "issuers", label: "Issuer Explorer", shortLabel: "Issuers" },
  { id: "portfolio", label: "Hybrid Portfolio Lab", shortLabel: "Portfolio" },
];

function getModeBadge(mode: DataSourceMode, hasCustomKey: boolean) {
  if (mode === "live_pro") {
    return {
      label: hasCustomKey ? "LIVE PRO (SESSION KEY)" : "LIVE CMC PRO API",
      dotClass: "bg-emerald-400",
      textClass: "text-emerald-300",
    };
  }
  if (mode === "live_keyless") {
    return {
      label: "HYBRID KEYLESS + SNAPSHOT",
      dotClass: "bg-amber-400",
      textClass: "text-amber-300",
    };
  }
  return {
    label: "REFERENCE SNAPSHOT",
    dotClass: "bg-slate-400",
    textClass: "text-slate-300",
  };
}

export function TerminalHeader({
  activeTab,
  onSelectTab,
  overview,
  loading,
  onRefresh,
  onOpenInspector,
  traceCount,
  hasCustomKey,
  introHidden = false,
  onShowIntro,
}: TerminalHeaderProps) {
  const btc = overview?.cryptoBenchmarks.find((c) => c.symbol === "BTC");
  const eth = overview?.cryptoBenchmarks.find((c) => c.symbol === "ETH");
  const fg = overview?.fearAndGreed;
  const gm = overview?.globalMetrics;
  const badge = getModeBadge(overview?.mode ?? "snapshot", hasCustomKey);

  return (
    <header className="sticky top-0 z-30 border-b border-[#252B3D] bg-[#0D1421]/95 backdrop-blur-md">
      {/* Macro Context Ribbon */}
      <div className="border-b border-[#22283A] bg-[#0A101B]">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-1.5 px-4 py-1.5 text-xs sm:px-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[#A1A7BB]">
            <span className="font-medium tracking-wider text-[#646B80] uppercase">
              CMC Macro Feed
            </span>
            {btc && (
              <span className="flex items-center gap-1.5">
                <TokenLogo cryptoId={btc.id} symbol={btc.symbol} name={btc.name} size={16} />
                <span className="text-[#A1A7BB]">BTC</span>
                <span className="num text-white">{formatCurrency(btc.price)}</span>
                <span
                  className={`num ${
                    btc.percent_change_24h >= 0 ? "text-[#16C784]" : "text-[#EA3943]"
                  }`}
                >
                  {formatPercent(btc.percent_change_24h, true)}
                </span>
              </span>
            )}
            {eth && (
              <span className="hidden items-center gap-1.5 sm:flex">
                <TokenLogo cryptoId={eth.id} symbol={eth.symbol} name={eth.name} size={16} />
                <span className="text-[#A1A7BB]">ETH</span>
                <span className="num text-white">{formatCurrency(eth.price)}</span>
                <span
                  className={`num ${
                    eth.percent_change_24h >= 0 ? "text-[#16C784]" : "text-[#EA3943]"
                  }`}
                >
                  {formatPercent(eth.percent_change_24h, true)}
                </span>
              </span>
            )}
            {gm && (
              <span className="hidden items-center gap-1.5 md:flex">
                <span className="text-[#A1A7BB]">Global Crypto Cap</span>
                <span className="num text-[#6188FF]">
                  {formatCurrency(gm.total_market_cap, true)}
                </span>
                <span className="text-[#4B5563]">·</span>
                <span className="text-[#A1A7BB]">BTC.D</span>
                <span className="num text-white">{gm.btc_dominance.toFixed(1)}%</span>
              </span>
            )}
            {fg && (
              <span className="flex items-center gap-1.5">
                <span className="text-[#A1A7BB]">CMC Fear &amp; Greed</span>
                <span
                  className={`num font-medium ${
                    fg.value <= 25
                      ? "text-[#EA3943]"
                      : fg.value >= 70
                        ? "text-[#16C784]"
                        : "text-[#F3BA2F]"
                  }`}
                >
                  {fg.value}/100 ({fg.value_classification})
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span className={`h-1.5 w-1.5 rounded-full ${badge.dotClass}`} />
            <span className={`num font-medium tracking-wide ${badge.textClass}`}>
              {badge.label}
            </span>
          </div>
        </div>
      </div>

      {/* Primary Terminal Navigation */}
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <Link
              id="brand-landing-link"
              href="/"
              className="group flex items-center text-left"
              title="Back to ParityLens Overview"
            >
              <ParityLensLogo size="md" />
            </Link>
            <span className="hidden rounded-full border border-[#3861FB]/30 bg-[#1E274F]/80 px-2 py-0.5 text-[10px] font-medium tracking-wider text-[#89A5FF] uppercase lg:inline-flex lg:items-center lg:gap-1.5">
              <span>RWA Terminal</span>
              <span className="text-[#4C5C96]">·</span>
              <span className="num text-[#F3BA2F]">CMC v5</span>
            </span>
          </div>

          <nav aria-label="Primary sections" className="flex items-center gap-1">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  type="button"
                  onClick={() => onSelectTab(tab.id)}
                  className={`relative rounded-lg px-3 py-1.5 text-xs font-medium transition-colors sm:text-[13px] ${
                    isActive
                      ? "bg-[#1E274F]/85 text-white"
                      : "text-[#A1A7BB] hover:bg-[#1A2033] hover:text-white"
                  }`}
                >
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  {isActive && (
                    <span className="absolute inset-x-3 -bottom-[13px] h-[2px] bg-[#3861FB]" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Link
            id="btn-back-overview"
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A3147] bg-[#161B2A] px-2.5 py-1.5 text-xs font-medium text-[#A1A7BB] transition-colors hover:border-[#6188FF]/45 hover:text-white"
            title="View ParityLens Landing Page"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Overview</span>
          </Link>
          {introHidden && onShowIntro && (
            <button
              id="btn-show-intro"
              type="button"
              onClick={onShowIntro}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A3147] bg-[#161B2A] px-2.5 py-1.5 text-xs font-medium text-[#A1A7BB] transition-colors hover:border-[#F3BA2F]/45 hover:text-white"
              title="Restore Quick Judge Tour strip"
            >
              <Compass className="h-3.5 w-3.5 text-[#F3BA2F]" />
              <span className="hidden md:inline">Tour</span>
            </button>
          )}
          <button
            id="btn-refresh-data"
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A3147] bg-[#161B2A] px-2.5 py-1.5 text-xs font-medium text-[#C8CEE0] transition-colors hover:border-[#6188FF]/45 hover:text-white disabled:opacity-50"
            title="Bypass TTL cache and refresh from CoinMarketCap API"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            id="btn-open-api-inspector"
            type="button"
            onClick={onOpenInspector}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#3861FB]/45 bg-[#192241] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-[#6188FF] hover:bg-[#22305C]"
          >
            <Terminal className="h-3.5 w-3.5 text-[#6188FF]" />
            <span>API Inspector</span>
            <span className="num rounded bg-[#3861FB]/25 px-1.5 py-0.5 text-[11px] text-[#A9BEFF]">
              {traceCount}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
