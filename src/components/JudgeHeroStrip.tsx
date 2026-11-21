"use client";

import { ArrowUpRight, EyeOff, Terminal } from "lucide-react";
import { IssuerLogo, RwaLogo, TokenLogo } from "@/components/AssetLogo";

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
      className="terminal-panel mb-5 rounded-xl px-4 py-3.5 sm:px-5"
    >
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="num rounded-full border border-[#3861FB]/35 bg-[#1E274F] px-2 py-0.5 text-[10px] font-semibold tracking-wider text-[#89A5FF] uppercase">
              Quick Judge Tour
            </span>
            <span className="text-[11px] font-medium text-[#7C849C]">
              CoinMarketCap API v5 / v3 · Real-World Assets Track
            </span>
          </div>
          <h2 className="mt-1.5 text-base font-semibold tracking-tight text-white sm:text-[17px]">
            Multi-Issuer RWA Parity, Concentration &amp; Liquidity Terminal
          </h2>
          <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-[#A1A7BB]">
            Real-time cross-issuer RWA spreads with automatic{" "}
            <span className="num text-white">1oz</span> vs{" "}
            <span className="num text-white">1g</span> unit-mismatch filtering, HHI issuer
            concentration risk, and live liquidity telemetry powered by CoinMarketCap API v5/v3.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            id="hero-btn-api-inspector"
            type="button"
            onClick={onOpenInspector}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#3861FB]/40 bg-[#192241] px-3 py-1.5 text-xs font-medium text-[#A9BEFF] transition-colors hover:border-[#6188FF] hover:text-white"
          >
            <Terminal className="h-3.5 w-3.5 text-[#6188FF]" />
            <span>Live API Inspector</span>
          </button>
          <button
            id="hero-btn-hide-intro"
            type="button"
            onClick={onHide}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2B3349] bg-transparent px-2.5 py-1.5 text-xs font-medium text-[#8E96AF] transition-colors hover:border-[#4B556E] hover:text-white"
          >
            <EyeOff className="h-3.5 w-3.5" />
            <span>Hide intro</span>
          </button>
        </div>
      </div>

      {/* 3 Quick Judge Tour Cards with REAL CMC Logos */}
      <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
        <button
          id="judge-tour-gold"
          type="button"
          onClick={onTourGold}
          className="group flex items-start justify-between gap-2 rounded-lg border border-[#262E43] bg-[#111726] px-3 py-2.5 text-left transition-all hover:border-[#F3BA2F]/55 hover:bg-[#171F33]"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <RwaLogo symbol="GOLD" assetType="commodity" size={18} />
              <span className="truncate">Gold Multi-Issuer Spread</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-[#9DA4B8]">
              <span className="num text-[#F3BA2F]">1oz vs 1g filter</span> · PAXG, XAUt &amp; XAUM
              bps spread with unit-scaled exclusions.
            </p>
          </div>
          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#646B80] transition-colors group-hover:text-[#F3BA2F]" />
        </button>

        <button
          id="judge-tour-issuer"
          type="button"
          onClick={onTourIssuer}
          className="group flex items-start justify-between gap-2 rounded-lg border border-[#262E43] bg-[#111726] px-3 py-2.5 text-left transition-all hover:border-[#16C784]/55 hover:bg-[#171F33]"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <IssuerLogo name="Backed Assets" size={18} />
              <span className="truncate">Issuer Concentration Audit</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-[#9DA4B8]">
              <span className="text-[#16C784]">Backed Assets</span> · Drill into issued token
              catalogs &amp; priced RWA coverage.
            </p>
          </div>
          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#646B80] transition-colors group-hover:text-[#16C784]" />
        </button>

        <button
          id="judge-tour-portfolio"
          type="button"
          onClick={onTourPortfolio}
          className="group flex items-start justify-between gap-2 rounded-lg border border-[#262E43] bg-[#111726] px-3 py-2.5 text-left transition-all hover:border-[#3861FB]/65 hover:bg-[#171F33]"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <TokenLogo cryptoId={1} symbol="BTC" size={18} />
              <span className="truncate">Hybrid Crypto + RWA Hedge</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-[#9DA4B8]">
              <span className="text-[#6188FF]">Portfolio Lab</span> · Combine live BTC/ETH/SOL with
              tokenized Gold, T-bills &amp; equities.
            </p>
          </div>
          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#646B80] transition-colors group-hover:text-[#6188FF]" />
        </button>
      </div>
    </section>
  );
}
