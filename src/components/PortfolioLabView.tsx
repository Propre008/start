"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Plus, X } from "lucide-react";
import { RwaLogo, TokenLogo } from "@/components/AssetLogo";
import { formatAssetTypeLabel, formatCurrency, formatPercent } from "@/lib/analytics/parity";
import type { OverviewResponse, RwaAssetType, RwaListItem } from "@/lib/cmc/types";

interface PortfolioLabViewProps {
  overview: OverviewResponse;
  onInspectRwa: (rwaId: number) => void;
}

interface HoldingInput {
  id: string;
  sleeve: "crypto" | "rwa";
  symbol: string;
  name: string;
  assetClass: string;
  price: number;
  quantity: number;
  cryptoId?: number;
  rwaId?: number;
  rwaAssetType?: RwaAssetType;
}

interface RwaPresetLeg {
  preferredSymbols: string[];
  fallbackType: RwaAssetType;
  targetUsd: number;
}

interface PresetSpec {
  label: string;
  desc: string;
  cryptoUnits: Record<string, number>;
  rwaLegs: RwaPresetLeg[];
}

const PRESETS: Record<string, PresetSpec> = {
  gold_hedge: {
    label: "Gold-Hedged Crypto",
    desc: "Core crypto paired with tokenized gold, sovereign T-bills & equities",
    cryptoUnits: { BTC: 0.45, ETH: 6, SOL: 25 },
    rwaLegs: [
      { preferredSymbols: ["GOLD", "XAU", "PAXG", "XAUT"], fallbackType: "commodity", targetUsd: 15_400 },
      { preferredSymbols: ["USTB", "USYC", "BUIDL", "OUSG"], fallbackType: "government_security", targetUsd: 12_000 },
      { preferredSymbols: ["NVDA", "NVDAX"], fallbackType: "stock", targetUsd: 4_500 },
      { preferredSymbols: ["SPY", "CSPX"], fallbackType: "etf", targetUsd: 6_200 },
    ],
  },
  treasury_barbell: {
    label: "Treasury Barbell",
    desc: "Yield-heavy sovereign RWA base with BTC/ETH upside",
    cryptoUnits: { BTC: 0.25, ETH: 4, USDT: 5000 },
    rwaLegs: [
      { preferredSymbols: ["USTB", "USYC", "BUIDL", "OUSG"], fallbackType: "government_security", targetUsd: 35_000 },
      { preferredSymbols: ["GOLD", "XAU", "PAXG", "XAUT"], fallbackType: "commodity", targetUsd: 8_800 },
      { preferredSymbols: ["SPY", "CSPX"], fallbackType: "etf", targetUsd: 9_300 },
    ],
  },
  ai_equities: {
    label: "AI & Equities Blend",
    desc: "On-chain tech equities + major Layer-1s",
    cryptoUnits: { BTC: 0.3, ETH: 5, SOL: 40 },
    rwaLegs: [
      { preferredSymbols: ["NVDA", "NVDAX"], fallbackType: "stock", targetUsd: 13_600 },
      { preferredSymbols: ["AAPL", "AAPLX"], fallbackType: "stock", targetUsd: 6_200 },
      { preferredSymbols: ["TSLA", "TSLAX"], fallbackType: "stock", targetUsd: 5_500 },
      { preferredSymbols: ["SPY", "CSPX"], fallbackType: "etf", targetUsd: 7_400 },
    ],
  },
};

const CLASS_COLORS: Record<string, string> = {
  Crypto: "#3861FB",
  Commodities: "#F3BA2F",
  "Gov Securities": "#16C784",
  Equities: "#13B2CF",
  ETFs: "#8A3FFC",
  "FX / Currencies": "#FF775F",
  "Real Estate": "#A1A7BB",
};

function roundPresetUnits(targetUsd: number, price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 1;
  const raw = targetUsd / price;
  if (raw >= 50) return Math.round(raw);
  if (raw >= 5) return Number(raw.toFixed(1));
  return Math.max(0.05, Number(raw.toFixed(2)));
}

/**
 * Always format decimals with a dot (.) regardless of browser OS locale
 * so unit inputs stay visually consistent with USD prices ($60,061.86).
 */
function formatDotDecimal(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return String(Number(value.toFixed(6)));
}

function sanitizeDecimalDraft(raw: string): string {
  const normalized = raw.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const firstDot = normalized.indexOf(".");
  if (firstDot === -1) return normalized;
  return normalized.slice(0, firstDot + 1) + normalized.slice(firstDot + 1).replace(/\./g, "");
}

