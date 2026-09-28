// ESG Report TEMPLATE — PDF version. Recreates the structure AND look of
// the real "Carbon Abatement - Client Template.pdf" using that PDF's own
// embedded images for the letterhead (logo + contact info), the
// teal-to-blue gradient top bar, the two-row compliance-logo strip, and
// the form-code footer text — not redrawn, so these match exactly. Body
// content: Client / Prepared by / Reporting Period header, 1. Introduction,
// 2. Detailed Impact Breakdown (asset-category table + subtotal),
// 3. Recycled Materials, 4. Methodology, 5. Environmental Impact
// narrative, 6. Conclusion, 3-signatory sign-off (with role labels).
// Serif body text and near-black headings — a very different look from
// the certificates' rounded sans-serif/green branding, matching the
// reference.
//
// Every free-text line comes from resolveReportText (defaults + preview
// editor overrides); built-in images the editor removed are skipped, and
// images added in the editor are drawn on top at the end.
//
// This is intentionally the only file that knows how the PDF report is
// laid out. `generateReportPdf.js` just calls `drawReportPdf(doc, assets, data)`.

import autoTable from 'jspdf-autotable'
import { formatNumber } from '../lib/format.js'
import { BRAND, SIGNATORIES } from '../lib/brand.js'
import { REPORT_ASSET_DIMENSIONS } from './assetDimensions.js'
import { ASSET_DIMENSIONS } from '../certificate/assetDimensions.js'
import { introductionParagraphs, METHODOLOGY_SECTIONS, CONCLUSION_PARAGRAPHS } from './methodology.js'
import { resolveReportText } from './reportText.js'
import { LETTERHEAD_ID, GRADIENT_BAR_ID, FORM_CODE_ID, REPORT_COMPLIANCE_LOGOS, reportStripLogoBoxes } from './reportBuiltInImages.js'

const MARGIN = 18
const FONT = 'times'
const BLACK = [15, 15, 15]

// Guards against drawing the letterhead twice on the same page — both
// ensureSpace() and autoTable's own didDrawPage hook can fire back-to-back
// right after a page break, which would otherwise stack two copies of the
// (partially transparent) letterhead PNG and make it look ghosted/faded.
let lastLetterheadPage = -1
let pageAssets = null
// Built-in images removed in the preview editor, and the page boxes of the
// built-in images actually drawn (returned to the editor so it can put
// remove/move targets exactly on them). Reset per document in drawReportPdf.
let hidden = new Set()
let builtInBoxes = []

const currentPage = (doc) => doc.internal.getCurrentPageInfo().pageNumber - 1

const LETTERHEAD_WIDTH = 90
const GRADIENT_BAR_HEIGHT = 4
const LETTERHEAD_HEIGHT = GRADIENT_BAR_HEIGHT + 4 + LETTERHEAD_WIDTH * (REPORT_ASSET_DIMENSIONS.letterhead.height / REPORT_ASSET_DIMENSIONS.letterhead.width) + 6

/** Real gradient bar + real centered letterhead image (logo + contact info) — repeated on every page. */
function drawLetterhead(doc, assets) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageNumber = doc.internal.getCurrentPageInfo().pageNumber
  if (pageNumber === lastLetterheadPage) return LETTERHEAD_HEIGHT
  lastLetterheadPage = pageNumber

  // A removed letterhead / bar keeps its space, so the page layout doesn't shift.
  if (assets?.gradientBar && !hidden.has(GRADIENT_BAR_ID)) {
    doc.addImage(assets.gradientBar, 'PNG', 0, 0, pageWidth, GRADIENT_BAR_HEIGHT)
    builtInBoxes.push({ id: GRADIENT_BAR_ID, name: 'Top colour bar', page: pageNumber - 1, x: 0, y: 0, w: pageWidth, h: GRADIENT_BAR_HEIGHT })
  }

  let y = GRADIENT_BAR_HEIGHT + 4
  if (assets?.letterhead) {
    const dim = REPORT_ASSET_DIMENSIONS.letterhead
    const h = LETTERHEAD_WIDTH * (dim.height / dim.width)
    if (!hidden.has(LETTERHEAD_ID)) {
      const x = pageWidth / 2 - LETTERHEAD_WIDTH / 2
      doc.addImage(assets.letterhead, 'PNG', x, y, LETTERHEAD_WIDTH, h)
      builtInBoxes.push({ id: LETTERHEAD_ID, name: 'Letterhead', page: pageNumber - 1, x, y, w: LETTERHEAD_WIDTH, h })
    }
    y += h
  }

  return y + 6
}

/** Advance to a new page if `needed` mm of vertical space isn't left, redrawing the letterhead. */
function ensureSpace(doc, y, needed) {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + needed > pageHeight - MARGIN) {
    doc.addPage()
    return drawLetterhead(doc, pageAssets) + 4
  }
  return y
}

