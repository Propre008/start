"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, Search } from "lucide-react";
import {
  formatAssetTypeLabel,
  formatCurrency,
  formatPercent,
} from "@/lib/analytics/parity";
import type { OverviewResponse, RwaAssetType, RwaListItem } from "@/lib/cmc/types";

interface ScreenerViewProps {
  overview: OverviewResponse;
  onInspectRwa: (rwaId: number) => void;
}

type SortKey =
  | "rwa_rank"
  | "average_tokenized_price"
  | "tokenized_market_cap"
  | "tokenized_volume_24h"
  | "turnover";

const ASSET_TYPE_COLORS: Record<RwaAssetType, string> = {
  commodity: "#eab308",
  government_security: "#10b981",
  currency: "#38bdf8",
  etf: "#f97316",
  stock: "#e2e8f0",
  real_estate: "#94a3b8",
};

const ASSET_TYPES: Array<{ id: "all" | RwaAssetType; label: string }> = [
  { id: "all", label: "All Classes" },
  { id: "commodity", label: "Commodities" },
  { id: "government_security", label: "Gov Securities" },
  { id: "stock", label: "Equities" },
  { id: "etf", label: "ETFs" },
  { id: "currency", label: "FX" },
  { id: "real_estate", label: "Real Estate" },
];