function resolvePresetAllocation(
  presetKey: string,
  rwaAssets: RwaListItem[]
): Record<string, number> {
  const spec = PRESETS[presetKey] ?? PRESETS.gold_hedge;
  const quantities: Record<string, number> = {};
  for (const [symbol, qty] of Object.entries(spec.cryptoUnits)) {
    if (qty > 0) quantities[`crypto-${symbol}`] = qty;
  }

  const usedIds = new Set<number>();

  for (const leg of spec.rwaLegs) {
    const preferredUpper = new Set(leg.preferredSymbols.map((s) => s.toUpperCase()));
    const match =
      rwaAssets.find(
        (a) => !usedIds.has(a.rwa_id) && preferredUpper.has(a.symbol.toUpperCase())
      ) ??
      rwaAssets.find((a) => !usedIds.has(a.rwa_id) && a.asset_type === leg.fallbackType) ??
      rwaAssets.find((a) => !usedIds.has(a.rwa_id) && a.average_tokenized_price > 0);

    if (match) {
      usedIds.add(match.rwa_id);
      quantities[`rwa-${match.rwa_id}`] = roundPresetUnits(
        leg.targetUsd,
        match.average_tokenized_price
      );
    }
  }

  return quantities;
}

export function PortfolioLabView({ overview, onInspectRwa }: PortfolioLabViewProps) {
  const [activePreset, setActivePreset] = useState<string>("gold_hedge");
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});
  const [assetToAdd, setAssetToAdd] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<string>("");

  const presetQuantities = useMemo(
    () =>
      resolvePresetAllocation(
        activePreset === "custom" ? "gold_hedge" : activePreset,
        overview.rwaAssets
      ),
    [activePreset, overview.rwaAssets]
  );

  const effectiveQuantities =
    activePreset === "custom" ? customQuantities : presetQuantities;

  const catalogPositions = useMemo<HoldingInput[]>(() => {
    const cryptoRows: HoldingInput[] = overview.cryptoBenchmarks.map((c) => {
      const id = `crypto-${c.symbol}`;
      return {
        id,
        sleeve: "crypto",
        symbol: c.symbol,
        name: c.name,
        assetClass: "Crypto",
        price: c.price,
        quantity: effectiveQuantities[id] ?? 0,
        cryptoId: c.id,
      };
    });

    const rwaRows: HoldingInput[] = overview.rwaAssets
      .filter((r) => typeof r.rwa_id === "number" && r.rwa_id > 0)
      .map((r) => {
        const id = `rwa-${r.rwa_id}`;
        return {
          id,
          sleeve: "rwa",
          symbol: r.symbol,
          name: r.name,
          assetClass: formatAssetTypeLabel(r.asset_type),
          price: r.average_tokenized_price,
          quantity: effectiveQuantities[id] ?? 0,
          rwaId: r.rwa_id,
          rwaAssetType: r.asset_type,
        };
      });

    return [...cryptoRows, ...rwaRows];
  }, [overview.cryptoBenchmarks, overview.rwaAssets, effectiveQuantities]);

  // Display only active holdings (units > 0) or the row currently being edited
  const activePositions = useMemo(
    () => catalogPositions.filter((p) => p.quantity > 0 || p.id === editingId),
    [catalogPositions, editingId]
  );

  const addableRwas = useMemo(
    () =>
      catalogPositions.filter(
        (p) => p.sleeve === "rwa" && p.quantity <= 0 && p.id !== editingId
      ),
    [catalogPositions, editingId]
  );

  const addableCryptos = useMemo(
    () =>
      catalogPositions.filter(
        (p) => p.sleeve === "crypto" && p.quantity <= 0 && p.id !== editingId
      ),
    [catalogPositions, editingId]
  );

  const portfolio = useMemo(() => {
    const valued = activePositions.map((p) => ({
      ...p,
      valueUsd: Math.max(0, p.quantity) * p.price,
    }));

    const totalNav = valued.reduce((sum, p) => sum + p.valueUsd, 0);
    const cryptoNav = valued
      .filter((p) => p.sleeve === "crypto")
      .reduce((sum, p) => sum + p.valueUsd, 0);
    const rwaNav = valued
      .filter((p) => p.sleeve === "rwa")
      .reduce((sum, p) => sum + p.valueUsd, 0);

    const cryptoPct = totalNav > 0 ? (cryptoNav / totalNav) * 100 : 0;
    const rwaPct = totalNav > 0 ? (rwaNav / totalNav) * 100 : 0;

    const byClassMap = new Map<string, number>();
    for (const p of valued) {
      if (p.valueUsd <= 0) continue;
      byClassMap.set(p.assetClass, (byClassMap.get(p.assetClass) ?? 0) + p.valueUsd);
    }

    const byClass = Array.from(byClassMap.entries())
      .map(([label, value]) => ({
        label,
        value,
        pct: totalNav > 0 ? (value / totalNav) * 100 : 0,
        color: CLASS_COLORS[label] ?? "#94a3b8",
      }))
      .sort((a, b) => b.value - a.value);

    const activeRwaPositions = valued.filter((p) => p.sleeve === "rwa" && p.valueUsd > 0);
    const largestRwa = [...activeRwaPositions].sort((a, b) => b.valueUsd - a.valueUsd)[0];
    const largestRwaShareOfRwa =
      largestRwa && rwaNav > 0 ? (largestRwa.valueUsd / rwaNav) * 100 : 0;

    return {
      valued,
      totalNav,
      cryptoNav,
      rwaNav,
      cryptoPct,
      rwaPct,
      byClass,
      largestRwa,
      largestRwaShareOfRwa,
    };
  }, [activePositions]);

  function applyPreset(key: string) {
    setEditingId(null);
    setEditingDraft("");
    setActivePreset(key);
  }

  function commitQuantity(positionId: string, nextValue: number) {
    const base = activePreset === "custom" ? customQuantities : presetQuantities;
    const updated = { ...base };
    if (Number.isFinite(nextValue) && nextValue > 0) {
      updated[positionId] = nextValue;
    } else {
      delete updated[positionId];
    }
    setActivePreset("custom");
    setCustomQuantities(updated);
  }

  function handleFocusQty(positionId: string, currentQty: number) {
    setEditingId(positionId);
    setEditingDraft(formatDotDecimal(currentQty));
  }

  function handleChangeQty(positionId: string, raw: string) {
    const clean = sanitizeDecimalDraft(raw);
    setEditingDraft(clean);
    const parsed = Number.parseFloat(clean);
    if (clean === "" || !Number.isFinite(parsed) || parsed <= 0) {
      commitQuantity(positionId, 0);
    } else {
      commitQuantity(positionId, parsed);
    }
  }

  function handleBlurQty() {
    setEditingId(null);
    setEditingDraft("");
  }

  function handleRemoveRow(positionId: string) {
    if (editingId === positionId) {
      setEditingId(null);
      setEditingDraft("");
    }
    commitQuantity(positionId, 0);
  }

  function handleAddAsset() {
    if (!assetToAdd) return;
    const target = catalogPositions.find((p) => p.id === assetToAdd);
    if (!target) return;
    const defaultUnits = roundPresetUnits(2_500, target.price);
    commitQuantity(target.id, defaultUnits);
    setAssetToAdd("");
  }

  const hasAddableOptions = addableRwas.length > 0 || addableCryptos.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-end">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Hybrid Crypto + Tokenized TradFi Portfolio Lab
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Combine native crypto assets (
            <code className="text-slate-300">/v3/cryptocurrency/quotes/latest</code>) and tokenized
            RWAs (<code className="text-slate-300">/v5/real-world-assets/assets/list</code>) in a
            single risk view alongside live CMC Fear &amp; Greed context.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-1.5">
          {Object.entries(PRESETS).map(([key, preset]) => (
            <button
              key={key}
              id={`preset-${key}`}
              type="button"
              onClick={() => applyPreset(key)}
              title={preset.desc}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activePreset === key
                  ? "bg-[#3861FB] text-white shadow-xs"
                  : "border border-[#2A3248] bg-[#141A29] text-[#C8CEE0] hover:border-[#6188FF]/50 hover:text-white"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top Portfolio Summary Strip */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="terminal-panel rounded-lg p-4">
          <div className="text-[11px] font-medium tracking-wider text-slate-400 uppercase">
            Combined Portfolio NAV
          </div>
          <div className="num mt-2 text-2xl font-semibold text-slate-50">
            {formatCurrency(portfolio.totalNav)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            <span className="num text-slate-300">{portfolio.valued.length}</span> active position
            {portfolio.valued.length === 1 ? "" : "s"} across both sleeves
          </div>
        </div>

        <div className="terminal-panel rounded-lg p-4">
          <div className="text-[11px] font-medium tracking-wider text-slate-400 uppercase">
            Crypto vs RWA Split
          </div>
          <div className="num mt-2 flex items-baseline gap-2 text-2xl font-semibold">
            <span className="text-sky-400">{portfolio.cryptoPct.toFixed(1)}%</span>
            <span className="text-sm text-slate-500">/</span>
            <span className="text-[#eab308]">{portfolio.rwaPct.toFixed(1)}%</span>
          </div>
          <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div className="bg-sky-400" style={{ width: `${portfolio.cryptoPct}%` }} />
            <div className="bg-[#eab308]" style={{ width: `${portfolio.rwaPct}%` }} />
          </div>
        </div>

        <div className="terminal-panel rounded-lg p-4">
          <div className="text-[11px] font-medium tracking-wider text-slate-400 uppercase">
            Macro Regime &amp; Concentration Audit
          </div>
          <div className="mt-2 flex items-start gap-2 text-xs text-slate-300">
            {portfolio.largestRwaShareOfRwa > 55 ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            )}
            <div>
              {portfolio.largestRwa ? (
                <span>
                  Top RWA sleeve holding:{" "}
                  <strong className="text-slate-100">{portfolio.largestRwa.symbol}</strong> (
                  <span className="num">{portfolio.largestRwaShareOfRwa.toFixed(0)}%</span> of RWA).
                  CMC Fear &amp; Greed is{" "}
                  <span className="num text-slate-100">{overview.fearAndGreed.value}/100</span> (
                  {overview.fearAndGreed.value_classification}).
                </span>
              ) : (
                <span>Add RWA positions below to hedge native crypto volatility.</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left 8 cols: Active Holdings Editor (units > 0 only) */}
        <section className="terminal-panel overflow-hidden rounded-lg lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/[0.08] px-4 py-3">
            <div>
              <h2 className="text-xs font-semibold tracking-wider text-slate-200 uppercase">
                Active Portfolio Holdings ({portfolio.valued.length})
              </h2>
              <span className="text-xs text-slate-500">
                Showing funded positions (<code className="text-slate-400">units &gt; 0</code>) ·
                decimal separator <code className="text-slate-400">.</code>
              </span>
            </div>

            {hasAddableOptions && (
              <div className="flex items-center gap-1.5">
                <select
                  id="select-add-rwa"
                  aria-label="Add RWA or crypto asset to portfolio"
                  value={assetToAdd}
                  onChange={(e) => setAssetToAdd(e.target.value)}
                  className="num max-w-56 rounded-md border border-slate-200/[0.12] bg-[#0a0e14] px-2 py-1 text-xs text-slate-200 focus:border-[#eab308]/60 focus:outline-none"
                >
                  <option value="">+ Add RWA ({addableRwas.length})...</option>
                  {addableRwas.length > 0 && (
                    <optgroup label="Tokenized RWAs">
                      {addableRwas.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.symbol} — {r.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {addableCryptos.length > 0 && (
                    <optgroup label="Crypto Benchmarks">
                      {addableCryptos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.symbol} — {c.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <button
                  id="btn-add-rwa"
                  type="button"
                  onClick={handleAddAsset}
                  disabled={!assetToAdd}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200/[0.12] bg-[#151d28] px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-[#eab308]/50 hover:text-white disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </div>
            )}
          </div>

          <div className="terminal-scroll overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/[0.08] bg-[#0c1016] text-[11px] font-medium tracking-wider text-slate-400 uppercase">
                  <th className="px-4 py-2.5">Asset</th>
                  <th className="px-4 py-2.5">Sleeve</th>
                  <th className="px-4 py-2.5 text-right">Live Price</th>
                  <th className="px-4 py-2.5 text-right">Units</th>
                  <th className="px-4 py-2.5 text-right">Position Value</th>
                  <th className="px-4 py-2.5 text-right">Weight</th>
                  <th className="w-10 px-2 py-2.5 text-center" aria-label="Remove" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/[0.05]">
                {portfolio.valued.map((row) => {
                  const weight = portfolio.totalNav > 0 ? (row.valueUsd / portfolio.totalNav) * 100 : 0;
                  const displayValue =
                    editingId === row.id ? editingDraft : formatDotDecimal(row.quantity);
                  return (
                    <tr key={row.id} className="hover:bg-[#161e29]">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {row.sleeve === "crypto" ? (
                            <TokenLogo
                              cryptoId={row.cryptoId}
                              symbol={row.symbol}
                              name={row.name}
                              size={22}
                            />
                          ) : (
                            <RwaLogo
                              symbol={row.symbol}
                              name={row.name}
                              assetType={row.rwaAssetType}
                              size={22}
                            />
                          )}
                          <span className="num font-semibold text-white">{row.symbol}</span>
                          {row.rwaId ? (
                            <button
                              type="button"
                              onClick={() => onInspectRwa(row.rwaId!)}
                              className="text-[#A1A7BB] hover:text-[#6188FF] hover:underline"
                            >
                              {row.name}
                            </button>
                          ) : (
                            <span className="text-[#A1A7BB]">{row.name}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            row.sleeve === "crypto"
                              ? "bg-sky-500/15 text-sky-300"
                              : "bg-[#eab308]/15 text-[#eab308]"
                          }`}
                        >
                          {row.assetClass}
                        </span>
                      </td>
                      <td className="num px-4 py-2.5 text-right text-slate-200">
                        {formatCurrency(row.price)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          id={`qty-${row.id}`}
                          type="text"
                          inputMode="decimal"
                          lang="en"
                          spellCheck={false}
                          value={displayValue}
                          onFocus={() => handleFocusQty(row.id, row.quantity)}
                          onChange={(e) => handleChangeQty(row.id, e.target.value)}
                          onBlur={handleBlurQty}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.currentTarget as HTMLInputElement).blur();
                            }
                          }}
                          className="num w-24 rounded border border-slate-200/[0.12] bg-[#0a0e14] px-2 py-1 text-right text-xs text-slate-100 focus:border-[#eab308]/60 focus:outline-none"
                        />
                      </td>
                      <td className="num px-4 py-2.5 text-right font-medium text-slate-100">
                        {formatCurrency(row.valueUsd)}
                      </td>
                      <td className="num px-4 py-2.5 text-right text-slate-400">
                        {formatPercent(weight)}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          id={`remove-${row.id}`}
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          aria-label={`Remove ${row.symbol}`}
                          title={`Remove ${row.symbol}`}
                          className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 transition-colors hover:bg-red-500/15 hover:text-red-300"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {portfolio.valued.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      No active positions. Select a preset above or use{" "}
                      <strong className="text-slate-200">+ Add RWA</strong> to build a custom blend.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right 4 cols: Asset-Class Breakdown & SVG Donut */}
        <section className="terminal-panel flex flex-col justify-between rounded-lg p-4 lg:col-span-4">
          <div>
            <h2 className="border-b border-slate-200/[0.08] pb-3 text-xs font-semibold tracking-wider text-slate-200 uppercase">
              Asset-Class Allocation
            </h2>

            {/* Clean SVG Ring Chart */}
            <div className="my-5 flex justify-center">
              <AllocationDonut segments={portfolio.byClass} totalNav={portfolio.totalNav} />
            </div>

            <div className="space-y-2.5">
              {portfolio.byClass.map((seg) => (
                <div key={seg.label} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-200">
                      <span
                        className="h-2 w-2 rounded-[2px]"
                        style={{ backgroundColor: seg.color }}
                      />
                      {seg.label}
                    </span>
                    <span className="num text-slate-300">
                      {formatCurrency(seg.value, true)}{" "}
                      <span className="text-slate-500">({seg.pct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(seg.pct, 1.5)}%`, backgroundColor: seg.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded border border-slate-200/[0.08] bg-[#0c1016] p-3 text-[11px] leading-relaxed text-slate-400">
            Valuations use live USD prices from CMC{" "}
            <code className="text-slate-300">/v3/cryptocurrency/quotes/latest</code> (by stable CMC
            ID) and <code className="text-slate-300">/v5/real-world-assets/assets/list</code>.
          </div>
        </section>
      </div>
    </div>
  );
}

function AllocationDonut({
  segments,
  totalNav,
}: {
  segments: Array<{ label: string; value: number; pct: number; color: string }>;
  totalNav: number;
}) {
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const arcs = segments.reduce<
    Array<{ label: string; color: string; strokeDasharray: string; strokeDashoffset: number }>
  >((acc, seg) => {
    const priorPct = acc.reduce((sum, item) => sum + Number(item.strokeDasharray.split(" ")[0]), 0);
    const len = (seg.pct / 100) * circumference;
    acc.push({
      label: seg.label,
      color: seg.color,
      strokeDasharray: `${len} ${circumference - len}`,
      strokeDashoffset: -priorPct,
    });
    return acc;
  }, []);

  return (
    <div className="relative flex h-36 w-36 items-center justify-center">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="rgba(148,163,184,0.12)"
          strokeWidth="12"
        />
        {arcs.map((arc) => (
          <circle
            key={arc.label}
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth="12"
            strokeDasharray={arc.strokeDasharray}
            strokeDashoffset={arc.strokeDashoffset}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[10px] tracking-wider text-slate-500 uppercase">Total NAV</span>
        <span className="num text-sm font-semibold text-slate-100">
          {formatCurrency(totalNav, true)}
        </span>
      </div>
    </div>
  );
}
