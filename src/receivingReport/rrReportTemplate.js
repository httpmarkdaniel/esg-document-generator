// The Incoming Receiving Report (HEPI FORM - WHSE 4003), drawn with jsPDF —
// rebuilt after "S19029 - ACCENTURE (LHEPACC31212_ACNTQ00107056).pdf" (an
// A4 Excel export). Every position below is measured from that PDF (mm,
// baselines); Arial is drawn as jsPDF's built-in Helvetica (same metrics).
//
// The item table keeps the sample's fixed frame: rows fill down to the total
// row, and when the items don't fit, the form repeats on the next page (the
// totals, notes, endorsement box and sign-off only print on the last page).
//
// Returns { pageCount, textBoxes } — where each editable text landed (mm,
// per page) so the preview editor can put click-to-edit targets on them.
// Recording them never changes what's drawn.

import { resolveRrText } from './rrReportText.js'

const PT_MM = 0.3528
const BLACK = [0, 0, 0]
const RED = [255, 0, 0]
const RR_GREY = [80, 80, 80]
const STRIPE = [246, 248, 249]
const YELLOW = [255, 255, 0]

// Column edges of the table, left to right.
const X = [5.0, 26.1, 41.6, 59.7, 103.7, 128.5, 139.8, 148.8, 162.0, 171.8, 184.9, 193.6, 204.9]
const TABLE_L = X[0]
const TABLE_R = X[X.length - 1]
const HEAD_TOP = 81.9
const HEAD_BOTTOM = 89.5
const ROW_H = 3.72
const FIRST_ROW_BOTTOM = HEAD_BOTTOM + ROW_H // the date / RR no. / company name row
const TABLE_BOTTOM = 194.8 // top of the total row
const TOTAL_BOTTOM = 199.1
const BASELINE_UP = 0.78 // cell text sits this far above the cell's bottom edge
const DESC_LINE_H = 2.55
// Item column -> table columns and how its text prints (sizes in pt, from the sample).
const ITEM_COLUMNS = [
  { field: 'description', from: 4, size: 6.4, wrap: true },
  { field: 'kilos', from: 5, size: 6.9 },
  { field: 'palletWeight', from: 6, size: 6.9 },
  { field: 'netWeight', from: 7, size: 6.9, bold: true, color: RED },
  { field: 'qty', from: 8, size: 6.4 },
  { field: 'uom', from: 9, size: 5.5 },
  { field: 'category', from: 10, size: 5.9, bold: true, color: RED },
  { field: 'remarks', from: 11, size: 5.5, bold: true, shrink: true },
]

let textBoxes = []

