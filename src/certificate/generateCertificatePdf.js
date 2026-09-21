// Certificate PDF generation plumbing. This file wires normalized data
// (certificateData.js) into the visual template (certificateTemplate.js)
// and produces a downloadable Blob. It should not contain layout code or
// ESG calculation logic.

import { jsPDF } from 'jspdf'
import { drawCertificate } from './certificateTemplate.js'
import { slugifyForFilename } from '../lib/download.js'
import { CERTIFICATE_TYPES } from '../lib/brand.js'

/**
 * @param {import('./certificateData.js').normalizeCertificateData extends (...a: any) => infer R ? R : never} data
 * @returns {{ blob: Blob, filename: string }}
 */
export function generateCertificatePdf(data) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  drawCertificate(doc, data)

  const typeLabel = CERTIFICATE_TYPES[data.certificateType]?.label || 'certificate'
  const filename = `${slugifyForFilename(typeLabel, 'certificate')}-${slugifyForFilename(data.certificateNumber, data.certificateType)}.pdf`
  const blob = doc.output('blob')
  return { blob, filename }
}
