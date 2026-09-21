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
const HEADER_HEIGHT = 37

// Exact header diagonal geometry, extracted from the reference PDF's own
// vector paths (page.get_drawings() on "Template ESG Certificates.pdf",
// converted from PDF points to mm at 1pt = 0.352778mm). Each colored
// triangle sits in front of a slightly larger "shadow" triangle of the
// same shape, offset down/outward, which is what gives the diagonal its
// layered/beveled look instead of a flat two-triangle split.
const HEADER_SHADOW_COLOR = [231, 231, 231]
const HEADER_SHAPES = {
  limeShadow: [
    [23.82, 0],
    [296.75, 0],
    [296.75, 36.88],
  ],
  lime: [
    [39.28, 0],
    [296.75, 0],
    [296.75, 34.8],
  ],
  navyShadow: [
    [0.42, 0],
    [0.42, 37.05],
    [274.46, 0],
  ],
  navy: [
    [0.42, 0],
    [0.42, 34.8],
    [257.86, 0],
  ],
}
// Real logo placement from the reference PDF (page.get_image_info()), also
// converted pt -> mm: x 27.2mm, y 8.37mm, width 62.7mm, height 12.4mm.
const LOGO_X = 27.2
const LOGO_Y = 8.4
const LOGO_WIDTH = 62.7

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

function drawHeaderShape(doc, key, color) {
  const [[x1, y1], [x2, y2], [x3, y3]] = HEADER_SHAPES[key]
  doc.setFillColor(...color)
  doc.triangle(x1, y1, x2, y2, x3, y3, 'F')
}

