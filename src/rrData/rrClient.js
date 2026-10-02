// Frontend client for the Receiving Report (RR) data proxied through
// /api/rr-data.js. Fetches once, caches in memory for the session, and
// exposes the aggregation helpers the Certificate (single RR) and Report
// (date-range of RRs) flows need.
//
// This is the ONLY file that should know the shape of the raw sheet rows —
// callers work with the aggregated shapes below.

import { getMaterialCatalog, matchMaterialSplit } from './materialCatalogClient.js'

let itemsPromise = null

/** Fetch (and cache) every RR line-item row. */
function loadItems() {
  if (!itemsPromise) {
    itemsPromise = fetch('/api/rr-data')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `Failed to load RR data (HTTP ${res.status})`)
        }
        return res.json()
      })
      .then((data) => data.items)
      .catch((err) => {
        itemsPromise = null // allow retry on next call
        throw err
      })
  }
  return itemsPromise
}

/** Sorted list of every distinct RR reference number, for the dropdown. */
export async function getRrNumbers() {
  const items = await loadItems()
  const unique = [...new Set(items.map((i) => i.referenceNo))]
  return unique.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
}

/**
 * Sum each item's material-catalog-derived KG breakdown (item.netWeight ×
 * matched split %) across a set of RR line items. Items whose ITEM TYPE
 * doesn't match anything in the catalog simply contribute 0 — never an
 * invented split — so `materialsMatchedFraction` tells the caller how much
 * of the total weight the breakdown actually covers.
 */
function aggregateMaterials(items, catalogEntries) {
  const materialsKg = { metalKg: 0, plasticKg: 0, glassKg: 0, electronicsKg: 0 }
  let matchedNetWeight = 0
  const matchedItemTypes = new Set()
  const unmatchedItemTypes = new Set()

  for (const item of items) {
    const match = matchMaterialSplit(item.itemType, catalogEntries)
    if (!match) {
      if (item.itemType) unmatchedItemTypes.add(item.itemType)
      continue
    }
    matchedNetWeight += item.netWeight
    matchedItemTypes.add(item.itemType)
    materialsKg.metalKg += item.netWeight * (match.split.metal / 100)
    materialsKg.plasticKg += item.netWeight * (match.split.plastic / 100)
    materialsKg.glassKg += item.netWeight * (match.split.glass / 100)
    materialsKg.electronicsKg += item.netWeight * (match.split.electronics / 100)
  }

  return { materialsKg, matchedNetWeight, matchedItemTypes: [...matchedItemTypes], unmatchedItemTypes: [...unmatchedItemTypes] }
}

/**
 * One entry per ITEM TYPE in an RR (e.g. LAPTOP, MONITOR): its net weight and
 * its own material-catalog breakdown — the ESG report's "Item" rows. Item
 * types the catalog doesn't cover keep a 0 breakdown and `matched: false`.
 */
function itemTypeBreakdown(items, catalogEntries) {
  const byType = new Map()
  for (const item of items) {
    const type = item.itemType || 'Unspecified item'
    if (!byType.has(type)) byType.set(type, [])
    byType.get(type).push(item)
  }
  return [...byType.entries()].map(([itemType, typeItems]) => {
    const { materialsKg, matchedNetWeight } = aggregateMaterials(typeItems, catalogEntries)
    return { itemType, netWeight: typeItems.reduce((s, i) => s + i.netWeight, 0), materialsKg, matched: matchedNetWeight > 0 }
  })
}

function summarize(referenceNo, items, catalogEntries) {
  if (!items.length) return null
  const first = items[0]
  const totalNetWeight = items.reduce((s, i) => s + i.netWeight, 0)
  const { materialsKg, matchedNetWeight, matchedItemTypes, unmatchedItemTypes } = aggregateMaterials(items, catalogEntries)

  return {
    referenceNo,
    accountName: first.accountName,
    companyName: first.companyName,
    billingAddress: first.billingAddress,
    pickupAddress: first.pickupAddress,
    receivedDate: first.receivedDate,
    receivedDateIso: first.receivedDateIso,
    itemCount: items.length,
    totalKilos: items.reduce((s, i) => s + i.kilos, 0),
    totalPalletWeight: items.reduce((s, i) => s + i.palletWeight, 0),
    totalNetWeight,
    totalQty: items.reduce((s, i) => s + i.qty, 0),
    itemTypes: [...new Set(items.map((i) => i.itemType).filter(Boolean))],
    // Material-catalog-derived breakdown (see aggregateMaterials) — never
    // typed by hand, and never invented for item types the catalog doesn't
    // recognize.
    materialsKg,
    materialsMatchedNetWeight: matchedNetWeight,
    materialsMatchedFraction: totalNetWeight > 0 ? matchedNetWeight / totalNetWeight : 0,
    matchedItemTypes,
    unmatchedItemTypes,
    itemTypeRows: itemTypeBreakdown(items, catalogEntries),
    items,
  }
}

