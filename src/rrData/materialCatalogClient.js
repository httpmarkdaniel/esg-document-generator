// Frontend client for the material-split catalog proxied through
// /api/material-catalog.js — matches an RR line item's free-text ITEM TYPE
// against the catalog's canonical item names/aliases to derive a real,
// sourced material split (metal/plastic/glass/electronics %) instead of
// requiring it to be typed by hand. Never guesses: returns null when
// nothing matches, rather than assigning an arbitrary split.

let entriesPromise = null

function loadEntries() {
  if (!entriesPromise) {
    entriesPromise = fetch('/api/material-catalog')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `Failed to load material catalog (HTTP ${res.status})`)
        }
        return res.json()
      })
      .then((data) => data.entries)
      .catch((err) => {
        entriesPromise = null // allow retry on next call
        throw err
      })
  }
  return entriesPromise
}

function normalize(s) {
  return String(s || '').trim().toUpperCase().replace(/\s+/g, ' ')
}

function wholeWordIncludes(haystack, needle) {
  if (!needle) return false
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`).test(haystack)
}

/**
 * Best-effort match of a raw ITEM TYPE against pre-loaded catalog entries.
 * Exact alias match wins outright; otherwise the closest-length whole-word
 * substring match (either direction) is used. Returns
 * `{ split, matchedAlias, catalogItem, reference } | null`.
 */
export function matchMaterialSplit(itemType, entries) {
  const target = normalize(itemType)
  if (!target || !entries?.length) return null

  for (const entry of entries) {
    for (const alias of entry.aliases) {
      if (normalize(alias) === target) {
        return { split: entry.split, matchedAlias: alias, catalogItem: entry.item, reference: entry.reference }
      }
    }
  }

  // Take the first whole-word substring match in catalog order (not the
  // "closest length" one) — the catalog lists common/general categories
  // before brand- or legacy-specific variants (e.g. "Flat Screen Monitor"
  // before "Old Monitor / CRT" or "Apple Monitor"), so catalog order is a
  // better tiebreak than string length for a bare term like "MONITOR".
  for (const entry of entries) {
    for (const alias of entry.aliases) {
      const normAlias = normalize(alias)
      if (wholeWordIncludes(target, normAlias) || wholeWordIncludes(normAlias, target)) {
        return { split: entry.split, matchedAlias: alias, catalogItem: entry.item, reference: entry.reference }
      }
    }
  }
  return null
}

/** Fetch (and cache) every catalog entry. */
export async function getMaterialCatalog() {
  return loadEntries()
}

/** Fetch the catalog, then match one item type against it. */
export async function matchMaterialSplitAsync(itemType) {
  const entries = await loadEntries()
  return matchMaterialSplit(itemType, entries)
}
