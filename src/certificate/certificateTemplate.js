// Certificate TEMPLATE (visual design layer) — recreates the layout of the
// real "Template ESG Certificates.pdf" (navy/lime diagonal header, deep
// green stat numbers, 3 fixed signatories, compliance footer), using the
// REAL brand assets extracted from that PDF (logo, compliance-logo strip,
// tree/energy/recycle icons — see assets.js).
//
// This is intentionally the only file that knows how a certificate looks.
// `generateCertificatePdf.js` just calls `drawCertificate(doc, data, assets)`.
// The data model (certificateData.js) should not need to change when this
// file does.

import autoTable from 'jspdf-autotable'
import { formatKg, formatNumber, toText } from '../lib/format.js'
import { COMPANY, BRAND, SIGNATORIES, CERTIFICATE_TYPES, CERTIFICATE_DISCLAIMER, MATERIAL_BENEFIT_TEXT } from '../lib/brand.js'
import { ASSET_DIMENSIONS } from './assetDimensions.js'

const MARGIN = 14
const HEADER_HEIGHT = 34

function withAlpha(doc, alpha, fn) {
  doc.saveGraphicsState()
  doc.setGState(new doc.GState({ opacity: alpha }))
  fn()
  doc.restoreGraphicsState()
}

/** Draw an asset image at a given width (mm), preserving its real aspect ratio. */
function drawAsset(doc, assets, key, x, y, targetWidth, align = 'left') {
  const image = assets?.[key]
  if (!image) return 0
  const dim = ASSET_DIMENSIONS[key]
  const h = targetWidth * (dim.height / dim.width)
  const drawX = align === 'center' ? x - targetWidth / 2 : x
  doc.addImage(image, 'PNG', drawX, y, targetWidth, h)
  return h
}

/** Navy/lime diagonal header band shared by all certificate types. */
function drawHeader(doc, assets, { certificateNumber, title }) {
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFillColor(...BRAND.navy)
  doc.triangle(0, 0, pageWidth, 0, 0, HEADER_HEIGHT - 14, 'F')
  doc.setFillColor(...BRAND.lime)
  doc.triangle(0, HEADER_HEIGHT - 14, pageWidth, 0, pageWidth, HEADER_HEIGHT, 'F')

  // Real EnviroCycle wordmark, extracted from the reference certificate PDF.
  drawAsset(doc, assets, 'logo', MARGIN, 6, 46)

  doc.setFont('Poppins', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...BRAND.navy)
  doc.text(`Certificate No. ${toText(certificateNumber)}`, pageWidth - MARGIN, 12, { align: 'right' })

  let y = HEADER_HEIGHT + 14
  doc.setTextColor(...BRAND.green)
  doc.setFont('Poppins', 'bold')
  doc.setFontSize(24)
  doc.text(title, pageWidth / 2, y, { align: 'center' })

  y += 9
  doc.setTextColor(...BRAND.ink)
  doc.setFont('Poppins', 'normal')
  doc.setFontSize(11)
  doc.text('IS ISSUED TO :', pageWidth / 2, y, { align: 'center' })

  return y
}

/** Recipient name / address / reporting-period block, shared by all types. */
function drawRecipientBlock(doc, data, y) {
  const pageWidth = doc.internal.pageSize.getWidth()
  let cursorY = y + 11

  doc.setTextColor(...BRAND.navy)
  doc.setFont('Poppins', 'bold')
  doc.setFontSize(18)
  doc.text(toText(data.recipient), pageWidth / 2, cursorY, { align: 'center' })

  if (toText(data.companyAddress, '') !== '—') {
    cursorY += 6
    doc.setTextColor(...BRAND.muted)
    doc.setFont('Poppins', 'normal')
    doc.setFontSize(10)
    doc.text(toText(data.companyAddress), pageWidth / 2, cursorY, { align: 'center' })
  }

  cursorY += 7
  doc.setFont('Poppins', 'italic')
  doc.setFontSize(10)
  doc.setTextColor(...BRAND.ink)
  doc.text(`Reporting Period: ${data.reportingPeriodLabel}`, pageWidth / 2, cursorY, { align: 'center' })

  return cursorY + 8
}

