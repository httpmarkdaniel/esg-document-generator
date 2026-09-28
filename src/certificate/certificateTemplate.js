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
import { BRAND, SIGNATORIES } from '../lib/brand.js'
import { resolveCertificateText } from './certificateText.js'
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

/** Draw text unless it's empty (an empty string is how the preview editor hides a line). */
function drawText(doc, text, x, y, options) {
  if (text === '' || text == null) return
  doc.text(text, x, y, options)
}

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
function drawHeader(doc, assets, T) {
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
  drawText(doc, T.certificateNo, pageWidth - MARGIN, 15, { align: 'right' })

  let y = HEADER_HEIGHT + 14
  doc.setTextColor(...BRAND.green)
  doc.setFont('Poppins', 'bold')
  doc.setFontSize(24)
  drawText(doc, T.title, pageWidth / 2, y, { align: 'center' })

  y += 9
  doc.setTextColor(...BRAND.ink)
  doc.setFont('Poppins', 'normal')
  doc.setFontSize(11)
  drawText(doc, T.issuedTo, pageWidth / 2, y, { align: 'center' })

  return y
}

/** Recipient name / address / reporting-period block, shared by all types. */
function drawRecipientBlock(doc, T, y) {
  const pageWidth = doc.internal.pageSize.getWidth()
  let cursorY = y + 11

  doc.setTextColor(...BRAND.navy)
  doc.setFont('Poppins', 'bold')
  doc.setFontSize(18)
  drawText(doc, T.recipient, pageWidth / 2, cursorY, { align: 'center' })

  if (T.address) {
    cursorY += 8
    doc.setTextColor(...BRAND.muted)
    doc.setFont('Poppins', 'normal')
    doc.setFontSize(10)
    doc.text(T.address, pageWidth / 2, cursorY, { align: 'center' })
  }

  cursorY += 9
  doc.setFont('Poppins', 'italic')
  doc.setFontSize(10)
  doc.setTextColor(...BRAND.ink)
  drawText(doc, T.period, pageWidth / 2, cursorY, { align: 'center' })

  return cursorY + 8
}

/** Given-date line, signature row, disclaimer, compliance-logo strip, and bottom accent bar. Shared by all types. */
function drawFooter(doc, assets, T, { showSignatures }) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  let y = pageHeight - 68
  doc.setTextColor(...BRAND.ink)
  doc.setFont('Poppins', 'normal')
  doc.setFontSize(9.5)
  drawText(doc, T.givenLine, pageWidth / 2, y, { align: 'center' })
  y += 4.5
  doc.setTextColor(...BRAND.muted)
  drawText(doc, T.companyAddress, pageWidth / 2, y, { align: 'center' })

  // Signature row
  y = pageHeight - 44
  const colWidth = (pageWidth - MARGIN * 2) / SIGNATORIES.length
  SIGNATORIES.forEach((sig, i) => {
    const cx = MARGIN + colWidth * i + colWidth / 2
    // A person's pen signature only goes above their OWN name: if the name
    // was edited to someone else, the signature is left off.
    if (showSignatures && sig.signature && T[`sig${i}Name`] === sig.name) drawSignature(doc, assets, sig.signature, cx, y - 5)
    doc.setDrawColor(...BRAND.border)
    doc.setLineWidth(0.2)
    doc.line(cx - 28, y - 5, cx + 28, y - 5)
    doc.setTextColor(...BRAND.navy)
    doc.setFont('Poppins', 'bold')
    doc.setFontSize(10)
    drawText(doc, T[`sig${i}Name`], cx, y, { align: 'center' })
    doc.setTextColor(...BRAND.muted)
    doc.setFont('Poppins', 'normal')
    doc.setFontSize(7.5)
    drawText(doc, T[`sig${i}Title`], cx, y + 4, { align: 'center' })
  })

  // Disclaimer
  y = pageHeight - 28
  doc.setTextColor(...BRAND.muted)
  doc.setFont('Poppins', 'normal')
  doc.setFontSize(6.8)
  if (T.disclaimer) doc.text(doc.splitTextToSize(T.disclaimer, pageWidth - MARGIN * 2), pageWidth / 2, y, { align: 'center' })

  // Real compliance-logo strip (ISO/BSI/FDA/UN/etc.), extracted from the
  // reference PDF at its own exact size/position (page.get_image_info()):
  // ~203.4mm wide, top edge 21.44mm above the page bottom.
  drawAsset(doc, assets, 'complianceStrip', pageWidth / 2, pageHeight - 21.44, 203.4, 'center')

  // Bottom accent bar — real height/position from the reference PDF's own
  // vector rect (3.6mm tall, not the page's full corner-to-corner margin).
  doc.setFillColor(...BRAND.lime)
  doc.rect(0, pageHeight - 3.6, pageWidth, 3.6, 'F')
}

