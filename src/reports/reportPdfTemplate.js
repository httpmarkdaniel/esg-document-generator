// ESG Report TEMPLATE — PDF version, laid out after the real
// "Carbon Abatement - Client Template.pdf" (positions, sizes and spacing
// measured from it):
//
// • Every page: the teal-to-blue top bar and the letterhead (logo + company
//   line + phone/email/website) as the header, and the form code + two-row
//   compliance-logo strip as the footer.
// • Body in Lora (the reference's typeface): 10pt text on a 4.5mm line, 11pt
//   bold numbered headings, indented sub-headings / bullets, bold figures.
// • Sign-off: role labels, then each signatory's pen signature over their
//   name and title (the look of their signed name block).
//
// The letterhead is rebuilt sharp instead of reusing the reference's own
// ~96-dpi letterhead picture: the logo is the high-resolution EnviroCycle
// logo (lettering recoloured dark for a white page) and the company/contact
// lines are real text.
//
// Every free-text line comes from resolveReportText (defaults + preview
// editor overrides); built-in images the editor removed are skipped, and
// images added in the editor are drawn on top at the end.
//
// This is intentionally the only file that knows how the PDF report is
// laid out. `generateReportPdf.js` just calls `drawReportPdf(doc, assets, data)`.

import autoTable from 'jspdf-autotable'
import { formatNumber } from '../lib/format.js'
import { SIGNATORIES } from '../lib/brand.js'
import { REPORT_ASSET_DIMENSIONS } from './assetDimensions.js'
import { ASSET_DIMENSIONS } from '../certificate/assetDimensions.js'
import { METHODOLOGY_SECTIONS, CONCLUSION_PARAGRAPHS } from './methodology.js'
import { resolveReportText } from './reportText.js'
import { wrapRich, drawRichLines } from './richText.js'
import { LETTERHEAD_ID, GRADIENT_BAR_ID, STAMP_ID, REPORT_COMPLIANCE_LOGOS, reportStripLogoBoxes } from './reportBuiltInImages.js'

const PAGE_W = 210
const PAGE_H = 297
const FONT = 'Lora'
const BLACK = [0, 0, 0]

// Text columns, from the reference.
const X_TEXT = 22.5 // body paragraphs, header block
const X_HEAD = 28.9 // "1." of a section heading, section descriptions
const X_HEAD_TEXT = 35.2 // section heading text, sub-headings, 4.x paragraphs
const X_BULLET = 41.6 // the "o" bullet
const X_BULLET_TEXT = 47.9
const X_RIGHT = PAGE_W - 22.5

const TEXT_SIZE = 10
const LINE = 4.5 // mm between baselines at 10pt
const TOP = 28.6 // first body baseline on a page
const BOTTOM = 259 // last allowed body baseline (the footer starts at ~264mm)

// Header / footer geometry, measured from the reference.
const BAR = { x: -3.4, y: 0.3, w: 222, h: 5.3 }
const LOGO = { w: 47.7, cy: 10.4 }
const LH_ADDRESS_Y = 17.4 // baseline of the company/address line
const LH_CONTACT_Y = 20.0 // baseline of the phone/email/website line
const LH_ADDRESS_MAX_W = 136.4
const FORM_CODE = { x: 4.6, y1: 267.5, y2: 271.1, w: 33.3 }
const STRIP = { x: 42.1, y: 271.9, w: 125.4 }

const LH_GREY = [70, 70, 70]
const LH_LIGHT = [120, 120, 120]
const LH_GREEN = [46, 125, 50]
const SIG_NAVY = [20, 42, 78]

// Built-in images removed in the preview editor, and the page boxes of the
// built-in images actually drawn (returned to the editor so it can put
// remove targets exactly on them). Reset per document in drawReportPdf.
let hidden = new Set()
let builtInBoxes = []
// Where each editable text field landed (mm, per page) — returned to the
// preview editor so a field can be clicked and edited right on the page.
// Recording them never changes what's drawn.
let textBoxes = []

