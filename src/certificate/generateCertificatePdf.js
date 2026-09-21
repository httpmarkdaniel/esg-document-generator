// Certificate PDF generation plumbing. This file wires normalized data
// (certificateData.js) into the visual template (certificateTemplate.js)
// and produces a downloadable Blob. It should not contain layout code or
// ESG calculation logic.

import { jsPDF } from 'jspdf'
import { drawCertificate } from './certificateTemplate.js'
import { loadCertificateAssets } from './assets.js'
import { loadPoppinsFonts, registerPoppins } from './fonts.js'
import { formalizeForFilename, formalFilename } from '../lib/download.js'
import { CERTIFICATE_TYPES } from '../lib/brand.js'

/**
 * @param {import('./certificateData.js').normalizeCertificateData extends (...a: any) => infer R ? R : never} data
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function generateCertificatePdf(data) {
  const [assets, fonts] = await Promise.all([loadCertificateAssets(), loadPoppinsFonts()])

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  registerPoppins(doc, fonts)
  drawCertificate(doc, assets, data)

  // Formal filename, e.g. "Environmental Impact Certificate - Acme Corporation - EIC-2026-0001.pdf"
  const typeLabel = CERTIFICATE_TYPES[data.certificateType]?.label || 'Certificate'
  const filename = formalFilename([formalizeForFilename(typeLabel), formalizeForFilename(data.recipient, 'Recipient'), formalizeForFilename(data.certificateNumber)], 'pdf')
  const blob = doc.output('blob')
  return { blob, filename }
}