// heading / subheading / paragraph / bullet print nothing (and take no space)
// for an empty string — that's how the preview editor removes a line.

function heading(doc, y, text) {
  if (!text) return y
  y = ensureSpace(doc, y, 14)
  doc.setTextColor(...BLACK)
  doc.setFont(FONT, 'bold')
  doc.setFontSize(13)
  doc.text(text, MARGIN, y)
  return y + 7
}

function subheading(doc, y, text) {
  if (!text) return y
  y = ensureSpace(doc, y, 10)
  doc.setTextColor(...BLACK)
  doc.setFont(FONT, 'bold')
  doc.setFontSize(10.5)
  doc.text(text, MARGIN, y)
  return y + 5.5
}

function paragraph(doc, y, text, opts = {}) {
  if (!text) return y
  const pageWidth = doc.internal.pageSize.getWidth()
  doc.setFont(FONT, opts.bold ? 'bold' : 'normal')
  doc.setFontSize(opts.size || 9.5)
  const lines = doc.splitTextToSize(text, pageWidth - MARGIN * 2)
  y = ensureSpace(doc, y, lines.length * 4.6 + 3)
  doc.setTextColor(...(opts.color || BLACK))
  doc.text(lines, MARGIN, y)
  return y + lines.length * 4.6 + 3
}

/** Hollow "o" bullet, matching the reference's sub-bullet style. */
function bullet(doc, y, text) {
  if (!text) return y
  const pageWidth = doc.internal.pageSize.getWidth()
  const indent = MARGIN + 6
  doc.setFont(FONT, 'normal')
  doc.setFontSize(9.5)
  const lines = doc.splitTextToSize(text, pageWidth - MARGIN - indent)
  y = ensureSpace(doc, y, lines.length * 4.6 + 1.5)
  doc.setTextColor(...BLACK)
  doc.text('o', MARGIN, y)
  doc.text(lines, indent, y)
  return y + lines.length * 4.6 + 1.5
}

/** Draw text unless it's empty (an empty string is how the preview editor removes a line). */
function drawText(doc, text, x, y, options) {
  if (text) doc.text(text, x, y, options)
}

// E-signatures on the sign-off lines: one shared scale for all 3 images so
// they keep their real relative sizes (the tallest come out ~10mm), dipping
// slightly below the line like a pen signature. Same images as the certificate.
const SIGNATURE_MM_PER_PX = 10 / 249
const SIGNATURE_LINE_OVERLAP = 0.18

function drawSignature(doc, assets, key, cx, lineY) {
  const image = assets?.[key]
  if (!image) return
  const dim = ASSET_DIMENSIONS[key]
  const w = dim.width * SIGNATURE_MM_PER_PX
  const h = dim.height * SIGNATURE_MM_PER_PX
  doc.addImage(image, 'PNG', cx - w / 2, lineY + h * SIGNATURE_LINE_OVERLAP - h, w, h)
}

/**
 * Draws the whole report. Returns the layout the preview editor needs:
 * { pageCount, builtInBoxes } — where each built-in image landed (mm, per page).
 */