/** Given-date line, signature row, disclaimer, compliance-logo strip, and bottom accent bar. Shared by all types. */
function drawFooter(doc, assets, data) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  let y = pageHeight - 68
  doc.setTextColor(...BRAND.ink)
  doc.setFont('Poppins', 'normal')
  doc.setFontSize(9.5)
  doc.text(`Given this day, ${data.givenDateLabel}, at ${COMPANY.name}`, pageWidth / 2, y, { align: 'center' })
  y += 4.5
  doc.setTextColor(...BRAND.muted)
  doc.text(COMPANY.addressLine, pageWidth / 2, y, { align: 'center' })

  // Signature row
  y = pageHeight - 44
  const colWidth = (pageWidth - MARGIN * 2) / SIGNATORIES.length
  SIGNATORIES.forEach((sig, i) => {
    const cx = MARGIN + colWidth * i + colWidth / 2
    doc.setDrawColor(...BRAND.border)
    doc.setLineWidth(0.2)
    doc.line(cx - 28, y - 5, cx + 28, y - 5)
    doc.setTextColor(...BRAND.navy)
    doc.setFont('Poppins', 'bold')
    doc.setFontSize(10)
    doc.text(sig.name, cx, y, { align: 'center' })
    doc.setTextColor(...BRAND.muted)
    doc.setFont('Poppins', 'normal')
    doc.setFontSize(7.5)
    doc.text(sig.title, cx, y + 4, { align: 'center' })
  })

  // Disclaimer
  y = pageHeight - 28
  doc.setTextColor(...BRAND.muted)
  doc.setFont('Poppins', 'normal')
  doc.setFontSize(6.8)
  const disclaimer = CERTIFICATE_DISCLAIMER[data.certificateType] || CERTIFICATE_DISCLAIMER.EIC
  const lines = doc.splitTextToSize(disclaimer, pageWidth - MARGIN * 2)
  doc.text(lines, pageWidth / 2, y, { align: 'center' })

  // Real compliance-logo strip (ISO/BSI/FDA/UN/etc.), extracted from the reference PDF.
  drawAsset(doc, assets, 'complianceStrip', pageWidth / 2, pageHeight - 19, 160, 'center')

  // Bottom accent bar
  doc.setFillColor(...BRAND.lime)
  doc.rect(0, pageHeight - 6, pageWidth, 6, 'F')
}

const STAT_TILE_LABEL_SIZE = 9
const STAT_TILE_LABEL_LINE_HEIGHT = 4
const STAT_TILE_ICON_SIZE = 9

/** How many lines `label` will wrap to inside a tile of width `w`. */
function statTileLabelLineCount(doc, label, w) {
  doc.setFont('Poppins', 'bold')
  doc.setFontSize(STAT_TILE_LABEL_SIZE)
  return doc.splitTextToSize(label, Math.max(w - 15, 20)).length
}

/**
 * Vector approximations for the two tile icons with no raster asset
 * available (CO2 and a water drop weren't embedded as images in the
 * reference PDF — they're drawn directly with PDF vector operators there,
 * which PyMuPDF can't extract as a raster). Drawn inside the same cream
 * circular badge as the real icon assets.
 */
function drawVectorIcon(doc, shape, cx, cy) {
  if (shape === 'co2') {
    doc.setTextColor(...BRAND.green)
    doc.setFont('Poppins', 'bold')
    doc.setFontSize(6.5)
    doc.text('CO2', cx, cy + 1, { align: 'center' })
  } else if (shape === 'water') {
    doc.setFillColor(70, 150, 210)
    doc.circle(cx, cy + 0.8, 2, 'F')
    doc.triangle(cx - 1.7, cy + 0.2, cx + 1.7, cy + 0.2, cx, cy - 2.6, 'F')
  }
}

/** Cream circular badge behind every tile icon, matching the reference's icon frames. */
function drawIconBadge(doc, assets, cx, cy, iconKey, vectorShape) {
  doc.setFillColor(...BRAND.iconCream)
  doc.setDrawColor(...BRAND.green)
  doc.setLineWidth(0.25)
  doc.circle(cx, cy, 5, 'FD')

  const iconImage = iconKey && assets?.[iconKey]
  if (iconImage) {
    const dim = ASSET_DIMENSIONS[iconKey]
    const iconH = STAT_TILE_ICON_SIZE * (dim.height / dim.width)
    doc.addImage(iconImage, 'PNG', cx - STAT_TILE_ICON_SIZE / 2, cy - iconH / 2, STAT_TILE_ICON_SIZE, iconH)
  } else if (vectorShape) {
    drawVectorIcon(doc, vectorShape, cx, cy)
  }
}

/**
 * A single rounded stat tile: icon badge (real asset, a vector
 * approximation, or a plain circle) + label + big green number.
 * `labelLines` is the line count to reserve for the label (pass the max
 * across a row of tiles so every tile's value lands on the same baseline).
 */
