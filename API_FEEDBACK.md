# CoinMarketCap API Product Feedback — ParityLens (#BuildwithCMC Round 2)

This note summarizes what the CoinMarketCap API (especially the new **RWA v5** suite and **Keyless Public API**) made possible while building **ParityLens**, along with specific areas where developer ergonomics or data coverage got in the way.

---

## What the CoinMarketCap API Made Possible

1. **Unified Multi-Issuer RWA Schema (`/v5/real-world-assets/quotes/latest`)**
   Returning the aggregate `average_tokenized_price` alongside each individual underlying on-chain token (`tokens[]` with `issuer_id`, `issuer_name`, `crypto_id`, `price`, `market_cap`, and `volume_24h`) inside a single response is a huge win. It let us calculate cross-issuer basis-point parity spreads and Herfindahl-Hirschman Index (HHI) concentration in one credit-efficient request.
2. **All 7 RWA v5 Endpoints Available on Basic & Startup Plans**
   Making the full RWA v5 catalog accessible on the Basic tier (and zero-credit lookups on `/v5/real-world-assets/map`) meant we could build a production-ready public tool without breaking when event-window Startup access reverts to Basic during judging.
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
