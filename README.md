# ParityLens — RWA Parity, Liquidity & Issuer Intelligence Terminal

> **Built for [Build with CMC: API Hackathon, Round 2](https://coinmarketcap.com/api/resources/api-hackathon-2026-11/) (`#BuildwithCMC`)**  
> **Track:** Real World Assets (RWA)

**ParityLens** is an institutional-grade Real-World Asset intelligence terminal built on **CoinMarketCap's RWA API v5**. When multiple issuers tokenize the same underlying asset (e.g., **PAXG** vs **XAUt** for Gold, **NVDAX** vs **NVDAon** for NVIDIA, **BUIDL** vs **OUSG** vs **bIB01** for U.S. Treasuries), prices diverge, liquidity fragments across CEX/DEX venues, and issuer concentration risk builds up.

ParityLens turns raw CoinMarketCap RWA v5 and macro endpoints into four cohesive workflows:
1. **Tokenized RWA Screener** — Filter across all 6 RWA classes (`stock`, `commodity`, `government_security`, `etf`, `currency`, `real_estate`), compare tokenized market cap, 24h volume, and capital turnover ratio (`vol / cap`).
2. **Multi-Issuer Parity & Spread Analyzer** — Visual basis-point deviation ruler comparing every competing on-chain token against `average_tokenized_price`, inter-issuer spread grading (`TIGHT < 15 bps`, `MODERATE 15–50 bps`, `WIDE > 50 bps`), **Herfindahl-Hirschman Index (HHI)** issuer concentration risk, and exchange venue fragmentation.
3. **RWA Issuer Due-Diligence Explorer** — Directory of active RWA issuers (Backed Assets, Ondo Assets, Paxos, Tether Holdings, Securitize, Backpack, etc.) with full linked-token catalog drill-down.
4. **Hybrid Crypto + Tokenized TradFi Portfolio Lab** — Combine native crypto (`BTC`, `ETH`, `SOL`, `USDT`) and tokenized RWAs in a unified USD portfolio with live sleeve allocation, concentration audit, and CoinMarketCap Fear & Greed context.
5. **Built-In Live API Inspector** — Slide-over drawer displaying every executed CoinMarketCap request, HTTP status, CMC `elapsed` latency, credit cost, cache state, and sanitized JSON payload — plus a memory-only Session Key tester so judges can test live RWA v5 calls directly.

---

## Explicit CoinMarketCap API Endpoints Used (11 Total)

**10 of 11 integrated endpoints run live on the free Basic plan** (including 6 of 7 RWA v5 endpoints), ensuring the deployed application stays fully operational after the hackathon's Startup window closes and during the December 10–25 judging period. The 11th endpoint (`/v5/real-world-assets/market-pairs/list`) unlocks on **Startup+** plans and gracefully degrades on Basic keys (HTTP `403` / code `1006`) to live per-token 24h liquidity shares from `/v5/real-world-assets/quotes/latest`.

| # | Endpoint | Category | Plan | Purpose in ParityLens |
| :- | :--- | :--- | :--- | :--- |
| 1 | `GET /v5/real-world-assets/map` | RWA v5 | Basic+ (0 cr) | Catalog index & canonical `rwa_id` count |
| 2 | `GET /v5/real-world-assets/assets/list` | RWA v5 | Basic+ | Ranked RWA screener, asset-class breakdown, average prices & caps |
| 3 | `GET /v5/real-world-assets/quotes/latest` | RWA v5 | Basic+ | Per-asset competing `tokens[]` by issuer + `tradfi_markets[]` for parity spread & HHI math |
| 4 | `GET /v5/real-world-assets/info` | RWA v5 | Basic+ | Underlying reference metadata (`primary_exchange`, `industry`, `cik`, description) |
| 5 | `GET /v5/real-world-assets/market-pairs/list` | RWA v5 | Startup+ | Active CEX/DEX trading pairs & cross-venue liquidity fragmentation (graceful Basic fallback) |
| 6 | `GET /v5/real-world-assets/issuers/list` | RWA v5 | Basic+ | Active issuer directory and issued token counts |
| 7 | `GET /v5/real-world-assets/issuers` | RWA v5 | Basic+ | Single-issuer drill-down returning linked on-chain tokens |
| 8 | `GET /v3/cryptocurrency/quotes/latest` | Crypto v3 | Keyless / Basic+ | Live USD quotes by stable CMC ID (`1,1027,5426,825`) for macro ribbon & Hybrid Portfolio |
| 9 | `GET /v1/global-metrics/quotes/latest` | Global v1 | Keyless / Basic+ | Total crypto market cap, 24h volume & BTC/ETH dominance (RWA share of crypto) |
| 10 | `GET /v3/fear-and-greed/latest` | Sentiment v3 | Keyless / Basic+ | CoinMarketCap proprietary Fear & Greed Index for portfolio macro context |
| 11 | `GET /v1/key/info` | Utilities v1 | Basic+ (0 cr) | Live plan tier, monthly credit consumption & rate-limit telemetry |

---

## Architecture & Security Best Practices

* **Server-Side Proxy Only:** All CoinMarketCap Pro requests run inside Next.js App Router route handlers (`src/app/api/cmc/*`). `CMC_PRO_API_KEY` is read strictly on the server and **never committed to Git** or exposed to browser bundles.
* **Credit-Safe TTL Caching:** Server-side in-memory TTL caching matches CMC's documented refresh windows (60s for quotes/pairs, 300s for map/info/issuers/sentiment).
* **Resilient Data Transparency:** Normalizes CMC `status.error_code` across numeric `0` (Pro API) and string `"0"` (Keyless Public API). Every request is explicitly badged `LIVE PRO`, `KEYLESS`, or `SNAPSHOT` in the header and Live API Inspector.

```text
Browser UI (Next.js App Router + Tailwind CSS)
  ├── Market Screener / Parity Analyzer / Issuer Explorer / Portfolio Lab
  └── Live API Inspector Drawer (HTTP status, elapsed ms, credit_count, JSON)
        │
        ▼  GET /api/cmc/overview | /api/cmc/rwa/[id] | /api/cmc/issuers/[id]
Next.js Server Route Handlers (TTL Cache + Parity & HHI Analytics Engine)
        │
        ▼  X-CMC_PRO_API_KEY (server-side env) or /public-api (Keyless)
https://pro-api.coinmarketcap.com
```

---

## Local Setup & Running Live

### 1. Install dependencies
```bash
npm install
```

### 2. Configure your CoinMarketCap API Key
Copy `.env.example` to `.env.local` and paste your personal key from [coinmarketcap.com/api](https://coinmarketcap.com/api/):
```bash
cp .env.example .env.local
# Edit .env.local and set: CMC_PRO_API_KEY=your_key_here
```

### 3. Verify live CMC API calls & capture evidence
```bash
npm run verify:cmc
```
This script calls every integrated CoinMarketCap endpoint, prints HTTP status, latency, and credit usage, and writes sanitized real JSON responses (with zero secrets) to `evidence/live-api-evidence.json`.

### 4. Start the development server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## Deploy to Vercel (1-Click)

1. Import this GitHub repository in [Vercel](https://vercel.com/new).
2. Under **Environment Variables**, add `CMC_PRO_API_KEY` with your CoinMarketCap API key.
3. Click **Deploy** — Next.js App Router API routes run automatically as serverless functions with zero additional configuration.

---

## Real API Evidence & Product Feedback

* **Live API Evidence:** Run `npm run verify:cmc` to regenerate `evidence/live-api-evidence.json`, or inspect live calls directly inside the app via the **API Inspector** drawer.
* **CoinMarketCap API Feedback:** Read our detailed product & DX feedback in [`API_FEEDBACK.md`](./API_FEEDBACK.md).