function drawStatTile(doc, assets, x, y, w, label, value, labelLines = 1, iconKey, vectorShape) {
  const textX = x + 15
  const textW = Math.max(w - 15, 20)

  if (iconKey || vectorShape) {
    drawIconBadge(doc, assets, x + 6, y + 4, iconKey, vectorShape)
  } else {
    doc.setFillColor(...BRAND.navy)
    withAlpha(doc, 0.08, () => doc.circle(x + 6, y + 4, 5, 'F'))
  }

  doc.setFont('Poppins', 'bold')
  doc.setFontSize(STAT_TILE_LABEL_SIZE)
  doc.setTextColor(...BRAND.ink)
  doc.text(doc.splitTextToSize(label, textW), textX, y + 2.5)

  const valueY = y + 2.5 + labelLines * STAT_TILE_LABEL_LINE_HEIGHT + 4
  doc.setTextColor(...BRAND.green)
  doc.setFont('Poppins', 'bold')
  doc.setFontSize(15)
  doc.text(value, textX, valueY)
}

/** Bordered panel with a title and a row of stat tiles inside — used by EIC. */
function drawPanel(doc, assets, x, y, w, h, title, tiles) {
  doc.setDrawColor(...BRAND.green)
  doc.setLineWidth(0.4)
  doc.roundedRect(x, y, w, h, 3, 3, 'S')

  doc.setTextColor(...BRAND.green)
  doc.setFont('Poppins', 'bold')
  doc.setFontSize(9.5)
  doc.text(title, x + w / 2, y - 3, { align: 'center' })

  const tileW = (w - 8) / tiles.length
  const maxLabelLines = Math.max(...tiles.map((t) => statTileLabelLineCount(doc, t.label, tileW - 2)))
  tiles.forEach((tile, i) => {
    drawStatTile(doc, assets, x + 4 + tileW * i, y + h / 2 - 8, tileW - 2, tile.label, tile.value, maxLabelLines, tile.icon, tile.vector)
  })
}

// ---------------------------------------------------------------------------
// Environmental Impact Certificate (EIC)
// ---------------------------------------------------------------------------
function drawEnvironmentalImpactCertificate(doc, assets, data) {
  let y = drawHeader(doc, assets, { certificateNumber: data.certificateNumber, title: CERTIFICATE_TYPES.EIC.title })
  y = drawRecipientBlock(doc, data, y)

  const pageWidth = doc.internal.pageSize.getWidth()
  const panelY = y + 6
  const panelH = 34
  const gap = 8
  const panelW = (pageWidth - MARGIN * 2 - gap) / 2

  const resultTiles = [
    { label: 'Carbon Saved', value: `${formatNumber(data.netCarbonAbatedKgCO2e)}\nkg CO2e`, vector: 'co2' },
    { label: 'Landfill Diverted', value: `${formatNumber(data.landfillDivertedKg)}\nkg`, icon: 'iconRecycle' },
    { label: 'Plastic Recycled', value: `${formatNumber(data.plasticRecycledKg)}\nkg`, icon: 'iconRecycle' },
  ]
  drawPanel(doc, assets, MARGIN, panelY, panelW, panelH, 'ENVIRONMENTAL IMPACT RESULTS', resultTiles)

  const savingsTiles = [
    data.treesSaved > 0 && { label: 'Trees Saved', value: `${formatNumber(data.treesSaved, 0)}\nTrees`, icon: 'iconTree' },
    data.waterSavedLiters > 0 && { label: 'Water Saved', value: `${formatNumber(data.waterSavedLiters, 0)}\nL`, vector: 'water' },
    data.energySavedKwh > 0 && { label: 'Energy Saved', value: `${formatNumber(data.energySavedKwh)}\nkWh`, icon: 'iconEnergy' },
  ].filter(Boolean)
  if (savingsTiles.length) {
    drawPanel(doc, assets, MARGIN + panelW + gap, panelY, panelW, panelH, 'ENVIRONMENTAL SAVINGS', savingsTiles)
  }

  drawFooter(doc, assets, data)
}