/** Navy/lime diagonal header band shared by all certificate types, matching the reference PDF's exact vector shapes. */
function drawHeader(doc, assets, { certificateNumber, title }) {
  const pageWidth = doc.internal.pageSize.getWidth()

  // Draw order matches the reference PDF's own paint order: lime's shadow,
  // then lime, then navy's shadow, then navy (navy in front).
  drawHeaderShape(doc, 'limeShadow', HEADER_SHADOW_COLOR)
  drawHeaderShape(doc, 'lime', BRAND.lime)
  drawHeaderShape(doc, 'navyShadow', HEADER_SHADOW_COLOR)
  drawHeaderShape(doc, 'navy', BRAND.navy)

  // Real EnviroCycle wordmark, at its real size/position from the reference certificate PDF.
  drawAsset(doc, assets, 'logo', LOGO_X, LOGO_Y, LOGO_WIDTH)

  doc.setFont('Poppins', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...BRAND.navy)
  doc.text(`Certificate No. ${toText(certificateNumber)}`, pageWidth - MARGIN, 15, { align: 'right' })

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

  // Real compliance-logo strip (ISO/BSI/FDA/UN/etc.), extracted from the
  // reference PDF at its own exact size/position (page.get_image_info()):
  // ~203.4mm wide, top edge 21.44mm above the page bottom.
  drawAsset(doc, assets, 'complianceStrip', pageWidth / 2, pageHeight - 21.44, 203.4, 'center')

  // Bottom accent bar — real height/position from the reference PDF's own
  // vector rect (3.6mm tall, not the page's full corner-to-corner margin).
  doc.setFillColor(...BRAND.lime)
  doc.rect(0, pageHeight - 3.6, pageWidth, 3.6, 'F')
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
 * Every tile icon is a COMPLETE badge image (scalloped circular frame +
 * glyph) cropped directly from the reference PDF's own rendered pixels —
 * see assets.js / assetDimensions.js. Draw it as-is; nothing is composited
 * on top of a separately-drawn circle.
 */
function drawIconBadge(doc, assets, cx, cy, iconKey) {
  const iconImage = iconKey && assets?.[iconKey]
  if (!iconImage) {
    doc.setFillColor(...BRAND.navy)
    withAlpha(doc, 0.08, () => doc.circle(cx, cy, 5, 'F'))
    return
  }
  const dim = ASSET_DIMENSIONS[iconKey]
  const size = STAT_TILE_ICON_SIZE * 1.15
  const h = size * (dim.height / dim.width)
  doc.addImage(iconImage, 'PNG', cx - size / 2, cy - h / 2, size, h)
}

/**
 * A single rounded stat tile: icon badge (real asset, or a plain circle
 * placeholder when a tile has no icon) + label + big green number.
 * `labelLines` is the line count to reserve for the label (pass the max
 * across a row of tiles so every tile's value lands on the same baseline).
 */
function drawStatTile(doc, assets, x, y, w, label, value, labelLines = 1, iconKey) {
  const textX = x + 15
  const textW = Math.max(w - 15, 20)

  drawIconBadge(doc, assets, x + 6, y + 4, iconKey)

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

/** Centered label-over-big-number block with no icon — matches the Recycled Plastics Certificate's plain numeric columns. */
function drawSimpleStatBlock(doc, cx, y, label, value) {
  doc.setFont('Poppins', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...BRAND.ink)
  doc.text(label, cx, y, { align: 'center' })

  doc.setFont('Poppins', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...BRAND.green)
  doc.text(value, cx, y + 9, { align: 'center' })
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
    drawStatTile(doc, assets, x + 4 + tileW * i, y + h / 2 - 8, tileW - 2, tile.label, tile.value, maxLabelLines, tile.icon)
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
    { label: 'Carbon Saved', value: `${formatNumber(data.netCarbonAbatedKgCO2e)}\nkg CO2e`, icon: 'iconCo2' },
    { label: 'Landfill Diverted', value: `${formatNumber(data.landfillDivertedKg)}\nkg`, icon: 'iconLandfill' },
    { label: 'Plastic Recycled', value: `${formatNumber(data.plasticRecycledKg)}\nkg`, icon: 'iconRecycle' },
  ]
  drawPanel(doc, assets, MARGIN, panelY, panelW, panelH, 'ENVIRONMENTAL IMPACT RESULTS', resultTiles)

  const savingsTiles = [
    data.treesSaved > 0 && { label: 'Trees Saved', value: `${formatNumber(data.treesSaved, 0)}\nTrees`, icon: 'iconTree' },
    data.waterSavedLiters > 0 && { label: 'Water Saved', value: `${formatNumber(data.waterSavedLiters, 0)}\nL`, icon: 'iconWater' },
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
    { label: 'Total Carbon Footprint', value: `${formatNumber(data.totalCarbonFootprintKgCO2e)}\nkg CO2e`, icon: 'iconFootprint' },
    { label: 'Net Carbon Abated', value: `${formatNumber(data.netCarbonAbatedKgCO2e / 1000)}\ntCO2e`, icon: 'iconCo2' },
    { label: 'Recycled Emissions', value: `${formatNumber(data.recycledEmissionsKgCO2e)}\nkg CO2e`, icon: 'iconCloud' },
    { label: 'Carbon Benefits Equivalent', value: `~${formatNumber(data.kmAvoided, 0)} km\navoided`, icon: 'iconCar' },
  ]
  const cols = 3
  const tileW = (pageWidth - MARGIN * 2) / cols
  const maxLabelLines = Math.max(...tiles.map((t) => statTileLabelLineCount(doc, t.label, tileW - 6)))
  tiles.forEach((tile, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    drawStatTile(doc, assets, MARGIN + tileW * col, y + row * 20, tileW - 6, tile.label, tile.value, maxLabelLines, tile.icon)
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
  drawStatTile(doc, assets, MARGIN, y + 16, leftW, 'Landfill Diverted', `${formatNumber(data.landfillDivertedKg)} KG`, 1, 'iconLandfill')

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
  const blocks = [
    { label: 'TOTAL RECEIVED VOLUME', value: `${formatNumber(data.totalReceivedVolumeKg)}\nKG` },
    { label: 'PLASTIC WASTE', value: `${formatNumber(data.plasticWasteKg)}\nKG` },
    { label: 'RIGID PLASTIC', value: `${formatNumber(data.rigidPlasticKg)}\nKG` },
    { label: 'FLEXIBLE PLASTIC', value: `${formatNumber(data.flexiblePlasticKg)}\nKG` },
  ]
  const blockW = (pageWidth - MARGIN * 2) / blocks.length
  blocks.forEach((block, i) => {
    drawSimpleStatBlock(doc, MARGIN + blockW * i + blockW / 2, y + 12, block.label, block.value)
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
