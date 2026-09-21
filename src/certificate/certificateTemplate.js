// Certificate TEMPLATE (visual design layer) — recreates the layout of the
// real "Template ESG Certificates.pdf" (navy/lime diagonal header, deep
// green stat numbers, 3 fixed signatories, compliance footer).
//
// This is intentionally the only file that knows how a certificate looks.
// `generateCertificatePdf.js` just calls `drawCertificate(doc, data)`.
// When the official (pixel-exact) design assets are supplied — logo image,
// exact brand colors, compliance-logo artwork — replace the contents of
// this file. The data model (certificateData.js) should not need to change.

import autoTable from 'jspdf-autotable'
import { formatKg, formatNumber, toText } from '../lib/format.js'
import { COMPANY, BRAND, SIGNATORIES, CERTIFICATE_TYPES, CERTIFICATE_DISCLAIMER, MATERIAL_BENEFIT_TEXT } from '../lib/brand.js'

const MARGIN = 14
const HEADER_HEIGHT = 34

function withAlpha(doc, alpha, fn) {
  doc.saveGraphicsState()
  doc.setGState(new doc.GState({ opacity: alpha }))
  fn()
  doc.restoreGraphicsState()
}

/** Navy/lime diagonal header band shared by all certificate types. */
function drawHeader(doc, { certificateNumber, title }) {
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFillColor(...BRAND.navy)
  doc.triangle(0, 0, pageWidth, 0, 0, HEADER_HEIGHT - 14, 'F')
  doc.setFillColor(...BRAND.lime)
  doc.triangle(0, HEADER_HEIGHT - 14, pageWidth, 0, pageWidth, HEADER_HEIGHT, 'F')

  // Logo mark (temporary — swap for the real logo image asset later)
  doc.setFillColor(255, 255, 255)
  doc.circle(MARGIN + 4, 11, 4.2, 'F')
  doc.setDrawColor(...BRAND.navy)
  doc.setLineWidth(0.6)
  doc.circle(MARGIN + 4, 11, 2.3, 'S')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('ENVIRCYCLE', MARGIN + 10, 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...BRAND.navy)
  doc.text(`Certificate No. ${toText(certificateNumber)}`, pageWidth - MARGIN, 12, { align: 'right' })

  let y = HEADER_HEIGHT + 14
  doc.setTextColor(...BRAND.green)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.text(title, pageWidth / 2, y, { align: 'center' })

  y += 9
  doc.setTextColor(...BRAND.ink)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text('IS ISSUED TO :', pageWidth / 2, y, { align: 'center' })

  return y
}

/** Recipient name / address / reporting-period block, shared by all types. */
function drawRecipientBlock(doc, data, y) {
  const pageWidth = doc.internal.pageSize.getWidth()
  let cursorY = y + 11

  doc.setTextColor(...BRAND.navy)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(toText(data.recipient), pageWidth / 2, cursorY, { align: 'center' })

  if (toText(data.companyAddress, '') !== '—') {
    cursorY += 6
    doc.setTextColor(...BRAND.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(toText(data.companyAddress), pageWidth / 2, cursorY, { align: 'center' })
  }

  cursorY += 7
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(10)
  doc.setTextColor(...BRAND.ink)
  doc.text(`Reporting Period: ${data.reportingPeriodLabel}`, pageWidth / 2, cursorY, { align: 'center' })

  return cursorY + 8
}

/** Given-date line, signature row, disclaimer, and bottom accent bar. Shared by all types. */
function drawFooter(doc, data) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  let y = pageHeight - 58
  doc.setTextColor(...BRAND.ink)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text(`Given this day, ${data.givenDateLabel}, at ${COMPANY.name}`, pageWidth / 2, y, { align: 'center' })
  y += 4.5
  doc.setTextColor(...BRAND.muted)
  doc.text(COMPANY.addressLine, pageWidth / 2, y, { align: 'center' })

  // Signature row
  y = pageHeight - 42
  const colWidth = (pageWidth - MARGIN * 2) / SIGNATORIES.length
  SIGNATORIES.forEach((sig, i) => {
    const cx = MARGIN + colWidth * i + colWidth / 2
    doc.setDrawColor(...BRAND.border)
    doc.setLineWidth(0.2)
    doc.line(cx - 28, y - 5, cx + 28, y - 5)
    doc.setTextColor(...BRAND.navy)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(sig.name, cx, y, { align: 'center' })
    doc.setTextColor(...BRAND.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(sig.title, cx, y + 4, { align: 'center' })
  })

  // Disclaimer
  y = pageHeight - 26
  doc.setTextColor(...BRAND.muted)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.8)
  const disclaimer = CERTIFICATE_DISCLAIMER[data.certificateType] || CERTIFICATE_DISCLAIMER.EIC
  const lines = doc.splitTextToSize(disclaimer, pageWidth - MARGIN * 2)
  doc.text(lines, pageWidth / 2, y, { align: 'center' })

  // Bottom accent bar
  doc.setFillColor(...BRAND.lime)
  doc.rect(0, pageHeight - 6, pageWidth, 6, 'F')
}

