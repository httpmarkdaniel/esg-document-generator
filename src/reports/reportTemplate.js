// ESG Report TEMPLATE (document design layer) — recreates the structure of
// the real "Carbon Abatement - Client Template.pdf": Client / Prepared by /
// Reporting Period header, 1. Introduction, 2. Detailed Impact Breakdown
// (asset-category table + subtotal), 3. Recycled Materials, 4. Methodology,
// 5. Environmental Impact narrative, 6. Conclusion, and a 3-signatory
// sign-off block.
//
// This is intentionally the only file that knows how the .docx report is
// laid out. `generateReportDocx.js` just calls `buildReportDocument(data)`.
// When the official Word template (esg-report-template.docx) is supplied,
// replace the contents of this file — reportData.js / reportAggregator.js
// should not need to change.

import { Document, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx'
import { formatKg, formatUnit, formatNumber, toText } from '../lib/format.js'
import { COMPANY, SIGNATORIES } from '../lib/brand.js'
import {
  introductionParagraphs,
  REFURBISH_REUSE_DESCRIPTION,
  RECYCLED_MATERIALS_DESCRIPTION,
  METHODOLOGY_SECTIONS,
  CONCLUSION_PARAGRAPHS,
  FORM_CODE,
  FORM_EFFECTIVE_DATE,
} from './methodology.js'

const ACCENT = '166534'
const MUTED = '6B7280'

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 280, after: 140 },
    children: [new TextRun({ text, color: ACCENT, bold: true })],
  })
}

function body(text, opts = {}) {
  return new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text, ...opts })] })
}

function bullet(text) {
  return new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `○   ${text}` })] })
}

const CELL_MARGIN = { top: 40, bottom: 40, left: 60, right: 60 }

function headerCell(text, width, size = 14) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: { fill: 'ECFDF5' },
    margins: CELL_MARGIN,
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, color: ACCENT, size })] })],
  })
}

function cell(text, width, opts = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    margins: CELL_MARGIN,
    shading: opts.fill ? { fill: opts.fill } : undefined,
    children: [
      new Paragraph({
        alignment: opts.align,
        children: [new TextRun({ text, size: opts.size ?? 14, bold: opts.bold })],
      }),
    ],
  })
}

function table(headers, rows, { fontSize } = {}) {
  const widths = headers.map((h) => h.width)
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headers.map((h, i) => headerCell(h.label, widths[i], fontSize)) }),
      ...rows.map(
        (r, ri) =>
          new TableRow({
            children: r.map((val, i) =>
              cell(val, widths[i], { align: headers[i].align, size: fontSize, bold: ri === rows.length - 1 && rows.__totalRow }),
            ),
          }),
      ),
    ],
  })
}