// One shared scale for all 3 signature images (mm per image pixel), so they
// keep the same sizes relative to each other as on the signed original —
// the tallest (Sanchez / Bweheni) come out ~13mm tall.
const SIGNATURE_MM_PER_PX = 13 / 249
// Share of the signature's height that dips below the signature line, like a real pen signature.
const SIGNATURE_LINE_OVERLAP = 0.18

/** Draw a signature image centered on `cx`, sitting on the signature line at `lineY`. */
function drawSignature(doc, assets, key, cx, lineY) {
  const image = assets?.[key]
  if (!image) return
  const dim = ASSET_DIMENSIONS[key]
  const w = dim.width * SIGNATURE_MM_PER_PX
  const h = dim.height * SIGNATURE_MM_PER_PX
  doc.addImage(image, 'PNG', cx - w / 2, lineY + h * SIGNATURE_LINE_OVERLAP - h, w, h)
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
  if (label) doc.text(doc.splitTextToSize(label, textW), textX, y + 2.5)

  const valueY = y + 2.5 + labelLines * STAT_TILE_LABEL_LINE_HEIGHT + 4
  doc.setTextColor(...BRAND.green)
  doc.setFont('Poppins', 'bold')
  doc.setFontSize(15)
  drawText(doc, value, textX, valueY)
}

/** Centered label-over-big-number block with no icon — matches the Recycled Plastics Certificate's plain numeric columns. */
function drawSimpleStatBlock(doc, cx, y, label, value) {
  doc.setFont('Poppins', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...BRAND.ink)
  drawText(doc, label, cx, y, { align: 'center' })

  doc.setFont('Poppins', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...BRAND.green)
  drawText(doc, value, cx, y + 9, { align: 'center' })
}

/** Bordered panel with a title and a row of stat tiles inside — used by EIC. */
function drawPanel(doc, assets, x, y, w, h, title, tiles) {
  doc.setDrawColor(...BRAND.green)
  doc.setLineWidth(0.4)
  doc.roundedRect(x, y, w, h, 3, 3, 'S')

  doc.setTextColor(...BRAND.green)
  doc.setFont('Poppins', 'bold')
  doc.setFontSize(9.5)
  drawText(doc, title, x + w / 2, y - 3, { align: 'center' })

  const tileW = (w - 8) / tiles.length
  const maxLabelLines = Math.max(...tiles.map((t) => statTileLabelLineCount(doc, t.label, tileW - 2)))
  tiles.forEach((tile, i) => {
    drawStatTile(doc, assets, x + 4 + tileW * i, y + h / 2 - 8, tileW - 2, tile.label, tile.value, maxLabelLines, tile.icon)
  })
}

// ---------------------------------------------------------------------------
// Environmental Impact Certificate (EIC)
// ---------------------------------------------------------------------------
function drawEnvironmentalImpactCertificate(doc, assets, T, options) {
  let y = drawHeader(doc, assets, T)
  y = drawRecipientBlock(doc, T, y)

  const pageWidth = doc.internal.pageSize.getWidth()
  const panelY = y + 6
  const panelH = 34
  const gap = 8
  const panelW = (pageWidth - MARGIN * 2 - gap) / 2

  const resultTiles = [
    { label: T.carbonLabel, value: T.carbonValue, icon: 'iconCo2' },
    { label: T.landfillLabel, value: T.landfillValue, icon: 'iconLandfill' },
    { label: T.plasticLabel, value: T.plasticValue, icon: 'iconRecycle' },
  ]
  drawPanel(doc, assets, MARGIN, panelY, panelW, panelH, T.resultsTitle, resultTiles)

  // A savings tile's text only exists when its value is above zero (see certificateText.js).
  const savingsTiles = [
    'treesLabel' in T && { label: T.treesLabel, value: T.treesValue, icon: 'iconTree' },
    'waterLabel' in T && { label: T.waterLabel, value: T.waterValue, icon: 'iconWater' },
    'energyLabel' in T && { label: T.energyLabel, value: T.energyValue, icon: 'iconEnergy' },
  ].filter(Boolean)
  if (savingsTiles.length) {
    drawPanel(doc, assets, MARGIN + panelW + gap, panelY, panelW, panelH, T.savingsTitle, savingsTiles)
  }

  drawFooter(doc, assets, T, options)
}

