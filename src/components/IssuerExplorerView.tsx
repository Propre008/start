"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, ExternalLink, RefreshCw, Search } from "lucide-react";
import { formatAssetTypeLabel, formatCurrency } from "@/lib/analytics/parity";
import type { IssuerDetailResponse, RwaIssuerSummary } from "@/lib/cmc/types";

interface IssuerExplorerViewProps {
  issuers: RwaIssuerSummary[];
  selectedIssuerId: string;
  onSelectIssuer: (issuerId: string) => void;
  issuerDetail: IssuerDetailResponse | null;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onInspectRwa: (rwaId: number) => void;
}

export function IssuerExplorerView({
  issuers,
  selectedIssuerId,
  onSelectIssuer,
  issuerDetail,
  loading,
  error,
  onRetry,
  onInspectRwa,
}: IssuerExplorerViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [pricedOnly, setPricedOnly] = useState(true);

  const sortedIssuers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...issuers]
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.issuer_id.toLowerCase().includes(q))
      .sort((a, b) => b.num_tokens - a.num_tokens);
  }, [issuers, searchQuery]);

  const maxTokens = Math.max(1, ...issuers.map((i) => i.num_tokens));
  const totalCatalogTokens = issuers.reduce((sum, i) => sum + i.num_tokens, 0);

  const { visibleLinkedAssets, pricedCount, loadedCount } = useMemo(() => {
    const all = issuerDetail?.linkedAssets ?? [];
    const priced = all.filter((t) => Boolean(t.rwa && t.rwa.average_tokenized_price > 0));
    return {
      visibleLinkedAssets: pricedOnly ? priced : all,
      pricedCount: priced.length,
      loadedCount: all.length,
    };
  }, [issuerDetail, pricedOnly]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-50">
          RWA Issuer Due-Diligence Explorer
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Compare tokenized asset issuers tracked by CoinMarketCap (
          <code className="text-slate-300">/v5/real-world-assets/issuers/list</code> &amp;{" "}
          <code className="text-slate-300">/v5/real-world-assets/issuers</code>) and inspect every
          linked on-chain token they back.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left 5 cols: Issuer Directory + Catalog Share Bars */}
        <section className="terminal-panel overflow-hidden rounded-lg lg:col-span-5">
          <div className="space-y-2.5 border-b border-slate-200/[0.08] px-4 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold tracking-wider text-slate-200 uppercase">
                Tracked Issuers (<span className="num">{sortedIssuers.length}</span>)
              </h2>
              <span className="num text-xs text-slate-500">
                {totalCatalogTokens.toLocaleString("en-US")} total linked tokens
              </span>
            </div>
            {issuers.length > 6 && (
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  id="input-issuer-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter issuer name..."
                  className="w-full rounded-md border border-slate-200/[0.1] bg-[#0a0e14] py-1.5 pr-3 pl-8 text-xs text-slate-100 placeholder:text-slate-500 focus:border-[#eab308]/60 focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="divide-y divide-slate-200/[0.05]">
            {sortedIssuers.map((issuer) => {
              const isSelected = issuer.issuer_id === selectedIssuerId;
              const widthPct = Math.max(3, (issuer.num_tokens / maxTokens) * 100);
              return (
                <button
                  key={issuer.issuer_id}
                  id={`issuer-row-${issuer.issuer_id}`}
                  type="button"
                  onClick={() => onSelectIssuer(issuer.issuer_id)}
                  className={`block w-full px-4 py-3 text-left transition-colors ${
                    isSelected ? "bg-[#19222e]" : "hover:bg-[#141c26]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-semibold ${
                        isSelected ? "text-[#eab308]" : "text-slate-100"
                      }`}
                    >
                      {issuer.name}
                    </span>
                    <span className="num text-xs text-slate-300">
                      {issuer.num_tokens.toLocaleString("en-US")}{" "}
                      {issuer.num_tokens === 1 ? "token" : "tokens"}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isSelected ? "bg-[#eab308]" : "bg-slate-500"
                      }`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </button>
              );
            })}

            {sortedIssuers.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-slate-400">
                No issuers match &ldquo;{searchQuery}&rdquo;.
              </div>
            )}
          </div>
        </section>

        {/* Right 7 cols: Single Issuer Drill-Down */}
        <section className="terminal-panel overflow-hidden rounded-lg lg:col-span-7">
          {!loading && error ? (
            <div className="flex h-72 flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="text-sm font-medium text-slate-100">Unable to load issuer details</div>
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
          ) : loading || !issuerDetail ? (
            <div className="flex h-72 items-center justify-center text-sm text-slate-400">
              Loading issuer token catalog from /v5/real-world-assets/issuers...
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/[0.08] p-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-50">
                    {issuerDetail.issuer.name}
                  </h2>
                  <div className="num mt-1 text-[11px] text-slate-500">
                    issuer_id: {issuerDetail.issuer.issuer_id}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="num text-lg font-semibold text-[#eab308]">
                      {issuerDetail.issuer.num_tokens.toLocaleString("en-US")}
                    </div>
                    <div className="text-[11px] text-slate-500">Total Issued Tokens</div>
                  </div>
                  {issuerDetail.issuer.website && (
                    <a
                      href={issuerDetail.issuer.website}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200/[0.12] bg-[#0c1016] px-2.5 py-1.5 text-xs text-slate-300 hover:border-[#eab308]/50 hover:text-white"
                    >
                      Website
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* Filter & Coverage Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/[0.06] bg-[#0b0f15] px-4 py-2 text-xs">
                <div className="text-slate-400">
                  Showing{" "}
                  <span className="num font-medium text-slate-100">
                    {visibleLinkedAssets.length}
                  </span>{" "}
                  of <span className="num text-slate-200">{loadedCount}</span> loaded (
                  <span className="num text-emerald-400">{pricedCount}</span> priced ·{" "}
                  <span className="num text-slate-300">
                    {issuerDetail.issuer.num_tokens.toLocaleString("en-US")}
                  </span>{" "}
                  total issued)
                </div>

                <button
                  id="toggle-priced-only"
                  type="button"
                  role="switch"
                  aria-checked={pricedOnly}
                  onClick={() => setPricedOnly((prev) => !prev)}
                  className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    pricedOnly
                      ? "border-[#eab308]/45 bg-[#eab308]/15 text-[#eab308]"
                      : "border-slate-200/[0.1] bg-[#10151d] text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      pricedOnly ? "bg-[#eab308]" : "bg-slate-500"
                    }`}
                  />
                  <span>Priced only</span>
                </button>
              </div>

              <div className="terminal-scroll overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/[0.08] bg-[#0c1016] text-[11px] font-medium tracking-wider text-slate-400 uppercase">
                      <th className="px-4 py-2.5">Issued Token</th>
                      <th className="px-4 py-2.5">Underlying RWA</th>
                      <th className="px-4 py-2.5">Class</th>
                      <th className="px-4 py-2.5 text-right">Avg RWA Price</th>
                      <th className="px-4 py-2.5 text-right">Parity View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/[0.05]">
                    {visibleLinkedAssets.map((token) => (
                      <tr
                        key={`${token.crypto_id}-${token.rwa_id}`}
                        onClick={() => onInspectRwa(token.rwa_id)}
                        className="group cursor-pointer transition-colors hover:bg-[#161e29]"
                      >
                        <td className="px-4 py-3">
                          <div className="num font-semibold text-slate-100">{token.symbol}</div>
                          <div className="text-[11px] text-slate-500">{token.name}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-200">
                            {token.rwa?.name ?? `RWA #${token.rwa_id}`}
                          </div>
                          <div className="num text-[11px] text-slate-500">
                            crypto_id:{token.crypto_id} · rwa_id:{token.rwa_id}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {token.rwa ? formatAssetTypeLabel(token.rwa.asset_type) : "Tokenized RWA"}
                        </td>
                        <td className="num px-4 py-3 text-right text-slate-200">
                          {token.rwa ? formatCurrency(token.rwa.average_tokenized_price) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1 font-medium text-[#eab308]">
                            Inspect
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </span>
                        </td>
                      </tr>
                    ))}

                    {visibleLinkedAssets.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                          {pricedOnly && loadedCount > 0 ? (
                            <div className="space-y-2">
                              <p>
                                None of the <span className="num">{loadedCount}</span> loaded tokens
                                for this issuer rank inside the top-100 priced RWA index yet.
                              </p>
                              <button
                                type="button"
                                onClick={() => setPricedOnly(false)}
                                className="rounded-md border border-[#eab308]/40 bg-[#eab308]/10 px-3 py-1 text-xs font-medium text-[#eab308] hover:bg-[#eab308]/20"
                              >
                                Show all {loadedCount} loaded tokens
                              </button>
                            </div>
                          ) : (
                            "No linked tokens returned for this issuer on the current page."
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