const STAT_TILE_LABEL_SIZE = 9
const STAT_TILE_LABEL_LINE_HEIGHT = 4

/** How many lines `label` will wrap to inside a tile of width `w`. */
function statTileLabelLineCount(doc, label, w) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(STAT_TILE_LABEL_SIZE)
  return doc.splitTextToSize(label, Math.max(w - 15, 20)).length
}

/**
 * A single rounded stat tile: circle marker + label + big green number.
 * `labelLines` is the line count to reserve for the label (pass the max
 * across a row of tiles so every tile's value lands on the same baseline).
 */
function drawStatTile(doc, x, y, w, label, value, labelLines = 1) {
  const textX = x + 15
  const textW = Math.max(w - 15, 20)

  doc.setFillColor(...BRAND.navy)
  withAlpha(doc, 0.08, () => doc.circle(x + 6, y + 4, 5, 'F'))

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(STAT_TILE_LABEL_SIZE)
  doc.setTextColor(...BRAND.ink)
  doc.text(doc.splitTextToSize(label, textW), textX, y + 2.5)

  const valueY = y + 2.5 + labelLines * STAT_TILE_LABEL_LINE_HEIGHT + 4
  doc.setTextColor(...BRAND.green)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(value, textX, valueY)
}

/** Bordered panel with a title and a row of stat tiles inside — used by EIC. */
function drawPanel(doc, x, y, w, h, title, tiles) {
  doc.setDrawColor(...BRAND.green)
  doc.setLineWidth(0.4)
  doc.roundedRect(x, y, w, h, 3, 3, 'S')

  doc.setTextColor(...BRAND.green)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text(title, x + w / 2, y - 3, { align: 'center' })

  const tileW = (w - 8) / tiles.length
  const maxLabelLines = Math.max(...tiles.map((t) => statTileLabelLineCount(doc, t.label, tileW - 2)))
  tiles.forEach((tile, i) => {
    drawStatTile(doc, x + 4 + tileW * i, y + h / 2 - 8, tileW - 2, tile.label, tile.value, maxLabelLines)
  })
}

// ---------------------------------------------------------------------------
// Environmental Impact Certificate (EIC)
// ---------------------------------------------------------------------------
function drawEnvironmentalImpactCertificate(doc, data) {
  let y = drawHeader(doc, { certificateNumber: data.certificateNumber, title: CERTIFICATE_TYPES.EIC.title })
  y = drawRecipientBlock(doc, data, y)

  const pageWidth = doc.internal.pageSize.getWidth()
  const panelY = y + 6
  const panelH = 34
  const gap = 8
  const panelW = (pageWidth - MARGIN * 2 - gap) / 2

  const resultTiles = [
    { label: 'Carbon Saved', value: `${formatNumber(data.netCarbonAbatedKgCO2e)}\nkg CO2e` },
    { label: 'Landfill Diverted', value: `${formatNumber(data.landfillDivertedKg)}\nkg` },
    { label: 'Plastic Recycled', value: `${formatNumber(data.plasticRecycledKg)}\nkg` },
  ]
  drawPanel(doc, MARGIN, panelY, panelW, panelH, 'ENVIRONMENTAL IMPACT RESULTS', resultTiles)

  const savingsTiles = [
    data.treesSaved > 0 && { label: 'Trees Saved', value: `${formatNumber(data.treesSaved, 0)}\nTrees` },
    data.waterSavedLiters > 0 && { label: 'Water Saved', value: `${formatNumber(data.waterSavedLiters, 0)}\nL` },
    data.energySavedKwh > 0 && { label: 'Energy Saved', value: `${formatNumber(data.energySavedKwh)}\nkWh` },
  ].filter(Boolean)
  if (savingsTiles.length) {
    drawPanel(doc, MARGIN + panelW + gap, panelY, panelW, panelH, 'ENVIRONMENTAL SAVINGS', savingsTiles)
  }

  drawFooter(doc, data)
}