// ---------------------------------------------------------------------------
// Carbon Abatement Certificate (CAC)
// ---------------------------------------------------------------------------
function drawCarbonAbatementCertificate(doc, assets, T, options) {
  let y = drawHeader(doc, assets, T)
  y = drawRecipientBlock(doc, T, y)

  doc.setTextColor(...BRAND.muted)
  doc.setFont('Poppins', 'italic')
  doc.setFontSize(8.5)
  drawText(doc, T.basis, doc.internal.pageSize.getWidth() / 2, y, { align: 'center' })
  y += 8

  const pageWidth = doc.internal.pageSize.getWidth()
  const tiles = [
    { label: T.collectedLabel, value: T.collectedValue, icon: 'iconRecycle' },
    { label: T.footprintLabel, value: T.footprintValue, icon: 'iconFootprint' },
    { label: T.abatedLabel, value: T.abatedValue, icon: 'iconCo2' },
    { label: T.recycledEmissionsLabel, value: T.recycledEmissionsValue, icon: 'iconCloud' },
    { label: T.kmLabel, value: T.kmValue, icon: 'iconCar' },
  ]
  const cols = 3
  const tileW = (pageWidth - MARGIN * 2) / cols
  const maxLabelLines = Math.max(...tiles.map((t) => statTileLabelLineCount(doc, t.label, tileW - 6)))
  tiles.forEach((tile, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    drawStatTile(doc, assets, MARGIN + tileW * col, y + row * 20, tileW - 6, tile.label, tile.value, maxLabelLines, tile.icon)
  })

  drawFooter(doc, assets, T, options)
}

// ---------------------------------------------------------------------------
// Landfill Diverted Certificate (LDC)
// ---------------------------------------------------------------------------
function drawLandfillDivertedCertificate(doc, assets, T, options) {
  let y = drawHeader(doc, assets, T)
  y = drawRecipientBlock(doc, T, y)

  const pageWidth = doc.internal.pageSize.getWidth()
  const leftW = (pageWidth - MARGIN * 2) * 0.4
  const rightX = MARGIN + leftW + 8

  doc.setTextColor(...BRAND.green)
  doc.setFont('Poppins', 'bold')
  doc.setFontSize(9.5)
  drawText(doc, T.diversionHeading, MARGIN, y)
  drawText(doc, T.recycledHeading, rightX, y)
  y += 6

  drawStatTile(doc, assets, MARGIN, y, leftW, T.collectedLabel, T.collectedValue, 1, 'iconRecycle')
  drawStatTile(doc, assets, MARGIN, y + 16, leftW, T.landfillLabel, T.landfillValue, 1, 'iconLandfill')

  // Rows only exist for materials with weight (see certificateText.js).
  const rows = ['Metal', 'Plastic', 'Glass', 'Electronics']
    .filter((m) => `row${m}Label` in T)
    .map((m) => [T[`row${m}Label`], T[`row${m}Amount`], T[`row${m}Benefit`]])

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

  drawFooter(doc, assets, T, options)
}

// ---------------------------------------------------------------------------
// Recycled Plastics Certificate (RPC)
// ---------------------------------------------------------------------------
function drawRecycledPlasticsCertificate(doc, assets, T, options) {
  let y = drawHeader(doc, assets, T)
  y = drawRecipientBlock(doc, T, y)

  const pageWidth = doc.internal.pageSize.getWidth()
  const blocks = [
    { label: T.receivedLabel, value: T.receivedValue },
    { label: T.plasticWasteLabel, value: T.plasticWasteValue },
    { label: T.rigidLabel, value: T.rigidValue },
    { label: T.flexibleLabel, value: T.flexibleValue },
  ]
  const blockW = (pageWidth - MARGIN * 2) / blocks.length
  blocks.forEach((block, i) => {
    drawSimpleStatBlock(doc, MARGIN + blockW * i + blockW / 2, y + 12, block.label, block.value)
  })

  drawFooter(doc, assets, T, options)
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
 * loadCertificateAssets() in assets.js. Every printed string comes from
 * resolveCertificateText (defaults + any preview-editor overrides).
 */
export function drawCertificate(doc, assets, data) {
  const drawer = DRAWERS[data.certificateType] || DRAWERS.EIC
  drawer(doc, assets, resolveCertificateText(data), { showSignatures: !data.textOverrides?.hideSignatures })
  drawPlacedImages(doc, data.placedImages)
}

/**
 * Images added in the preview editor (e.g. a client logo), drawn last so
 * they sit on top. Each is a PNG data URL with its position/size in mm on
 * the A4-landscape page — see CertificatePreviewEditor.jsx.
 */
function drawPlacedImages(doc, images = []) {
  for (const img of images) doc.addImage(img.dataUrl, 'PNG', img.x, img.y, img.w, img.h, img.id, 'FAST')
}
