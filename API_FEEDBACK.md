# CoinMarketCap API Product Feedback — ParityLens (#BuildwithCMC Round 2)

This note summarizes what the CoinMarketCap API (especially the new **RWA v5** suite and **Keyless Public API**) made possible while building **ParityLens**, along with specific areas where developer ergonomics or data coverage got in the way.

---

## What the CoinMarketCap API Made Possible

1. **Unified Multi-Issuer RWA Schema (`/v5/real-world-assets/quotes/latest`)**
   Returning the aggregate `average_tokenized_price` alongside each individual underlying on-chain token (`tokens[]` with `issuer_id`, `issuer_name`, `crypto_id`, `price`, `market_cap`, and `volume_24h`) inside a single response is a huge win. It let us calculate cross-issuer basis-point parity spreads and Herfindahl-Hirschman Index (HHI) concentration in one credit-efficient request.
2. **6 of 7 RWA v5 Endpoints Live on Basic Plan (Zero-Credit Map Lookups)**
   Having `/v5/real-world-assets/map`, `/assets/list`, `/quotes/latest`, `/info`, `/issuers/list`, and `/issuers` accessible on the free Basic tier (with zero-credit lookups on `/map`) let us build a live production RWA intelligence tool that stays operational even after Startup credits expire.
3. **Zero-Friction Prototyping with Keyless + Standardized Envelope**
   Having `/public-api/v3/fear-and-greed/latest`, `/public-api/v1/global-metrics/quotes/latest`, and `/public-api/v3/cryptocurrency/quotes/latest` share the exact same JSON envelope as the authenticated Pro API simplified building a single backend client (`src/lib/cmc/client.ts`).
4. **Machine-Readable Documentation**
   The clean endpoint schemas and explicit `Cache / Update frequency` and `Plan credit use` annotations made designing server-side TTL caching straightforward.

---

## Where the API Got in the Way (Actionable Product Feedback)

1. **Missing TradFi Reference Spot Price Inside `tradfi_markets[]`**
   In `/v5/real-world-assets/quotes/latest`, `tradfi_markets` gives the exchange name, ticker, and URL, **but not the underlying TradFi reference price or market-open status**. As a result, comparing a tokenized stock (e.g., `NVDAX` or `NVDAon`) against its *true off-chain TradFi benchmark* still requires a separate external TradFi feed — we can currently only compute *inter-issuer* dispersion against `average_tokenized_price`. Adding an optional `reference_price` and `market_status` (`open` / `after_hours` / `closed`) field would unlock true weekend/after-hours RWA depeg tracking natively in CMC.
2. **No Historical RWA Quotes Endpoint (`/v5/real-world-assets/quotes/historical`) Yet**
   While `/v5/real-world-assets/map` exposes `first_historical_data` and `last_historical_data` timestamps, there is no public historical RWA quotes or historical issuer-spread endpoint in the RWA v5 reference yet. Adding a daily/hourly historical endpoint would allow plotting depeg persistence curves during macro volatility events.
3. **Inconsistent `status.error_code` Type Between Keyless and Pro APIs**
   Live calls to `/public-api/v3/fear-and-greed/latest` return `"error_code": "0"` (string) while `/public-api/v1/global-metrics/quotes/latest` and authenticated Pro endpoints return `"error_code": 0` (number). Strict TypeScript clients comparing `status.error_code === 0` silently fail unless normalized with `String(status.error_code) === "0"`.
4. **Tight Shared-IP Ceiling on Keyless Public API (`error_code: "1022"`)**
   During development from a cloud container IP, hitting 3 sequential keyless endpoints immediately triggered `error_code: "1022"` (*"You've reached the limit for anonymous access"*). Including a `Retry-After` HTTP header alongside `1022` would help clients implement deterministic exponential backoff.
5. **Enriching `/v5/real-world-assets/issuers` Without Secondary Joins**
   The single-issuer endpoint returns `{ name, symbol, crypto_id, rwa_id }` per linked token, without each token's `price`, `market_cap`, or `volume_24h`. Showing total AUM/TVL per issuer requires N additional calls to `/v5/real-world-assets/quotes/latest` or `/v3/cryptocurrency/quotes/latest`. Adding optional `aux=quotes` or returning aggregate issuer `total_tokenized_market_cap` would make issuer due-diligence views dramatically more credit-efficient.
6. **Mixed Token Denominations Under a Single `rwa_id` Without a `unit_multiplier` Field**
   In live `/v5/real-world-assets/quotes/latest?rwa_id=1` (Gold), 1-troy-ounce tokens (`PAXG`, `XAUt`, `XAUM` around `~$3,545`) appear in the same `tokens[]` array as 1-gram tokens (`CGO` at `$112.49`, `VNXAU` at `$115.71`) and zero-cap derivative entries (`XAU` at `$0` mcap/volume), without a `unit_multiplier` or `denomination` field (`1_oz` vs `1_gram`). ParityLens now auto-detects and tags unit-scaled and zero-liquidity tokens, but exposing an explicit `unit_ratio` or `unit_label` field directly in the RWA v5 schema would make cross-issuer price parity analytics exact out of the box.
7. **`/v5/real-world-assets/market-pairs/list` Tier Gating (`HTTP 403` / `error_code: "1006"`) on Basic Plan**
   During live verification with a Basic plan key (`15,000` monthly credits), 6 of 7 RWA v5 endpoints returned `HTTP 200`, while `/v5/real-world-assets/market-pairs/list` returned `HTTP 403` (`error_code: "1006": "Your API Key subscription plan doesn't support this endpoint"`). Highlighting Startup+ gating explicitly in the RWA v5 endpoint matrix — or granting Basic read access to top-10 pairs — would avoid surprises when hackathon builds revert to Basic after Startup windows close.
8. **`quote` Array Schema Change on `/v3/cryptocurrency/quotes/latest` vs v1/v2 Object Map**
   Unlike `/v1/cryptocurrency/quotes/latest` and `/v2/cryptocurrency/quotes/latest` (where `data[id].quote` is an object keyed by symbol, e.g., `quote.USD.price`), `/v3/cryptocurrency/quotes/latest` returns `data` as an array where each asset's `quote` is itself an array (`quote: [{ id: 2781, symbol: "USD", price, ... }]`). Calling out this breaking shape difference prominently in a v2 → v3 migration callout would prevent silent parsing fallbacks for developers migrating from older CMC SDKs.
