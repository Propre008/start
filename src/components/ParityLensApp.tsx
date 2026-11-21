"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiInspectorDrawer } from "./ApiInspectorDrawer";
import { IssuerExplorerView } from "./IssuerExplorerView";
import { ParityAnalyzerView } from "./ParityAnalyzerView";
import { PortfolioLabView } from "./PortfolioLabView";
import { ScreenerView } from "./ScreenerView";
import { type ActiveTab, TerminalHeader } from "./TerminalHeader";
import type {
  ApiTraceEntry,
  IssuerDetailResponse,
  OverviewResponse,
  RwaDetailResponse,
} from "@/lib/cmc/types";

export function ParityLensApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("screener");
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  const [selectedRwaId, setSelectedRwaId] = useState<number>(1);
  const [rwaDetail, setRwaDetail] = useState<RwaDetailResponse | null>(null);
  const [rwaLoading, setRwaLoading] = useState(false);

  const [selectedIssuerId, setSelectedIssuerId] = useState<string>("");
  const [issuerDetail, setIssuerDetail] = useState<IssuerDetailResponse | null>(null);
  const [issuerLoading, setIssuerLoading] = useState(false);

  const [traces, setTraces] = useState<ApiTraceEntry[]>([]);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [sessionKey, setSessionKey] = useState("");

  const mergeTraces = useCallback((incoming: ApiTraceEntry[]) => {
    setTraces((prev) => {
      const byEndpoint = new Map<string, ApiTraceEntry>();
      for (const item of prev) byEndpoint.set(`${item.endpoint}?${item.query}`, item);
      for (const item of incoming) byEndpoint.set(`${item.endpoint}?${item.query}`, item);
      return Array.from(byEndpoint.values()).sort((a, b) =>
        b.timestamp.localeCompare(a.timestamp)
      );
    });
  }, []);

  const buildHeaders = useCallback(
    (keyOverride?: string): HeadersInit => {
      const effective = keyOverride !== undefined ? keyOverride : sessionKey;
      return effective ? { "x-user-cmc-key": effective } : {};
    },
    [sessionKey]
  );

  const loadOverview = useCallback(
    async (bypassCache = false, keyOverride?: string) => {
      setOverviewLoading(true);
      try {
        const res = await fetch(`/api/cmc/overview${bypassCache ? "?refresh=1" : ""}`, {
          headers: buildHeaders(keyOverride),
        });
        if (!res.ok) return;
        const data = (await res.json()) as OverviewResponse;
        setOverview(data);
        mergeTraces(data.traces);

        if (data.rwaAssets.length > 0) {
          setSelectedRwaId((prev) =>
            data.rwaAssets.some((a) => a.rwa_id === prev) ? prev : data.rwaAssets[0].rwa_id
          );
        }
        if (data.issuers.length > 0) {
          setSelectedIssuerId((prev) =>
            prev && data.issuers.some((i) => i.issuer_id === prev)
              ? prev
              : data.issuers[0].issuer_id
          );
        }
      } finally {
        setOverviewLoading(false);
      }
    },
    [buildHeaders, mergeTraces]
  );

  const loadRwaDetail = useCallback(
    async (rwaId: number, bypassCache = false, keyOverride?: string) => {
      setRwaLoading(true);
      try {
        const res = await fetch(
          `/api/cmc/rwa/${rwaId}${bypassCache ? "?refresh=1" : ""}`,
          { headers: buildHeaders(keyOverride) }
        );
        if (!res.ok) return;
        const data = (await res.json()) as RwaDetailResponse;
        setRwaDetail(data);
        mergeTraces(data.traces);
      } finally {
        setRwaLoading(false);
      }
    },
    [buildHeaders, mergeTraces]
  );

  const loadIssuerDetail = useCallback(
    async (issuerId: string, bypassCache = false, keyOverride?: string) => {
      if (!issuerId) return;
      setIssuerLoading(true);
      try {
        const res = await fetch(
          `/api/cmc/issuers/${issuerId}${bypassCache ? "?refresh=1" : ""}`,
          { headers: buildHeaders(keyOverride) }
        );
        if (!res.ok) return;
        const data = (await res.json()) as IssuerDetailResponse;
        setIssuerDetail(data);
        mergeTraces(data.traces);
      } finally {
        setIssuerLoading(false);
      }
    },
    [buildHeaders, mergeTraces]
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cmc/overview", { headers: buildHeaders() })
      .then((res) => (res.ok ? (res.json() as Promise<OverviewResponse>) : null))
      .then((data) => {
        if (cancelled || !data) return;
        setOverview(data);
        mergeTraces(data.traces);
        if (data.rwaAssets.length > 0) {
          setSelectedRwaId((prev) =>
            data.rwaAssets.some((a) => a.rwa_id === prev) ? prev : data.rwaAssets[0].rwa_id
          );
        }
        if (data.issuers.length > 0) {
          setSelectedIssuerId((prev) =>
            prev && data.issuers.some((i) => i.issuer_id === prev)
              ? prev
              : data.issuers[0].issuer_id
          );
        }
      })
      .finally(() => {
        if (!cancelled) setOverviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [buildHeaders, mergeTraces]);

  useEffect(() => {
    if (activeTab !== "parity" || selectedRwaId <= 0) return;
    let cancelled = false;
    fetch(`/api/cmc/rwa/${selectedRwaId}`, { headers: buildHeaders() })
      .then((res) => (res.ok ? (res.json() as Promise<RwaDetailResponse>) : null))
      .then((data) => {
        if (cancelled || !data) return;
        setRwaDetail(data);
        mergeTraces(data.traces);
      })
      .finally(() => {
        if (!cancelled) setRwaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedRwaId, buildHeaders, mergeTraces]);

  useEffect(() => {
    if (activeTab !== "issuers" || !selectedIssuerId) return;
    let cancelled = false;
    fetch(`/api/cmc/issuers/${selectedIssuerId}`, { headers: buildHeaders() })
      .then((res) => (res.ok ? (res.json() as Promise<IssuerDetailResponse>) : null))
      .then((data) => {
        if (cancelled || !data) return;
        setIssuerDetail(data);
        mergeTraces(data.traces);
      })
      .finally(() => {
        if (!cancelled) setIssuerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedIssuerId, buildHeaders, mergeTraces]);

  function handleInspectRwa(rwaId: number) {
    setRwaLoading(true);
    setSelectedRwaId(rwaId);
    setActiveTab("parity");
  }

  function handleSelectIssuerFromParity(issuerId: string) {
    setIssuerLoading(true);
    setSelectedIssuerId(issuerId);
    setActiveTab("issuers");
  }

  function handleRefresh() {
    void loadOverview(true);
    if (activeTab === "parity" && selectedRwaId > 0) {
      void loadRwaDetail(selectedRwaId, true);
    }
    if (activeTab === "issuers" && selectedIssuerId) {
      void loadIssuerDetail(selectedIssuerId, true);
    }
  }

  function handleApplySessionKey(nextKey: string) {
    setSessionKey(nextKey);
    void loadOverview(true, nextKey);
    if (selectedRwaId > 0) void loadRwaDetail(selectedRwaId, true, nextKey);
    if (selectedIssuerId) void loadIssuerDetail(selectedIssuerId, true, nextKey);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TerminalHeader
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        overview={overview}
        loading={overviewLoading || rwaLoading || issuerLoading}
        onRefresh={handleRefresh}
        onOpenInspector={() => setInspectorOpen(true)}
        traceCount={traces.length}
        hasCustomKey={Boolean(sessionKey)}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6">
        {!overview ? (
          <div className="terminal-panel flex h-80 items-center justify-center rounded-lg text-sm text-slate-400">
            Initializing ParityLens RWA intelligence feed...
          </div>
        ) : (
          <>
            {overview.mode !== "live_pro" && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-4 py-2.5 text-xs text-amber-200">
                <span>
                  <strong>Notice:</strong> Server <code className="num">CMC_PRO_API_KEY</code> is
                  not configured yet — macro feeds use CoinMarketCap Keyless Public API while RWA
                  v5 endpoints display schema-verified reference snapshots.
                </span>
                <button
                  type="button"
                  onClick={() => setInspectorOpen(true)}
                  className="shrink-0 font-semibold text-[#eab308] hover:underline"
                >
                  Test with Session API Key →
                </button>
              </div>
            )}

            {activeTab === "screener" && (
              <ScreenerView overview={overview} onInspectRwa={handleInspectRwa} />
            )}

            {activeTab === "parity" && (
              <ParityAnalyzerView
                rwaAssets={overview.rwaAssets}
                selectedRwaId={selectedRwaId}
                onSelectRwa={setSelectedRwaId}
                detail={rwaDetail}
                loading={rwaLoading}
                onSelectIssuer={handleSelectIssuerFromParity}
              />
            )}

            {activeTab === "issuers" && (
              <IssuerExplorerView
                issuers={overview.issuers}
                selectedIssuerId={selectedIssuerId}
                onSelectIssuer={setSelectedIssuerId}
                issuerDetail={issuerDetail}
                loading={issuerLoading}
                onInspectRwa={handleInspectRwa}
              />
            )}

            {activeTab === "portfolio" && (
              <PortfolioLabView overview={overview} onInspectRwa={handleInspectRwa} />
            )}
          </>
        )}
      </main>

      <footer className="border-t border-slate-200/[0.06] bg-[#0a0d12]">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 py-3 text-[11px] text-slate-500 sm:px-6">
          <div>
            ParityLens · Built for <span className="text-slate-300">#BuildwithCMC</span> (API
            Hackathon Round 2 — Real World Assets Track)
          </div>
          <div className="num">
            11 CoinMarketCap API endpoints · Basic &amp; Startup Tier Compatible
          </div>
        </div>
      </footer>

      <ApiInspectorDrawer
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        traces={traces}
        keyInfo={overview?.keyInfo ?? null}
        proKeyConfigured={overview?.proKeyConfigured ?? false}
        sessionKey={sessionKey}
        onApplySessionKey={handleApplySessionKey}
      />
    </div>
  );
}
