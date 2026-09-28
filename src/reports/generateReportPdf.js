// ESG Report PDF generation plumbing. Wires ESGReportData
// (reportAggregator.js) into the PDF template (reportPdfTemplate.js) and
// produces a downloadable Blob. No layout or ESG calculation logic here.

import { jsPDF } from 'jspdf'
import { drawReportPdf } from './reportPdfTemplate.js'
import { loadReportAssets } from './assets.js'
import { formalizeForFilename, formalFilename } from '../lib/download.js'

/**
 * @param {import('./reportAggregator.js').buildEsgReportData extends (...a: any) => infer R ? R : never} data
 * @returns {Promise<{ blob: Blob, filename: string, layout: { pageCount: number, builtInBoxes: object[] } }>}
 */
export async function generateReportPdf(data) {
  const assets = await loadReportAssets()

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const layout = drawReportPdf(doc, assets, data)

  // Formal filename, e.g. "Carbon Abatement Report - Acme Corporation - February 2, 2026.pdf"
  const filename = formalFilename(
    [formalizeForFilename(data.report.title, 'Carbon Abatement Report'), formalizeForFilename(data.client.name, 'Client'), formalizeForFilename(data.reportIssueDateLabel)],
    'pdf',
  )
  const blob = doc.output('blob')

  return { blob, filename, layout }
}
