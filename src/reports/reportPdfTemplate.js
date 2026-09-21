// ESG Report TEMPLATE — PDF version. Recreates the structure of the real
// "Carbon Abatement - Client Template.pdf": Client / Prepared by /
// Reporting Period header, 1. Introduction, 2. Detailed Impact Breakdown
// (asset-category table + subtotal), 3. Recycled Materials, 4. Methodology,
// 5. Environmental Impact narrative, 6. Conclusion, 3-signatory sign-off.
//
// This is intentionally the only file that knows how the PDF report is
// laid out. `generateReportPdf.js` just calls `drawReport(doc, assets, data)`.

import autoTable from 'jspdf-autotable'
import { formatKg, formatUnit, formatNumber, toText } from '../lib/format.js'
import { COMPANY, BRAND, SIGNATORIES } from '../lib/brand.js'
import { ASSET_DIMENSIONS } from '../certificate/assetDimensions.js'
import {
  introductionParagraphs,
  REFURBISH_REUSE_DESCRIPTION,
  RECYCLED_MATERIALS_DESCRIPTION,
  METHODOLOGY_SECTIONS,
  CONCLUSION_PARAGRAPHS,
  FORM_CODE,
  FORM_EFFECTIVE_DATE,
} from './methodology.js'

const MARGIN = 16

/** Advance to a new page if `needed` mm of vertical space isn't left. */
function ensureSpace(doc, y, needed) {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + needed > pageHeight - MARGIN) {
    doc.addPage()
    return MARGIN
  }
  return y
}

function heading(doc, y, text) {
  y = ensureSpace(doc, y, 14)
  doc.setTextColor(...BRAND.green)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(text, MARGIN, y)
  return y + 7
}

function subheading(doc, y, text) {
  y = ensureSpace(doc, y, 10)
  doc.setTextColor(...BRAND.ink)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.text(text, MARGIN, y)
  return y + 5.5
}

function paragraph(doc, y, text, opts = {}) {
  const pageWidth = doc.internal.pageSize.getWidth()
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
  doc.setFontSize(opts.size || 9.5)
  const lines = doc.splitTextToSize(text, pageWidth - MARGIN * 2)
  y = ensureSpace(doc, y, lines.length * 4.6 + 3)
  doc.setTextColor(...(opts.color || BRAND.ink))
  doc.text(lines, MARGIN, y)
  return y + lines.length * 4.6 + 3
}

function bullet(doc, y, text) {
  const pageWidth = doc.internal.pageSize.getWidth()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  const lines = doc.splitTextToSize(text, pageWidth - MARGIN * 2 - 5)
  y = ensureSpace(doc, y, lines.length * 4.6 + 1.5)
  doc.setTextColor(...BRAND.ink)
  doc.text('•', MARGIN, y)
  doc.text(lines, MARGIN + 5, y)
  return y + lines.length * 4.6 + 1.5
}

