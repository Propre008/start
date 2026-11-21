"use client";

import { ArrowUpRight, ExternalLink } from "lucide-react";
import { formatAssetTypeLabel, formatCurrency } from "@/lib/analytics/parity";
import type { IssuerDetailResponse, RwaIssuerSummary } from "@/lib/cmc/types";

interface IssuerExplorerViewProps {
  issuers: RwaIssuerSummary[];
  selectedIssuerId: string;
  onSelectIssuer: (issuerId: string) => void;
  issuerDetail: IssuerDetailResponse | null;
  loading: boolean;
  onInspectRwa: (rwaId: number) => void;
}

export function IssuerExplorerView({
  issuers,
  selectedIssuerId,
  onSelectIssuer,
  issuerDetail,
  loading,
  onInspectRwa,
}: IssuerExplorerViewProps) {
  const sortedIssuers = [...issuers].sort((a, b) => b.num_tokens - a.num_tokens);
  const maxTokens = Math.max(1, ...sortedIssuers.map((i) => i.num_tokens));
  const totalCatalogTokens = sortedIssuers.reduce((sum, i) => sum + i.num_tokens, 0);

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
          <div className="flex items-center justify-between border-b border-slate-200/[0.08] px-4 py-3">
            <h2 className="text-xs font-semibold tracking-wider text-slate-200 uppercase">
              Tracked Issuers ({sortedIssuers.length})
            </h2>
            <span className="num text-xs text-slate-500">
              {totalCatalogTokens} total linked tokens
            </span>
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
                      {issuer.num_tokens} {issuer.num_tokens === 1 ? "token" : "tokens"}
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
          </div>
        </section>

        {/* Right 7 cols: Single Issuer Drill-Down */}
        <section className="terminal-panel overflow-hidden rounded-lg lg:col-span-7">
          {loading || !issuerDetail ? (
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
                      {issuerDetail.issuer.num_tokens}
                    </div>
                    <div className="text-[11px] text-slate-500">Issued Tokens</div>
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
                    {issuerDetail.linkedAssets.map((token) => (
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

                    {issuerDetail.linkedAssets.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                          No linked tokens returned for this issuer on the current page.
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
