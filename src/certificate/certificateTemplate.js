// Certificate TEMPLATE (visual design layer).
//
// This is intentionally the only file that knows how a certificate looks.
// `generateCertificatePdf.js` just calls `drawCertificate(doc, data)`.
// When the official certificate design is supplied, replace the contents of
// this file — the data model (certificateData.js) and the generation
// plumbing (generateCertificatePdf.js) should not need to change.

import autoTable from 'jspdf-autotable'
import { formatKg, formatUnit, formatDate, todayDisplay, toText } from '../lib/format.js'

const PAGE_MARGIN = 18
const ACCENT = [22, 101, 52] // deep green
const MUTED = [107, 114, 128]
const INK = [17, 24, 39]

export function drawCertificate(doc, data) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const contentWidth = pageWidth - PAGE_MARGIN * 2
  let y = PAGE_MARGIN

  // Decorative border
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.8)
  doc.rect(PAGE_MARGIN - 6, PAGE_MARGIN - 8, contentWidth + 12, doc.internal.pageSize.getHeight() - (PAGE_MARGIN - 8) * 2)

  // Company / ESG heading
  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('ENVIRONMENTAL, SOCIAL & GOVERNANCE', pageWidth / 2, y + 4, { align: 'center' })

  y += 14
  doc.setTextColor(...ACCENT)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.text('Environmental Impact Certificate', pageWidth / 2, y, { align: 'center' })

  y += 8
  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(`Certificate No. ${toText(data.certificateNumber)}`, pageWidth / 2, y, { align: 'center' })

  y += 3
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.4)
  doc.line(pageWidth / 2 - 30, y + 4, pageWidth / 2 + 30, y + 4)

  y += 16
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text('This certificate confirms the recycling and environmental impact outcomes', pageWidth / 2, y, {
    align: 'center',
  })
  y += 5.5
  doc.text('generated on behalf of:', pageWidth / 2, y, { align: 'center' })

  y += 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text(toText(data.recipient), pageWidth / 2, y, { align: 'center' })

  // Transaction detail row
  y += 12
  const details = [
    ['Reference / Transaction', toText(data.reference)],
    ['Item', toText(data.item)],
    ...(toText(data.quantity, '') ? [['Quantity', toText(data.quantity)]] : []),
    ['Calculation Date', formatDate(data.calculationDate)],
  ]
  doc.setFontSize(10)
  const detailColWidth = contentWidth / 2
  details.forEach(([label, value], i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = PAGE_MARGIN + col * detailColWidth
    const ry = y + row * 10
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.text(label.toUpperCase(), x, ry)
    doc.setTextColor(...INK)
    doc.setFont('helvetica', 'bold')
    doc.text(value, x, ry + 5)
  })
  y += Math.ceil(details.length / 2) * 10 + 8

  // Environmental impact grid
  doc.setTextColor(...ACCENT)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Environmental Impact', PAGE_MARGIN, y)
  y += 6

  const metrics = [
    ['Net Weight', formatKg(data.netWeightKg)],
    ['Carbon Abated', formatUnit(data.carbonAbatedKgCO2e, 'kg CO2e')],
    ['Water Saved', formatUnit(data.waterSavedLiters, 'L', 0)],
    ['Energy Saved', formatUnit(data.energySavedKwh, 'kWh')],
    ['Landfill Averted', formatKg(data.landfillAvertedKg)],
  ]
  const metricColWidth = contentWidth / 3
  const metricRowHeight = 20
  metrics.forEach(([label, value], i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const x = PAGE_MARGIN + col * metricColWidth
    const ry = y + row * metricRowHeight

    doc.setDrawColor(229, 231, 235)
    doc.setLineWidth(0.2)
    doc.roundedRect(x, ry, metricColWidth - 4, metricRowHeight - 4, 1.5, 1.5)

    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.text(label.toUpperCase(), x + 4, ry + 6)

    doc.setTextColor(...ACCENT)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(value, x + 4, ry + 14)
  })
  y += Math.ceil(metrics.length / 3) * metricRowHeight + 6

  // Material composition (optional)
  if (data.materials && data.materials.length) {
    doc.setTextColor(...ACCENT)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Material Composition', PAGE_MARGIN, y)
    y += 4

    autoTable(doc, {
      startY: y,
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      head: [['Material', 'Weight']],
      body: data.materials.map((m) => [m.material, formatKg(m.weightKg)]),
      theme: 'plain',
      styles: { fontSize: 9.5, textColor: INK, cellPadding: 1.5 },
      headStyles: { textColor: MUTED, fontStyle: 'normal', fontSize: 8.5 },
      columnStyles: { 1: { halign: 'right' } },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // Footer: methodology + generated date + signature
  const pageHeight = doc.internal.pageSize.getHeight()
  const footerY = Math.max(y + 4, pageHeight - 46)

  doc.setDrawColor(229, 231, 235)
  doc.setLineWidth(0.2)
  doc.line(PAGE_MARGIN, footerY, pageWidth - PAGE_MARGIN, footerY)

  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const methodologyLine = data.methodologyVersion
    ? `Calculation methodology ${toText(data.methodologyVersion)}`
    : 'Calculation methodology on file'
  doc.text(methodologyLine, PAGE_MARGIN, footerY + 6)
  doc.text(`Generated ${todayDisplay()}`, PAGE_MARGIN, footerY + 11)

  // Signature block, right-aligned
  const sigX = pageWidth - PAGE_MARGIN - 55
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.2)
  doc.line(sigX, footerY + 22, pageWidth - PAGE_MARGIN, footerY + 22)
  doc.setTextColor(...MUTED)
  doc.setFontSize(8)
  doc.text('Authorized Representative', sigX, footerY + 27)
}
