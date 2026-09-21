// ESG Report DOCX generation plumbing. Wires ESGReportData
// (reportAggregator.js) into the document template (reportTemplate.js) and
// produces a downloadable Blob. No layout or ESG calculation logic here.

import { Packer } from 'docx'
import { buildReportDocument } from './reportTemplate.js'
import { slugifyForFilename } from '../lib/download.js'

/**
 * @param {import('./reportAggregator.js').buildEsgReportData extends (...a: any) => infer R ? R : never} data
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function generateReportDocx(data) {
  const doc = buildReportDocument(data)
  const blob = await Packer.toBlob(doc)

  const start = slugifyForFilename(data.report.periodStart, 'start')
  const end = slugifyForFilename(data.report.periodEnd, 'end')
  const filename = `environmental-impact-report-${start}-to-${end}.docx`

  return { blob, filename }
}
