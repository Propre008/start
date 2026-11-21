"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, KeyRound, X } from "lucide-react";
import type { ApiTraceEntry, DataSourceMode, KeyInfoSummary } from "@/lib/cmc/types";

interface ApiInspectorDrawerProps {
  open: boolean;
  onClose: () => void;
  traces: ApiTraceEntry[];
  keyInfo: KeyInfoSummary | null;
  mode: DataSourceMode;
  proKeyConfigured: boolean;
  sessionKey: string;
  onApplySessionKey: (key: string) => void;
}

const CMC_ENDPOINT_CATALOG = [
  { path: "/v5/real-world-assets/map", group: "RWA v5", plan: "Basic+" },
  { path: "/v5/real-world-assets/assets/list", group: "RWA v5", plan: "Basic+" },
  { path: "/v5/real-world-assets/quotes/latest", group: "RWA v5", plan: "Basic+" },
  { path: "/v5/real-world-assets/info", group: "RWA v5", plan: "Basic+" },
  { path: "/v5/real-world-assets/market-pairs/list", group: "RWA v5", plan: "Startup+" },
  { path: "/v5/real-world-assets/issuers/list", group: "RWA v5", plan: "Basic+" },
  { path: "/v5/real-world-assets/issuers", group: "RWA v5", plan: "Basic+" },
  { path: "/v3/cryptocurrency/quotes/latest", group: "Crypto v3", plan: "Keyless / Basic+" },
  { path: "/v1/global-metrics/quotes/latest", group: "Global v1", plan: "Keyless / Basic+" },
  { path: "/v3/fear-and-greed/latest", group: "Sentiment v3", plan: "Keyless / Basic+" },
  { path: "/v1/key/info", group: "Utilities v1", plan: "Basic+" },
];

export function ApiInspectorDrawer(props: ApiInspectorDrawerProps) {
  if (!props.open) return null;
  return <ApiInspectorDrawerContent {...props} />;
}

