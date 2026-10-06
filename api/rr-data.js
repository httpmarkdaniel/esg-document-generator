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
//
// 2025 RRs aren't in that sheet (it starts Jan 2026), so they're added from
// the "NEO - Abatement Report" workbook:
//   - its Jan-2025 … Apr-2025 tabs (every client, one row per item), and
//   - its "Abatement Report" tab (NEO's RRs only, one block per RR), for the
//     NEO RRs after April 2025 that the monthly tabs don't have.
// An RR number already in the Receiving Reports sheet always comes from
// there; the 2025 sources only add RR numbers it doesn't have.

import Papa from 'papaparse'

const csvUrl = (sheetId, gid) => `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`

const CSV_URL = csvUrl('1z_IKx8vqsTo_Opk9cvlLpqWE6YaTZgSXgB5DXEVOIsI', '1661142632') // the RR consolidation tab

const NEO_WORKBOOK_ID = '16CstnzOkrqfBnHf8DMtYUx8auVHhPBk-i2tpuvCcmUI'
const MONTHLY_2025_URLS = ['2088008955', '1351992279', '445070157', '226866058'].map((gid) => csvUrl(NEO_WORKBOOK_ID, gid)) // Jan–Apr 2025
const NEO_ABATEMENT_URL = csvUrl(NEO_WORKBOOK_ID, '49103372')
// The Abatement Report tab has no client column; this is NEO's name as the monthly tabs spell it.
const NEO_ACCOUNT_NAME = 'NEO Property Management Inc.'

// 2025 monthly tabs: column header -> the same field names as FIELD_MAP.
const MONTHLY_FIELD_MAP = {
  'RR NO.': 'referenceNo',
  'RECEIVED DATE': 'receivedDate',
  'CLIENT/COMPANY NAME': 'accountName',
  DESCRIPTION: 'itemType',
  KILOS: 'kilos',
  'NET WEIGHT': 'netWeight',
  'QTY (PCS)': 'qty',
  UOM: 'uom',
  CATEGORY: 'category',
  REMARKS: 'remarks',
}

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

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
const fullYear = (y) => (String(y).length === 2 ? 2000 + Number(y) : Number(y))
const iso = (year, month, day) =>
  month >= 1 && month <= 12 && day >= 1 && day <= 31 ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null

/**
 * The sheet's RECEIVED DATE -> "2026-01-29" (ISO), or null if unparsable.
 * Handles the formats actually typed in the sheet: "1/29/26", "09/11/2026",
 * "1/12//2026" (doubled slash), "September 28, 2026", "4-Aug-26".
 */
function toIsoDate(value) {
  const v = String(value || '').trim()
  let m = v.match(/^(\d{1,2})\/+(\d{1,2})\/+(\d{2}|\d{4})$/)
  if (m) return iso(fullYear(m[3]), Number(m[1]), Number(m[2]))
  m = v.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})$/)
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) return iso(Number(m[3]), MONTHS[m[1].slice(0, 3).toLowerCase()], Number(m[2]))
  m = v.match(/^(\d{1,2})[-\s]([A-Za-z]{3,})[-\s,]+(\d{2}|\d{4})$/)
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) return iso(fullYear(m[3]), MONTHS[m[2].slice(0, 3).toLowerCase()], Number(m[1]))
  m = v.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]))
  return null
}

