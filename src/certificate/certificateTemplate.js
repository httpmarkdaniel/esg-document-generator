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

import { BRAND, SIGNATORIES } from '../lib/brand.js'
import { resolveCertificateText, LDC_TABLE_ROWS, ldcRowKey } from './certificateText.js'
import { wrapRich, drawRichLines } from '../reports/richText.js'
import { LOGO_ID, ICONS_ID, COMPLIANCE_LOGOS, complianceLogoBoxes, hiddenImageSet } from './builtInImages.js'
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

// While drawing the regular certificate, every text field and signature is
// recorded here by its text key (see certificateText.js): where it was drawn
// and in what font/size/colour. That's the starting layout of the fields
// when a custom (Canva) design is uploaded — see drawCustomDesign below.
let fieldLog = null
// Where each text field's printed text sits on the page (mm box), so the
// preview editor can let you click it and edit it right there. Recording it
// never changes what's drawn.
let textBoxLog = null
const PT_MM = 0.3528

function logTextBox(doc, key, text, x, y, options = {}) {
  if (!textBoxLog || !key || text === '' || text == null) return
  const size = doc.getFontSize()
  const lines = options.maxWidth ? doc.splitTextToSize(String(text), options.maxWidth) : String(text).split('\n')
  const w = Math.max(...lines.map((l) => doc.getTextWidth(l)), 2)
  const align = options.align || 'left'
  const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x
  const lineH = size * PT_MM * 1.15 // jsPDF's default line height
  const top = y - size * PT_MM * 0.85
  textBoxLog.push({ key, page: 0, x: left, y: top, w, h: (lines.length - 1) * lineH + size * PT_MM * 1.15, size, align, bold: doc.getFont().fontStyle === 'bold' })
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex))
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0]
}

function recordText(doc, key, x, y, options = {}) {
  if (!fieldLog || !key) return
  const font = doc.getFont()
  fieldLog[key] = {
    kind: 'text',
    x,
    y,
    align: options.align || 'left',
    font: font.fontName,
    style: font.fontStyle,
    size: doc.getFontSize(),
    color: hexToRgb(doc.getTextColor()),
    ...(options.maxWidth ? { maxWidth: options.maxWidth } : {}),
  }
}

/**
 * Draw text unless it's empty (an empty string is how the preview editor hides a line); `key` records it (see fieldLog).
 * `options.letterSpacing` (em) spreads a single line out, like Canva's letter spacing.
 */
function drawText(doc, text, x, y, options, key) {
  if (text === '' || text == null) return
  if (options?.letterSpacing) return drawSpacedText(doc, String(text), x, y, options, key)
  doc.text(text, x, y, options)
  recordText(doc, key, x, y, options)
  logTextBox(doc, key, text, x, y, options)
}

function drawSpacedText(doc, text, x, y, { align = 'left', letterSpacing }, key) {
  const size = doc.getFontSize()
  const charSpace = letterSpacing * size * PT_MM
  const w = doc.getTextWidth(text) + charSpace * (text.length - 1)
  const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x
  doc.text(text, left, y, { charSpace })
  recordText(doc, key, x, y, { align })
  if (textBoxLog && key) textBoxLog.push({ key, page: 0, x: left, y: y - size * PT_MM * 0.85, w, h: size * PT_MM * 1.15, size, align, bold: doc.getFont().fontStyle === 'bold' })
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
  drawText(doc, T.certificateNo, pageWidth - MARGIN, 15, { align: 'right' }, 'certificateNo')

  let y = HEADER_HEIGHT + 14
  doc.setTextColor(...BRAND.green)
  doc.setFont('Poppins', 'bold')
  doc.setFontSize(24)
  drawText(doc, T.title, pageWidth / 2, y, { align: 'center' }, 'title')

  y += 9
  doc.setTextColor(...BRAND.ink)
  doc.setFont('Poppins', 'normal')
  doc.setFontSize(11)
  drawText(doc, T.issuedTo, pageWidth / 2, y, { align: 'center' }, 'issuedTo')

  return y
}