const PT_MM = 0.3528
/** Grow (or start) the box of text field `key` on the current page to cover one line at `baseline`. */
function markText(doc, key, x, w, baseline, size) {
  if (!key) return
  const page = doc.getCurrentPageInfo().pageNumber - 1
  const top = baseline - size * PT_MM * 0.85
  const bottom = baseline + size * PT_MM * 0.3
  const box = textBoxes.find((b) => b.key === key && b.page === page)
  if (box) {
    const y2 = Math.max(box.y + box.h, bottom)
    box.y = Math.min(box.y, top)
    box.h = y2 - box.y
  } else textBoxes.push({ key, page, x, y: top, w, h: bottom - top, size })
}

// ---------------------------------------------------------------------------
// Body flow: a cursor (page baseline `y`) plus the kind of the last block, so
// the gap before the next block matches the reference's spacing.
// ---------------------------------------------------------------------------

// Baseline-to-baseline gap from the previous block's last line to the next block's first line.
const GAPS = {
  'heading>sub': 4.6,
  'heading>para': 8.7,
  'heading>desc': 8.7,
  'sub>para': 8.7,
  'sub>desc': 8.7,
  'sub>bullet': 4.6,
  'sub>sub': 9,
  'para>heading': 9.4,
  'desc>heading': 9.4,
  'bullet>bullet': 4.5,
  'bullet>heading': 13.1,
  'bullet>sub': 8.8,
  'caption>heading': 11,
  'caption>sub': 9.4,
  'title>label': 9.2,
  'label>value': 4.5,
  'value>value': 4.5,
  'value>label': 9,
  'value>heading': 14,
  'table>caption': 5,
  'desc>table': 9,
  'heading>para5': 6,
  'para5>sub': 8.8,
  'heading>concl': 8.7, // one blank line under "6. Conclusion", like the other section headings
  'concl>signoff': 12.7,
  'para>signoff': 12.7,
}
const gapBetween = (prev, next) => GAPS[`${prev}>${next}`] ?? 9

function newFlow(doc) {
  return { doc, y: TOP, last: 'top' }
}

// A table caption may run a little below BOTTOM (the footer starts ~264mm) so it stays with its table.
const CAPTION_BOTTOM = BOTTOM + 3

/** Move to where a block of `kind` starts; start a new page if its first `height` mm won't fit. */
function place(flow, kind, height) {
  if (flow.last !== 'top') flow.y += gapBetween(flow.last, kind)
  if (flow.y + height > (kind === 'caption' ? CAPTION_BOTTOM : BOTTOM)) {
    flow.doc.addPage()
    flow.y = TOP
  }
  flow.last = kind
}

/** Wrapped rich-text block; breaks onto the next page between lines when needed. */
function textBlock(flow, kind, text, { x = X_TEXT, size = TEXT_SIZE, lineHeight = LINE, align = 'left', key } = {}) {
  if (!text) return
  const { doc } = flow
  const maxWidth = X_RIGHT - x
  const lines = wrapRich(doc, text, { font: FONT, size, maxWidth })
  place(flow, kind, 0)
  lines.forEach((line, i) => {
    if (i > 0) {
      flow.y += lineHeight
      if (flow.y > BOTTOM) {
        doc.addPage()
        flow.y = TOP
      }
    }
    doc.setTextColor(...BLACK)
    markText(doc, key, x, maxWidth, flow.y, size)
    drawRichLines(doc, [line], { font: FONT, size, x, y: flow.y, lineHeight, align, centerX: PAGE_W / 2, maxWidth, lastLine: i === lines.length - 1 })
  })
}

/** "1. Introduction": the number at X_HEAD, the words at X_HEAD_TEXT, bold 11pt. */
function heading(flow, text, key) {
  if (!text) return
  place(flow, 'heading', 6)
  const { doc } = flow
  markText(doc, key, X_HEAD, X_RIGHT - X_HEAD, flow.y, 11)
  doc.setTextColor(...BLACK)
  doc.setFont(FONT, 'bold')
  doc.setFontSize(11)
  const m = text.match(/^(\d+\.)\s*(.*)$/)
  if (m) {
    doc.text(m[1], X_HEAD, flow.y)
    doc.text(m[2], X_HEAD_TEXT, flow.y)
  } else doc.text(text, X_HEAD, flow.y)
}

function subheading(flow, text, key) {
  if (!text) return
  textBlock(flow, 'sub', `**${text}**`, { x: X_HEAD_TEXT, key })
}

