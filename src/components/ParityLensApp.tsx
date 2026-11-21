"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { ApiInspectorDrawer } from "./ApiInspectorDrawer";
import { IssuerExplorerView } from "./IssuerExplorerView";
import { JudgeHeroStrip } from "./JudgeHeroStrip";
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

const INTRO_STORAGE_KEY = "paritylens_hide_intro";
const INTRO_EVENT_NAME = "paritylens:intro-visibility-change";

function subscribeIntroHidden(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(INTRO_EVENT_NAME, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(INTRO_EVENT_NAME, callback);
    window.removeEventListener("storage", callback);
  };
}

function getIntroHiddenSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(INTRO_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getIntroHiddenServerSnapshot(): boolean {
  return false;
}

function setIntroHiddenStored(hidden: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (hidden) {
      window.sessionStorage.setItem(INTRO_STORAGE_KEY, "1");
    } else {
      window.sessionStorage.removeItem(INTRO_STORAGE_KEY);
    }
    window.dispatchEvent(new Event(INTRO_EVENT_NAME));
  } catch {
    // Ignore storage quota/privacy restrictions
  }
}

interface RefreshRequest {
  nonce: number;
  bypassCache: boolean;
}

export interface ParityLensAppProps {
  initialTab?: ActiveTab;
  initialRwaId?: number;
  initialIssuerId?: string;
  initialOpenInspector?: boolean;
}