/** Recipient name / address / reporting-period (or RR + items collected) block, for EIC and RPC. */
function drawRecipientBlock(doc, T, y) {
  const pageWidth = doc.internal.pageSize.getWidth()
  let cursorY = y + 11

  doc.setTextColor(...BRAND.navy)
  doc.setFont('Poppins', 'bold')
  doc.setFontSize(18)
  drawText(doc, T.recipient, pageWidth / 2, cursorY, { align: 'center' }, 'recipient')

  if (T.address) {
    cursorY += 8
    doc.setTextColor(...BRAND.muted)
    doc.setFont('Poppins', 'normal')
    doc.setFontSize(10)
    drawText(doc, T.address, pageWidth / 2, cursorY, { align: 'center' }, 'address')
  }

  doc.setFont('Poppins', 'italic')
  doc.setFontSize(10)
  doc.setTextColor(...BRAND.ink)
  if ('period' in T) {
    cursorY += 9
    drawText(doc, T.period, pageWidth / 2, cursorY, { align: 'center' }, 'period')
    return cursorY + 8
  }
  // "Receiving Report: S…" over "Items collected on …" (EIC).
  cursorY += 7
  drawText(doc, T.receivingReport, pageWidth / 2, cursorY, { align: 'center' }, 'receivingReport')
  cursorY += 4.5
  drawText(doc, T.itemsCollected, pageWidth / 2, cursorY, { align: 'center' }, 'itemsCollected')
  return cursorY + 6.5
}

/** Given-date line, signature row, disclaimer, compliance-logo strip, and bottom accent bar. For EIC and RPC. */
function drawFooter(doc, assets, T, { showSignatures, hidden }) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  let y = pageHeight - 68
  doc.setTextColor(...BRAND.ink)
  doc.setFont('Poppins', 'normal')
  doc.setFontSize(9.5)
  drawText(doc, T.givenLine, pageWidth / 2, y, { align: 'center' }, 'givenLine')
  y += 4.5
  doc.setTextColor(...BRAND.muted)
  drawText(doc, T.companyAddress, pageWidth / 2, y, { align: 'center' }, 'companyAddress')

  // Signature row
  y = pageHeight - 44
  const colWidth = (pageWidth - MARGIN * 2) / SIGNATORIES.length
  SIGNATORIES.forEach((sig, i) => {
    const cx = MARGIN + colWidth * i + colWidth / 2
    // A person's pen signature only goes above their OWN name: if the name
    // was edited to someone else, the signature is left off.
    if (showSignatures && sig.signature && T[`sig${i}Name`] === sig.name) drawSignature(doc, assets, sig.signature, cx, y - 5, `sig${i}Img`)
    doc.setDrawColor(...BRAND.border)
    doc.setLineWidth(0.2)
    doc.line(cx - 28, y - 5, cx + 28, y - 5)
    doc.setTextColor(...BRAND.navy)
    doc.setFont('Poppins', 'bold')
    doc.setFontSize(10)
    drawText(doc, T[`sig${i}Name`], cx, y, { align: 'center' }, `sig${i}Name`)
    doc.setTextColor(...BRAND.muted)
    doc.setFont('Poppins', 'normal')
    doc.setFontSize(7.5)
    drawText(doc, T[`sig${i}Title`], cx, y + 4, { align: 'center' }, `sig${i}Title`)
  })

  // Disclaimer
  y = pageHeight - 28
  doc.setTextColor(...BRAND.muted)
  doc.setFont('Poppins', 'normal')
  doc.setFontSize(6.8)
  if (T.disclaimer) {
    doc.text(doc.splitTextToSize(T.disclaimer, pageWidth - MARGIN * 2), pageWidth / 2, y, { align: 'center' })
    recordText(doc, 'disclaimer', pageWidth / 2, y, { align: 'center', maxWidth: pageWidth - MARGIN * 2 })
    logTextBox(doc, 'disclaimer', T.disclaimer, pageWidth / 2, y, { align: 'center', maxWidth: pageWidth - MARGIN * 2 })
  }

  drawComplianceStrip(doc, assets, hidden)
}

