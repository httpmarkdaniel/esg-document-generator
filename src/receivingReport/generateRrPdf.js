// Receiving Report PDF plumbing: wires the RR document data into the
// template (rrReportTemplate.js) and returns a downloadable Blob.

import { jsPDF } from 'jspdf'
import { drawRrPdf } from './rrReportTemplate.js'
import { resolveRrText } from './rrReportText.js'
import { formalizeForFilename } from '../lib/download.js'

/** The sample's file name: "S19029 - ACCENTURE INC. (LHEPACC31212_ACNTQ00107056).pdf". */
function rrFilename(data) {
  const t = resolveRrText(data)
  const refs = [t.pis, t.jobNumber].map((v) => formalizeForFilename(v, '')).filter(Boolean)
  const base = [formalizeForFilename(t.referenceNo, 'Receiving Report'), formalizeForFilename(t.accountName, '')].filter(Boolean).join(' - ')
  return `${base}${refs.length ? ` (${refs.join('_')})` : ''}.pdf`
}

/** @returns {Promise<{ blob: Blob, filename: string, layout: { pageCount: number, textBoxes: object[] } }>} */
export async function generateRrPdf(data) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const layout = drawRrPdf(doc, data)
  return { blob: doc.output('blob'), filename: rrFilename(data), layout }
}
