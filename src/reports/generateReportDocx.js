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

  const client = slugifyForFilename(data.client.name, 'client')
  const issued = slugifyForFilename(data.reportIssueDate, 'report')
  const filename = `carbon-abatement-report-${client}-${issued}.docx`

  return { blob, filename }
}
