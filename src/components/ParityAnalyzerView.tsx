"use client";

import { useState } from "react";
import { AlertTriangle, ExternalLink, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  formatAssetTypeLabel,
  formatBps,
  formatCurrency,
  formatPercent,
} from "@/lib/analytics/parity";
import type { RwaDetailResponse, RwaListItem } from "@/lib/cmc/types";

interface ParityAnalyzerViewProps {
  rwaAssets: RwaListItem[];
  selectedRwaId: number;
  onSelectRwa: (rwaId: number) => void;
  detail: RwaDetailResponse | null;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSelectIssuer: (issuerId: string) => void;
}

function formatCmcDescription(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const cleaned = raw
    .replace(/^#{1,6}\s+.*$/gm, "")
    .replace(/\[([^\]]+)\]\s*\((https?:\/\/[^)]+)\)/g, "$1")
    .replace(/\r/g, "")
    .trim();

  return cleaned
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);
}

export function ParityAnalyzerView({
  rwaAssets,
  selectedRwaId,
  onSelectRwa,
  detail,
  loading,
  error,
  onRetry,
  onSelectIssuer,
}: ParityAnalyzerViewProps) {
  const [expandedDescRwaId, setExpandedDescRwaId] = useState<number | null>(null);

  const parity = detail?.parity;
  const quote = detail?.quote;
  const info = detail?.info;
  const frag = detail?.fragmentation;

  const comparableTokens = parity
    ? parity.tokens.filter((t) => t.parityStatus === "INCLUDED")
    : [];
  const rulerTokens =
    comparableTokens.length > 0 ? comparableTokens : (parity?.tokens ?? []);

  const maxAbsDevBps = rulerTokens.length
    ? Math.max(10, ...rulerTokens.map((t) => Math.abs(t.deviationBps)))
    : 25;

  const descriptionParagraphs = formatCmcDescription(info?.about?.description);
  const descExpanded = quote !== undefined && expandedDescRwaId === quote.rwa_id;
  const visibleParagraphs = descExpanded
    ? descriptionParagraphs
    : descriptionParagraphs.slice(0, 2);

  const liquidTokenBars = parity
    ? parity.tokens.filter((t) => t.volume_24h > 0).sort((a, b) => b.volume_24h - a.volume_24h)
    : [];

  return (
    <div className="space-y-5">
      {/* Asset Switcher Strip */}
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Multi-Issuer Parity &amp; Spread Analyzer
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Cross-issuer price dispersion, basis-point depeg detection, HHI issuer concentration,
            and exchange liquidity fragmentation from CoinMarketCap RWA v5.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {rwaAssets.slice(0, 8).map((item) => {
            const active = item.rwa_id === selectedRwaId;
            return (
              <button
                key={item.rwa_id}
                id={`select-rwa-${item.rwa_id}`}
                type="button"
                onClick={() => onSelectRwa(item.rwa_id)}
                className={`num rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "bg-[#eab308] text-[#090c10]"
                    : "border border-slate-200/[0.08] bg-[#10151d] text-slate-300 hover:border-slate-200/[0.2] hover:text-white"
                }`}
              >
                {item.symbol}
              </button>
            );
          })}
          {rwaAssets.length > 8 && (
            <select
              id="select-rwa-all"
              aria-label="Select any ranked RWA asset"
              value={selectedRwaId}
              onChange={(e) => onSelectRwa(Number(e.target.value))}
              className="num rounded-md border border-slate-200/[0.12] bg-[#10151d] px-2.5 py-1 text-xs text-slate-200 focus:border-[#eab308]/60 focus:outline-none"
            >
              {rwaAssets.map((item) => (
                <option key={item.rwa_id} value={item.rwa_id}>
                  #{item.rwa_rank} {item.symbol} — {item.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {!loading && error ? (
        <div className="terminal-panel flex h-72 flex-col items-center justify-center gap-3 rounded-lg p-6 text-center">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <div className="text-sm font-medium text-slate-100">Unable to load RWA parity profile</div>
          <p className="max-w-md text-xs text-slate-400">{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#eab308] px-3 py-1.5 text-xs font-semibold text-[#090c10] hover:bg-[#facc15]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          )}
        </div>
      ) : loading || !detail || !parity || !quote || !frag ? (
        <div className="terminal-panel flex h-72 items-center justify-center rounded-lg text-sm text-slate-400">
          Fetching live RWA quotes, metadata, and market pairs from CoinMarketCap v5...
        </div>
      ) : (
        <>
          {/* Asset Header & 4 Parity KPIs */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="terminal-panel rounded-lg p-4">
              <div className="flex items-center justify-between text-[11px] font-medium tracking-wider text-slate-400 uppercase">
                <span>Inter-Issuer Spread</span>
                <GradeTag grade={parity.grade} />
              </div>
              <div className="num mt-2 text-2xl font-semibold text-slate-50">
                {parity.grade === "SINGLE_ISSUER" ? "Single Issuer" : formatBps(parity.spreadBps)}
              </div>
              <div className="num mt-1 text-xs text-slate-500">
                Range {formatCurrency(parity.minPrice)} – {formatCurrency(parity.maxPrice)}
              </div>
            </div>

            <div className="terminal-panel rounded-lg p-4">
              <div className="text-[11px] font-medium tracking-wider text-slate-400 uppercase">
                Avg Tokenized Price
              </div>
              <div className="num mt-2 text-2xl font-semibold text-slate-50">
                {formatCurrency(parity.averagePrice)}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {quote.name} ({quote.symbol}) · {formatAssetTypeLabel(quote.asset_type)}
              </div>
            </div>

            <div className="terminal-panel rounded-lg p-4">
              <div className="flex items-center justify-between text-[11px] font-medium tracking-wider text-slate-400 uppercase">
                <span>Issuer Concentration (HHI)</span>
                <span
                  className={`num text-[11px] font-semibold ${
                    parity.concentrationLabel === "CONCENTRATED"
                      ? "text-red-400"
                      : parity.concentrationLabel === "MODERATE"
                        ? "text-amber-300"
                        : "text-emerald-400"
                  }`}
                >
                  {parity.concentrationLabel}
                </span>
              </div>
              <div className="num mt-2 text-2xl font-semibold text-slate-50">
                {parity.hhiScore.toLocaleString("en-US")}
                <span className="text-xs font-normal text-slate-500"> / 10,000</span>
              </div>
              <div className="mt-1 truncate text-xs text-slate-500">
                Lead: <span className="text-slate-300">{parity.dominantIssuer}</span> (
                <span className="num">{parity.dominantIssuerSharePct.toFixed(1)}%</span>)
              </div>
            </div>

            <div className="terminal-panel rounded-lg p-4">
              <div className="text-[11px] font-medium tracking-wider text-slate-400 uppercase">
                {detail.pairsPlanRestricted ? "Token 24h Liquidity" : "Venue Fragmentation"}
              </div>
              {detail.pairsPlanRestricted ? (
                <>
                  <div className="num mt-2 text-2xl font-semibold text-slate-50">
                    {formatCurrency(parity.totalTokenVolume24h, true)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Turnover{" "}
                    <span className="num text-slate-300">
                      {formatPercent(parity.turnoverRatioPct)}
                    </span>{" "}
                    · Pairs require Startup+
                  </div>
                </>
              ) : (
                <>
                  <div className="num mt-2 text-2xl font-semibold text-slate-50">
                    {frag.uniqueExchanges} venues
                    <span className="text-xs font-normal text-slate-500">
                      {" "}
                      · {frag.totalPairs} pairs
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Top venue: <span className="text-slate-300">{frag.topExchangeName}</span> (
                    <span className="num">{frag.topExchangeSharePct.toFixed(1)}%</span>)
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Visual Parity Deviation Ruler + Competing Tokens Table */}
          <section className="terminal-panel overflow-hidden rounded-lg">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/[0.08] px-4 py-3">
              <div>
                <h2 className="text-xs font-semibold tracking-wider text-slate-200 uppercase">
                  Competing On-Chain Tokens — Deviation vs Average Tokenized Price
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Positive bps indicates trading at a premium to the CMC aggregate average; negative
                  bps indicates a discount.
                  {parity.excludedTokenCount > 0 && (
                    <span className="text-amber-300/90">
                      {" "}
                      ({parity.excludedTokenCount} unit-scaled or zero-liquidity token
                      {parity.excludedTokenCount === 1 ? "" : "s"} excluded from spread calculation)
                    </span>
                  )}
                </p>
              </div>
              <div className="num text-xs text-slate-400">
                {parity.tokens.length} token{parity.tokens.length === 1 ? "" : "s"} ·{" "}
                {parity.issuerCount} issuer{parity.issuerCount === 1 ? "" : "s"}
              </div>
            </div>

            {/* Basis-Point Deviation Chart */}
            <div className="border-b border-slate-200/[0.06] bg-[#0c1016] px-4 py-4">
              <div className="space-y-3">
                {rulerTokens.map((token) => {
                  const pctOffset = Math.min(48, (Math.abs(token.deviationBps) / maxAbsDevBps) * 48);
                  const isPremium = token.deviationBps >= 0;
                  const barColor =
                    Math.abs(token.deviationBps) > 35
                      ? "#ef4444"
                      : isPremium
                        ? "#10b981"
                        : "#38bdf8";

                  return (
                    <div
                      key={`${token.crypto_id}-${token.symbol}`}
                      className="grid grid-cols-12 items-center gap-3 text-xs"
                    >
                      <div className="col-span-4 sm:col-span-3">
                        <div className="flex items-center gap-2">
                          <span className="num font-semibold text-slate-100">{token.symbol}</span>
                          <span className="truncate text-[11px] text-slate-500">
                            {token.issuer_name}
                          </span>
                        </div>
                      </div>

                      <div className="col-span-5 sm:col-span-6">
                        <div className="relative h-5 w-full rounded bg-slate-900/90">
                          <div className="absolute inset-y-0 left-1/2 w-px bg-slate-600/60" />
                          <div
                            className="absolute top-1 bottom-1 rounded-[2px] transition-all duration-300"
                            style={{
                              backgroundColor: barColor,
                              left: isPremium ? "50%" : `${50 - pctOffset}%`,
                              width: `${Math.max(pctOffset, 1.2)}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="col-span-3 text-right">
                        <span
                          className={`num font-medium ${
                            Math.abs(token.deviationBps) > 35
                              ? "text-red-400"
                              : isPremium
                                ? "text-emerald-400"
                                : "text-sky-400"
                          }`}
                        >
                          {formatBps(token.deviationBps, true)}
                        </span>
                        <span className="num ml-2 hidden text-slate-500 md:inline">
                          ({formatCurrency(token.price)})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="num mt-3 flex justify-between text-[10px] text-slate-500">
                <span>-{maxAbsDevBps.toFixed(0)} bps (Discount)</span>
                <span>0.0 bps (Avg Parity)</span>
                <span>+{maxAbsDevBps.toFixed(0)} bps (Premium)</span>
              </div>
            </div>

            {/* Detailed Token Comparison Table */}
            <div className="terminal-scroll overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/[0.08] bg-[#0d1218] text-[11px] font-medium tracking-wider text-slate-400 uppercase">
                    <th className="px-4 py-2.5">Token</th>
                    <th className="px-4 py-2.5">Issuer</th>
                    <th className="px-4 py-2.5 text-right">Live Price</th>
                    <th className="px-4 py-2.5 text-right">Parity Dev</th>
                    <th className="px-4 py-2.5 text-right">Market Cap</th>
                    <th className="px-4 py-2.5 text-right">Cap Share</th>
                    <th className="px-4 py-2.5 text-right">24h Volume</th>
                    <th className="px-4 py-2.5 text-right">Turnover</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/[0.05]">
                  {parity.tokens.map((t) => (
                    <tr
                      key={`${t.crypto_id}-${t.issuer_id}`}
                      className="transition-colors hover:bg-[#161e29]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-100">{t.symbol}</span>
                          {t.parityStatus === "UNIT_MISMATCH" && (
                            <span
                              title="Different denomination/unit scale vs underlying benchmark (excluded from inter-issuer spread)"
                              className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300"
                            >
                              Unit-Scaled
                            </span>
                          )}
                          {t.parityStatus === "NO_LIQUIDITY" && (
                            <span
                              title="Zero reported market cap and 24h volume (excluded from inter-issuer spread)"
                              className="rounded bg-slate-700/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-300"
                            >
                              No Spot Liq
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">{t.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => onSelectIssuer(t.issuer_id)}
                          className="text-left text-xs font-medium text-[#eab308] hover:underline"
                        >
                          {t.issuer_name}
                        </button>
                      </td>
                      <td className="num px-4 py-3 text-right font-medium text-slate-100">
                        {formatCurrency(t.price)}
                      </td>
                      <td
                        className={`num px-4 py-3 text-right ${
                          t.parityStatus !== "INCLUDED"
                            ? "text-slate-500"
                            : Math.abs(t.deviationBps) > 35
                              ? "text-red-400"
                              : t.deviationBps >= 0
                                ? "text-emerald-400"
                                : "text-sky-400"
                        }`}
                      >
                        {t.parityStatus === "UNIT_MISMATCH"
                          ? "Excl. (unit)"
                          : t.parityStatus === "NO_LIQUIDITY"
                            ? "Excl. (0 liq)"
                            : formatBps(t.deviationBps, true)}
                      </td>
                      <td className="num px-4 py-3 text-right text-slate-200">
                        {formatCurrency(t.market_cap, true)}
                      </td>
                      <td className="num px-4 py-3 text-right text-slate-300">
                        {t.marketCapSharePct.toFixed(1)}%
                      </td>
                      <td className="num px-4 py-3 text-right text-slate-300">
                        {formatCurrency(t.volume_24h, true)}
                      </td>
                      <td className="num px-4 py-3 text-right text-slate-400">
                        {formatPercent(t.turnoverPct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Lower Split: Venue Fragmentation + Asset Metadata & TradFi Markets */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Left 7 cols: Active Venues & Market Pairs (or Live Token Liquidity when Basic plan) */}
            <section className="terminal-panel overflow-hidden rounded-lg lg:col-span-7">
              <div className="flex items-center justify-between border-b border-slate-200/[0.08] px-4 py-3">
                <h2 className="text-xs font-semibold tracking-wider text-slate-200 uppercase">
                  {detail.pairsPlanRestricted
                    ? "Live Token 24h Liquidity Distribution"
                    : "Venue Liquidity & Active Market Pairs"}
                </h2>
                <span className="num text-xs text-slate-500">
                  {detail.pairsPlanRestricted
                    ? "CMC Startup+ unlocks CEX/DEX pairs"
                    : `Cross-venue spread: ${formatBps(frag.priceSpreadAcrossVenuesBps)}`}
                </span>
              </div>

              {detail.pairsPlanRestricted ? (
                <div className="space-y-4 p-4">
                  <div className="rounded-md border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5 text-xs text-amber-200">
                    {detail.pairsNote}
                  </div>
                  <div className="space-y-2.5">
                    {liquidTokenBars.map((tok) => (
                      <div key={`${tok.crypto_id}-${tok.symbol}`} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-200">
                            <span className="num">{tok.symbol}</span>{" "}
                            <span className="text-[11px] text-slate-500">({tok.issuer_name})</span>
                          </span>
                          <span className="num text-slate-300">
                            {formatCurrency(tok.volume_24h, true)}{" "}
                            <span className="text-slate-500">
                              ({tok.volumeSharePct.toFixed(1)}%)
                            </span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-[#eab308]"
                            style={{ width: `${Math.max(tok.volumeSharePct, 1.5)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {liquidTokenBars.length === 0 && (
                      <p className="text-xs text-slate-500">
                        No reported 24h token volume for this asset.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2.5 border-b border-slate-200/[0.06] bg-[#0c1016] p-4">
                    {frag.byExchange.slice(0, 5).map((venue) => (
                      <div key={venue.exchangeName} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-200">
                            {venue.exchangeName}{" "}
                            <span className="num text-[11px] text-slate-500">
                              ({venue.pairCount} {venue.pairCount === 1 ? "pair" : "pairs"})
                            </span>
                          </span>
                          <span className="num text-slate-300">
                            {formatCurrency(venue.volume24h, true)}{" "}
                            <span className="text-slate-500">({venue.sharePct.toFixed(1)}%)</span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-[#eab308]"
                            style={{ width: `${Math.max(venue.sharePct, 2)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="terminal-scroll overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200/[0.08] text-[11px] font-medium tracking-wider text-slate-400 uppercase">
                          <th className="px-4 py-2.5">Exchange</th>
                          <th className="px-4 py-2.5">Pair</th>
                          <th className="px-4 py-2.5">Type</th>
                          <th className="px-4 py-2.5 text-right">Price</th>
                          <th className="px-4 py-2.5 text-right">24h Volume</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/[0.05]">
                        {detail.pairs.market_pairs.slice(0, 8).map((pair) => {
                          const usd =
                            pair.quotes?.find((q) => q.symbol === "USD") ?? pair.quotes?.[0];
                          const price = usd?.price ?? pair.exchange_reported_quotes?.price ?? 0;
                          const vol =
                            usd?.volume_24h ?? pair.exchange_reported_quotes?.volume_24h_quote ?? 0;
                          return (
                            <tr
                              key={`${pair.market_id}-${pair.market_pair}`}
                              className="hover:bg-[#161e29]"
                            >
                              <td className="px-4 py-2.5 font-medium text-slate-200">
                                {pair.exchange.name}
                              </td>
                              <td className="num px-4 py-2.5 text-slate-300">{pair.market_pair}</td>
                              <td className="px-4 py-2.5 text-[11px] text-slate-400 uppercase">
                                {pair.category}
                              </td>
                              <td className="num px-4 py-2.5 text-right text-slate-200">
                                {formatCurrency(price)}
                              </td>
                              <td className="num px-4 py-2.5 text-right text-slate-300">
                                {formatCurrency(vol, true)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            {/* Right 5 cols: Underlying Asset Metadata & TradFi Reference */}
            <section className="terminal-panel flex flex-col justify-between rounded-lg p-4 lg:col-span-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/[0.08] pb-3">
                  <h2 className="text-xs font-semibold tracking-wider text-slate-200 uppercase">
                    Underlying Reference Profile
                  </h2>
                  <span className="num text-[11px] text-slate-500">rwa_id:{quote.rwa_id}</span>
                </div>

                <div className="space-y-2 text-xs leading-relaxed text-slate-300">
                  {visibleParagraphs.length > 0 ? (
                    visibleParagraphs.map((para, idx) => <p key={idx}>{para}</p>)
                  ) : (
                    <p>
                      {`${quote.name} (${quote.symbol}) is a tokenized ${formatAssetTypeLabel(
                        quote.asset_type
                      ).toLowerCase()} asset tracked across CoinMarketCap RWA v5 endpoints.`}
                    </p>
                  )}
                  {descriptionParagraphs.length > 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedDescRwaId(descExpanded ? null : quote.rwa_id)
                      }
                      className="text-[11px] font-medium text-[#eab308] hover:underline"
                    >
                      {descExpanded
                        ? "Show concise summary"
                        : `Read full CMC profile (${descriptionParagraphs.length} sections)`}
                    </button>
                  )}
                </div>

                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div className="terminal-subpanel rounded p-2.5">
                    <dt className="text-[11px] text-slate-500">Primary Exchange</dt>
                    <dd className="mt-0.5 font-medium text-slate-200">
                      {info?.primary_exchange ?? "Multi-venue / OTC"}
                    </dd>
                  </div>
                  <div className="terminal-subpanel rounded p-2.5">
                    <dt className="text-[11px] text-slate-500">Industry / Sector</dt>
                    <dd className="mt-0.5 font-medium text-slate-200">
                      {info?.industry ?? formatAssetTypeLabel(quote.asset_type)}
                    </dd>
                  </div>
                  <div className="terminal-subpanel rounded p-2.5">
                    <dt className="text-[11px] text-slate-500">SEC CIK</dt>
                    <dd className="num mt-0.5 font-medium text-slate-200">
                      {info?.cik ?? "N/A"}
                    </dd>
                  </div>
                  <div className="terminal-subpanel rounded p-2.5">
                    <dt className="text-[11px] text-slate-500">Founded / Employees</dt>
                    <dd className="num mt-0.5 font-medium text-slate-200">
                      {info?.founded ? info.founded.slice(0, 4) : "—"}
                      {info?.employees ? ` · ${info.employees.toLocaleString("en-US")}` : ""}
                    </dd>
                  </div>
                </dl>

                {/* TradFi Reference Markets */}
                <div>
                  <h3 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                    Linked TradFi Markets ({quote.tradfi_markets?.length ?? 0})
                  </h3>
                  {quote.tradfi_markets && quote.tradfi_markets.length > 0 ? (
                    <div className="mt-2 space-y-1.5">
                      {quote.tradfi_markets.map((m, idx) => (
                        <a
                          key={`${m.ticker}-${idx}`}
                          href={m.market_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded border border-slate-200/[0.08] bg-[#0c1016] px-3 py-2 text-xs text-slate-200 transition-colors hover:border-[#eab308]/40"
                        >
                          <span>
                            {m.exchange.name} ·{" "}
                            <span className="num text-[#eab308]">{m.ticker}</span>
                          </span>
                          <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1.5 text-xs text-slate-500">
                      No direct TradFi reference venue linked on this asset yet in CMC v5.
                    </p>
                  )}
                </div>
              </div>

              {/* Risk Callout */}
              <div className="mt-4 rounded-md border border-slate-200/[0.08] bg-[#0c1016] p-3 text-xs">
                <div className="flex items-start gap-2.5">
                  {parity.concentrationLabel === "CONCENTRATED" || parity.grade === "WIDE" ? (
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  ) : (
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  )}
                  <div className="text-slate-300">
                    <span className="font-semibold text-slate-100">ParityLens Assessment: </span>
                    {parity.grade === "SINGLE_ISSUER"
                      ? `Single-issuer exposure (${parity.dominantIssuer}). No competing on-chain arbitrageur exists to enforce tighter secondary-market pegs.`
                      : parity.grade === "WIDE"
                        ? `Elevated cross-issuer price dispersion (${formatBps(parity.spreadBps)}). Verify redemption fees and venue depth before routing size.`
                        : `Healthy secondary parity (${formatBps(parity.spreadBps)}) across ${parity.issuerCount} competing issuers with HHI ${parity.hhiScore.toLocaleString("en-US")}.`}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function GradeTag({ grade }: { grade: "TIGHT" | "MODERATE" | "WIDE" | "SINGLE_ISSUER" }) {
  const styles =
    grade === "TIGHT"
      ? "bg-emerald-500/15 text-emerald-300"
      : grade === "MODERATE"
        ? "bg-amber-500/15 text-amber-300"
        : grade === "WIDE"
          ? "bg-red-500/15 text-red-300"
          : "bg-slate-700/60 text-slate-300";

  return (
    <span className={`num rounded px-1.5 py-0.5 text-[10px] font-semibold ${styles}`}>
      {grade.replace("_", " ")}
    </span>
  );
}
