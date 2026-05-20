# Catalog Bundling Strategy (v0.1)

**Decision:** For v0.1 MVP, FieldLog ships a **hand-curated Missouri-relevant product seed list** (~30 products) baked into the repo as a typed TypeScript module. The ingestion script and the catalog loader service are designed so a full **active-Section-3 bundle (~20k products, expected ~10 MB gzipped)** can drop in later without UI changes.

See `epa-source-data-inventory.md` for the underlying APPRIL data inventory.

## Why this choice (not the alternatives)

| Option | Why we picked / passed |
|---|---|
| **Hand-curated MO seed (chosen for v0.1)** | Unblocks form UX and Product Autocomplete (Item 6.6) today. Auditable; every product checked by a human. Trivially commit-traceable. Fits comfortably in IndexedDB without performance work. |
| Active-Sec3 bundle (~20k) | Comprehensive but not required for the MVP UI. Defer until we have an ingestion script (Item 6.4) we trust and a real-user complaint about missing products. Avoid premature 10 MB asset. |
| Streamed / lazy API | Violates offline-first. Useless on a tractor with no signal. Not viable for v0.1 — reconsider only for post-MVP power users browsing the full catalog. |

## What this means for the loader interface

The `CatalogLoader` we build in Item 6.5 must accept *any* source that yields a `Product[]` shape — seed JSON, an ingested bundle, or a future streamed query — and idempotently populate Dexie. Concretely:

```ts
interface CatalogSource {
  catalogVersion: string;
  fetchProducts(): Promise<Product[]>;
}
```

The MO seed implements `CatalogSource` by returning an in-memory array. The bundle implementation will implement the same interface by `fetch()`-ing the bundle once, decompressing, caching to IndexedDB, and serving subsequent reads from there.

## Versioning and provenance

- Every product carries a `catalogVersion` (e.g. `MO-SEED-2026-05-19` for the curated list, `APPRIL-FULL-YYYY-MM-DD` for a bundled snapshot).
- ProductSnapshots already freeze `catalogVersion` at submit time — this is the audit hook that lets us answer "which catalog said this product was active at submit time."

## Out of scope for v0.1

- No live APPRIL API calls.
- No partial / on-demand product downloads.
- No diff / delta updates between catalog versions.
- No multi-state coverage; MO only.

Revisit after Item 6.7 ships and we have real-user product-not-found signals.
