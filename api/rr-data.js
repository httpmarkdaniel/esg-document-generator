// Vercel serverless function: proxies and parses the public "Receiving
// Reports" Google Sheet (Envirocycle's RR consolidation tab) into JSON.
//
// The sheet is shared as "anyone with the link can view", so a public CSV
// export works with no service-account/OAuth setup. This still runs
// server-side (rather than fetching the CSV directly from the browser) so:
//   - the browser never needs cross-origin access to docs.google.com,
//   - the sheet ID/tab isn't hardcoded into client bundle logic that's
//     harder to change later, and
//   - swapping to authenticated access later (if the sheet goes private)
//     only touches this file.

import Papa from 'papaparse'

const SHEET_ID = '1z_IKx8vqsTo_Opk9cvlLpqWE6YaTZgSXgB5DXEVOIsI'
const GID = '1661142632' // the RR consolidation tab
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`

// Sheet column header -> stable camelCase field name.
const FIELD_MAP = {
  'ACCOUNT NAME': 'accountName',
  'BILLING ADDRESS': 'billingAddress',
  'PICKUP ADDRESS': 'pickupAddress',
  'JOB NUMBER': 'jobNumber',
  'ACCOUNT REP': 'accountRep',
  'ORDER TYPE': 'orderType',
  'RECEIVED DATE': 'receivedDate',
  'SCHEDULE DATE': 'scheduleDate',
  'GP NO.': 'gpNo',
  'REFERENCE NO.': 'referenceNo',
  'COMPANY NAME': 'companyName',
  PIS: 'pis',
  'TRUCK PLATE NO.': 'truckPlateNo',
  'SEAL NO.': 'sealNo',
  "DRIVER'S NAME": 'driverName',
  "DRIVER'S LICENSE": 'driverLicense',
  VALIDITY: 'validity',
  'PALLET BATCH NO.': 'palletBatchNo',
  'ITEM TYPE': 'itemType',
  KILOS: 'kilos',
  'PALLET WEIGHT': 'palletWeight',
  'NET WEIGHT': 'netWeight',
  QTY: 'qty',
  UoM: 'uom',
  CATEGORY: 'category',
  REMARKS: 'remarks',
  'PALLET NO.': 'palletNo',
  'RECEIVING NOTES': 'receivingNotes',
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return 0
  const n = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** "1/29/26" or "09/11/2026" -> "2026-01-29" (ISO), or null if unparsable. */
function toIsoDate(value) {
  const m = String(value || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (!m) return null
  const [, mo, d, yRaw] = m
  const year = yRaw.length === 2 ? 2000 + Number(yRaw) : Number(yRaw)
  const month = String(mo).padStart(2, '0')
  const day = String(d).padStart(2, '0')
  return `${year}-${month}-${day}`
}

let cache = null
let cacheFetchedAt = 0
const CACHE_MS = 5 * 60 * 1000

async function loadItems() {
  const now = Date.now()
  if (cache && now - cacheFetchedAt < CACHE_MS) return cache

  const csvRes = await fetch(CSV_URL)
  if (!csvRes.ok) throw new Error(`Sheet fetch failed: HTTP ${csvRes.status}`)
  const csvText = await csvRes.text()

  const { data: rows } = Papa.parse(csvText, { skipEmptyLines: true })
  const headerRowIndex = rows.findIndex((r) => r.includes('REFERENCE NO.'))
  if (headerRowIndex === -1) throw new Error('Could not find the header row (REFERENCE NO.) in the sheet')
  const headers = rows[headerRowIndex]

  const items = []
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    const item = {}
    headers.forEach((h, idx) => {
      const key = FIELD_MAP[h?.trim()]
      if (key) item[key] = (row[idx] ?? '').toString().trim()
    })
    if (!item.referenceNo) continue

    item.kilos = toNumber(item.kilos)
    item.palletWeight = toNumber(item.palletWeight)
    item.netWeight = toNumber(item.netWeight)
    item.qty = toNumber(item.qty)
    item.receivedDateIso = toIsoDate(item.receivedDate)

    items.push(item)
  }

  cache = { items, fetchedAt: new Date().toISOString() }
  cacheFetchedAt = now
  return cache
}

export default async function handler(req, res) {
  try {
    const data = await loadItems()
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300')
    res.status(200).json(data)
  } catch (err) {
    console.error('rr-data error:', err)
    res.status(500).json({ error: err.message || 'Failed to load Receiving Report data.' })
  }
}
