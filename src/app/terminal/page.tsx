"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ParityLensApp } from "@/components/ParityLensApp";
import type { ActiveTab } from "@/components/TerminalHeader";

const VALID_TABS = new Set<ActiveTab>(["screener", "parity", "issuers", "portfolio"]);

function TerminalWithParams() {
  const params = useSearchParams();
  const rawTab = params.get("tab") as ActiveTab | null;
  const initialTab: ActiveTab = rawTab && VALID_TABS.has(rawTab) ? rawTab : "screener";

  const rawRwa = Number(params.get("rwa"));
  const initialRwaId = Number.isInteger(rawRwa) && rawRwa > 0 ? rawRwa : 1;

  const rawIssuer = (params.get("issuer") ?? "").trim();
  const initialIssuerId = /^[a-zA-Z0-9_-]{1,64}$/.test(rawIssuer) ? rawIssuer : "";

  const initialOpenInspector = params.get("inspector") === "1";
  const routeKey = `${initialTab}:${initialRwaId}:${initialIssuerId}:${initialOpenInspector}`;

  return (
    <ParityLensApp
      key={routeKey}
      initialTab={initialTab}
      initialRwaId={initialRwaId}
      initialIssuerId={initialIssuerId}
      initialOpenInspector={initialOpenInspector}
    />
  );
}

export default function TerminalPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#090c10] text-sm text-slate-400">
          Loading ParityLens Live RWA Terminal...
        </div>
      }
    >
      <TerminalWithParams />
    </Suspense>
  );
}