function setFont(doc, { bold = false, italic = false, size = 7.3, color = BLACK } = {}) {
  doc.setFont('helvetica', bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal')
  doc.setFontSize(size)
  doc.setTextColor(...color)
}

function record(doc, key, box, opts) {
  if (!key) return
  textBoxes.push({ key, page: doc.getCurrentPageInfo().pageNumber - 1, ...box, size: Math.max(opts.size || 7.3, 8), align: opts.align || 'left', bold: !!opts.bold })
}

/** Fit `size` down (to `min`) so one line of `text` is no wider than `maxW`. */
function fitSize(doc, text, size, maxW, min = 3.2) {
  let s = size
  doc.setFontSize(s)
  while (s > min && doc.getTextWidth(text) > maxW) {
    s -= 0.1
    doc.setFontSize(s)
  }
  return s
}

/** `text` split on newlines and wrapped to `maxW` (when given). */
function linesOf(doc, text, maxW) {
  const parts = String(text ?? '').replace(/\r/g, '').split('\n')
  return maxW ? parts.flatMap((p) => (p.trim() ? doc.splitTextToSize(p.trim(), maxW) : [''])) : parts
}

/**
 * Free-standing text (not in a cell), first baseline at `y`, lines going down.
 * Empty text prints nothing; `blankBox` keeps a click target there anyway.
 */
function text(doc, key, value, x, y, opts = {}) {
  const { align = 'left', lineH = 3.6, maxW, blankBox, fit } = opts
  setFont(doc, opts)
  let size = opts.size || 7.3
  if (fit && value) size = fitSize(doc, String(value), size, fit)
  const lines = value ? linesOf(doc, value, maxW) : []
  if (!lines.length) {
    if (blankBox) record(doc, key, blankBox, { ...opts, size })
    return
  }
  lines.forEach((line, i) => line && doc.text(line, x, y + i * lineH, { align }))
  const w = Math.max(...lines.map((l) => doc.getTextWidth(l)), 4)
  const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x
  const top = y - size * PT_MM * 0.85
  record(doc, key, { x: left, y: top, w, h: (lines.length - 1) * lineH + size * PT_MM * 1.15 }, { ...opts, size })
}

/**
 * Text in a table cell [x1, x2] × [top, bottom]: bottom-aligned like the
 * Excel sheet (wrapped lines stack upward), centered unless `align` says
 * otherwise. The whole cell is the click target, even when empty.
 */
function cellText(doc, key, value, x1, x2, top, bottom, opts = {}) {
  const { align = 'center', wrap = false, shrink = false, lineH = 2.25, pad = 0.5 } = opts
  setFont(doc, opts)
  const maxW = x2 - x1 - pad * 2
  let size = opts.size || 5.5
  const str = String(value ?? '')
  // Unwrapped text shrinks until its widest line fits the cell.
  if (str && (shrink || !wrap)) {
    const widest = str.split('\n').reduce((a, b) => (doc.getTextWidth(b) > doc.getTextWidth(a) ? b : a), '')
    size = fitSize(doc, widest, size, maxW)
  }
  const lines = str ? linesOf(doc, str, wrap ? maxW : 0) : []
  const x = align === 'center' ? (x1 + x2) / 2 : align === 'right' ? x2 - pad : x1 + pad
  const base = bottom - BASELINE_UP
  lines.forEach((line, i) => line && doc.text(line, x, base - (lines.length - 1 - i) * lineH, { align }))
  record(doc, key, { x: x1, y: top, w: x2 - x1, h: bottom - top }, { ...opts, size, align })
}

/** How tall an item's row is: one 3.72 mm row, taller when the description wraps. */
function itemRowHeight(doc, item) {
  setFont(doc, { size: 6.4 })
  const lines = linesOf(doc, item.description, X[5] - X[4] - 1).length
  return Math.max(ROW_H, lines * DESC_LINE_H + 0.9)
}

/** Split the items into pages of rows: { item?, top, bottom, index? } per row, each page filled down to the total row. */
function paginate(doc, items) {
  const pages = []
  let next = 0
  do {
    const rows = []
    let y = FIRST_ROW_BOTTOM
    while (next < items.length) {
      const h = Math.min(itemRowHeight(doc, items[next]), TABLE_BOTTOM - FIRST_ROW_BOTTOM)
      if (y + h > TABLE_BOTTOM + 0.01 && rows.length) break
      rows.push({ item: items[next], index: next, top: y, bottom: y + h })
      y += h
      next++
    }
    while (y + ROW_H <= TABLE_BOTTOM + 0.01) {
      rows.push({ top: y, bottom: y + ROW_H })
      y += ROW_H
    }
    if (rows.length) rows[rows.length - 1].bottom = TABLE_BOTTOM
    pages.push(rows)
  } while (next < items.length)
  return pages
}

function drawCompanyBlock(doc, t) {
  text(doc, 'coName', t.coName, 5.5, 2.8, { bold: true, size: 7.8 })
  text(doc, 'coHq', t.coHq, 5.5, 6.6, { bold: true })
  text(doc, 'coHqAddress', t.coHqAddress, 5.5, 10.2)
  text(doc, 'coBranch', t.coBranch, 5.5, 16.8, { bold: true, size: 5.5 })
  text(doc, 'coBranchAddress', t.coBranchAddress, 5.5, 21.0)
  text(doc, 'coTel', t.coTel, 5.5, 28.2)

  text(doc, 'title', t.title, 160.9, 3.0, { bold: true, size: 8.2, align: 'center' })
  const rows = [
    ['orderTypeLabel', 'orderType', 13.8, 6.9],
    ['referenceNoLabel', 'referenceNo', 17.4],
    ['receivedDateLabel', 'receivedDate', 21.0],
    ['jobNoLabel', 'jobNumber', 24.6],
    ['scheduleDateLabel', 'scheduleDate', 28.2],
    ['accountRepLabel', 'accountRep', 31.8],
  ]
  for (const [labelKey, valueKey, y, valueSize = 7.3] of rows) {
    text(doc, labelKey, t[labelKey], 150.8, y, { bold: true, size: labelKey === 'jobNoLabel' ? 7.8 : 7.3, align: 'center' })
    text(doc, valueKey, t[valueKey], 177.8, y, { size: valueSize, align: 'center', fit: 40, blankBox: { x: 164, y: y - 2.6, w: 28, h: 3.4 } })
  }

  text(doc, 'accountNameLabel', t.accountNameLabel, 5.5, 41.6, { bold: true })
  text(doc, 'accountName', t.accountName, 77.3, 41.6, { bold: true, align: 'center', maxW: 98, blankBox: { x: 40, y: 39, w: 75, h: 3.4 } })
  text(doc, 'billingLabel', t.billingLabel, 5.5, 45.2, { bold: true })
  text(doc, 'billingAddress', t.billingAddress, 77.3, 45.2, { bold: true, align: 'center', maxW: 98, blankBox: { x: 40, y: 42.6, w: 75, h: 3.4 } })
  text(doc, 'pickupLabel', t.pickupLabel, 128.9, 45.2, { bold: true })
  text(doc, 'pickupAddress', t.pickupAddress, 166.7, 48.8, { bold: true, align: 'center', maxW: 74, blankBox: { x: 132, y: 46.2, w: 70, h: 3.4 } })

  for (const [side, x] of [
    ['billing', 5.5],
    ['pickup', 128.9],
  ]) {
    text(doc, `${side}Country`, t[`${side}Country`], x, 65.5)
    text(doc, `${side}Contact`, t[`${side}Contact`], x, 69.1)
    text(doc, `${side}Phone`, t[`${side}Phone`], x, 72.7)
  }
}

function drawTableFrame(doc, rows) {
  // Stripes on the item columns (the sample's banded rows), and the yellow company-name cell.
  doc.setFillColor(...STRIPE)
  doc.rect(X[4], HEAD_BOTTOM, TABLE_R - X[4], ROW_H, 'F')
  rows.forEach((row, i) => {
    if (i % 2 === 0) doc.rect(X[4], row.top, TABLE_R - X[4], row.bottom - row.top, 'F')
  })
  doc.setFillColor(...YELLOW)
  doc.rect(X[2], HEAD_BOTTOM, X[4] - X[2], ROW_H, 'F')

  doc.setDrawColor(...BLACK)
  doc.setLineWidth(0.15)
  for (const x of X.slice(1, -1)) doc.line(x, x === X[3] ? FIRST_ROW_BOTTOM : HEAD_BOTTOM, x, TOTAL_BOTTOM)
  doc.line(TABLE_L, HEAD_BOTTOM, TABLE_L, TOTAL_BOTTOM)
  doc.line(TABLE_R, HEAD_BOTTOM, TABLE_R, TOTAL_BOTTOM)
  doc.line(TABLE_L, FIRST_ROW_BOTTOM, TABLE_R, FIRST_ROW_BOTTOM)
  for (const row of rows) doc.line(TABLE_L, row.bottom, TABLE_R, row.bottom)
  doc.line(TABLE_L, TOTAL_BOTTOM, TABLE_R, TOTAL_BOTTOM)

  // The header row is boxed in heavier lines.
  doc.setLineWidth(0.4)
  doc.rect(TABLE_L, HEAD_TOP, TABLE_R - TABLE_L, HEAD_BOTTOM - HEAD_TOP)
  for (const x of X.slice(1, -1)) if (x !== X[3]) doc.line(x, HEAD_TOP, x, HEAD_BOTTOM)
}

function drawTableHeader(doc, t) {
  text(doc, 'tableTitle', t.tableTitle, 5.5, 80.9, { bold: true })
  const heads = [
    ['colDate', 0, 1],
    ['colRr', 1, 2],
    ['colCompany', 2, 4, 8.2],
    ['colDescription', 4, 5],
    ['colKilos', 5, 6],
    ['colPallet', 6, 7],
    ['colNet', 7, 8, 5.0],
    ['colQty', 8, 9],
    ['colUom', 9, 10],
    ['colCategory', 10, 11],
    ['colRemarks', 11, 12],
  ]
  for (const [key, from, to, size = 5.5] of heads) {
    cellText(doc, key, t[key], X[from], X[to], HEAD_TOP, HEAD_BOTTOM + (key === 'colCompany' ? -0.2 : 0), { bold: true, size, pad: 0.3 })
  }
}

function drawFirstRow(doc, t) {
  cellText(doc, 'rowDate', t.rowDate, X[0], X[1], HEAD_BOTTOM, FIRST_ROW_BOTTOM, { size: 5.5 })
  cellText(doc, 'rowRr', t.rowRr, X[1], X[2], HEAD_BOTTOM, FIRST_ROW_BOTTOM, { size: 7.3, bold: true, color: RR_GREY })
  cellText(doc, 'rowCompany', t.rowCompany, X[2], X[4], HEAD_BOTTOM, FIRST_ROW_BOTTOM, { size: 7.3, bold: true })
}

function drawItemRow(doc, row) {
  for (const col of ITEM_COLUMNS) {
    cellText(doc, `item:${row.index}:${col.field}`, row.item[col.field], X[col.from], X[col.from + 1], row.top, row.bottom, {
      size: col.size,
      bold: col.bold,
      color: col.color,
      wrap: col.wrap,
      shrink: col.shrink,
      lineH: DESC_LINE_H,
    })
  }
}

/** Page 1's left-hand labels: PIS / GP / truck / seal / driver, and the expense lines. */
function drawLabelRows(doc, t, rows) {
  const at = (n) => rows[n - 1]
  const pis = at(1)
  if (!pis) return
  cellText(doc, 'pisLabel', t.pisLabel, X[2], X[3], pis.top, pis.bottom, { size: 5.5 })
  cellText(doc, 'pis', t.pis, X[3], X[4], pis.top, pis.bottom, { size: 6.4 })

  const trucking = [
    ['gpLabel', 'gpNo', 2, true],
    ['plateLabel', 'truckPlateNo', 3],
    ['sealLabel', 'sealNo', 4],
    ['driverLabel', 'driverName', 5],
    ['licenseLabel', 'driverLicense', 6],
    ['validityLabel', 'validity', 7],
  ]
  for (const [labelKey, valueKey, n, bold = false] of trucking) {
    const row = at(n)
    if (!row) continue
    cellText(doc, labelKey, t[labelKey], X[2], X[3], row.top, row.bottom, { size: 5.5, bold, align: 'left', pad: 0.4 })
    cellText(doc, valueKey, t[valueKey], X[3], X[4], row.top, row.bottom, { size: 6.4 })
  }

  const expenses = [
    ['expensesLabel', 'expenses', 2],
    ['manpowerLabel', 'manpower', 3],
    ['trucking1Label', 'trucking1', 4],
    ['trucking2Label', 'trucking2', 5],
    ['purchasedCostLabel', 'purchasedCost', 6],
  ]
  for (const [labelKey, valueKey, n] of expenses) {
    const row = at(n)
    if (!row) continue
    cellText(doc, labelKey, t[labelKey], X[0], X[1], row.top, row.bottom, { size: 5.5, align: 'left' })
    cellText(doc, valueKey, t[valueKey], X[1], X[2], row.top, row.bottom, { size: 5.5 })
  }
}

function drawTotals(doc, t) {
  const cells = [
    ['totalKilos', 5, BLACK],
    ['totalPallet', 6, BLACK],
    ['totalNet', 7, RED],
  ]
  for (const [key, from, color] of cells) cellText(doc, key, t[key], X[from], X[from + 1], TABLE_BOTTOM, TOTAL_BOTTOM, { size: 5.5, bold: true, color })
  cellText(doc, 'totalQty', t.totalQty, X[8], X[9], TABLE_BOTTOM, TOTAL_BOTTOM, { size: 5.5 })
}

function drawContinued(doc, page, pageCount) {
  setFont(doc, { size: 5.5, italic: true, color: [90, 90, 90] })
  doc.text(`Continued on page ${page + 2} of ${pageCount}`, (X[2] + X[4]) / 2, TOTAL_BOTTOM - BASELINE_UP, { align: 'center' })
}

/** One label + signing line in the endorsement box. */
function endorsementLine(doc, t, key, labelX, lineX1, lineX2, y, { italic = false, double = false } = {}) {
  text(doc, `${key}Label`, t[`${key}Label`], labelX, y, { bold: true, italic, size: 5.0 })
  const lineY = y + 0.8
  doc.setLineWidth(0.2)
  doc.setDrawColor(...(double ? [90, 90, 90] : BLACK))
  doc.line(lineX1, lineY, lineX2, lineY)
  if (double) doc.line(lineX1, lineY + 0.35, lineX2, lineY + 0.35)
  text(doc, key, t[key], (lineX1 + lineX2) / 2, y - 0.2, {
    size: 6.4,
    align: 'center',
    fit: lineX2 - lineX1,
    blankBox: { x: lineX1, y: y - 3, w: lineX2 - lineX1, h: 3.8 },
  })
}

function drawBottom(doc, t) {
  text(doc, 'notesLabel', t.notesLabel, 5.5, 205.3, { bold: true, size: 6.4 })
  text(doc, 'receivingNotes', t.receivingNotes, 42.0, 205.2, { bold: true, size: 6.9, maxW: 160, lineH: 2.9, blankBox: { x: 41, y: 202.6, w: 100, h: 3.6 } })

  const box = { x: 36.7, y: 210.78, w: 132.54, h: 32.61 }
  doc.setDrawColor(...BLACK)
  doc.setLineWidth(0.35)
  doc.rect(box.x, box.y, box.w, box.h)
  text(doc, 'endorsedLabel', t.endorsedLabel, 41.4, 215.2, { bold: true, size: 5.3 })
  const lefts = ['production', 'technical', 'sales', 'receivedBy']
  const rights = ['disposal', 'warehouseUse', 'pco', 'notedBy']
  const ys = [220.3, 225.6, 231.0, 236.3]
  lefts.forEach((key, i) => endorsementLine(doc, t, key, 41.4, 60.2, 98.1, ys[i], { italic: key === 'receivedBy', double: true }))
  rights.forEach((key, i) => endorsementLine(doc, t, key, 107.8, 126.8, 165.1, ys[i]))

  const signoff = [
    ['reportByLabel', 'reportBy', 250.2],
    ['warehouseWorkerLabel', 'warehouseWorker', 253.4],
    ['driverSignLabel', 'driverSign', 256.7],
  ]
  for (const [labelKey, valueKey, y] of signoff) {
    text(doc, labelKey, t[labelKey], 5.5, y, { bold: true, size: 6.4 })
    setFont(doc, { bold: true, size: 6.4 })
    const x = 5.5 + (t[labelKey] ? doc.getTextWidth(t[labelKey]) + 1 : 0)
    text(doc, valueKey, t[valueKey], x, y, { bold: true, size: 6.4, blankBox: { x, y: y - 2.3, w: 60, h: 3 } })
  }
}

function drawFooter(doc, t) {
  text(doc, 'formCode', t.formCode, 5.5, 262.4, { size: 5.5 })
  text(doc, 'formEffective', t.formEffective, 5.5, 265.3, { size: 5.5 })
}

function drawPlacedImages(doc, images = []) {
  if (!images.length) return
  const pageCount = doc.getNumberOfPages()
  for (const img of images) {
    doc.setPage(Math.min(img.page ?? 0, pageCount - 1) + 1)
    doc.addImage(img.dataUrl, 'PNG', img.x, img.y, img.w, img.h, img.id, 'FAST')
  }
  doc.setPage(pageCount)
}

/**
 * Draw the whole RR into `doc` (A4 portrait, mm).
 * @param {{ header: object, items: object[], textOverrides?: object, placedImages?: object[] }} data
 */
export function drawRrPdf(doc, data) {
  textBoxes = []
  const t = resolveRrText(data)
  const pages = paginate(doc, data.items)

  pages.forEach((rows, page) => {
    if (page > 0) doc.addPage()
    const last = page === pages.length - 1
    drawCompanyBlock(doc, t)
    drawTableFrame(doc, rows)
    drawTableHeader(doc, t)
    drawFirstRow(doc, t)
    for (const row of rows) if (row.item) drawItemRow(doc, row)
    if (page === 0) drawLabelRows(doc, t, rows)
    if (last) {
      drawTotals(doc, t)
      drawBottom(doc, t)
    } else drawContinued(doc, page, pages.length)
    drawFooter(doc, t)
  })

  drawPlacedImages(doc, data.placedImages)
  return { pageCount: pages.length, textBoxes }
}