export function drawReportPdf(doc, assets, data) {
  const { report, client, collectionDateRange, reportIssueDateLabel, rows, totals, recycledMaterials, equivalencies } = data
  const pageWidth = doc.internal.pageSize.getWidth()

  let y = MARGIN

  // Logo + title
  if (assets?.logo) {
    const dim = ASSET_DIMENSIONS.logo
    const logoW = 36
    doc.addImage(assets.logo, 'PNG', MARGIN, y, logoW, logoW * (dim.height / dim.width))
  }
  doc.setTextColor(...BRAND.green)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(toText(report.title, 'Carbon Abatement Report'), pageWidth - MARGIN, y + 8, { align: 'right' })
  y += 20

  // Client / Prepared by / Reporting period block
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...BRAND.ink)
  doc.text('Client:', MARGIN, y)
  doc.setFont('helvetica', 'normal')
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
  doc.setFont('helvetica', 'bold')
  doc.text('Prepared by:', MARGIN, y)
  doc.setFont('helvetica', 'normal')
  doc.text(COMPANY.name, MARGIN + 26, y)
  y += 5
  doc.text(COMPANY.addressLine, MARGIN + 26, y)
  y += 6.5
  doc.setFont('helvetica', 'bold')
  doc.text('Reporting Period:', MARGIN, y)
  y += 5
  doc.setFont('helvetica', 'normal')
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
    margin: { left: MARGIN, right: MARGIN },
    head: [['No.', 'Item', 'Qty\n(kg)', 'Metal\n(kg)', 'Plastic\n(kg)', 'Glass\n(kg)', 'Elec.\n(kg)', 'Carbon\nFootprint', 'Recycled\nEmissions', 'Net\nAbated', 'Water\n(L)', 'Energy\n(kWh)', 'Landfill\n(kg)']],
    body: tableRows,
    theme: 'grid',
    styles: { fontSize: 6.3, textColor: BRAND.ink, cellPadding: 1.2, halign: 'right' },
    headStyles: { fillColor: [236, 253, 245], textColor: BRAND.green, fontStyle: 'bold', halign: 'center' },
    columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 1: { halign: 'left', cellWidth: 20 } },
    didParseCell: (hook) => {
      if (hook.row.index === tableRows.length - 1 && hook.section === 'body') {
        hook.cell.styles.fontStyle = 'bold'
      }
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
    margin: { left: MARGIN, right: MARGIN },
    head: [['Material', 'Quantity (kg)', 'Environmental Benefit']],
    body: recycledMaterials.map((m) => [m.material, formatNumber(m.quantityKg, 1), m.benefit]),
    theme: 'grid',
    styles: { fontSize: 8.5, textColor: BRAND.ink, cellPadding: 2 },
    headStyles: { fillColor: [236, 253, 245], textColor: BRAND.green, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' } },
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
  y = subheading(doc, y, '5.1 Carbon Benefits')
  y = bullet(doc, y, `${formatUnit(totals.carbonFootprintKgCO2e, 'kg CO2e')} of embodied carbon avoided through recycling.`)
  y = bullet(
    doc,
    y,
    `After accounting for ${formatUnit(totals.recycledEmissionsKgCO2e, 'CO2e')} of recycling-related emissions, the net carbon abatement achieved is ${formatUnit(totals.netCarbonAbatedKgCO2e, 'kg CO2e')}.`,
  )
  y = bullet(doc, y, `Equivalent to eliminating emissions from ${formatNumber(equivalencies.kmAvoided, 0)} km of passenger-car travel.`)
  y = subheading(doc, y, '5.2 Water Saved')
  y = bullet(doc, y, `${formatUnit(totals.waterSavedLiters, 'liters', 0)} of fresh water saved.`)
  y = bullet(doc, y, `Equivalent to ${formatNumber(equivalencies.olympicPools, 1)} Olympic-sized swimming pools (1 pool ~ 2.5M liters).`)
  y = subheading(doc, y, '5.3 Energy Saved')
  y = bullet(doc, y, `${formatUnit(totals.energySavedKwh, 'kWh')} of energy conserved.`)
  y = bullet(doc, y, `Equivalent to powering ${formatNumber(equivalencies.householdYears, 1)} average Philippine household-years (~ 9,000 kWh).`)
  y = subheading(doc, y, '5.4 Waste Diversion')
  y = bullet(doc, y, `${formatKg(totals.landfillAvertedKg)} of electronic waste diverted from landfill.`)
  y = bullet(doc, y, `Equivalent to ${formatNumber(equivalencies.carWeights, 1)} of an average car's weight (~ 3,000 kg).`)
  y += 2

  // 6. Conclusion
  y = heading(doc, y, '6. Conclusion')
  for (const p of CONCLUSION_PARAGRAPHS) y = paragraph(doc, y, p)

  // Sign-off
  y = ensureSpace(doc, y, 26)
  y += 6
  const colWidth = (pageWidth - MARGIN * 2) / SIGNATORIES.length
  SIGNATORIES.forEach((sig, i) => {
    const x = MARGIN + colWidth * i
    doc.setDrawColor(...BRAND.border)
    doc.setLineWidth(0.2)
    doc.line(x, y, x + colWidth - 10, y)
    doc.setTextColor(...BRAND.navy)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.text(sig.name, x, y + 5)
    doc.setTextColor(...BRAND.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(doc.splitTextToSize(sig.title, colWidth - 10), x, y + 9)
  })
  y += 20

  // Compliance strip + form code footer
  if (assets?.complianceStrip) {
    y = ensureSpace(doc, y, 14)
    const dim = ASSET_DIMENSIONS.complianceStrip
    const stripW = 140
    doc.addImage(assets.complianceStrip, 'PNG', MARGIN, y, stripW, stripW * (dim.height / dim.width))
    y += stripW * (dim.height / dim.width) + 4
  }
  y = ensureSpace(doc, y, 6)
  doc.setTextColor(...BRAND.muted)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(`${FORM_CODE} | ${FORM_EFFECTIVE_DATE}`, MARGIN, y)
}