export function buildReportDocument(data) {
  const { report, client, collectionDateRange, reportIssueDateLabel, rows, totals, recycledMaterials, equivalencies } = data

  const children = []

  // Header block: Client / Prepared by / Reporting Period
  children.push(
    new Paragraph({
      spacing: { before: 120, after: 240 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: toText(report.title, 'Carbon Abatement Report'), bold: true, size: 36 })],
    }),
    body('Client:', { bold: true }),
    body(toText(client.name)),
    ...(client.addressLine1 !== '—' ? [body(client.addressLine1)] : []),
    ...(client.addressLine2 !== '—' ? [body(client.addressLine2)] : []),
    ...(client.cityStateZipCountry !== '—' ? [body(client.cityStateZipCountry)] : []),
    new Paragraph({ spacing: { before: 120, after: 0 }, children: [new TextRun({ text: 'Prepared by:', bold: true })] }),
    body(COMPANY.name),
    body(COMPANY.addressLine),
    new Paragraph({ spacing: { before: 120, after: 0 }, children: [new TextRun({ text: 'Reporting Period:', bold: true })] }),
    body(`Items collected: ${toText(collectionDateRange, '—')}`),
    body(`Report issued: ${reportIssueDateLabel}`),
  )

  // 1. Introduction
  children.push(heading('1. Introduction'))
  introductionParagraphs(toText(client.name)).forEach((p) => children.push(body(p)))

  // 2. Detailed Impact Breakdown
  children.push(heading('2. Detailed Impact Breakdown'), heading('2.1 Refurbish/Re-use of Materials', HeadingLevel.HEADING_2), body(REFURBISH_REUSE_DESCRIPTION))

  const tableHeaders = [
    { label: 'No.', width: 4 },
    { label: 'Item', width: 12 },
    { label: 'Qty\n(kg)', width: 6, align: AlignmentType.RIGHT },
    { label: 'Metal\n(kg)', width: 6, align: AlignmentType.RIGHT },
    { label: 'Plastic\n(kg)', width: 6, align: AlignmentType.RIGHT },
    { label: 'Glass\n(kg)', width: 6, align: AlignmentType.RIGHT },
    { label: 'Electronics\n(kg)', width: 7, align: AlignmentType.RIGHT },
    { label: 'Carbon\nFootprint\n(kg CO2e)', width: 9, align: AlignmentType.RIGHT },
    { label: 'Recycled\nEmissions\n(kg CO2e)', width: 9, align: AlignmentType.RIGHT },
    { label: 'Net Carbon\nAbated\n(kg CO2e)', width: 9, align: AlignmentType.RIGHT },
    { label: 'Water\nSaved (L)', width: 8, align: AlignmentType.RIGHT },
    { label: 'Energy\nSaved (kWh)', width: 9, align: AlignmentType.RIGHT },
    { label: 'Landfill\nAverted (kg)', width: 9, align: AlignmentType.RIGHT },
  ]
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
  tableRows.__totalRow = true
  children.push(table(tableHeaders, tableRows, { fontSize: 12 }))
  children.push(body('Table 1. Summary of Detailed Impact Breakdown for Refurbish/Re-use of Materials', { color: MUTED, size: 14, italics: true }))

  // 2.2 Subtotal
  children.push(
    heading('2.2 Subtotal Impact for Refurbished Equipment', HeadingLevel.HEADING_2),
    bullet(`Total Material Processed: ${formatKg(totals.materialsTotalKg)}`),
    bullet(`Total Carbon Footprint: ${formatUnit(totals.carbonFootprintKgCO2e, 'kg CO2e')}`),
    bullet(`Recycled Emissions: ${formatUnit(totals.recycledEmissionsKgCO2e, 'kg CO2e')}`),
    bullet(`Net Carbon Abated: ${formatUnit(totals.netCarbonAbatedKgCO2e, 'kg CO2e')}`),
    bullet(`Water Saved: ${formatUnit(totals.waterSavedLiters, 'liters', 0)}`),
    bullet(`Energy Saved: ${formatUnit(totals.energySavedKwh, 'kWh')}`),
    bullet(`Landfill Averted: ${formatKg(totals.landfillAvertedKg)}`),
  )

  // 3. Recycled Materials
  children.push(heading('3. Recycled Materials'), body(RECYCLED_MATERIALS_DESCRIPTION))
  children.push(
    table(
      [
        { label: 'Material', width: 20 },
        { label: 'Quantity (kg)', width: 20, align: AlignmentType.RIGHT },
        { label: 'Environmental Benefit', width: 60 },
      ],
      recycledMaterials.map((m) => [m.material, formatNumber(m.quantityKg, 1), m.benefit]),
      { fontSize: 16 },
    ),
  )
  children.push(body('Table 2. Summary of Materials Recovered', { color: MUTED, size: 14, italics: true }))

  // 4. Methodology
  children.push(heading('4. Methodology'))
  METHODOLOGY_SECTIONS.forEach((section) => {
    children.push(
      new Paragraph({ spacing: { before: 100, after: 40 }, children: [new TextRun({ text: section.heading, bold: true })] }),
      body(section.body(toText(client.name))),
    )
  })

  // 5. Environmental Impact
  children.push(
    heading('5. Environmental Impact'),
    body('The recycling of the listed assets will result in the following environmental benefits:'),
    new Paragraph({ spacing: { before: 100, after: 40 }, children: [new TextRun({ text: '5.1 Carbon Benefits', bold: true })] }),
    bullet(`${formatUnit(totals.carbonFootprintKgCO2e, 'kg CO2e')} of embodied carbon avoided through recycling.`),
    bullet(
      `After accounting for ${formatUnit(totals.recycledEmissionsKgCO2e, 'CO2e')} of recycling-related emissions, the net carbon abatement achieved is ${formatUnit(totals.netCarbonAbatedKgCO2e, 'kg CO2e')}.`,
    ),
    bullet(`Equivalent to eliminating emissions from ${formatNumber(equivalencies.kmAvoided, 0)} km of passenger-car travel.`),
    new Paragraph({ spacing: { before: 100, after: 40 }, children: [new TextRun({ text: '5.2 Water Saved', bold: true })] }),
    bullet(`${formatUnit(totals.waterSavedLiters, 'liters', 0)} of fresh water saved.`),
    bullet(`Equivalent to ${formatNumber(equivalencies.olympicPools, 1)} Olympic-sized swimming pools (1 pool ≈ 2.5M liters).`),
    new Paragraph({ spacing: { before: 100, after: 40 }, children: [new TextRun({ text: '5.3 Energy Saved', bold: true })] }),
    bullet(`${formatUnit(totals.energySavedKwh, 'kWh')} of energy conserved.`),
    bullet(`Equivalent to powering ${formatNumber(equivalencies.householdYears, 1)} average Philippine household-years (≈ 9,000 kWh).`),
    new Paragraph({ spacing: { before: 100, after: 40 }, children: [new TextRun({ text: '5.4 Waste Diversion', bold: true })] }),
    bullet(`${formatKg(totals.landfillAvertedKg)} of electronic waste diverted from landfill.`),
    bullet(`Equivalent to ${formatNumber(equivalencies.carWeights, 1)} of an average car's weight (≈ 3,000 kg).`),
  )

  // 6. Conclusion
  children.push(heading('6. Conclusion'))
  CONCLUSION_PARAGRAPHS.forEach((p) => children.push(body(p)))

  // Sign-off
  children.push(
    new Paragraph({ spacing: { before: 320 }, children: [] }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: SIGNATORIES.map((sig, i) => headerCellLabel(i === 0 ? 'Prepared by:' : i === 1 ? 'Reviewed by:' : 'Approved by:')),
        }),
        new TableRow({
          children: SIGNATORIES.map((sig) =>
            new TableCell({
              width: { size: 100 / SIGNATORIES.length, type: WidthType.PERCENTAGE },
              margins: CELL_MARGIN,
              children: [
                new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: sig.name, bold: true })] }),
                new Paragraph({ children: [new TextRun({ text: sig.title, size: 14, color: MUTED })] }),
              ],
            }),
          ),
        }),
      ],
    }),
    new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: `${FORM_CODE} | ${FORM_EFFECTIVE_DATE}`, size: 12, color: MUTED })] }),
  )

  return new Document({ sections: [{ properties: {}, children }] })
}

function headerCellLabel(text) {
  return new TableCell({
    width: { size: 100 / SIGNATORIES.length, type: WidthType.PERCENTAGE },
    margins: CELL_MARGIN,
    children: [new Paragraph({ children: [new TextRun({ text, size: 14, color: MUTED })] })],
  })
}