/** Aggregate every line item for one RR reference number (for the Certificate flow). */
export async function getRrSummary(referenceNo) {
  const [items, catalogEntries] = await Promise.all([loadItems(), getMaterialCatalog()])
  return summarize(
    referenceNo,
    items.filter((i) => i.referenceNo === referenceNo),
    catalogEntries,
  )
}

/** One summary per RR reference number, sorted by received date then reference number. */
function summarizeByRef(items, catalogEntries) {
  const byRef = new Map()
  for (const item of items) {
    if (!byRef.has(item.referenceNo)) byRef.set(item.referenceNo, [])
    byRef.get(item.referenceNo).push(item)
  }

  return [...byRef.entries()]
    .map(([referenceNo, refItems]) => summarize(referenceNo, refItems, catalogEntries))
    .sort((a, b) => (a.receivedDateIso || '').localeCompare(b.receivedDateIso || '') || a.referenceNo.localeCompare(b.referenceNo))
}

/**
 * Aggregate every RR whose RECEIVED DATE falls within [startIso, endIso]
 * (inclusive), one summary per RR reference number.
 */
export async function getRrSummariesInRange(startIso, endIso) {
  const [items, catalogEntries] = await Promise.all([loadItems(), getMaterialCatalog()])
  const inRange = items.filter((i) => i.receivedDateIso && i.receivedDateIso >= startIso && i.receivedDateIso <= endIso)
  return summarizeByRef(inRange, catalogEntries)
}

let allSummariesPromise = null

/** Every RR as a summary (for the multi-RR picker), cached for the session. */
export function getAllRrSummaries() {
  if (!allSummariesPromise) {
    allSummariesPromise = Promise.all([loadItems(), getMaterialCatalog()])
      .then(([items, catalogEntries]) => summarizeByRef(items, catalogEntries))
      .catch((err) => {
        allSummariesPromise = null // allow retry on next call
        throw err
      })
  }
  return allSummariesPromise
}

/**
 * Combine several RR summaries into one (for a single certificate covering
 * multiple RRs): weights and material breakdowns are summed, item types are
 * unioned. Account/address come from the first RR; `accountNames` lists
 * every distinct account so the caller can warn when they differ.
 */
export function combineRrSummaries(summaries) {
  if (!summaries.length) return null

  const first = summaries[0]
  const sum = (key) => summaries.reduce((s, r) => s + r[key], 0)
  const union = (key) => [...new Set(summaries.flatMap((r) => r[key]))]
  const totalNetWeight = sum('totalNetWeight')
  const matchedNetWeight = sum('materialsMatchedNetWeight')
  const dates = summaries.map((r) => r.receivedDateIso).filter(Boolean).sort()

  return {
    referenceNo: summaries.map((r) => r.referenceNo).join(', '),
    referenceNos: summaries.map((r) => r.referenceNo),
    rrCount: summaries.length,
    accountName: first.accountName,
    accountNames: [...new Set(summaries.map((r) => r.accountName).filter(Boolean))],
    companyName: first.companyName,
    billingAddress: first.billingAddress,
    pickupAddress: first.pickupAddress,
    receivedDateFromIso: dates[0] || null,
    receivedDateToIso: dates[dates.length - 1] || null,
    itemCount: sum('itemCount'),
    totalKilos: sum('totalKilos'),
    totalPalletWeight: sum('totalPalletWeight'),
    totalNetWeight,
    totalQty: sum('totalQty'),
    itemTypes: union('itemTypes'),
    materialsKg: {
      metalKg: summaries.reduce((s, r) => s + r.materialsKg.metalKg, 0),
      plasticKg: summaries.reduce((s, r) => s + r.materialsKg.plasticKg, 0),
      glassKg: summaries.reduce((s, r) => s + r.materialsKg.glassKg, 0),
      electronicsKg: summaries.reduce((s, r) => s + r.materialsKg.electronicsKg, 0),
    },
    materialsMatchedNetWeight: matchedNetWeight,
    materialsMatchedFraction: totalNetWeight > 0 ? matchedNetWeight / totalNetWeight : 0,
    matchedItemTypes: union('matchedItemTypes'),
    unmatchedItemTypes: union('unmatchedItemTypes'),
    items: summaries.flatMap((r) => r.items),
  }
}
