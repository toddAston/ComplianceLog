// Small "recent values" cache for repetitive form inputs.
//
// Why this exists: managers onboarding contractors enter the same kind of
// values over and over — Missouri license expiry dates cluster on Dec 31 of
// a given year, certification numbers share company-wide prefixes, contractor
// company names repeat across an applicator roster, etc. Surfacing the last
// N values the user typed for a given field turns the second/third entry
// into a one-click pick.
//
// Backed by localStorage under `fieldlog-recent:<key>`. Per-key LRU with a
// hard cap so the store stays small. Trims empty / whitespace-only entries.
// Does not de-duplicate case-insensitively — different casings stay distinct,
// since some real values (e.g. "MO-12345" vs "mo-12345") are technically the
// same license but the user typed them differently. Caller decides what to
// display.

const STORAGE_PREFIX = "fieldlog-recent:";
const DEFAULT_CAP = 8;

function storageKey(fieldKey: string): string {
  return `${STORAGE_PREFIX}${fieldKey}`;
}

// Reads the recent list for a field key. Returns an empty array when the
// key is absent, the entry is corrupt, or window/localStorage is unavailable
// (e.g. SSR, certain test environments). Most-recent value is at index 0.
export function getRecentValues(fieldKey: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(fieldKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

// Records a value into the recent list for a field. Empty/whitespace values
// are ignored. If the value already exists it gets bumped to the front of
// the list (LRU). The list is capped at `cap` entries (default 8).
export function recordRecentValue(
  fieldKey: string,
  value: string,
  cap: number = DEFAULT_CAP
): void {
  if (typeof window === "undefined") return;
  const trimmed = value.trim();
  if (!trimmed) return;
  const existing = getRecentValues(fieldKey);
  const next = [
    trimmed,
    ...existing.filter((v) => v.trim() !== trimmed),
  ].slice(0, cap);
  try {
    window.localStorage.setItem(storageKey(fieldKey), JSON.stringify(next));
  } catch {
    // ignore quota / serialization errors — recent-values is best-effort.
  }
}

// Test/demo helper. Production code should use the per-key functions above.
export function clearRecentValues(fieldKey: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey(fieldKey));
}