export function ParityLensApp({
  initialTab = "screener",
  initialRwaId = 1,
  initialIssuerId = "",
  initialOpenInspector = false,
}: ParityLensAppProps = {}) {
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [overviewReq, setOverviewReq] = useState<RefreshRequest>({
    nonce: 0,
    bypassCache: false,
  });

  const [rwaReq, setRwaReq] = useState<{ rwaId: number; nonce: number; bypassCache: boolean }>({
    rwaId: initialRwaId > 0 ? initialRwaId : 1,
    nonce: 0,
    bypassCache: false,
  });
  const [rwaDetail, setRwaDetail] = useState<RwaDetailResponse | null>(null);
  const [rwaLoading, setRwaLoading] = useState(initialTab === "parity");
  const [rwaError, setRwaError] = useState<string | null>(null);

  const [issuerReq, setIssuerReq] = useState<{
    issuerId: string;
    nonce: number;
    bypassCache: boolean;
  }>({
    issuerId: initialIssuerId,
    nonce: 0,
    bypassCache: false,
  });
  const [issuerDetail, setIssuerDetail] = useState<IssuerDetailResponse | null>(null);
  const [issuerLoading, setIssuerLoading] = useState(initialTab === "issuers" && Boolean(initialIssuerId));
  const [issuerError, setIssuerError] = useState<string | null>(null);

  const [traces, setTraces] = useState<ApiTraceEntry[]>([]);
  const [inspectorOpen, setInspectorOpen] = useState(initialOpenInspector);
  const [sessionKey, setSessionKey] = useState("");
  const introHidden = useSyncExternalStore(
    subscribeIntroHidden,
    getIntroHiddenSnapshot,
    getIntroHiddenServerSnapshot
  );

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

  // Overview fetch — single source of truth, StrictMode & AbortController safe
  useEffect(() => {
    const controller = new AbortController();
    const headers: HeadersInit = sessionKey ? { "x-user-cmc-key": sessionKey } : {};
    const url = `/api/cmc/overview${overviewReq.bypassCache ? "?refresh=1" : ""}`;

    fetch(url, { headers, signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Overview request failed (HTTP ${res.status})`);
        }
        return (await res.json()) as OverviewResponse;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setOverview(data);
        setOverviewError(null);
        mergeTraces(data.traces);

        if (data.rwaAssets.length > 0) {
          setRwaReq((prev) =>
            data.rwaAssets.some((a) => a.rwa_id === prev.rwaId)
              ? prev
              : { rwaId: data.rwaAssets[0].rwa_id, nonce: prev.nonce + 1, bypassCache: false }
          );
        }
        if (data.issuers.length > 0) {
          setIssuerReq((prev) =>
            prev.issuerId && data.issuers.some((i) => i.issuer_id === prev.issuerId)
              ? prev
              : { issuerId: data.issuers[0].issuer_id, nonce: prev.nonce + 1, bypassCache: false }
          );
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setOverviewError(
          err instanceof Error ? err.message : "Unable to load CoinMarketCap overview feed."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setOverviewLoading(false);
      });

    return () => controller.abort();
  }, [overviewReq, sessionKey, mergeTraces]);

  // RWA Parity Detail fetch — only runs when Parity tab is active
  useEffect(() => {
    if (activeTab !== "parity" || rwaReq.rwaId <= 0) return;
    const controller = new AbortController();
    const headers: HeadersInit = sessionKey ? { "x-user-cmc-key": sessionKey } : {};
    const url = `/api/cmc/rwa/${rwaReq.rwaId}${rwaReq.bypassCache ? "?refresh=1" : ""}`;

    fetch(url, { headers, signal: controller.signal })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | (RwaDetailResponse & { error?: string })
          | null;
        if (body?.traces) mergeTraces(body.traces);
        if (!res.ok || !body || !body.quote) {
          throw new Error(body?.error ?? `Failed to load RWA #${rwaReq.rwaId} (HTTP ${res.status})`);
        }
        return body as RwaDetailResponse;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setRwaDetail(data);
        setRwaError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setRwaDetail(null);
        setRwaError(err instanceof Error ? err.message : "Unable to load RWA parity details.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setRwaLoading(false);
      });

    return () => controller.abort();
  }, [activeTab, rwaReq, sessionKey, mergeTraces]);

  // Issuer Detail fetch — only runs when Issuers tab is active
  useEffect(() => {
    if (activeTab !== "issuers" || !issuerReq.issuerId) return;
    const controller = new AbortController();
    const headers: HeadersInit = sessionKey ? { "x-user-cmc-key": sessionKey } : {};
    const url = `/api/cmc/issuers/${issuerReq.issuerId}${issuerReq.bypassCache ? "?refresh=1" : ""}`;

    fetch(url, { headers, signal: controller.signal })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | (IssuerDetailResponse & { error?: string })
          | null;
        if (body?.traces) mergeTraces(body.traces);
        if (!res.ok || !body || !body.issuer) {
          throw new Error(
            body?.error ?? `Failed to load issuer ${issuerReq.issuerId} (HTTP ${res.status})`
          );
        }
        return body as IssuerDetailResponse;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setIssuerDetail(data);
        setIssuerError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setIssuerDetail(null);
        setIssuerError(err instanceof Error ? err.message : "Unable to load issuer details.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIssuerLoading(false);
      });

    return () => controller.abort();
  }, [activeTab, issuerReq, sessionKey, mergeTraces]);

  function handleSelectTab(tab: ActiveTab) {
    if (tab === "parity" && (!rwaDetail || rwaDetail.quote.rwa_id !== rwaReq.rwaId)) {
      setRwaLoading(true);
      setRwaError(null);
      setRwaReq((prev) => ({ ...prev, bypassCache: false }));
    }
    if (tab === "issuers" && (!issuerDetail || issuerDetail.issuer.issuer_id !== issuerReq.issuerId)) {
      setIssuerLoading(true);
      setIssuerError(null);
      setIssuerReq((prev) => ({ ...prev, bypassCache: false }));
    }
    setActiveTab(tab);
  }

  function handleSelectRwa(rwaId: number) {
    if (rwaId === rwaReq.rwaId && rwaDetail && !rwaError) return;
    setRwaLoading(true);
    setRwaError(null);
    setRwaReq((prev) => ({ rwaId, nonce: prev.nonce + 1, bypassCache: false }));
  }

  function handleInspectRwa(rwaId: number) {
    setRwaLoading(true);
    setRwaError(null);
    setRwaReq((prev) => ({ rwaId, nonce: prev.nonce + 1, bypassCache: false }));
    setActiveTab("parity");
  }

  function handleSelectIssuer(issuerId: string) {
    if (issuerId === issuerReq.issuerId && issuerDetail && !issuerError) return;
    setIssuerLoading(true);
    setIssuerError(null);
    setIssuerReq((prev) => ({ issuerId, nonce: prev.nonce + 1, bypassCache: false }));
  }

  function handleSelectIssuerFromParity(issuerId: string) {
    setIssuerLoading(true);
    setIssuerError(null);
    setIssuerReq((prev) => ({ issuerId, nonce: prev.nonce + 1, bypassCache: false }));
    setActiveTab("issuers");
  }

  function handleRefresh() {
    setOverviewLoading(true);
    setOverviewError(null);
    setOverviewReq((prev) => ({ nonce: prev.nonce + 1, bypassCache: true }));
    if (activeTab === "parity" && rwaReq.rwaId > 0) {
      setRwaLoading(true);
      setRwaError(null);
      setRwaReq((prev) => ({ ...prev, nonce: prev.nonce + 1, bypassCache: true }));
    }
    if (activeTab === "issuers" && issuerReq.issuerId) {
      setIssuerLoading(true);
      setIssuerError(null);
      setIssuerReq((prev) => ({ ...prev, nonce: prev.nonce + 1, bypassCache: true }));
    }
  }

  function handleApplySessionKey(nextKey: string) {
    // React batches these state updates so each active effect fires exactly once (no double-fetch)
    setSessionKey(nextKey);
    setOverviewLoading(true);
    setOverviewError(null);
    setOverviewReq((prev) => ({ nonce: prev.nonce + 1, bypassCache: true }));
    if (activeTab === "parity" && rwaReq.rwaId > 0) {
      setRwaLoading(true);
      setRwaError(null);
      setRwaReq((prev) => ({ ...prev, nonce: prev.nonce + 1, bypassCache: true }));
    }
    if (activeTab === "issuers" && issuerReq.issuerId) {
      setIssuerLoading(true);
      setIssuerError(null);
      setIssuerReq((prev) => ({ ...prev, nonce: prev.nonce + 1, bypassCache: true }));
    }
  }

  function handleTourGold() {
    const gold = overview?.rwaAssets.find(
      (a) => a.rwa_id === 1 || a.symbol.toUpperCase() === "GOLD"
    );
    handleInspectRwa(gold?.rwa_id ?? 1);
  }

  function handleTourIssuer() {
    const backed =
      overview?.issuers.find(
        (i) =>
          i.issuer_id === "6878977dcbbf471de3366e85" ||
          i.name.toLowerCase().includes("backed")
      ) ?? overview?.issuers[0];
    if (backed) {
      handleSelectIssuerFromParity(backed.issuer_id);
    } else {
      handleSelectTab("issuers");
    }
  }

  function handleTourPortfolio() {
    handleSelectTab("portfolio");
  }

  const proKeyAttemptedButFailed =
    Boolean(overview) &&
    (Boolean(overview?.proKeyConfigured) || Boolean(sessionKey)) &&
    overview?.mode !== "live_pro";

  return (
    <div className="flex min-h-screen flex-col">
      <TerminalHeader
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        overview={overview}
        loading={overviewLoading || rwaLoading || issuerLoading}
        onRefresh={handleRefresh}
        onOpenInspector={() => setInspectorOpen(true)}
        traceCount={traces.length}
        hasCustomKey={Boolean(sessionKey)}
        introHidden={introHidden}
        onShowIntro={() => setIntroHiddenStored(false)}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 sm:px-6">
        {!introHidden && (
          <JudgeHeroStrip
            onTourGold={handleTourGold}
            onTourIssuer={handleTourIssuer}
            onTourPortfolio={handleTourPortfolio}
            onOpenInspector={() => setInspectorOpen(true)}
            onHide={() => setIntroHiddenStored(true)}
          />
        )}

        {!overview ? (
          overviewError ? (
            <div className="terminal-panel flex h-80 flex-col items-center justify-center gap-3 rounded-lg p-6 text-center">
              <AlertTriangle className="h-6 w-6 text-red-400" />
              <div className="text-sm font-medium text-slate-100">
                Unable to initialize ParityLens feed
              </div>
              <p className="max-w-md text-xs text-slate-400">{overviewError}</p>
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#eab308] px-3 py-1.5 text-xs font-semibold text-[#090c10] hover:bg-[#facc15]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry Feed
              </button>
            </div>
          ) : (
            <div className="terminal-panel flex h-80 items-center justify-center rounded-lg text-sm text-slate-400">
              Initializing ParityLens RWA intelligence feed...
            </div>
          )
        ) : (
          <>
            {overviewError && (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/[0.08] px-4 py-2.5 text-xs text-red-200">
                <span>
                  <strong>Refresh warning:</strong> {overviewError}. Displaying last loaded state.
                </span>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="shrink-0 font-semibold text-red-200 underline hover:text-white"
                >
                  Retry
                </button>
              </div>
            )}

            {overview.mode !== "live_pro" && (
              <div
                className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-xs ${
                  proKeyAttemptedButFailed
                    ? "border-red-500/30 bg-red-500/[0.08] text-red-200"
                    : "border-amber-500/25 bg-amber-500/[0.06] text-amber-200"
                }`}
              >
                {proKeyAttemptedButFailed ? (
                  <span>
                    <strong>API Key Fallback:</strong> The active CoinMarketCap Pro API key was
                    rejected or rate-limited — falling back to reference snapshots. Open the API
                    Inspector to inspect the exact CMC error code.
                  </span>
                ) : (
                  <span>
                    <strong>Notice:</strong> Server <code className="num">CMC_PRO_API_KEY</code> is
                    not configured yet — macro feeds use CoinMarketCap Keyless Public API while RWA
                    v5 endpoints display schema-verified reference snapshots.
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setInspectorOpen(true)}
                  className="shrink-0 font-semibold text-[#eab308] hover:underline"
                >
                  {proKeyAttemptedButFailed ? "Inspect API Error →" : "Test with Session API Key →"}
                </button>
              </div>
            )}

            {activeTab === "screener" && (
              <ScreenerView overview={overview} onInspectRwa={handleInspectRwa} />
            )}

            {activeTab === "parity" && (
              <ParityAnalyzerView
                rwaAssets={overview.rwaAssets}
                selectedRwaId={rwaReq.rwaId}
                onSelectRwa={handleSelectRwa}
                detail={rwaDetail}
                loading={rwaLoading}
                error={rwaError}
                onRetry={handleRefresh}
                onSelectIssuer={handleSelectIssuerFromParity}
              />
            )}

            {activeTab === "issuers" && (
              <IssuerExplorerView
                issuers={overview.issuers}
                selectedIssuerId={issuerReq.issuerId}
                onSelectIssuer={handleSelectIssuer}
                issuerDetail={issuerDetail}
                loading={issuerLoading}
                error={issuerError}
                onRetry={handleRefresh}
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
        mode={overview?.mode ?? "snapshot"}
        proKeyConfigured={overview?.proKeyConfigured ?? false}
        sessionKey={sessionKey}
        onApplySessionKey={handleApplySessionKey}
      />
    </div>
  );
}