export function ScreenerView({ overview, onInspectRwa }: ScreenerViewProps) {
  const [selectedType, setSelectedType] = useState<"all" | RwaAssetType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("tokenized_market_cap");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const stats = useMemo(() => {
    const assets = overview.rwaAssets;
    const totalMcap = assets.reduce((sum, a) => sum + (a.tokenized_market_cap || 0), 0);
    const totalVol = assets.reduce((sum, a) => sum + (a.tokenized_volume_24h || 0), 0);
    const avgTurnover = totalMcap > 0 ? (totalVol / totalMcap) * 100 : 0;

    const byType = new Map<RwaAssetType, { mcap: number; count: number }>();
    for (const a of assets) {
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

    return { totalMcap, totalVol, avgTurnover, breakdown };
  }, [overview.rwaAssets]);

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = overview.rwaAssets.filter((item) => {
      if (selectedType !== "all" && item.asset_type !== selectedType) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.symbol.toLowerCase().includes(q) ||
        item.slug.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      const getVal = (row: RwaListItem) => {
        if (sortKey === "turnover") {
          return row.tokenized_market_cap > 0
            ? (row.tokenized_volume_24h / row.tokenized_market_cap) * 100
            : 0;
        }
        return row[sortKey] ?? 0;
      };
      const diff = getVal(a) - getVal(b);
      return sortDir === "asc" ? diff : -diff;
    });
  }, [overview.rwaAssets, selectedType, searchQuery, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir(key === "rwa_rank" ? "asc" : "desc");
    }
  }

  return (
    <div className="space-y-5">
      {/* Page Intro + KPI Strip */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Tokenized Real-World Asset Screener
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Track tokenized equities, commodities, sovereign treasuries, ETFs, and FX across
            competing issuers. Select any asset to audit inter-issuer parity spreads and exchange
            fragmentation.
          </p>
        </div>
        <div className="num text-xs text-slate-500">
          Catalog indexed: {overview.rwaMapTotal.toLocaleString()} RWA IDs
        </div>
      </div>

      {/* 4 Institutional KPI Cells */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="terminal-panel rounded-lg p-4">
          <div className="text-[11px] font-medium tracking-wider text-slate-400 uppercase">
            Tokenized RWA Cap
          </div>
          <div className="num mt-2 text-2xl font-semibold text-slate-50">
            {formatCurrency(stats.totalMcap, true)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Across {overview.rwaAssets.length} active ranked assets
          </div>
        </div>

        <div className="terminal-panel rounded-lg p-4">
          <div className="text-[11px] font-medium tracking-wider text-slate-400 uppercase">
            24h Tokenized Volume
          </div>
          <div className="num mt-2 text-2xl font-semibold text-slate-50">
            {formatCurrency(stats.totalVol, true)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Turnover ratio{" "}
            <span className="num text-slate-300">{formatPercent(stats.avgTurnover)}</span>
          </div>
        </div>

        <div className="terminal-panel rounded-lg p-4">
          <div className="text-[11px] font-medium tracking-wider text-slate-400 uppercase">
            Active RWA Issuers
          </div>
          <div className="num mt-2 text-2xl font-semibold text-slate-50">
            {overview.issuersTotal}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Tracked via <code className="text-slate-300">/v5/real-world-assets/issuers/list</code>
          </div>
        </div>

        <div className="terminal-panel rounded-lg p-4">
          <div className="text-[11px] font-medium tracking-wider text-slate-400 uppercase">
            RWA vs Global Crypto
          </div>
          <div className="num mt-2 text-2xl font-semibold text-[#eab308]">
            {overview.globalMetrics.total_market_cap > 0
              ? `${((stats.totalMcap / overview.globalMetrics.total_market_cap) * 100).toFixed(2)}%`
              : "—"}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Share of {formatCurrency(overview.globalMetrics.total_market_cap, true)} crypto cap
          </div>
        </div>
      </section>

      {/* Asset-Class Capital Composition Bar */}
      <section className="terminal-panel rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
            Tokenized Market Cap by Asset Class
          </h2>
          <span className="text-xs text-slate-500">Click a class below to filter the table</span>
        </div>

        <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-sm bg-slate-800/80">
          {stats.breakdown.map((seg) => (
            <button
              key={seg.type}
              type="button"
              onClick={() =>
                setSelectedType((prev) => (prev === seg.type ? "all" : seg.type))
              }
              style={{
                width: `${Math.max(seg.sharePct, 1.5)}%`,
                backgroundColor: ASSET_TYPE_COLORS[seg.type],
              }}
              className="h-full transition-opacity hover:opacity-85"
              title={`${formatAssetTypeLabel(seg.type)}: ${formatCurrency(seg.mcap, true)} (${seg.sharePct.toFixed(1)}%)`}
            />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
          {stats.breakdown.map((seg) => (
            <button
              key={seg.type}
              type="button"
              onClick={() =>
                setSelectedType((prev) => (prev === seg.type ? "all" : seg.type))
              }
              className={`flex items-center gap-2 transition-colors ${
                selectedType === seg.type ? "text-slate-50" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span
                className="h-2 w-2 rounded-[2px]"
                style={{ backgroundColor: ASSET_TYPE_COLORS[seg.type] }}
              />
              <span>{formatAssetTypeLabel(seg.type)}</span>
              <span className="num text-slate-300">{seg.sharePct.toFixed(1)}%</span>
              <span className="num text-slate-500">({seg.count})</span>
            </button>
          ))}
        </div>
      </section>

      {/* Filter & Search Toolbar + Screener Table */}
      <section className="terminal-panel overflow-hidden rounded-lg">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200/[0.08] p-4 md:flex-row md:items-center">
          <div className="flex flex-wrap items-center gap-1.5">
            {ASSET_TYPES.map((t) => {
              const active = selectedType === t.id;
              return (
                <button
                  key={t.id}
                  id={`filter-class-${t.id}`}
                  type="button"
                  onClick={() => setSelectedType(t.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "bg-[#eab308] text-[#090c10]"
                      : "bg-slate-200/[0.05] text-slate-400 hover:bg-slate-200/[0.09] hover:text-slate-200"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              id="input-screener-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter ticker or asset name..."
              className="w-full rounded-md border border-slate-200/[0.1] bg-[#0a0e14] py-1.5 pr-3 pl-8 text-xs text-slate-100 placeholder:text-slate-500 focus:border-[#eab308]/60 focus:outline-none"
            />
          </div>
        </div>

        <div className="terminal-scroll overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/[0.08] bg-[#0c1016] text-[11px] font-medium tracking-wider text-slate-400 uppercase">
                <th className="px-4 py-3">
                  <SortButton
                    label="#"
                    active={sortKey === "rwa_rank"}
                    dir={sortDir}
                    onClick={() => handleSort("rwa_rank")}
                  />
                </th>
                <th className="px-4 py-3">Real-World Asset</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3 text-right">
                  <SortButton
                    label="Avg Tokenized Price"
                    active={sortKey === "average_tokenized_price"}
                    dir={sortDir}
                    align="right"
                    onClick={() => handleSort("average_tokenized_price")}
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton
                    label="Tokenized Mkt Cap"
                    active={sortKey === "tokenized_market_cap"}
                    dir={sortDir}
                    align="right"
                    onClick={() => handleSort("tokenized_market_cap")}
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton
                    label="24h Volume"
                    active={sortKey === "tokenized_volume_24h"}
                    dir={sortDir}
                    align="right"
                    onClick={() => handleSort("tokenized_volume_24h")}
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton
                    label="Vol / Cap"
                    active={sortKey === "turnover"}
                    dir={sortDir}
                    align="right"
                    onClick={() => handleSort("turnover")}
                  />
                </th>
                <th className="px-4 py-3 text-right">Parity Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/[0.05]">
              {filteredAssets.map((asset) => {
                const turnover =
                  asset.tokenized_market_cap > 0
                    ? (asset.tokenized_volume_24h / asset.tokenized_market_cap) * 100
                    : 0;
                return (
                  <tr
                    key={asset.rwa_id}
                    onClick={() => onInspectRwa(asset.rwa_id)}
                    className="group cursor-pointer transition-colors hover:bg-[#161e29]"
                  >
                    <td className="num px-4 py-3 text-slate-500">{asset.rwa_rank}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="num inline-flex h-6 min-w-[46px] items-center justify-center rounded bg-slate-200/[0.06] px-1.5 text-[11px] font-semibold text-slate-100">
                          {asset.symbol}
                        </span>
                        <div>
                          <div className="font-medium text-slate-100 group-hover:text-white">
                            {asset.name}
                          </div>
                          <div className="num text-[11px] text-slate-500">
                            rwa_id:{asset.rwa_id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded bg-slate-200/[0.05] px-2 py-0.5 text-[11px] text-slate-300">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            backgroundColor: ASSET_TYPE_COLORS[asset.asset_type] ?? "#94a3b8",
                          }}
                        />
                        {formatAssetTypeLabel(asset.asset_type)}
                      </span>
                    </td>
                    <td className="num px-4 py-3 text-right font-medium text-slate-100">
                      {formatCurrency(asset.average_tokenized_price)}
                    </td>
                    <td className="num px-4 py-3 text-right text-slate-200">
                      {formatCurrency(asset.tokenized_market_cap, true)}
                    </td>
                    <td className="num px-4 py-3 text-right text-slate-300">
                      {formatCurrency(asset.tokenized_volume_24h, true)}
                    </td>
                    <td className="num px-4 py-3 text-right">
                      <span
                        className={
                          turnover >= 20
                            ? "text-emerald-400"
                            : turnover >= 5
                              ? "text-slate-200"
                              : "text-slate-500"
                        }
                      >
                        {formatPercent(turnover)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#eab308] opacity-80 transition-opacity group-hover:opacity-100">
                        Analyze
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </span>
                    </td>
                  </tr>
                );
              })}

              {filteredAssets.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    No tokenized Real-World Assets match your current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SortButton({
  label,
  active,
  dir,
  align = "left",
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  align?: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 transition-colors hover:text-slate-100 ${
        align === "right" ? "ml-auto" : ""
      } ${active ? "text-[#eab308]" : ""}`}
    >
      <span>{label}</span>
      {active && (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  );
}