// ---------------------------------------------------------------------------
// Carbon Abatement Certificate (CAC)
// ---------------------------------------------------------------------------
function drawCarbonAbatementCertificate(doc, assets, data) {
  let y = drawHeader(doc, assets, { certificateNumber: data.certificateNumber, title: CERTIFICATE_TYPES.CAC.title })
  y = drawRecipientBlock(doc, data, y)

  doc.setTextColor(...BRAND.muted)
  doc.setFont('Poppins', 'italic')
  doc.setFontSize(8.5)
  doc.text('Basis: Net carbon abated = avoided virgin production emissions - recycled processing emissions', doc.internal.pageSize.getWidth() / 2, y, {
    align: 'center',
  })
  y += 8

  const pageWidth = doc.internal.pageSize.getWidth()
  const tiles = [
    { label: 'Materials Collected', value: `${formatNumber(data.materialsCollectedKg)}\nKG`, icon: 'iconRecycle' },
    { label: 'Total Carbon Footprint', value: `${formatNumber(data.totalCarbonFootprintKgCO2e)}\nkg CO2e`, vector: 'co2' },
    { label: 'Net Carbon Abated', value: `${formatNumber(data.netCarbonAbatedKgCO2e / 1000)}\ntCO2e`, vector: 'co2' },
    { label: 'Recycled Emissions', value: `${formatNumber(data.recycledEmissionsKgCO2e)}\nkg CO2e`, vector: 'co2' },
    { label: 'Carbon Benefits Equivalent', value: `~${formatNumber(data.kmAvoided, 0)} km\navoided` },
  ]
  const cols = 3
  const tileW = (pageWidth - MARGIN * 2) / cols
  const maxLabelLines = Math.max(...tiles.map((t) => statTileLabelLineCount(doc, t.label, tileW - 6)))
  tiles.forEach((tile, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    drawStatTile(doc, assets, MARGIN + tileW * col, y + row * 20, tileW - 6, tile.label, tile.value, maxLabelLines, tile.icon, tile.vector)
  })

  drawFooter(doc, assets, data)
}

// ---------------------------------------------------------------------------
// Landfill Diverted Certificate (LDC)
// ---------------------------------------------------------------------------
function drawLandfillDivertedCertificate(doc, assets, data) {
  let y = drawHeader(doc, assets, { certificateNumber: data.certificateNumber, title: CERTIFICATE_TYPES.LDC.title })
  y = drawRecipientBlock(doc, data, y)

  const pageWidth = doc.internal.pageSize.getWidth()
  const leftW = (pageWidth - MARGIN * 2) * 0.4
  const rightX = MARGIN + leftW + 8

  doc.setTextColor(...BRAND.green)
  doc.setFont('Poppins', 'bold')
  doc.setFontSize(9.5)
  doc.text('MATERIAL DIVERSION SUMMARY', MARGIN, y)
  doc.text('RECYCLED MATERIALS SUMMARY', rightX, y)
  y += 6

  drawStatTile(doc, assets, MARGIN, y, leftW, 'Materials Collected', `${formatNumber(data.materialsCollectedKg)} KG`, 1, 'iconRecycle')
  drawStatTile(doc, assets, MARGIN, y + 16, leftW, 'Landfill Diverted', `${formatNumber(data.landfillDivertedKg)} KG`, 1, 'iconRecycle')

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

  drawFooter(doc, assets, data)
}

// ---------------------------------------------------------------------------
// Recycled Plastics Certificate (RPC)
// ---------------------------------------------------------------------------
function drawRecycledPlasticsCertificate(doc, assets, data) {
  let y = drawHeader(doc, assets, { certificateNumber: data.certificateNumber, title: CERTIFICATE_TYPES.RPC.title })
  y = drawRecipientBlock(doc, data, y)

  const pageWidth = doc.internal.pageSize.getWidth()
  const tiles = [
    { label: 'Total Received Volume', value: `${formatNumber(data.totalReceivedVolumeKg)}\nKG`, icon: 'iconRecycle' },
    { label: 'Plastic Waste', value: `${formatNumber(data.plasticWasteKg)}\nKG`, icon: 'iconRecycle' },
    { label: 'Rigid Plastic', value: `${formatNumber(data.rigidPlasticKg)}\nKG` },
    { label: 'Flexible Plastic', value: `${formatNumber(data.flexiblePlasticKg)}\nKG` },
  ]
  const tileW = (pageWidth - MARGIN * 2) / tiles.length
  const maxLabelLines = Math.max(...tiles.map((t) => statTileLabelLineCount(doc, t.label, tileW - 6)))
  tiles.forEach((tile, i) => {
    drawStatTile(doc, assets, MARGIN + tileW * i, y + 6, tileW - 6, tile.label, tile.value, maxLabelLines, tile.icon, tile.vector)
  })

  drawFooter(doc, assets, data)
}

const DRAWERS = {
  EIC: drawEnvironmentalImpactCertificate,
  CAC: drawCarbonAbatementCertificate,
  LDC: drawLandfillDivertedCertificate,
  RPC: drawRecycledPlasticsCertificate,
}

/**
 * Entry point used by generateCertificatePdf.js. Dispatches by
 * data.certificateType. `assets` is the object returned by
 * loadCertificateAssets() in assets.js.
 */
export function drawCertificate(doc, assets, data) {
  const drawer = DRAWERS[data.certificateType] || DRAWERS.EIC
  drawer(doc, assets, data)
}