function ApiInspectorDrawerContent({
  onClose,
  traces,
  keyInfo,
  mode,
  proKeyConfigured,
  sessionKey,
  onApplySessionKey,
}: ApiInspectorDrawerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [keyDraft, setKeyDraft] = useState(sessionKey);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const isLivePro = mode === "live_pro";
  const keyFailed = (proKeyConfigured || Boolean(sessionKey)) && !isLivePro;

  const statusBadge = isLivePro
    ? {
        label: `ACTIVE (${keyInfo?.plan_name ?? "Pro API"})`,
        className: "bg-emerald-500/15 text-emerald-300",
      }
    : keyFailed
      ? {
          label: "PRO KEY REJECTED / FALLBACK",
          className: "bg-red-500/15 text-red-300",
        }
      : {
          label: "KEYLESS + SNAPSHOT MODE",
          className: "bg-amber-500/15 text-amber-300",
        };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Live CoinMarketCap API Evidence Inspector"
        className="terminal-scroll flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-slate-200/[0.1] bg-[#0b0f15] shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/[0.08] bg-[#0b0f15]/95 px-5 py-4 backdrop-blur-md">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">
              Live CoinMarketCap API Evidence Inspector
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Real-time server-side request telemetry, credit counts, and JSON response proofs.
            </p>
          </div>
          <button
            id="btn-close-inspector"
            type="button"
            onClick={onClose}
            aria-label="Close API Inspector"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200/[0.08] hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* Plan Telemetry / Session BYOK */}
          <section className="terminal-subpanel rounded-lg p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <KeyRound className="h-3.5 w-3.5 text-[#eab308]" />
                <span>API Key Status</span>
              </div>
              <span className={`num rounded px-2 py-0.5 text-[11px] font-medium ${statusBadge.className}`}>
                {statusBadge.label}
              </span>
            </div>

            {keyInfo && (
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded bg-[#0a0e14] p-2">
                  <div className="text-[10px] text-slate-500 uppercase">Credits Used</div>
                  <div className="num mt-0.5 font-semibold text-slate-100">
                    {keyInfo.credits_used_monthly.toLocaleString("en-US")}
                  </div>
                </div>
                <div className="rounded bg-[#0a0e14] p-2">
                  <div className="text-[10px] text-slate-500 uppercase">Monthly Limit</div>
                  <div className="num mt-0.5 font-semibold text-slate-100">
                    {keyInfo.credit_limit_monthly.toLocaleString("en-US")}
                  </div>
                </div>
                <div className="rounded bg-[#0a0e14] p-2">
                  <div className="text-[10px] text-slate-500 uppercase">Rate Limit</div>
                  <div className="num mt-0.5 font-semibold text-slate-100">
                    {keyInfo.rate_limit_minute}/min
                  </div>
                </div>
              </div>
            )}

            <form
              className="mt-3 border-t border-slate-200/[0.08] pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                onApplySessionKey(keyDraft.trim());
              }}
            >
              <label htmlFor="input-session-cmc-key" className="block text-[11px] text-slate-400">
                Optional Session Key (memory-only, never stored or logged — lets judges verify live
                RWA v5 calls directly):
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id="input-session-cmc-key"
                  type="password"
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.value)}
                  placeholder="Paste CMC Pro API key for this session..."
                  className="num flex-1 rounded-md border border-slate-200/[0.12] bg-[#090c10] px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-[#eab308]/60 focus:outline-none"
                />
                <button
                  id="btn-apply-session-key"
                  type="submit"
                  className="rounded-md bg-[#eab308] px-3 py-1.5 text-xs font-semibold text-[#090c10] hover:bg-[#facc15]"
                >
                  Apply
                </button>
                {sessionKey && (
                  <button
                    type="button"
                    onClick={() => {
                      setKeyDraft("");
                      onApplySessionKey("");
                    }}
                    className="rounded-md border border-slate-200/[0.12] px-2.5 py-1.5 text-xs text-slate-300 hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* Executed Request Traces */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
              Executed Server Calls ({traces.length})
            </h3>

            <div className="space-y-2">
              {traces.map((trace) => {
                const expanded = expandedId === trace.id;
                const modeStyle =
                  trace.mode === "live_pro"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : trace.mode === "live_keyless"
                      ? "bg-sky-500/15 text-sky-300"
                      : "bg-slate-700/60 text-slate-300";

                return (
                  <div
                    key={trace.id}
                    className="overflow-hidden rounded-md border border-slate-200/[0.08] bg-[#10151d]"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : trace.id)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs hover:bg-[#161e29]"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {expanded ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                        )}
                        <span className="num truncate font-medium text-slate-100">
                          GET {trace.endpoint}
                          {trace.query ? `?${trace.query}` : ""}
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`num rounded px-1.5 py-0.5 text-[10px] ${modeStyle}`}>
                          {trace.mode === "live_pro"
                            ? "LIVE PRO"
                            : trace.mode === "live_keyless"
                              ? "KEYLESS"
                              : "SNAPSHOT"}
                        </span>
                        <span className="num text-[11px] text-slate-400">
                          {trace.httpStatus} · {trace.elapsedMs}ms · {trace.creditCount}cr
                          {trace.cached ? " (cache)" : ""}
                        </span>
                      </div>
                    </button>

                    {expanded && (
                      <div className="border-t border-slate-200/[0.06] bg-[#090c10] p-3">
                        {trace.note && (
                          <p className="mb-2 text-[11px] text-amber-300">{trace.note}</p>
                        )}
                        <pre className="terminal-scroll num max-h-64 overflow-auto text-[11px] leading-relaxed text-slate-300">
                          {JSON.stringify(trace.samplePayload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Explicit Endpoint Coverage Table */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
              Explicit CoinMarketCap Endpoints Integrated ({CMC_ENDPOINT_CATALOG.length})
            </h3>
            <div className="overflow-hidden rounded-md border border-slate-200/[0.08]">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/[0.08] bg-[#10151d] text-[10px] tracking-wider text-slate-400 uppercase">
                    <th className="px-3 py-2">Endpoint Path</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2 text-right">Tier Compatibility</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/[0.05] bg-[#0c1016]">
                  {CMC_ENDPOINT_CATALOG.map((ep) => (
                    <tr key={ep.path}>
                      <td className="num px-3 py-2 text-slate-200">{ep.path}</td>
                      <td className="px-3 py-2 text-slate-400">{ep.group}</td>
                      <td className="num px-3 py-2 text-right text-slate-400">{ep.plan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