/** Compliance-logo strip and the bottom accent bar — the same on every certificate. */
function drawComplianceStrip(doc, assets, hidden) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Real compliance-logo strip (ISO/BSI/FDA/UN/etc.), extracted from the
  // reference PDF at its own exact size/position (page.get_image_info()):
  // ~203.4mm wide, top edge 21.44mm above the page bottom.
  // Logos removed in the preview editor are left out; the rest are drawn
  // one by one, closed up and centered (see builtInImages.js).
  if (!COMPLIANCE_LOGOS.some((l) => hidden.has(l.id))) {
    drawAsset(doc, assets, 'complianceStrip', pageWidth / 2, pageHeight - 21.44, 203.4, 'center')
  } else {
    for (const box of complianceLogoBoxes(hidden)) {
      const piece = assets?.complianceStripPieces?.[box.id]
      if (piece) doc.addImage(piece, 'PNG', box.x, box.y, box.w, box.h, box.id, 'FAST')
    }
  }

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
function drawSignature(doc, assets, key, cx, lineY, fieldKey) {
  const image = assets?.[key]
  if (!image) return
  const dim = ASSET_DIMENSIONS[key]
  const w = dim.width * SIGNATURE_MM_PER_PX
  const h = dim.height * SIGNATURE_MM_PER_PX
  doc.addImage(image, 'PNG', cx - w / 2, lineY + h * SIGNATURE_LINE_OVERLAP - h, w, h)
  if (fieldLog && fieldKey) fieldLog[fieldKey] = { kind: 'image', image: key, x: cx - w / 2, y: lineY + h * SIGNATURE_LINE_OVERLAP - h, w, h }
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
  if (assets?.hideIcons) return // "Stat icons" removed in the preview editor
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
function drawStatTile(doc, assets, x, y, w, label, value, labelLines = 1, iconKey, keys = []) {
  const textX = x + 15
  const textW = Math.max(w - 15, 20)

  drawIconBadge(doc, assets, x + 6, y + 4, iconKey)

  doc.setFont('Poppins', 'bold')
  doc.setFontSize(STAT_TILE_LABEL_SIZE)
  doc.setTextColor(...BRAND.ink)
  if (label) {
    doc.text(doc.splitTextToSize(label, textW), textX, y + 2.5)
    recordText(doc, keys[0], textX, y + 2.5, { maxWidth: textW })
    logTextBox(doc, keys[0], label, textX, y + 2.5, { maxWidth: textW })
  }

  const valueY = y + 2.5 + labelLines * STAT_TILE_LABEL_LINE_HEIGHT + 4
  doc.setTextColor(...BRAND.green)
  doc.setFont('Poppins', 'bold')
  doc.setFontSize(15)
  drawText(doc, value, textX, valueY, undefined, keys[1])
}

/** Centered label-over-big-number block with no icon — matches the Recycled Plastics Certificate's plain numeric columns. */
function drawSimpleStatBlock(doc, cx, y, label, value, keys = []) {
  doc.setFont('Poppins', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...BRAND.ink)
  drawText(doc, label, cx, y, { align: 'center' }, keys[0])

  doc.setFont('Poppins', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...BRAND.green)
  drawText(doc, value, cx, y + 9, { align: 'center' }, keys[1])
}

/** Bordered panel with a title and a row of stat tiles inside — used by EIC. */
function drawPanel(doc, assets, x, y, w, h, title, tiles, titleKey) {
  doc.setDrawColor(...BRAND.green)
  doc.setLineWidth(0.4)
  doc.roundedRect(x, y, w, h, 3, 3, 'S')

  doc.setTextColor(...BRAND.green)
  doc.setFont('Poppins', 'bold')
  doc.setFontSize(9.5)
  drawText(doc, title, x + w / 2, y - 3, { align: 'center' }, titleKey)

  const tileW = (w - 8) / tiles.length
  const maxLabelLines = Math.max(...tiles.map((t) => statTileLabelLineCount(doc, t.label, tileW - 2)))
  tiles.forEach((tile, i) => {
    drawStatTile(doc, assets, x + 4 + tileW * i, y + h / 2 - 8, tileW - 2, tile.label, tile.value, maxLabelLines, tile.icon, tile.keys)
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
    { label: T.carbonLabel, value: T.carbonValue, icon: 'iconCo2', keys: ['carbonLabel', 'carbonValue'] },
    { label: T.landfillLabel, value: T.landfillValue, icon: 'iconLandfill', keys: ['landfillLabel', 'landfillValue'] },
    { label: T.plasticLabel, value: T.plasticValue, icon: 'iconRecycle', keys: ['plasticLabel', 'plasticValue'] },
  ]
  drawPanel(doc, assets, MARGIN, panelY, panelW, panelH, T.resultsTitle, resultTiles, 'resultsTitle')

  // A savings tile's text only exists when its value is above zero (see certificateText.js).
  const savingsTiles = [
    'treesLabel' in T && { label: T.treesLabel, value: T.treesValue, icon: 'iconTree', keys: ['treesLabel', 'treesValue'] },
    'waterLabel' in T && { label: T.waterLabel, value: T.waterValue, icon: 'iconWater', keys: ['waterLabel', 'waterValue'] },
    'energyLabel' in T && { label: T.energyLabel, value: T.energyValue, icon: 'iconEnergy', keys: ['energyLabel', 'energyValue'] },
  ].filter(Boolean)
  if (savingsTiles.length) {
    drawPanel(doc, assets, MARGIN + panelW + gap, panelY, panelW, panelH, T.savingsTitle, savingsTiles, 'savingsTitle')
  }

  drawFooter(doc, assets, T, options)
}

// ---------------------------------------------------------------------------
// Current EnviroCycle (Canva) layout — shared by CAC and LDC
// ---------------------------------------------------------------------------
// Rebuilt from "Carbon Abatement Certificate - S19733.pdf" and
// "Canva_LDC_For-Signature.pdf": every position below is that PDF's own
// text origin / box, converted pt -> mm. Fonts: League Spartan (title,
// recipient, section headings) and Nunito Sans standing in for Canva Sans.

const CANVA = {
  green: [0, 104, 56],
  navy: [12, 40, 59],
  black: [0, 0, 0],
  grey: [115, 115, 115],
  tableBorder: [2, 108, 32],
}
const CANVA_BADGE_SIZE = 15.5
// maxWidth wraps the disclaimer where the reference does (Nunito Sans runs a little narrower than Canva Sans).
const CANVA_DISCLAIMER = { centerX: 144.1, y: 183, lineHeight: 3.7, maxWidth: 205, size: 8 }

/** Header band, certificate no., title and "IS ISSUED TO :" (at `issuedY`). */
function drawCanvaHeader(doc, assets, T, issuedY) {
  const pageWidth = doc.internal.pageSize.getWidth()
  drawHeaderShape(doc, 'limeShadow', HEADER_SHADOW_COLOR)
  drawHeaderShape(doc, 'lime', BRAND.lime)
  drawHeaderShape(doc, 'navyShadow', HEADER_SHADOW_COLOR)
  drawHeaderShape(doc, 'navy', BRAND.navy)
  drawAsset(doc, assets, 'logo', LOGO_X, LOGO_Y, LOGO_WIDTH)

  doc.setFont('NunitoSans', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...CANVA.black)
  drawText(doc, T.certificateNo, 280.3, 17.6, { align: 'right' }, 'certificateNo')

  doc.setFont('LeagueSpartan', 'bold')
  doc.setFontSize(26)
  doc.setTextColor(...CANVA.green)
  drawText(doc, T.title, pageWidth / 2, 39.2, { align: 'center', letterSpacing: 0.06 }, 'title')

  doc.setFont('NunitoSans', 'normal')
  doc.setFontSize(14)
  doc.setTextColor(...CANVA.black)
  drawText(doc, T.issuedTo, pageWidth / 2, issuedY, { align: 'center' }, 'issuedTo')
}

/** Recipient name + address, then the italic lines under them: [{ key, y }]. */
function drawCanvaRecipient(doc, T, { recipientY, addressY, lines }) {
  const cx = doc.internal.pageSize.getWidth() / 2
  doc.setFont('LeagueSpartan', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...CANVA.navy)
  drawText(doc, T.recipient, cx, recipientY, { align: 'center' }, 'recipient')

  doc.setFont('NunitoSans', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...CANVA.black)
  drawText(doc, T.address, cx, addressY, { align: 'center' }, 'address')

  doc.setFont('NunitoSans', 'italic')
  doc.setFontSize(10)
  for (const { key, y } of lines) drawText(doc, T[key], cx, y, { align: 'center' }, key)
}

/** Badge icon (top-left at x, y) with a bold label and a big green value to its right, plus an optional small note under the value. */
function drawCanvaTile(doc, assets, T, { x, y, icon, prefix, labelDy = 4.6, noteKey }) {
  if (!assets?.hideIcons && assets?.[icon]) {
    const dim = ASSET_DIMENSIONS[icon]
    const h = CANVA_BADGE_SIZE * (dim.height / dim.width)
    doc.addImage(assets[icon], 'PNG', x, y + (CANVA_BADGE_SIZE - h) / 2, CANVA_BADGE_SIZE, h)
  }
  const textX = x + 20.1
  const labelY = y + labelDy
  doc.setFont('NunitoSans', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...CANVA.black)
  drawText(doc, T[`${prefix}Label`], textX, labelY, undefined, `${prefix}Label`)

  doc.setFontSize(18)
  doc.setTextColor(...CANVA.green)
  drawText(doc, T[`${prefix}Value`], textX, labelY + 7.7, undefined, `${prefix}Value`)

  if (noteKey) {
    doc.setFontSize(10)
    drawText(doc, T[noteKey], textX, labelY + 13.5, undefined, noteKey)
  }
}

// Each pen signature's size and spot on the reference certificates: mm per
// image pixel, centre offset from the name's centre, and how far its lowest
// stroke reaches below the name's baseline.
const CANVA_SIGNATURES = {
  sigSanchez: { mmPerPx: 0.0775, dx: 9.1, bottom: 2.8 },
  sigLaconsay: { mmPerPx: 0.0819, dx: 0.1, bottom: -1.1 },
  sigBweheni: { mmPerPx: 0.0846, dx: 3.8, bottom: 3.1 },
}

function drawCanvaSignature(doc, assets, key, nameCx, nameBaseline, fieldKey) {
  const image = assets?.[key]
  const place = CANVA_SIGNATURES[key]
  if (!image || !place) return
  const dim = ASSET_DIMENSIONS[key]
  const w = dim.width * place.mmPerPx
  const h = dim.height * place.mmPerPx
  const x = nameCx + place.dx - w / 2
  const y = nameBaseline + place.bottom - h
  doc.addImage(image, 'PNG', x, y, w, h)
  if (fieldLog && fieldKey) fieldLog[fieldKey] = { kind: 'image', image: key, x, y, w, h }
}

/** "Given this day" lines, signatories, bold-marked disclaimer, compliance strip and bottom bar. */
function drawCanvaFooter(doc, assets, T, { givenY, sigY, sigCenters, showSignatures, hidden }) {
  const cx = doc.internal.pageSize.getWidth() / 2
  doc.setFont('NunitoSans', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...CANVA.black)
  drawText(doc, T.givenLine, cx, givenY, { align: 'center' }, 'givenLine')
  drawText(doc, T.companyAddress, cx, givenY + 4.7, { align: 'center' }, 'companyAddress')

  // No signature lines on these certificates — the pen signature is drawn over the name.
  SIGNATORIES.forEach((sig, i) => {
    const x = sigCenters[i]
    doc.setTextColor(...CANVA.navy)
    doc.setFont('NunitoSans', 'bold')
    doc.setFontSize(13.3)
    drawText(doc, T[`sig${i}Name`], x, sigY, { align: 'center' }, `sig${i}Name`)
    doc.setFont('NunitoSans', 'normal')
    doc.setFontSize(8.6)
    drawText(doc, T[`sig${i}Title`], x, sigY + 5.1, { align: 'center' }, `sig${i}Title`)
    if (showSignatures && sig.signature && T[`sig${i}Name`] === sig.name) drawCanvaSignature(doc, assets, sig.signature, x, sigY, `sig${i}Img`)
  })

  if (T.disclaimer) {
    const { centerX, y, lineHeight, maxWidth, size } = CANVA_DISCLAIMER
    doc.setTextColor(...CANVA.grey)
    const lines = wrapRich(doc, T.disclaimer, { font: 'NunitoSans', size, maxWidth })
    drawRichLines(doc, lines, { font: 'NunitoSans', size, y, lineHeight, align: 'center', centerX })
    doc.setFont('NunitoSans', 'normal')
    recordText(doc, 'disclaimer', centerX, y, { align: 'center', maxWidth })
    logTextBox(doc, 'disclaimer', T.disclaimer.replaceAll('**', ''), centerX, y, { align: 'center', maxWidth })
  }

  drawComplianceStrip(doc, assets, hidden)
}

// ---------------------------------------------------------------------------
// Carbon Abatement Certificate (CAC)
// ---------------------------------------------------------------------------
function drawCarbonAbatementCertificate(doc, assets, T, options) {
  drawCanvaHeader(doc, assets, T, 52.2)
  drawCanvaRecipient(doc, T, {
    recipientY: 65.2,
    addressY: 74.1,
    lines: [
      { key: 'itemsCollected', y: 87.6 },
      { key: 'basis', y: 92.4 },
    ],
  })

  // Two tiles on top, three below — as placed on the reference.
  drawCanvaTile(doc, assets, T, { x: 71.8, y: 101.3, icon: 'iconRecycle', prefix: 'collected' })
  drawCanvaTile(doc, assets, T, { x: 145.4, y: 101.3, icon: 'iconFootprint', prefix: 'footprint' })
  drawCanvaTile(doc, assets, T, { x: 21.0, y: 120.9, icon: 'iconCo2', prefix: 'abated' })
  drawCanvaTile(doc, assets, T, { x: 108.7, y: 120.1, icon: 'iconCloud', prefix: 'recycledEmissions' })
  drawCanvaTile(doc, assets, T, { x: 189.8, y: 120.2, icon: 'iconCar', prefix: 'km', labelDy: 2.8, noteKey: 'kmNote' })

  drawCanvaFooter(doc, assets, T, { ...options, givenY: 145.6, sigY: 167.1, sigCenters: [62.25, 152.2, 233.95] })
}

// ---------------------------------------------------------------------------
// Landfill Diversion Certificate (LDC)
// ---------------------------------------------------------------------------
// "Recycled Materials Summary" table: column edges (mm) and text metrics.
const LDC_TABLE = { cols: [119.8, 145.0, 183.2, 276.4], top: 92.9, pad: 2.1, size: 9, lineHeight: 4.2, minRowHeight: 9.5 }

function drawLandfillDiversionCertificate(doc, assets, T, options) {
  drawCanvaHeader(doc, assets, T, 47.0)
  drawCanvaRecipient(doc, T, {
    recipientY: 60.0,
    addressY: 68.9,
    lines: [
      { key: 'receivingReport', y: 75.6 },
      { key: 'itemsCollected', y: 80.4 },
    ],
  })

  doc.setTextColor(...CANVA.green)
  doc.setFont('LeagueSpartan', 'bold')
  doc.setFontSize(9)
  drawText(doc, T.diversionHeading, 47.8, 94.7, { letterSpacing: 0.06 }, 'diversionHeading')
  drawText(doc, T.recycledHeading, 191.2, 88.7, { align: 'center', letterSpacing: 0.06 }, 'recycledHeading')

  drawCanvaTile(doc, assets, T, { x: 35.1, y: 100.3, icon: 'iconRecycle', prefix: 'collected' })
  drawCanvaTile(doc, assets, T, { x: 35.1, y: 120.1, icon: 'iconLandfill', prefix: 'landfill' })

  drawLdcTable(doc, T)

  drawCanvaFooter(doc, assets, T, { ...options, givenY: 151.5, sigY: 170.8, sigCenters: [58.6, 148.55, 230.25] })
}

/** The materials table: name | amount (bold green, centered) | benefit, green grid. Rows only exist for the keys present in T (see certificateText.js). */
function drawLdcTable(doc, T) {
  const { cols, top, pad, size, lineHeight, minRowHeight } = LDC_TABLE
  const rows = LDC_TABLE_ROWS.map(ldcRowKey).filter((key) => `${key}Label` in T)
  if (!rows.length) return
  const lineHeightFactor = lineHeight / (size * PT_MM)
  const cellWidth = (c) => cols[c + 1] - cols[c] - pad * 2
  const lineCount = (text, c, style) => {
    if (!text) return 1
    doc.setFont('NunitoSans', style)
    doc.setFontSize(size)
    return doc.splitTextToSize(String(text), cellWidth(c)).length
  }

  let y = top
  const rowEdges = [top]
  for (const key of rows) {
    const cells = [
      { text: T[`${key}Label`], key: `${key}Label`, style: 'normal', color: CANVA.black, align: 'left' },
      { text: T[`${key}Amount`], key: `${key}Amount`, style: 'bold', color: CANVA.green, align: 'center' },
      { text: T[`${key}Benefit`], key: `${key}Benefit`, style: 'normal', color: CANVA.black, align: 'left' },
    ]
    const counts = cells.map((cell, c) => lineCount(cell.text, c, cell.style))
    const h = Math.max(minRowHeight, Math.max(...counts) * lineHeight + 4.3)
    cells.forEach((cell, c) => {
      const firstBaseline = y + h / 2 - ((counts[c] - 1) * lineHeight) / 2 + 1.15
      const x = cell.align === 'center' ? (cols[c] + cols[c + 1]) / 2 : cols[c] + pad
      doc.setFont('NunitoSans', cell.style)
      doc.setFontSize(size)
      doc.setTextColor(...cell.color)
      drawText(doc, cell.text, x, firstBaseline, { align: cell.align, maxWidth: cellWidth(c), lineHeightFactor }, cell.key)
    })
    y += h
    rowEdges.push(y)
  }

  doc.setDrawColor(...CANVA.tableBorder)
  doc.setLineWidth(0.26)
  for (const edge of rowEdges) doc.line(cols[0], edge, cols[cols.length - 1], edge)
  for (const x of cols) doc.line(x, top, x, y)
}

// ---------------------------------------------------------------------------
// Recycled Plastics Certificate (RPC)
// ---------------------------------------------------------------------------
function drawRecycledPlasticsCertificate(doc, assets, T, options) {
  let y = drawHeader(doc, assets, T)
  y = drawRecipientBlock(doc, T, y)

  const pageWidth = doc.internal.pageSize.getWidth()
  const blocks = [
    { label: T.receivedLabel, value: T.receivedValue, keys: ['receivedLabel', 'receivedValue'] },
    { label: T.plasticWasteLabel, value: T.plasticWasteValue, keys: ['plasticWasteLabel', 'plasticWasteValue'] },
    { label: T.rigidLabel, value: T.rigidValue, keys: ['rigidLabel', 'rigidValue'] },
    { label: T.flexibleLabel, value: T.flexibleValue, keys: ['flexibleLabel', 'flexibleValue'] },
  ]
  const blockW = (pageWidth - MARGIN * 2) / blocks.length
  blocks.forEach((block, i) => {
    drawSimpleStatBlock(doc, MARGIN + blockW * i + blockW / 2, y + 12, block.label, block.value, block.keys)
  })

  drawFooter(doc, assets, T, options)
}

const DRAWERS = {
  EIC: drawEnvironmentalImpactCertificate,
  CAC: drawCarbonAbatementCertificate,
  LDC: drawLandfillDiversionCertificate,
  RPC: drawRecycledPlasticsCertificate,
}

/**
 * Entry point used by generateCertificatePdf.js. Dispatches by
 * data.certificateType. `assets` is the object returned by
 * loadCertificateAssets() in assets.js. Every printed string comes from
 * resolveCertificateText (defaults + any preview-editor overrides).
 */
export function drawCertificate(doc, assets, data) {
  const T = resolveCertificateText(data)
  if (data.customDesign) return drawCustomDesign(doc, assets, data, T)

  const drawer = DRAWERS[data.certificateType] || DRAWERS.EIC
  // Built-in images removed in the preview editor (see builtInImages.js).
  const hidden = hiddenImageSet(data.textOverrides)
  const drawAssets = { ...assets, hideIcons: hidden.has(ICONS_ID) }
  if (hidden.has(LOGO_ID)) delete drawAssets.logo
  fieldLog = {}
  textBoxLog = []
  drawer(doc, drawAssets, T, { showSignatures: !data.textOverrides?.hideSignatures, hidden })
  const fields = fieldLog
  const textBoxes = textBoxLog
  fieldLog = null
  textBoxLog = null
  drawPlacedImages(doc, data.placedImages)
  return { fields, textBoxes }
}

/**
 * Custom design mode: the uploaded design (e.g. exported from Canva) fills
 * the page, and only the live data is drawn on top of it — each field at the
 * position/style in `data.customFields` (the regular layout's positions,
 * adjusted in the preview editor; see certificate/customDesign.js).
 * Returns the page boxes of the drawn fields so the editor can put drag
 * handles exactly on them.
 */
function drawCustomDesign(doc, assets, data, T) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const design = data.customDesign
  doc.addImage(design.dataUrl, design.dataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG', 0, 0, pageWidth, pageHeight, 'customDesign', 'FAST')
  drawPlacedImages(doc, data.placedImages)

  const showSignatures = !data.textOverrides?.hideSignatures
  const boxes = {}
  for (const [key, f] of Object.entries(data.customFields || {})) {
    if (f.hidden) continue
    if (f.kind === 'image') {
      if (!showSignatures || !assets?.[f.image]) continue
      doc.addImage(assets[f.image], 'PNG', f.x, f.y, f.w, f.h)
      boxes[key] = { x: f.x, y: f.y, w: f.w, h: f.h }
      continue
    }
    const text = T[key]
    if (!text) continue
    doc.setFont(f.font, f.style)
    doc.setFontSize(f.size)
    doc.setTextColor(...f.color)
    const lines = f.maxWidth ? doc.splitTextToSize(text, f.maxWidth) : String(text).split('\n')
    doc.text(lines, f.x, f.y, { align: f.align })
    const mm = f.size * (25.4 / 72)
    const w = Math.max(...lines.map((l) => doc.getTextWidth(l)))
    const h = mm * (0.95 + (lines.length - 1) * doc.getLineHeightFactor())
    const x = f.align === 'center' ? f.x - w / 2 : f.align === 'right' ? f.x - w : f.x
    boxes[key] = { x, y: f.y - mm * 0.75, w, h }
  }
  return { fieldBoxes: boxes }
}

/**
 * Images added in the preview editor (e.g. a client logo), drawn last so
 * they sit on top. Each is a PNG data URL with its position/size in mm on
 * the A4-landscape page — see CertificatePreviewEditor.jsx.
 */
function drawPlacedImages(doc, images = []) {
  for (const img of images) doc.addImage(img.dataUrl, 'PNG', img.x, img.y, img.w, img.h, img.id, 'FAST')
}
