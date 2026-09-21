// Certificate PDF generation plumbing. This file wires normalized data
// (certificateData.js) into the visual template (certificateTemplate.js)
// and produces a downloadable Blob. It should not contain layout code or
// ESG calculation logic.

import { jsPDF } from 'jspdf'
import { drawCertificate } from './certificateTemplate.js'
import { slugifyForFilename } from '../lib/download.js'

/**
 * @param {import('./certificateData.js').normalizeCertificateData extends (...a: any) => infer R ? R : never} data
 * @returns {{ blob: Blob, filename: string }}
 */
export function generateCertificatePdf(data) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  drawCertificate(doc, data)

  const filename = `environmental-impact-certificate-${slugifyForFilename(data.certificateNumber, 'certificate')}.pdf`
  const blob = doc.output('blob')
  return { blob, filename }
}
