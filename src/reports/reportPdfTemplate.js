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
// This is intentionally the only file that knows how the PDF report is
// laid out. `generateReportPdf.js` just calls `drawReportPdf(doc, assets, data)`.

import autoTable from 'jspdf-autotable'
import { formatKg, formatUnit, formatNumber, toText } from '../lib/format.js'
import { COMPANY, BRAND, SIGNATORIES } from '../lib/brand.js'
import { REPORT_ASSET_DIMENSIONS } from './assetDimensions.js'
import {
  introductionParagraphs,
  REFURBISH_REUSE_DESCRIPTION,
  RECYCLED_MATERIALS_DESCRIPTION,
  METHODOLOGY_SECTIONS,
  CONCLUSION_PARAGRAPHS,
} from './methodology.js'

const MARGIN = 18
const FONT = 'times'
const BLACK = [15, 15, 15]

// Guards against drawing the letterhead twice on the same page — both
// ensureSpace() and autoTable's own didDrawPage hook can fire back-to-back
// right after a page break, which would otherwise stack two copies of the
// (partially transparent) letterhead PNG and make it look ghosted/faded.
let lastLetterheadPage = -1
let pageAssets = null

const LETTERHEAD_WIDTH = 90
const GRADIENT_BAR_HEIGHT = 4
const LETTERHEAD_HEIGHT = GRADIENT_BAR_HEIGHT + 4 + LETTERHEAD_WIDTH * (REPORT_ASSET_DIMENSIONS.letterhead.height / REPORT_ASSET_DIMENSIONS.letterhead.width) + 6