/** Hollow "o" bullet with its (rich, wrapped) text. */
function bullet(flow, text, key) {
  if (!text) return
  const { doc } = flow
  const lines = wrapRich(doc, text, { font: FONT, size: TEXT_SIZE, maxWidth: X_RIGHT - X_BULLET_TEXT })
  place(flow, 'bullet', 0)
  doc.setTextColor(...BLACK)
  doc.setFont(FONT, 'normal')
  doc.setFontSize(TEXT_SIZE)
  doc.text('o', X_BULLET, flow.y)
  lines.forEach((line, i) => {
    if (i > 0) flow.y += LINE
    markText(doc, key, X_BULLET_TEXT, X_RIGHT - X_BULLET_TEXT, flow.y, TEXT_SIZE)
    drawRichLines(doc, [line], {
      font: FONT,
      size: TEXT_SIZE,
      x: X_BULLET_TEXT,
      y: flow.y,
      lineHeight: LINE,
      align: 'justify',
      maxWidth: X_RIGHT - X_BULLET_TEXT,
      lastLine: i === lines.length - 1,
    })
  })
}

/** An autoTable in the report's style, placed after the current block; the flow continues below it. */
function table(flow, options) {
  const { doc } = flow
  place(flow, 'table', 12)
  autoTable(doc, {
    startY: flow.y - 3.5,
    margin: { left: X_TEXT, right: PAGE_W - X_RIGHT, top: TOP - 4, bottom: PAGE_H - BOTTOM },
    theme: 'grid',
    ...options,
    styles: { font: FONT, textColor: BLACK, lineColor: BLACK, lineWidth: 0.1, valign: 'middle', ...options.styles },
    headStyles: { fillColor: false, textColor: BLACK, fontStyle: 'bold', halign: 'center', valign: 'middle', ...options.headStyles },
  })
  // The next block (the caption) sits 5mm under the table's bottom edge.
  flow.y = doc.lastAutoTable.finalY + 5 - gapBetween('table', 'caption')
  flow.last = 'table'
}

// ---------------------------------------------------------------------------
// Header / footer (every page)
// ---------------------------------------------------------------------------

/** Small green contact icons, drawn as vector shapes (crisp at any zoom). */
function drawIcon(doc, kind, x, baseline) {
  const s = 1.7
  const top = baseline - s + 0.1
  doc.setDrawColor(...LH_GREEN)
  doc.setFillColor(...LH_GREEN)
  doc.setLineWidth(0.18)
  if (kind === 'phone') {
    // handset: a thick arc with two small pads
    doc.setLineWidth(0.45)
    doc.lines([[0.35, 1.1, 1.25, 1.55, 1.55, 1.55]], x + 0.1, top + 0.1, [1, 1], 'S')
    doc.circle(x + 0.25, top + 0.15, 0.3, 'F')
    doc.circle(x + 1.6, top + 1.55, 0.3, 'F')
  } else if (kind === 'mail') {
    doc.rect(x, top + 0.2, s + 0.4, s - 0.4, 'S')
    doc.line(x, top + 0.2, x + (s + 0.4) / 2, top + 0.95)
    doc.line(x + s + 0.4, top + 0.2, x + (s + 0.4) / 2, top + 0.95)
  } else {
    // website: a small screen with a globe
    doc.rect(x, top, s + 0.9, s - 0.2, 'S')
    doc.circle(x + (s + 0.9) / 2, top + (s - 0.2) / 2, 0.55, 'S')
    doc.line(x + (s + 0.9) / 2 - 0.55, top + (s - 0.2) / 2, x + (s + 0.9) / 2 + 0.55, top + (s - 0.2) / 2)
  }
  return kind === 'web' ? s + 0.9 : kind === 'mail' ? s + 0.4 : 1.9
}