export function drawReportPdf(doc, assets, data) {
  const { client, rows, totals, recycledMaterials } = data
  const T = resolveReportText(data)
  const pageWidth = doc.internal.pageSize.getWidth()
  pageAssets = assets
  lastLetterheadPage = -1 // reset the per-page draw guard for this fresh document
  hidden = new Set(data.textOverrides?.hiddenImages || [])
  builtInBoxes = []

  let y = drawLetterhead(doc, assets)

  // Centered title
  doc.setTextColor(...BLACK)
  doc.setFont(FONT, 'bold')
  doc.setFontSize(17)
  drawText(doc, T.title, pageWidth / 2, y, { align: 'center' })
  y += 12

  // Client / Prepared by / Reporting period block
  doc.setFont(FONT, 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...BLACK)
  drawText(doc, T.clientLabel, MARGIN, y)
  doc.setFont(FONT, 'normal')
  drawText(doc, T.clientName, MARGIN + 20, y)
  y += 5
  if (client.addressLine1 !== '—') {
    drawText(doc, T.clientAddress1, MARGIN + 20, y)
    y += 5
  }
  if (client.cityStateZipCountry !== '—') {
    drawText(doc, T.clientCity, MARGIN + 20, y)
    y += 5
  }
  y += 1.5
  doc.setFont(FONT, 'bold')
  drawText(doc, T.preparedLabel, MARGIN, y)
  doc.setFont(FONT, 'normal')
  drawText(doc, T.preparedName, MARGIN + 26, y)
  y += 5
  drawText(doc, T.preparedAddress, MARGIN + 26, y)
  y += 6.5
  doc.setFont(FONT, 'bold')
  drawText(doc, T.periodLabel, MARGIN, y)
  y += 5
  doc.setFont(FONT, 'normal')
  drawText(doc, T.itemsCollected, MARGIN, y)
  y += 5
  drawText(doc, T.reportIssued, MARGIN, y)
  y += 9

  // 1. Introduction
  y = heading(doc, y, T.h1)
  introductionParagraphs('').forEach((_, i) => (y = paragraph(doc, y, T[`intro${i}`])))

  // 2. Detailed Impact Breakdown
  y = heading(doc, y, T.h2)
  y = subheading(doc, y, T.h21)
  y = paragraph(doc, y, T.p21)

  const tableRows = rows.map((r, i) => [
    String(i + 1),
    r.item,
    formatNumber(r.qtyKg, 1),
    formatNumber(r.metalKg, 1),
    formatNumber(r.plasticKg, 1),
    formatNumber(r.glassKg, 1),
    formatNumber(r.electronicsKg, 1),
    formatNumber(r.carbonFootprintKgCO2e, 1),
    formatNumber(r.recycledEmissionsKgCO2e, 1),
    formatNumber(r.netCarbonAbatedKgCO2e, 1),
    formatNumber(r.waterSavedLiters, 0),
    formatNumber(r.energySavedKwh, 1),
    formatNumber(r.landfillAvertedKg, 1),
  ])
  tableRows.push([
    'Total',
    '',
    formatNumber(totals.qtyKg, 1),
    formatNumber(totals.metalKg, 1),
    formatNumber(totals.plasticKg, 1),
    formatNumber(totals.glassKg, 1),
    formatNumber(totals.electronicsKg, 1),
    formatNumber(totals.carbonFootprintKgCO2e, 1),
    formatNumber(totals.recycledEmissionsKgCO2e, 1),
    formatNumber(totals.netCarbonAbatedKgCO2e, 1),
    formatNumber(totals.waterSavedLiters, 0),
    formatNumber(totals.energySavedKwh, 1),
    formatNumber(totals.landfillAvertedKg, 1),
  ])

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, top: LETTERHEAD_HEIGHT + 4 },
    head: [
      ['No.', 'Item', 'Qty\n(kg)', 'Metal\nWeight\n(kg)', 'Plastic\nWeight\n(kg)', 'Glass\nWeight\n(kg)', 'Electronics\nWeight (kg)', 'Carbon\nFootprint\n(kg CO2e)', 'Recycled\nEmissions\n(kg CO2e)', 'Net Carbon\nAbated\n(kg CO2e)', 'Water\nSaved (L)', 'Energy\nSaved\n(kWh)', 'Landfill\nAverted\n(kg)'],
    ],
    body: tableRows,
    theme: 'grid',
    styles: { font: FONT, fontSize: 6.3, textColor: BLACK, cellPadding: 1.2, halign: 'center', lineColor: BLACK, lineWidth: 0.15 },
    headStyles: { fillColor: false, textColor: BLACK, fontStyle: 'bold', halign: 'center' },
    columnStyles: { 0: { cellWidth: 8 }, 1: { halign: 'left', cellWidth: 20 } },
    didParseCell: (hook) => {
      if (hook.row.index === tableRows.length - 1 && hook.section === 'body') {
        hook.cell.styles.fontStyle = 'bold'
      }
    },
    didDrawPage: () => {
      // autoTable's own pagination bypasses ensureSpace — redraw the letterhead on any page it adds.
      drawLetterhead(doc, pageAssets)
    },
  })
  y = doc.lastAutoTable.finalY + 3
  y = paragraph(doc, y, T.table1Caption, { size: 7.5, color: BRAND.muted })

  // 2.2 Subtotal
  y = subheading(doc, y, T.h22)
  for (let i = 0; i < 7; i++) y = bullet(doc, y, T[`b22_${i}`])
  y += 2

  // 3. Recycled Materials
  y = heading(doc, y, T.h3)
  y = paragraph(doc, y, T.p3)
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, top: LETTERHEAD_HEIGHT + 4 },
    head: [['Material', 'Quantity (kg)', 'Environmental Benefit']],
    body: recycledMaterials.map((m) => [m.material, formatNumber(m.quantityKg, 1), m.benefit]),
    theme: 'grid',
    styles: { font: FONT, fontSize: 8.5, textColor: BLACK, cellPadding: 2, lineColor: BLACK, lineWidth: 0.15 },
    headStyles: { fillColor: false, textColor: BLACK, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' } },
    didDrawPage: () => {
      drawLetterhead(doc, pageAssets)
    },
  })
  y = doc.lastAutoTable.finalY + 3
  y = paragraph(doc, y, T.table2Caption, { size: 7.5, color: BRAND.muted })

  // 4. Methodology
  y = heading(doc, y, T.h4)
  METHODOLOGY_SECTIONS.forEach((_, i) => {
    y = subheading(doc, y, T[`m${i}Heading`])
    y = paragraph(doc, y, T[`m${i}Body`])
  })

  // 5. Environmental Impact
  y = heading(doc, y, T.h5)
  y = paragraph(doc, y, T.p5)
  y = subheading(doc, y, T.h51)
  for (let i = 0; i < 3; i++) y = bullet(doc, y, T[`b51_${i}`])
  y = subheading(doc, y, T.h52)
  for (let i = 0; i < 2; i++) y = bullet(doc, y, T[`b52_${i}`])
  y = subheading(doc, y, T.h53)
  for (let i = 0; i < 2; i++) y = bullet(doc, y, T[`b53_${i}`])
  y = subheading(doc, y, T.h54)
  for (let i = 0; i < 2; i++) y = bullet(doc, y, T[`b54_${i}`])
  y += 2

  // 6. Conclusion
  y = heading(doc, y, T.h6)
  CONCLUSION_PARAGRAPHS.forEach((_, i) => (y = paragraph(doc, y, T[`concl${i}`])))

  // Sign-off, with role labels above each name (Prepared by: / Reviewed by: / Approved by:)
  y = ensureSpace(doc, y, 30)
  y += 6
  const colWidth = (pageWidth - MARGIN * 2) / SIGNATORIES.length
  const showSignatures = !data.textOverrides?.hideSignatures
  SIGNATORIES.forEach((sig, i) => {
    const x = MARGIN + colWidth * i
    doc.setTextColor(...BLACK)
    doc.setFont(FONT, 'normal')
    doc.setFontSize(9)
    doc.text(T[`role${i}`], x, y)

    doc.setDrawColor(...BRAND.border)
    doc.setLineWidth(0.2)
    doc.line(x, y + 14, x + colWidth - 10, y + 14)
    // A person's pen signature only goes above their OWN name (not if the name was edited).
    if (showSignatures && sig.signature && T[`sig${i}Name`] === sig.name) drawSignature(doc, assets, sig.signature, x + (colWidth - 10) / 2, y + 14)
    doc.setTextColor(...BLACK)
    doc.setFont(FONT, 'bold')
    doc.setFontSize(9.5)
    drawText(doc, T[`sig${i}Name`], x, y + 19)
    doc.setTextColor(...BRAND.muted)
    doc.setFont(FONT, 'normal')
    doc.setFontSize(7.5)
    if (T[`sig${i}Title`]) doc.text(doc.splitTextToSize(T[`sig${i}Title`], colWidth - 10), x, y + 23)
  })
  y += 34

  // Real form-code footer image + real two-row compliance strip, both extracted from the reference PDF.
  // A removed form code / logo leaves the layout below it as-is.
  y = ensureSpace(doc, y, 40)
  if (assets?.formCode) {
    const dim = REPORT_ASSET_DIMENSIONS.formCode
    const w = 28
    const h = w * (dim.height / dim.width)
    if (!hidden.has(FORM_CODE_ID)) {
      doc.addImage(assets.formCode, 'PNG', MARGIN, y, w, h)
      builtInBoxes.push({ id: FORM_CODE_ID, name: 'Form code', page: currentPage(doc), x: MARGIN, y, w, h, movable: true })
    }
    y += h + 3
  }
  if (assets?.complianceStrip) {
    const dim = REPORT_ASSET_DIMENSIONS.complianceStrip
    const stripW = pageWidth - MARGIN * 2
    const stripH = stripW * (dim.height / dim.width)
    y = ensureSpace(doc, y, stripH)
    const logoBoxes = reportStripLogoBoxes(hidden, { x: MARGIN, y, w: stripW })
    if (!REPORT_COMPLIANCE_LOGOS.some((l) => hidden.has(l.id))) {
      doc.addImage(assets.complianceStrip, 'PNG', MARGIN, y, stripW, stripH)
    } else {
      // Some logos removed: draw the rest one by one, closed up and centered per row.
      for (const box of logoBoxes) {
        const piece = assets.complianceStripPieces?.[box.id]
        if (piece) doc.addImage(piece, 'PNG', box.x, box.y, box.w, box.h, box.id, 'FAST')
      }
    }
    for (const box of logoBoxes) builtInBoxes.push({ id: box.id, name: box.name, page: currentPage(doc), x: box.x, y: box.y, w: box.w, h: box.h, movable: true })
  }

  drawPlacedImages(doc, data.placedImages)
  return { pageCount: doc.getNumberOfPages(), builtInBoxes }
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
