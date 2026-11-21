"use client";

import { RefreshCw, Terminal } from "lucide-react";
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
}: TerminalHeaderProps) {
  const btc = overview?.cryptoBenchmarks.find((c) => c.symbol === "BTC");
  const eth = overview?.cryptoBenchmarks.find((c) => c.symbol === "ETH");
  const fg = overview?.fearAndGreed;
  const gm = overview?.globalMetrics;
  const badge = getModeBadge(overview?.mode ?? "snapshot", hasCustomKey);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/[0.08] bg-[#090c10]/95 backdrop-blur-md">
      {/* Macro Context Ribbon */}
      <div className="border-b border-slate-200/[0.06] bg-[#0c1016]">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-1.5 px-4 py-1.5 text-xs sm:px-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-slate-400">
            <span className="font-medium tracking-wider text-slate-500 uppercase">
              CMC Macro Feed
            </span>
            {btc && (
              <span className="flex items-center gap-1.5">
                <span className="text-slate-400">BTC</span>
                <span className="num text-slate-100">{formatCurrency(btc.price)}</span>
                <span
                  className={`num ${
                    btc.percent_change_24h >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {formatPercent(btc.percent_change_24h, true)}
                </span>
              </span>
            )}
            {eth && (
              <span className="hidden items-center gap-1.5 sm:flex">
                <span className="text-slate-400">ETH</span>
                <span className="num text-slate-100">{formatCurrency(eth.price)}</span>
                <span
                  className={`num ${
                    eth.percent_change_24h >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {formatPercent(eth.percent_change_24h, true)}
                </span>
              </span>
            )}
            {gm && (
              <span className="hidden items-center gap-1.5 md:flex">
                <span className="text-slate-400">Global Crypto Cap</span>
                <span className="num text-slate-200">
                  {formatCurrency(gm.total_market_cap, true)}
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-400">BTC.D</span>
                <span className="num text-slate-200">{gm.btc_dominance.toFixed(1)}%</span>
              </span>
            )}
            {fg && (
              <span className="flex items-center gap-1.5">
                <span className="text-slate-400">CMC Fear &amp; Greed</span>
                <span
                  className={`num font-medium ${
                    fg.value <= 25
                      ? "text-red-400"
                      : fg.value >= 70
                        ? "text-emerald-400"
                        : "text-amber-300"
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
          <button
            id="brand-home-btn"
            type="button"
            onClick={() => onSelectTab("screener")}
            className="flex items-baseline gap-2.5 text-left"
          >
            <span className="text-base font-semibold tracking-tight text-slate-50">
              Parity<span className="text-[#eab308]">Lens</span>
            </span>
            <span className="hidden text-[11px] font-medium tracking-wider text-slate-500 uppercase lg:inline">
              RWA Terminal · CMC v5
            </span>
          </button>

          <nav aria-label="Primary sections" className="flex items-center gap-1">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  type="button"
                  onClick={() => onSelectTab(tab.id)}
                  className={`relative rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-[13px] ${
                    isActive
                      ? "bg-slate-200/[0.08] text-slate-50"
                      : "text-slate-400 hover:bg-slate-200/[0.04] hover:text-slate-200"
                  }`}
                >
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  {isActive && (
                    <span className="absolute inset-x-3 -bottom-[13px] h-[2px] bg-[#eab308]" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-refresh-data"
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200/[0.1] bg-[#121821] px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-200/[0.2] hover:text-slate-100 disabled:opacity-50"
            title="Bypass TTL cache and refresh from CoinMarketCap API"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            id="btn-open-api-inspector"
            type="button"
            onClick={onOpenInspector}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200/[0.12] bg-[#151d28] px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-[#eab308]/50 hover:text-white"
          >
            <Terminal className="h-3.5 w-3.5 text-[#eab308]" />
            <span>API Inspector</span>
            <span className="num rounded bg-slate-200/[0.08] px-1.5 py-0.5 text-[11px] text-slate-300">
              {traceCount}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