function drawHeader(doc, assets, T, page) {
  if (assets?.gradientBar && !hidden.has(GRADIENT_BAR_ID)) {
    doc.addImage(assets.gradientBar, 'PNG', BAR.x, BAR.y, BAR.w, BAR.h, 'gradientBar', 'FAST')
    builtInBoxes.push({ id: GRADIENT_BAR_ID, name: 'Top colour bar', page, x: 0, y: 0, w: PAGE_W, h: BAR.h + 0.3 })
  }
  if (hidden.has(LETTERHEAD_ID)) return

  // Logo — the high-res EnviroCycle logo, centered.
  if (assets?.logoDark) {
    const dim = REPORT_ASSET_DIMENSIONS.logoDark
    const h = LOGO.w * (dim.height / dim.width)
    doc.addImage(assets.logoDark, 'PNG', PAGE_W / 2 - LOGO.w / 2, LOGO.cy - h / 2, LOGO.w, h, 'logoDark', 'FAST')
  }

  // Company / address line — bold, sized to the reference's width.
  if (T.lhAddress) {
    doc.setFont('Poppins', 'semibold')
    doc.setFontSize(10)
    const size = Math.min(6.6, (10 * LH_ADDRESS_MAX_W) / doc.getTextWidth(T.lhAddress))
    doc.setFontSize(size)
    doc.setTextColor(...LH_GREY)
    doc.text(T.lhAddress, PAGE_W / 2, LH_ADDRESS_Y, { align: 'center' })
  }

  // Phone | email | website, each with its icon; email/website underlined links.
  const items = [
    T.lhPhone && { icon: 'phone', text: T.lhPhone },
    T.lhEmail && { icon: 'mail', text: T.lhEmail, url: `mailto:${T.lhEmail}` },
    T.lhWebsite && { icon: 'web', text: T.lhWebsite, url: /^https?:/.test(T.lhWebsite) ? T.lhWebsite : `https://${T.lhWebsite}` },
  ].filter(Boolean)
  if (items.length) {
    doc.setFont('Poppins', 'normal')
    doc.setFontSize(5.8)
    const sep = '  |  '
    const iconW = { phone: 1.9, mail: 2.1, web: 2.6 }
    const gap = 0.8
    const widths = items.map((it) => iconW[it.icon] + gap + doc.getTextWidth(it.text))
    const total = widths.reduce((s, w) => s + w, 0) + doc.getTextWidth(sep) * (items.length - 1)
    let x = PAGE_W / 2 - total / 2
    items.forEach((it, i) => {
      if (i > 0) {
        doc.setTextColor(...LH_LIGHT)
        doc.text(sep, x, LH_CONTACT_Y)
        x += doc.getTextWidth(sep)
      }
      drawIcon(doc, it.icon, x, LH_CONTACT_Y)
      x += iconW[it.icon] + gap
      doc.setTextColor(...LH_LIGHT)
      doc.text(it.text, x, LH_CONTACT_Y)
      const w = doc.getTextWidth(it.text)
      if (it.url) {
        doc.setDrawColor(...LH_LIGHT)
        doc.setLineWidth(0.1)
        doc.line(x, LH_CONTACT_Y + 0.35, x + w, LH_CONTACT_Y + 0.35)
        doc.link(x, LH_CONTACT_Y - 2, w, 2.4, { url: it.url })
      }
      x += w
    })
  }
  builtInBoxes.push({ id: LETTERHEAD_ID, name: 'Letterhead', page, x: PAGE_W / 2 - 70, y: 6, w: 140, h: 15 })
}

function drawFooter(doc, assets, T, page) {
  // Form code — two short lines, bottom-left.
  doc.setFont('Poppins', 'normal')
  for (const [text, y, color] of [
    [T.formCode, FORM_CODE.y1, [70, 70, 70]],
    [T.formEffective, FORM_CODE.y2, [20, 20, 20]],
  ]) {
    if (!text) continue
    doc.setFontSize(10)
    doc.setFontSize(Math.min(7.6, (10 * FORM_CODE.w) / doc.getTextWidth(text)))
    doc.setTextColor(...color)
    doc.text(text, FORM_CODE.x, y)
  }

  // Compliance-logo strip (the reference's own image), bottom center.
  if (!assets?.complianceStrip) return
  const logoBoxes = reportStripLogoBoxes(hidden, STRIP)
  if (!REPORT_COMPLIANCE_LOGOS.some((l) => hidden.has(l.id))) {
    const dim = REPORT_ASSET_DIMENSIONS.complianceStrip
    doc.addImage(assets.complianceStrip, 'PNG', STRIP.x, STRIP.y, STRIP.w, STRIP.w * (dim.height / dim.width), 'complianceStrip', 'FAST')
  } else {
    // Some logos removed: draw the rest one by one, closed up and centered per row.
    for (const box of logoBoxes) {
      const piece = assets.complianceStripPieces?.[box.id]
      if (piece) doc.addImage(piece, 'PNG', box.x, box.y, box.w, box.h, box.id, 'FAST')
    }
  }
  for (const box of logoBoxes) builtInBoxes.push({ id: box.id, name: box.name, page, x: box.x, y: box.y, w: box.w, h: box.h })
}

