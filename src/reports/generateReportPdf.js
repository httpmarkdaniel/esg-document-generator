// ESG Report PDF generation plumbing. Wires ESGReportData
// (reportAggregator.js) into the PDF template (reportPdfTemplate.js) and
// produces a downloadable Blob. No layout or ESG calculation logic here.

import { jsPDF } from 'jspdf'
import { drawReportPdf } from './reportPdfTemplate.js'
import { loadCertificateAssets } from '../certificate/assets.js'
import { slugifyForFilename } from '../lib/download.js'

/**
 * @param {import('./reportAggregator.js').buildEsgReportData extends (...a: any) => infer R ? R : never} data
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function generateReportPdf(data) {
  const assets = await loadCertificateAssets()

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  drawReportPdf(doc, assets, data)

  const client = slugifyForFilename(data.client.name, 'client')
  const issued = slugifyForFilename(data.reportIssueDate, 'report')
  const filename = `carbon-abatement-report-${client}-${issued}.pdf`
  const blob = doc.output('blob')

  return { blob, filename }
}
