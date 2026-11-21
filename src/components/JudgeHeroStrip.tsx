"use client";

import { ArrowUpRight, Building2, EyeOff, PieChart, Scale, Terminal } from "lucide-react";

interface JudgeHeroStripProps {
  onTourGold: () => void;
  onTourIssuer: () => void;
  onTourPortfolio: () => void;
  onOpenInspector: () => void;
  onHide: () => void;
}

export function JudgeHeroStrip({
  onTourGold,
  onTourIssuer,
  onTourPortfolio,
  onOpenInspector,
  onHide,
}: JudgeHeroStripProps) {
  return (
    <section
      id="judge-hero-strip"
      aria-label="ParityLens Quick Judge Tour"
      className="terminal-panel mb-5 rounded-lg px-4 py-3.5 sm:px-5"
    >
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="num rounded bg-[#eab308]/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-[#eab308] uppercase">
              Quick Judge Tour
            </span>
            <span className="text-[11px] font-medium text-slate-500">
              CMC API v5 / v3 · Real-World Assets Track
            </span>
          </div>
          <h2 className="mt-1.5 text-base font-semibold tracking-tight text-slate-50 sm:text-[17px]">
            Institutional RWA Parity, Concentration &amp; Liquidity Terminal
          </h2>
          <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-slate-400">
            Track cross-issuer RWA parity spreads in real time with automatic{" "}
            <span className="num text-slate-300">1oz</span> vs{" "}
            <span className="num text-slate-300">1g</span> unit-mismatch filtering, HHI issuer
            concentration risk, and live liquidity telemetry powered by CoinMarketCap API v5/v3.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            id="hero-btn-api-inspector"
            type="button"
            onClick={onOpenInspector}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200/[0.12] bg-[#151d28] px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-[#eab308]/50 hover:text-white"
          >
            <Terminal className="h-3.5 w-3.5 text-[#eab308]" />
            <span>Live API Inspector</span>
          </button>
          <button
            id="hero-btn-hide-intro"
            type="button"
            onClick={onHide}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200/[0.08] bg-transparent px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-slate-200/[0.18] hover:text-slate-200"
          >
            <EyeOff className="h-3.5 w-3.5" />
            <span>Hide intro</span>
          </button>
        </div>
      </div>

      {/* 3 Quick Judge Tour Action Cards */}
      <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
        <button
          id="judge-tour-gold"
          type="button"
          onClick={onTourGold}
          className="group flex items-start justify-between gap-2 rounded-md border border-slate-200/[0.08] bg-[#0b1017] px-3 py-2.5 text-left transition-colors hover:border-[#eab308]/45 hover:bg-[#121923]"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-100 group-hover:text-white">
              <Scale className="h-3.5 w-3.5 shrink-0 text-[#eab308]" />
              <span className="truncate">Gold Multi-Issuer Spread</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              <span className="num text-[#eab308]/90">1oz vs 1g filter</span> · PAXG, XAUt &amp;
              XAUM bps spread with unit-scaled exclusions.
            </p>
          </div>
          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500 transition-colors group-hover:text-[#eab308]" />
        </button>

        <button
          id="judge-tour-issuer"
          type="button"
          onClick={onTourIssuer}
          className="group flex items-start justify-between gap-2 rounded-md border border-slate-200/[0.08] bg-[#0b1017] px-3 py-2.5 text-left transition-colors hover:border-[#eab308]/45 hover:bg-[#121923]"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-100 group-hover:text-white">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <span className="truncate">Issuer Concentration Audit</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              <span className="text-emerald-300/90">Backed Assets</span> · Drill into issued token
              catalogs &amp; priced RWA coverage.
            </p>
          </div>
          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500 transition-colors group-hover:text-[#eab308]" />
        </button>

        <button
          id="judge-tour-portfolio"
          type="button"
          onClick={onTourPortfolio}
          className="group flex items-start justify-between gap-2 rounded-md border border-slate-200/[0.08] bg-[#0b1017] px-3 py-2.5 text-left transition-colors hover:border-[#eab308]/45 hover:bg-[#121923]"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-100 group-hover:text-white">
              <PieChart className="h-3.5 w-3.5 shrink-0 text-sky-400" />
              <span className="truncate">Hybrid Crypto + RWA Hedge</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              <span className="text-sky-300/90">Portfolio Lab</span> · Combine live BTC/ETH/SOL with
              tokenized Gold, T-bills &amp; equities.
            </p>
          </div>
          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500 transition-colors group-hover:text-[#eab308]" />
        </button>
      </div>
    </section>
  );
}