// ---------------------------------------------------------------------------
// Sign-off
// ---------------------------------------------------------------------------

// The sign-off recreates each signatory's signed name block (public/eisg.png):
// the pen signature sits over the printed name exactly as it does there.
// Offsets are in that image's pixels — `dx`: signature center minus name
// center; `drop`: signature bottom below the name's baseline (negative =
// above) — scaled so its name cap height (17.2px) matches ours. The
// signature PNGs are 3× crops of that same image.
const NAME_SIZE = 11.5
const NAME_CAP_MM = NAME_SIZE * (25.4 / 72) * 0.698 // Poppins cap height ≈ 0.698 em
const SOURCE_CAP_PX = 17.2
const MM_PER_SOURCE_PX = NAME_CAP_MM / SOURCE_CAP_PX
const SIGNATURE_OFFSETS = {
  sigSanchez: { dx: 37, drop: 7.8 },
  sigLaconsay: { dx: -13, drop: -12.2 },
  sigBweheni: { dx: 13.5, drop: 12.3 },
}
const SIGN_COLUMNS = [53.6, 113.2, 162.4] // name-block centers, from the reference
// The RECO2 stamp behind the reviewer (2nd signatory), placed as in the
// reference: 41.5mm wide, its top 4.1mm under the role labels' baseline, its
// center 9.9mm left of the reviewer's name.
const STAMP = { column: 1, w: 41.54, top: 4.1, dx: -9.9 }