/** Real gradient bar + real centered letterhead image (logo + contact info) — repeated on every page. */
function drawLetterhead(doc, assets) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageNumber = doc.internal.getCurrentPageInfo().pageNumber
  if (pageNumber === lastLetterheadPage) return LETTERHEAD_HEIGHT
  lastLetterheadPage = pageNumber

  if (assets?.gradientBar) {
    doc.addImage(assets.gradientBar, 'PNG', 0, 0, pageWidth, GRADIENT_BAR_HEIGHT)
  }

  let y = GRADIENT_BAR_HEIGHT + 4
  if (assets?.letterhead) {
    const dim = REPORT_ASSET_DIMENSIONS.letterhead
    const h = LETTERHEAD_WIDTH * (dim.height / dim.width)
    doc.addImage(assets.letterhead, 'PNG', pageWidth / 2 - LETTERHEAD_WIDTH / 2, y, LETTERHEAD_WIDTH, h)
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

function heading(doc, y, text) {
  y = ensureSpace(doc, y, 14)
  doc.setTextColor(...BLACK)
  doc.setFont(FONT, 'bold')
  doc.setFontSize(13)
  doc.text(text, MARGIN, y)
  return y + 7
}

function subheading(doc, y, text) {
  y = ensureSpace(doc, y, 10)
  doc.setTextColor(...BLACK)
  doc.setFont(FONT, 'bold')
  doc.setFontSize(10.5)
  doc.text(text, MARGIN, y)
  return y + 5.5
}

function paragraph(doc, y, text, opts = {}) {
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

export function drawReportPdf(doc, assets, data) {
  const { report, client, collectionDateRange, reportIssueDateLabel, rows, totals, recycledMaterials, equivalencies } = data
  const pageWidth = doc.internal.pageSize.getWidth()
  pageAssets = assets
  lastLetterheadPage = -1 // reset the per-page draw guard for this fresh document

  let y = drawLetterhead(doc, assets)

  // Centered title
  doc.setTextColor(...BLACK)
  doc.setFont(FONT, 'bold')
  doc.setFontSize(17)
  doc.text(toText(report.title, 'Carbon Abatement Report'), pageWidth / 2, y, { align: 'center' })
  y += 12

  // Client / Prepared by / Reporting period block
  doc.setFont(FONT, 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...BLACK)
  doc.text('Client:', MARGIN, y)
  doc.setFont(FONT, 'normal')
  doc.text(toText(client.name), MARGIN + 20, y)
  y += 5
  if (client.addressLine1 !== '—') {
    doc.text(client.addressLine1, MARGIN + 20, y)
    y += 5
  }
  if (client.cityStateZipCountry !== '—') {
    doc.text(client.cityStateZipCountry, MARGIN + 20, y)
    y += 5
  }
  y += 1.5
  doc.setFont(FONT, 'bold')
  doc.text('Prepared by:', MARGIN, y)
  doc.setFont(FONT, 'normal')
  doc.text(COMPANY.name, MARGIN + 26, y)
  y += 5
  doc.text(COMPANY.addressLine, MARGIN + 26, y)
  y += 6.5
  doc.setFont(FONT, 'bold')
  doc.text('Reporting Period:', MARGIN, y)
  y += 5
  doc.setFont(FONT, 'normal')
  doc.text(`Items collected: ${toText(collectionDateRange, '—')}`, MARGIN, y)
  y += 5
  doc.text(`Report issued: ${reportIssueDateLabel}`, MARGIN, y)
  y += 9

  // 1. Introduction
  y = heading(doc, y, '1. Introduction')
  for (const p of introductionParagraphs(toText(client.name))) y = paragraph(doc, y, p)

  // 2. Detailed Impact Breakdown
  y = heading(doc, y, '2. Detailed Impact Breakdown')
  y = subheading(doc, y, '2.1 Refurbish/Re-use of Materials')
  y = paragraph(doc, y, REFURBISH_REUSE_DESCRIPTION)

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
  y = paragraph(doc, y, 'Table 1. Summary of Detailed Impact Breakdown for Refurbish/Re-use of Materials', { size: 7.5, color: BRAND.muted })

  // 2.2 Subtotal
  y = subheading(doc, y, '2.2 Subtotal Impact for Refurbished Equipment')
  y = bullet(doc, y, `Total Material Processed: ${formatKg(totals.materialsTotalKg)}`)
  y = bullet(doc, y, `Total Carbon Footprint: ${formatUnit(totals.carbonFootprintKgCO2e, 'kg CO2e')}`)
  y = bullet(doc, y, `Recycled Emissions: ${formatUnit(totals.recycledEmissionsKgCO2e, 'kg CO2e')}`)
  y = bullet(doc, y, `Net Carbon Abated: ${formatUnit(totals.netCarbonAbatedKgCO2e, 'kg CO2e')}`)
  y = bullet(doc, y, `Water Saved: ${formatUnit(totals.waterSavedLiters, 'liters', 0)}`)
  y = bullet(doc, y, `Energy Saved: ${formatUnit(totals.energySavedKwh, 'kWh')}`)
  y = bullet(doc, y, `Landfill Averted: ${formatKg(totals.landfillAvertedKg)}`)
  y += 2

  // 3. Recycled Materials
  y = heading(doc, y, '3. Recycled Materials')
  y = paragraph(doc, y, RECYCLED_MATERIALS_DESCRIPTION)
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
  y = paragraph(doc, y, 'Table 2. Summary of Materials Recovered', { size: 7.5, color: BRAND.muted })

  // 4. Methodology
  y = heading(doc, y, '4. Methodology')
  for (const section of METHODOLOGY_SECTIONS) {
    y = subheading(doc, y, section.heading)
    y = paragraph(doc, y, section.body(toText(client.name)))
  }

  // 5. Environmental Impact
  y = heading(doc, y, '5. Environmental Impact')
  y = paragraph(doc, y, 'The recycling of the listed assets will result in the following environmental benefits:')
  y = subheading(doc, y, '5.1 Carbon Benefits:')
  y = bullet(doc, y, `${formatUnit(totals.carbonFootprintKgCO2e, 'kg CO2e')} of embodied carbon avoided through recycling.`)
  y = bullet(
    doc,
    y,
    `After accounting for ${formatUnit(totals.recycledEmissionsKgCO2e, 'CO2e')} of recycling-related emissions, the net carbon abatement achieved is ${formatUnit(totals.netCarbonAbatedKgCO2e, 'kg CO2e')}.`,
  )
  y = bullet(doc, y, `Equivalent to eliminating emissions from ${formatNumber(equivalencies.kmAvoided, 0)} km of passenger-car travel.`)
  y = subheading(doc, y, '5.2 Water Saved:')
  y = bullet(doc, y, `${formatUnit(totals.waterSavedLiters, 'liters', 0)} of fresh water saved.`)
  y = bullet(doc, y, `Equivalent to ${formatNumber(equivalencies.olympicPools, 1)} Olympic-sized swimming pools (1 pool ~ 2.5M liters).`)
  y = subheading(doc, y, '5.3 Energy Saved:')
  y = bullet(doc, y, `${formatUnit(totals.energySavedKwh, 'kWh')} of energy conserved.`)
  y = bullet(doc, y, `Equivalent to powering ${formatNumber(equivalencies.householdYears, 1)} average Philippine household-years (~ 9,000 kWh).`)
  y = subheading(doc, y, '5.4 Waste Diversion:')
  y = bullet(doc, y, `${formatKg(totals.landfillAvertedKg)} of electronic waste diverted from landfill.`)
  y = bullet(doc, y, `Equivalent to ${formatNumber(equivalencies.carWeights, 1)} of an average car's weight (~ 3,000 kg).`)
  y += 2

  // 6. Conclusion
  y = heading(doc, y, '6. Conclusion')
  for (const p of CONCLUSION_PARAGRAPHS) y = paragraph(doc, y, p)

  // Sign-off, with role labels above each name (Prepared by: / Reviewed by: / Approved by:)
  y = ensureSpace(doc, y, 30)
  y += 6
  const roleLabels = ['Prepared by:', 'Reviewed by:', 'Approved by:']
  const colWidth = (pageWidth - MARGIN * 2) / SIGNATORIES.length
  SIGNATORIES.forEach((sig, i) => {
    const x = MARGIN + colWidth * i
    doc.setTextColor(...BLACK)
    doc.setFont(FONT, 'normal')
    doc.setFontSize(9)
    doc.text(roleLabels[i] || '', x, y)

    doc.setDrawColor(...BRAND.border)
    doc.setLineWidth(0.2)
    doc.line(x, y + 14, x + colWidth - 10, y + 14)
    doc.setTextColor(...BLACK)
    doc.setFont(FONT, 'bold')
    doc.setFontSize(9.5)
    doc.text(sig.name, x, y + 19)
    doc.setTextColor(...BRAND.muted)
    doc.setFont(FONT, 'normal')
    doc.setFontSize(7.5)
    doc.text(doc.splitTextToSize(sig.title, colWidth - 10), x, y + 23)
  })
  y += 34

  // Real form-code footer image + real two-row compliance strip, both extracted from the reference PDF.
  y = ensureSpace(doc, y, 40)
  if (assets?.formCode) {
    const dim = REPORT_ASSET_DIMENSIONS.formCode
    const w = 28
    doc.addImage(assets.formCode, 'PNG', MARGIN, y, w, w * (dim.height / dim.width))
    y += w * (dim.height / dim.width) + 3
  }
  if (assets?.complianceStrip) {
    const dim = REPORT_ASSET_DIMENSIONS.complianceStrip
    const stripW = pageWidth - MARGIN * 2
    const stripH = stripW * (dim.height / dim.width)
    y = ensureSpace(doc, y, stripH)
    doc.addImage(assets.complianceStrip, 'PNG', MARGIN, y, stripW, stripH)
  }
}