/** The sheet export occasionally drops the connection mid-download ("terminated") — retry a couple of times. */
async function fetchCsvWithRetry(url, attempts = 3) {
  let lastError
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Sheet fetch failed: HTTP ${res.status}`)
      return await res.text()
    } catch (err) {
      lastError = err
      await new Promise((r) => setTimeout(r, 400 * (i + 1)))
    }
  }
  throw lastError
}

let cache = null
let cacheFetchedAt = 0
const CACHE_MS = 5 * 60 * 1000

function finishItem(item) {
  item.kilos = toNumber(item.kilos)
  item.palletWeight = toNumber(item.palletWeight)
  item.netWeight = toNumber(item.netWeight)
  item.qty = toNumber(item.qty)
  item.receivedDateIso = toIsoDate(item.receivedDate)
  return item
}

/** Rows under the header row (found by `headerCell`), mapped through `fieldMap`. */
function parseTable(csvText, headerCell, fieldMap, source) {
  const { data: rows } = Papa.parse(csvText, { skipEmptyLines: true })
  const headerRowIndex = rows.findIndex((r) => r.some((c) => c?.trim().toUpperCase() === headerCell))
  if (headerRowIndex === -1) throw new Error(`Could not find the header row (${headerCell}) in ${source}`)
  const headers = rows[headerRowIndex]

  const items = []
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    const item = { source }
    headers.forEach((h, idx) => {
      const header = h?.trim() ?? ''
      const key = fieldMap[header] ?? fieldMap[header.toUpperCase()]
      if (key) item[key] = (row[idx] ?? '').toString().trim()
    })
    if (!item.referenceNo) continue
    items.push(finishItem(item))
  }
  return items
}

/**
 * The Abatement Report tab: one block per RR — "RR No.: S16634" and
 * "Received Date: 2/18/2025" label rows, then a "No. | Item | Qty | UOM |
 * Total Weight (kg) | …" table ending in a "Total Weight" row. Only the item
 * and its total weight are taken; the material split still comes from the
 * catalog like every other RR.
 */
function parseAbatementBlocks(csvText, source) {
  const { data: rows } = Papa.parse(csvText, { skipEmptyLines: true })
  const items = []
  let referenceNo = ''
  let receivedDate = ''
  let cols = null

  for (const row of rows) {
    const cells = row.map((c) => (c ?? '').toString().trim())
    const labelIdx = cells.findIndex((c) => /^(RR No\.|Received Date):$/i.test(c))
    if (labelIdx !== -1) {
      const value = cells[labelIdx + 1] || ''
      if (/^RR/i.test(cells[labelIdx])) {
        referenceNo = value
        cols = null
      } else receivedDate = value
      continue
    }
    if (cells.includes('Item') && cells.some((c) => /^Total Weight/i.test(c))) {
      cols = { item: cells.indexOf('Item'), qty: cells.indexOf('Qty'), uom: cells.indexOf('UOM'), weight: cells.findIndex((c) => /^Total Weight/i.test(c)) }
      continue
    }
    if (!cols || !referenceNo) continue
    const itemType = cells[cols.item]
    if (!itemType || /^Total Weight/i.test(itemType)) continue
    items.push(
      finishItem({
        source,
        referenceNo,
        receivedDate,
        accountName: NEO_ACCOUNT_NAME,
        companyName: NEO_ACCOUNT_NAME,
        itemType,
        netWeight: cells[cols.weight],
        qty: cols.qty === -1 ? '' : cells[cols.qty],
        uom: cols.uom === -1 ? '' : cells[cols.uom],
      }),
    )
  }
  return items
}

/** Add `extra` items whose RR number isn't already in `items` (the earlier source wins). */
function addNewRrs(items, extra) {
  const known = new Set(items.map((i) => i.referenceNo))
  return items.concat(extra.filter((i) => !known.has(i.referenceNo)))
}

async function loadItems() {
  const now = Date.now()
  if (cache && now - cacheFetchedAt < CACHE_MS) return cache

  const [mainCsv, monthly, abatement] = await Promise.all([
    fetchCsvWithRetry(CSV_URL),
    Promise.allSettled(MONTHLY_2025_URLS.map((url) => fetchCsvWithRetry(url))),
    fetchCsvWithRetry(NEO_ABATEMENT_URL).then(
      (value) => ({ status: 'fulfilled', value }),
      (reason) => ({ status: 'rejected', reason }),
    ),
  ])

  let items = parseTable(mainCsv, 'REFERENCE NO.', FIELD_MAP, 'Receiving Reports')

  // The 2025 sources are extras: if one fails, the 2026 RRs still load.
  const warnings = []
  const monthlyItems = []
  monthly.forEach((r, i) => {
    if (r.status === 'fulfilled') monthlyItems.push(...parseTable(r.value, 'RR NO.', MONTHLY_FIELD_MAP, '2025 monthly RRs'))
    else warnings.push(`2025 monthly tab ${i + 1} failed to load: ${r.reason?.message || r.reason}`)
  })
  items = addNewRrs(items, monthlyItems)
  if (abatement.status === 'fulfilled') items = addNewRrs(items, parseAbatementBlocks(abatement.value, 'NEO Abatement Report'))
  else warnings.push(`NEO Abatement Report failed to load: ${abatement.reason?.message || abatement.reason}`)
  if (warnings.length) console.warn('rr-data:', warnings.join('; '))

  cache = { items, warnings, fetchedAt: new Date().toISOString() }
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