function drawSignOff(flow, assets, T, showSignatures) {
  const { doc } = flow
  const stamp = !hidden.has(STAMP_ID) && assets?.reco2Stamp
  const stampH = STAMP.w * (REPORT_ASSET_DIMENSIONS.reco2Stamp.height / REPORT_ASSET_DIMENSIONS.reco2Stamp.width)
  // Keep the whole block on one page. The stamp may reach down into the gap
  // above the footer logos (they start at STRIP.y), so it only needs that much room.
  const namesHeight = 24
  place(flow, 'signoff', stamp ? Math.max(namesHeight, STAMP.top + stampH - (STRIP.y - 1.5 - BOTTOM)) : namesHeight)
  const labelY = flow.y
  const nameY = labelY + 19

  // Stamp first, so the name and signature sit on top of it.
  if (stamp) {
    const box = { x: SIGN_COLUMNS[STAMP.column] + STAMP.dx - STAMP.w / 2, y: labelY + STAMP.top, w: STAMP.w, h: stampH }
    doc.addImage(assets.reco2Stamp, 'PNG', box.x, box.y, box.w, box.h, 'reco2Stamp', 'FAST')
    builtInBoxes.push({ id: STAMP_ID, name: 'RECO2 stamp', page: doc.getCurrentPageInfo().pageNumber - 1, ...box, movable: true })
  }

  SIGNATORIES.forEach((sig, i) => {
    const cx = SIGN_COLUMNS[i]
    doc.setTextColor(...BLACK)
    doc.setFont(FONT, 'normal')
    doc.setFontSize(9)
    if (T[`role${i}`]) doc.text(T[`role${i}`], cx - 22, labelY)
    markText(doc, `role${i}`, cx - 22, 30, labelY, 9)

    doc.setTextColor(...SIG_NAVY)
    doc.setFont('Poppins', 'semibold')
    doc.setFontSize(NAME_SIZE)
    if (T[`sig${i}Name`]) doc.text(T[`sig${i}Name`], cx, nameY, { align: 'center' })
    markText(doc, `sig${i}Name`, cx - 25, 50, nameY, NAME_SIZE)
    doc.setFont('Poppins', 'normal')
    doc.setFontSize(7)
    if (T[`sig${i}Title`]) doc.text(T[`sig${i}Title`].toUpperCase(), cx, nameY + 3.9, { align: 'center' })
    markText(doc, `sig${i}Title`, cx - 25, 50, nameY + 3.9, 7)

    // Pen signature on top of the name (ink over print), only above the person's OWN name.
    const offset = SIGNATURE_OFFSETS[sig.signature]
    if (showSignatures && offset && T[`sig${i}Name`] === sig.name && assets?.[sig.signature]) {
      const dim = ASSET_DIMENSIONS[sig.signature]
      const w = (dim.width / 3) * MM_PER_SOURCE_PX
      const h = (dim.height / 3) * MM_PER_SOURCE_PX
      const sx = cx + offset.dx * MM_PER_SOURCE_PX - w / 2
      const bottom = nameY + offset.drop * MM_PER_SOURCE_PX
      doc.addImage(assets[sig.signature], 'PNG', sx, bottom - h, w, h)
    }
  })
  flow.y = nameY + 3.9
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

/**
 * Draws the whole report. Returns the layout the preview editor needs:
 * { pageCount, builtInBoxes, textBoxes } — where each built-in image and each
 * editable text field landed (mm, per page).
 */
export function drawReportPdf(doc, assets, data) {
  const { rows, totals, recycledMaterials } = data
  const T = resolveReportText(data)
  hidden = new Set(data.textOverrides?.hiddenImages || [])
  builtInBoxes = []
  textBoxes = []
  const flow = newFlow(doc)

  // Title + Client / Prepared by / Reporting Period block
  if (T.title) {
    doc.setTextColor(...BLACK)
    doc.setFont(FONT, 'bold')
    doc.setFontSize(12)
    doc.text(T.title, PAGE_W / 2, TOP + 0.7, { align: 'center' })
    markText(doc, 'title', PAGE_W / 2 - 60, 120, TOP + 0.7, 12)
  }
  flow.y = TOP + 0.7
  flow.last = 'title'
  // [key, text] pairs: the label, then its value lines.
  const group = (label, values) => {
    const lines = [[label[0], label[1] && `**${label[1]}**`], ...values].filter(([, text]) => text)
    if (!lines.length) return
    lines.forEach(([key, text], i) => textBlock(flow, i === 0 ? 'label' : 'value', text, { key }))
  }
  const kv = (...keys) => keys.map((k) => [k, T[k]])
  group(['clientLabel', T.clientLabel], kv('clientName', 'clientAddress1', 'clientAddress2', 'clientCity'))
  group(['preparedLabel', T.preparedLabel], kv('preparedName', 'preparedAddress'))
  group(['periodLabel', T.periodLabel], kv('itemsCollected', 'reportIssued'))

  // 1. Introduction
  heading(flow, T.h1, 'h1')
  for (let i = 0; i < 3; i++) textBlock(flow, 'para', T[`intro${i}`], { align: 'justify', key: `intro${i}` })

  // 2. Detailed Impact Breakdown
  heading(flow, T.h2, 'h2')
  subheading(flow, T.h21, 'h21')
  textBlock(flow, 'desc', T.p21, { x: X_HEAD, align: 'justify', key: 'p21' })

  const n1 = (v) => formatNumber(v, 1)
  const body = rows.map((r, i) => [
    String(i + 1),
    r.item,
    n1(r.qtyKg),
    n1(r.metalKg),
    n1(r.plasticKg),
    n1(r.glassKg),
    n1(r.electronicsKg),
    n1(r.carbonFootprintKgCO2e),
    n1(r.recycledEmissionsKgCO2e),
    n1(r.netCarbonAbatedKgCO2e),
    formatNumber(r.waterSavedLiters, 0),
    n1(r.energySavedKwh),
    n1(r.landfillAvertedKg),
  ])
  body.push([
    { content: 'Total', colSpan: 2, styles: { halign: 'center', fontSize: 8 } },
    n1(totals.qtyKg),
    n1(totals.metalKg),
    n1(totals.plasticKg),
    n1(totals.glassKg),
    n1(totals.electronicsKg),
    n1(totals.carbonFootprintKgCO2e),
    n1(totals.recycledEmissionsKgCO2e),
    n1(totals.netCarbonAbatedKgCO2e),
    formatNumber(totals.waterSavedLiters, 0),
    n1(totals.energySavedKwh),
    n1(totals.landfillAvertedKg),
  ])
  table(flow, {
    head: [
      ['No.', 'Item', 'Qty (kg)', 'Metal\nWeight\n(kg)', 'Plastic\nWeight\n(kg)', 'Glass\nWeight\n(kg)', 'Electronics\nWeight (kg)', 'Carbon\nFootprint\n(kg CO2e)', 'Recycled\nEmissions\n(kg CO2e)', 'Net Carbon\nAbated\n(kg CO2e)', 'Water\nSaved (L)', 'Energy\nSaved\n(kWh)', 'Landfill\nAverted\n(kg)'],
    ],
    body,
    styles: { fontSize: 7, cellPadding: 1.1, halign: 'center' },
    headStyles: { fontSize: 7 },
    columnStyles: { 0: { cellWidth: 6.5 }, 1: { halign: 'left', cellWidth: 26 } },
    rowPageBreak: 'avoid',
    didParseCell: (hook) => {
      if (hook.section === 'body' && hook.row.index === body.length - 1) hook.cell.styles.fontStyle = 'bold'
    },
  })
  textBlock(flow, 'caption', T.table1Caption, { size: 8, align: 'center', key: 'table1Caption' })

  // 2.2 Subtotal
  subheading(flow, T.h22, 'h22')
  for (let i = 0; i < 7; i++) bullet(flow, T[`b22_${i}`], `b22_${i}`)

  // 3. Recycled Materials
  heading(flow, T.h3, 'h3')
  textBlock(flow, 'desc', T.p3, { x: X_HEAD, align: 'justify', key: 'p3' })
  table(flow, {
    head: [['Material', 'Quantity (kg)', 'Environmental Benefit']],
    body: recycledMaterials.map((m) => [m.material, n1(m.quantityKg), m.benefit]),
    styles: { fontSize: 8, cellPadding: 1.4 },
    columnStyles: { 0: { cellWidth: 36 }, 1: { halign: 'center', cellWidth: 28 } },
    rowPageBreak: 'avoid',
  })
  textBlock(flow, 'caption', T.table2Caption, { size: 8, align: 'center', key: 'table2Caption' })

  // 4. Methodology — "4.1 Data Collection:" in bold, running into its text.
  heading(flow, T.h4, 'h4')
  METHODOLOGY_SECTIONS.forEach((_, i) => {
    const head = T[`m${i}Heading`]
    const text = T[`m${i}Body`]
    const combined = [head && `**${head}**`, text].filter(Boolean).join(' ')
    // On-page editing edits the paragraph text (its bold heading is a separate field in the side panel).
    textBlock(flow, 'para', combined, { x: X_HEAD_TEXT, align: 'justify', key: text ? `m${i}Body` : `m${i}Heading` })
  })

  // 5. Environmental Impact
  heading(flow, T.h5, 'h5')
  textBlock(flow, 'para5', T.p5, { x: X_HEAD, align: 'justify', key: 'p5' })
  const groups = [
    ['h51', 'b51_', 3],
    ['h52', 'b52_', 2],
    ['h53', 'b53_', 2],
    ['h54', 'b54_', 2],
  ]
  for (const [h, prefix, count] of groups) {
    subheading(flow, T[h], h)
    for (let i = 0; i < count; i++) bullet(flow, T[`${prefix}${i}`], `${prefix}${i}`)
  }

  // 6. Conclusion
  heading(flow, T.h6, 'h6')
  CONCLUSION_PARAGRAPHS.forEach((_, i) => textBlock(flow, i === 0 ? 'concl' : 'para', T[`concl${i}`], { align: 'justify', key: `concl${i}` }))

  drawSignOff(flow, assets, T, !data.textOverrides?.hideSignatures)

  // Header + footer on every page (drawn last, over nothing — the body stays between them).
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    drawHeader(doc, assets, T, p - 1)
    drawFooter(doc, assets, T, p - 1)
  }

  drawPlacedImages(doc, data.placedImages)
  return { pageCount, builtInBoxes, textBoxes }
}

/**
 * Images added in the preview editor (e.g. a client logo), drawn last so
 * they sit on top. Each is a PNG data URL with a page index and its
 * position/size in mm on that A4 page. An image on a page that no longer
 * exists (the report got shorter) goes on the last page.
 */
function drawPlacedImages(doc, images = []) {
  if (!images.length) return
  const pageCount = doc.getNumberOfPages()
  for (const img of images) {
    doc.setPage(Math.min(img.page ?? 0, pageCount - 1) + 1)
    doc.addImage(img.dataUrl, 'PNG', img.x, img.y, img.w, img.h, img.id, 'FAST')
  }
  doc.setPage(pageCount)
}