// ---------------------------------------------------------------------------
// Carbon Abatement Certificate (CAC)
// ---------------------------------------------------------------------------
function drawCarbonAbatementCertificate(doc, data) {
  let y = drawHeader(doc, { certificateNumber: data.certificateNumber, title: CERTIFICATE_TYPES.CAC.title })
  y = drawRecipientBlock(doc, data, y)

  doc.setTextColor(...BRAND.muted)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8.5)
  doc.text('Basis: Net carbon abated = avoided virgin production emissions - recycled processing emissions', doc.internal.pageSize.getWidth() / 2, y, {
    align: 'center',
  })
  y += 8

  const pageWidth = doc.internal.pageSize.getWidth()
  const tiles = [
    { label: 'Materials Collected', value: `${formatNumber(data.materialsCollectedKg)}\nKG` },
    { label: 'Total Carbon Footprint', value: `${formatNumber(data.totalCarbonFootprintKgCO2e)}\nkg CO2e` },
    { label: 'Net Carbon Abated', value: `${formatNumber(data.netCarbonAbatedKgCO2e / 1000)}\ntCO2e` },
    { label: 'Recycled Emissions', value: `${formatNumber(data.recycledEmissionsKgCO2e)}\nkg CO2e` },
    { label: 'Carbon Benefits Equivalent', value: `~${formatNumber(data.kmAvoided, 0)} km\navoided` },
  ]
  const cols = 3
  const tileW = (pageWidth - MARGIN * 2) / cols
  const maxLabelLines = Math.max(...tiles.map((t) => statTileLabelLineCount(doc, t.label, tileW - 6)))
  tiles.forEach((tile, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    drawStatTile(doc, MARGIN + tileW * col, y + row * 20, tileW - 6, tile.label, tile.value, maxLabelLines)
  })

  drawFooter(doc, data)
}

// ---------------------------------------------------------------------------
// Landfill Diverted Certificate (LDC)
// ---------------------------------------------------------------------------
function drawLandfillDivertedCertificate(doc, data) {
  let y = drawHeader(doc, { certificateNumber: data.certificateNumber, title: CERTIFICATE_TYPES.LDC.title })
  y = drawRecipientBlock(doc, data, y)

  const pageWidth = doc.internal.pageSize.getWidth()
  const leftW = (pageWidth - MARGIN * 2) * 0.4
  const rightX = MARGIN + leftW + 8

  doc.setTextColor(...BRAND.green)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text('MATERIAL DIVERSION SUMMARY', MARGIN, y)
  doc.text('RECYCLED MATERIALS SUMMARY', rightX, y)
  y += 6

  drawStatTile(doc, MARGIN, y, leftW, 'Materials Collected', `${formatNumber(data.materialsCollectedKg)} KG`)
  drawStatTile(doc, MARGIN, y + 16, leftW, 'Landfill Diverted', `${formatNumber(data.landfillDivertedKg)} KG`)

  const rows = ['Metal', 'Plastic', 'Glass', 'Electronics']
    .map((label) => {
      const key = `${label.toLowerCase()}Kg`
      const weight = data.materials[key]
      if (weight <= 0) return null
      const pct = data.materialsTotalKg > 0 ? (weight / data.materialsTotalKg) * 100 : 0
      return [label, `${formatKg(weight)} (${formatNumber(pct, 1)}%)`, MATERIAL_BENEFIT_TEXT[label]]
    })
    .filter(Boolean)

  if (rows.length) {
    autoTable(doc, {
      startY: y,
      margin: { left: rightX, right: MARGIN },
      tableWidth: pageWidth - MARGIN - rightX,
      body: rows,
      theme: 'grid',
      styles: { fontSize: 8, textColor: BRAND.ink, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 22 }, 1: { fontStyle: 'bold', textColor: BRAND.green, cellWidth: 30 } },
    })
  }

  drawFooter(doc, data)
}

// ---------------------------------------------------------------------------
// Recycled Plastics Certificate (RPC)
// ---------------------------------------------------------------------------
function drawRecycledPlasticsCertificate(doc, data) {
  let y = drawHeader(doc, { certificateNumber: data.certificateNumber, title: CERTIFICATE_TYPES.RPC.title })
  y = drawRecipientBlock(doc, data, y)

  const pageWidth = doc.internal.pageSize.getWidth()
  const tiles = [
    { label: 'Total Received Volume', value: `${formatNumber(data.totalReceivedVolumeKg)}\nKG` },
    { label: 'Plastic Waste', value: `${formatNumber(data.plasticWasteKg)}\nKG` },
    { label: 'Rigid Plastic', value: `${formatNumber(data.rigidPlasticKg)}\nKG` },
    { label: 'Flexible Plastic', value: `${formatNumber(data.flexiblePlasticKg)}\nKG` },
  ]
  const tileW = (pageWidth - MARGIN * 2) / tiles.length
  const maxLabelLines = Math.max(...tiles.map((t) => statTileLabelLineCount(doc, t.label, tileW - 6)))
  tiles.forEach((tile, i) => {
    drawStatTile(doc, MARGIN + tileW * i, y + 6, tileW - 6, tile.label, tile.value, maxLabelLines)
  })

  drawFooter(doc, data)
}

const DRAWERS = {
  EIC: drawEnvironmentalImpactCertificate,
  CAC: drawCarbonAbatementCertificate,
  LDC: drawLandfillDivertedCertificate,
  RPC: drawRecycledPlasticsCertificate,
}

/** Entry point used by generateCertificatePdf.js. Dispatches by data.certificateType. */
export function drawCertificate(doc, data) {
  const drawer = DRAWERS[data.certificateType] || DRAWERS.EIC
  drawer(doc, data)
}
