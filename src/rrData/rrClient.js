// Frontend client for the Receiving Report (RR) data proxied through
// /api/rr-data.js. Fetches once, caches in memory for the session, and
// exposes the aggregation helpers the Certificate (single RR) and Report
// (date-range of RRs) flows need.
//
// This is the ONLY file that should know the shape of the raw sheet rows —
// callers work with the aggregated shapes below.

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

function summarize(referenceNo, items) {
  if (!items.length) return null
  const first = items[0]
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
    totalNetWeight: items.reduce((s, i) => s + i.netWeight, 0),
    totalQty: items.reduce((s, i) => s + i.qty, 0),
    itemTypes: [...new Set(items.map((i) => i.itemType).filter(Boolean))],
    items,
  }
}

/** Aggregate every line item for one RR reference number (for the Certificate flow). */
export async function getRrSummary(referenceNo) {
  const items = await loadItems()
  return summarize(
    referenceNo,
    items.filter((i) => i.referenceNo === referenceNo),
  )
}

/**
 * Aggregate every RR whose RECEIVED DATE falls within [startIso, endIso]
 * (inclusive), one summary per RR reference number, sorted by date then
 * reference number (for the Report flow's date-range loader).
 */
export async function getRrSummariesInRange(startIso, endIso) {
  const items = await loadItems()
  const inRange = items.filter((i) => i.receivedDateIso && i.receivedDateIso >= startIso && i.receivedDateIso <= endIso)

  const byRef = new Map()
  for (const item of inRange) {
    if (!byRef.has(item.referenceNo)) byRef.set(item.referenceNo, [])
    byRef.get(item.referenceNo).push(item)
  }

  return [...byRef.entries()]
    .map(([referenceNo, refItems]) => summarize(referenceNo, refItems))
    .sort((a, b) => (a.receivedDateIso || '').localeCompare(b.receivedDateIso || '') || a.referenceNo.localeCompare(b.referenceNo))
}
