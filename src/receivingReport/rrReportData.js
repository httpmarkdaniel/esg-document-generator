// Receiving Report (RR) document data: one RR's rows from the RR Google Sheet
// (rrClient.js summary) -> the header fields and line items the "Incoming
// Receiving Report" form prints. Line items stay plain strings so the editor
// can change them cell by cell; totals are summed from them at draw time.

import { toNumber } from '../lib/format.js'

/** A sheet number the way the Excel form shows it: "219", "108.7", blank for 0 when `blankZero`. */
export function rrNumber(value, blankZero = false) {
  const n = toNumber(value)
  if (n === 0) return blankZero ? '' : '0'
  return String(Math.round(n * 100) / 100)
}

/** One printed line item, from one sheet row. */
function itemFromRow(row) {
  return {
    description: row.itemType || '',
    kilos: rrNumber(row.kilos, true),
    palletWeight: rrNumber(row.palletWeight, true),
    netWeight: rrNumber(row.netWeight, true),
    qty: rrNumber(row.qty, true),
    uom: row.uom || '',
    category: row.category || '',
    remarks: row.remarks || '',
  }
}

export const EMPTY_ITEM = { description: '', kilos: '', palletWeight: '', netWeight: '', qty: '', uom: '', category: '', remarks: '' }

/** The first non-blank value of `key` across the RR's rows (the sheet repeats header values on every row, but not always). */
function firstOf(rows, key) {
  for (const row of rows) {
    const v = String(row[key] ?? '').trim()
    if (v) return v
  }
  return ''
}

/** RR summary (rrClient.js) -> { header, items }. */
export function buildRrDocumentData(summary) {
  const rows = summary?.items || []
  const header = {
    referenceNo: summary?.referenceNo || '',
    orderType: firstOf(rows, 'orderType'),
    receivedDate: firstOf(rows, 'receivedDate'),
    jobNumber: firstOf(rows, 'jobNumber'),
    scheduleDate: firstOf(rows, 'scheduleDate'),
    accountRep: firstOf(rows, 'accountRep'),
    accountName: firstOf(rows, 'accountName'),
    billingAddress: firstOf(rows, 'billingAddress'),
    pickupAddress: firstOf(rows, 'pickupAddress'),
    companyName: firstOf(rows, 'companyName') || firstOf(rows, 'accountName'),
    pis: firstOf(rows, 'pis'),
    gpNo: firstOf(rows, 'gpNo'),
    truckPlateNo: firstOf(rows, 'truckPlateNo'),
    sealNo: firstOf(rows, 'sealNo'),
    driverName: firstOf(rows, 'driverName'),
    driverLicense: firstOf(rows, 'driverLicense'),
    validity: firstOf(rows, 'validity'),
    receivingNotes: firstOf(rows, 'receivingNotes'),
  }
  return { header, items: rows.map(itemFromRow) }
}

/** A blank form (no RR loaded yet). */
export function emptyRrDocumentData() {
  return buildRrDocumentData(null)
}

/** Column totals of the line items, as printed on the total row. */
export function rrTotals(items) {
  const sum = (key) => items.reduce((s, item) => s + toNumber(item[key]), 0)
  return {
    kilos: rrNumber(sum('kilos')),
    palletWeight: rrNumber(sum('palletWeight')),
    netWeight: rrNumber(sum('netWeight')),
    qty: rrNumber(sum('qty')),
  }
}
