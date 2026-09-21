// ESG Report TEMPLATE (document design layer).
//
// This is intentionally the only file that knows how the .docx report is
// laid out. `generateReportDocx.js` just calls `buildReportDocument(data)`.
// When the official Word template (esg-report-template.docx) is supplied,
// replace the contents of this file — reportData.js / reportAggregator.js
// should not need to change.

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
} from 'docx'
import { formatKg, formatUnit, formatNumber, formatDate, toText } from '../lib/format.js'

const ACCENT = '166534' // deep green, matches certificate
const MUTED = '6B7280'

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text, color: ACCENT, bold: true })],
  })
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, ...opts })],
  })
}

function muted(text) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, color: MUTED, size: 20 })],
  })
}

const CELL_MARGIN = { top: 80, bottom: 80, left: 100, right: 100 }

function headerCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: { fill: 'ECFDF5' },
    margins: CELL_MARGIN,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: ACCENT, size: 18 })] })],
  })
}

function cell(text, width, opts = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    margins: CELL_MARGIN,
    children: [
      new Paragraph({
        alignment: opts.align,
        children: [new TextRun({ text, size: 18 })],
      }),
    ],
  })
}

function table(headers, rows) {
  const widths = headers.map((h) => h.width)
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headers.map((h, i) => headerCell(h.label, widths[i])) }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: r.map((val, i) => cell(val, widths[i], { align: headers[i].align })),
          }),
      ),
    ],
  })
}

function metricRows(summary) {
  return [
    ['Carbon Abated', formatNumber(summary.carbonAbatedKgCO2e), 'kg CO2e'],
    ['Water Saved', formatNumber(summary.waterSavedLiters, 0), 'L'],
    ['Energy Saved', formatNumber(summary.energySavedKwh), 'kWh'],
    ['Landfill Averted', formatNumber(summary.landfillAvertedKg), 'kg'],
  ]
}

export function buildReportDocument(data) {
  const { report, organization, summary, carbon, materials, transactions, methodology } = data

  const sections = []

  // 1. COVER
  sections.push(
    new Paragraph({ spacing: { before: 400, after: 80 }, children: [new TextRun({ text: 'ENVIRONMENTAL, SOCIAL & GOVERNANCE', color: MUTED, size: 20 })] }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: toText(report.title, 'Environmental Impact Report'), bold: true, color: ACCENT, size: 44 })],
    }),
    body(`Reporting Period: ${formatDate(report.periodStart)} – ${formatDate(report.periodEnd)}`, { bold: true }),
    muted(`Generated: ${formatDate(report.generatedAt)}`),
    ...(toText(organization, '') !== '—' ? [muted(`Organization: ${toText(organization)}`)] : []),
    muted(`Report ID: ${toText(report.id)}`),
  )

  // 2. EXECUTIVE SUMMARY
  sections.push(
    heading('Executive Summary'),
    body(
      `Over the reporting period, ${formatNumber(summary.transactionCount, 0)} transaction(s) processed a total of ${formatKg(
        summary.totalNetWeightKg,
      )} of material, abating ${formatUnit(summary.carbonAbatedKgCO2e, 'kg CO2e')} of carbon emissions.`,
    ),
    table(
      [
        { label: 'Metric', width: 60 },
        { label: 'Result', width: 40, align: AlignmentType.RIGHT },
      ],
      [
        ['Transactions', formatNumber(summary.transactionCount, 0)],
        ['Total Net Weight', formatKg(summary.totalNetWeightKg)],
        ['Carbon Abated', formatUnit(summary.carbonAbatedKgCO2e, 'kg CO2e')],
        ['Water Saved', formatUnit(summary.waterSavedLiters, 'L', 0)],
        ['Energy Saved', formatUnit(summary.energySavedKwh, 'kWh')],
        ['Landfill Averted', formatKg(summary.landfillAvertedKg)],
      ],
    ),
  )

  // 3. ENVIRONMENTAL IMPACT SUMMARY
  sections.push(
    heading('Environmental Impact Summary'),
    table(
      [
        { label: 'Metric', width: 40 },
        { label: 'Result', width: 30, align: AlignmentType.RIGHT },
        { label: 'Unit', width: 30 },
      ],
      metricRows(summary),
    ),
  )

  // 4. MATERIAL BREAKDOWN
  sections.push(heading('Material Breakdown'))
  if (materials.length) {
    sections.push(
      table(
        [
          { label: 'Material', width: 40 },
          { label: 'Weight', width: 30, align: AlignmentType.RIGHT },
          { label: 'Percentage', width: 30, align: AlignmentType.RIGHT },
        ],
        materials.map((m) => [m.material, formatKg(m.weightKg), `${formatNumber(m.percentage, 1)}%`]),
      ),
    )
  } else {
    sections.push(muted('No material breakdown was provided for this report.'))
  }

  // 5. CARBON IMPACT
  sections.push(
    heading('Carbon Impact'),
    table(
      [
        { label: 'Component', width: 60 },
        { label: 'Value', width: 40, align: AlignmentType.RIGHT },
      ],
      [
        ['Primary Material Carbon Footprint', formatUnit(carbon.primaryMaterialEmissionsKgCO2e, 'kg CO2e')],
        ['Recycling Emissions', formatUnit(carbon.recyclingEmissionsKgCO2e, 'kg CO2e')],
        ['Net Carbon Abated', formatUnit(carbon.netCarbonAbatedKgCO2e, 'kg CO2e')],
      ],
    ),
  )

  // 6. TRANSACTION DETAILS
  sections.push(heading('Transaction Details'))
  if (transactions.length) {
    sections.push(
      table(
        [
          { label: 'Date', width: 12 },
          { label: 'Reference', width: 14 },
          { label: 'Item', width: 24 },
          { label: 'Qty', width: 8, align: AlignmentType.RIGHT },
          { label: 'Net Wt (kg)', width: 10, align: AlignmentType.RIGHT },
          { label: 'Carbon (kgCO2e)', width: 10, align: AlignmentType.RIGHT },
          { label: 'Water (L)', width: 11, align: AlignmentType.RIGHT },
          { label: 'Energy (kWh)', width: 11, align: AlignmentType.RIGHT },
        ],
        transactions.map((t) => [
          formatDate(t.date),
          t.reference,
          t.description,
          formatNumber(t.quantity, 0),
          formatNumber(t.netWeightKg),
          formatNumber(t.carbonAbatedKgCO2e),
          formatNumber(t.waterSavedLiters, 0),
          formatNumber(t.energySavedKwh),
        ]),
      ),
    )
  } else {
    sections.push(muted('No transactions were provided for this report.'))
  }

  // 7. METHODOLOGY
  sections.push(
    heading('Methodology'),
    body(`Methodology version: ${toText(methodology.version)}`, { bold: true }),
    body(`Source: ${toText(methodology.source)}`),
    ...methodology.assumptions.map((a) => body(`•  ${a}`)),
  )

  // 8. GENERATED DOCUMENT INFORMATION
  sections.push(
    heading('Generated Document Information'),
    muted(`Generated date: ${formatDate(report.generatedAt)}`),
    muted(`Factor / methodology version: ${toText(methodology.version)}`),
    muted(`Report / template version: ${toText(report.templateVersion)}`),
  )

  return new Document({
    sections: [{ properties: {}, children: sections }],
  })
}
