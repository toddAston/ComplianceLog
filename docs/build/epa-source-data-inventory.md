# EPA Source Data Inventory (APPRIL)

Documents what we have on disk for product/EPA reference data and what's available upstream, so the catalog-ingestion work (Items 6.3-6.5) can choose between bulk-load vs API-pull vs hand-curated.

## Files on disk

| Path | Size | Notes |
|---|---|---|
| `data/raw/epa/apprildatadump_public.xlsx` | 93.64 MB | Full APPRIL public dump — every Section 3 and distributor product. Gitignored. Source of truth for offline bundling. |
| `data/raw/epa/2024-cdr-public-csv-data/` (5 files, ~120 MB total) | ~120 MB | TSCA Chemical Data Reporting dump. **Not pesticide product data** — these are industrial chemicals reported under TSCA, not FIFRA. Not useful for FieldLog's product catalog; do not ingest. |
| `research/regulatory/APPRIL_User_Guide_Public.pdf` | — | End-user guide to the APPRIL website. |
| `research/regulatory/APPRIL_REST_API_User_Guide.pdf` | — | API endpoint, query syntax, full field reference. Read first when designing the loader. |
| `research/regulatory/rups-rpt.pdf` | — | RUP-specific report (PDF table). Useful as a sanity check for the RUP flag column. |

## APPRIL upstream

- Single REST endpoint: `https://ordspub.epa.gov/ords/pesticides/apprilapi/`
- Returns JSON. Default page size 500, max 10,000 per call.
- Total volume: ~400k Section 3 + distributor records; ~50k active products; ~20k active FIFRA Section 3 products.
- Pagination via `&limit=` + `&offset=`.
- Query filter via `?q={...JSON...}` (Oracle SODA filter syntax — supports `$or`, `$instr`, `$gte`, `$date`).

### Useful filters for FieldLog

| Goal | Filter |
|---|---|
| Active products only | `{"status_group":"Active"}` |
| Active Section 3 only | `{"reg_type":"Sec3","status_group":"Active"}` |
| Restricted Use only | `{"rup_flag":"Y"}` |
| Look up by EPA reg # | `{"reg_num":"12345-678"}` |
| Look up by AI (CAS, PC_Code, or name) | `{"ais":{"$instr":"glyphosate"}}` |

## Field reference (the columns we'd actually use)

| Field | Type | FieldLog mapping |
|---|---|---|
| `reg_num` | varchar | `Product.epaRegistrationNumber` |
| `reg_type` | enum: `Sec3` / `DP` | filter to `Sec3` for v0.1 catalog |
| `product_name` | varchar | `Product.name` |
| `company_num` / `company_name` | varchar | (out of scope for v0.1) |
| `first_reg_dt` | date | (informational) |
| `status` / `status_desc` / `status_group` | enums | filter to `status_group = "Active"` |
| `rup_flag` | Y/N | drives `Product.rupStatus` (Y → `yes`, N → `no`) |
| `rup_reason` | varchar | freeze onto `ProductSnapshot` (audit-relevant) |
| `signal_word` | enum | display on PDF and snapshot |
| `use_type` / `pesticide_type` / `pest_cat` | enums | filter / categorize |
| `ais` (CLOB) | comma-separated AI list with chemical name + PC_Code + CAS # + % | snapshot |
| `pests` (CLOB) | comma-separated allowable pests | (search index later) |
| `sites` (CLOB) | comma-separated allowable use sites | (search index later) |
| `phys_form` | enum | informational |
| `use_pattern` | comma-separated | informational |

## Constraints that shape the loader

- **Field is offline-first.** Live API calls aren't acceptable at submit time. The catalog must be bundled or pre-synced.
- **50k active Section 3 products** would be ~10-30 MB compressed JSON depending on field selection — too large for a baseline IndexedDB bundle if shipped uncompressed, but acceptable as a chunked or trimmed dataset.
- **RUP truth must round-trip.** Whatever subset we ship, the `rup_flag` column must survive verbatim — it's the only field FieldLog persists as a fact (never as a decision).
- **No legal adjudication.** Do not derive "is allowed" from `sites`/`pests`. We capture facts; we don't authorize applications.

## Decision needed in Item 6.3 (Pick catalog bundling strategy)

Three viable strategies, in order of complexity:

1. **Hand-curated MO seed list (~30 products)** — fastest, validates the UI; ship as JSON in repo. Item 6.7 captures this.
2. **Active-Sec3-only bundle (~20k products, ~10 MB gzipped)** — single fetch at install, cached for offline use. Best balance for v0.1.
3. **Streamed/lazy catalog** — query APPRIL on demand, cache hits to IndexedDB. Heaviest path; only justifiable if the bundle proves unmanageable.

Recommendation for v0.1 MVP: ship **#1 immediately**, design the loader interface to swap in **#2** without UI changes. #3 is post-v0.1.
