// Certificate PDF generation plumbing. This file wires normalized data
// (certificateData.js) into the visual template (certificateTemplate.js)
// and produces a downloadable Blob. It should not contain layout code or
// ESG calculation logic.

import { jsPDF } from 'jspdf'
import { drawCertificate } from './certificateTemplate.js'
import { loadCertificateAssets } from './assets.js'
import { loadCertificateFonts, loadCanvaFonts, registerCertificateFonts, registerCanvaFonts } from './fonts.js'
import { mergeDesignFields } from './customDesign.js'
import { loadReportFonts, registerReportFonts } from '../reports/fonts.js'
import { formalizeForFilename, formalFilename } from '../lib/download.js'
import { CERTIFICATE_TYPES } from '../lib/brand.js'

function newDoc() {
  return new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
}

/**
 * @param {import('./certificateData.js').normalizeCertificateData extends (...a: any) => infer R ? R : never} data
 *   plus optional `customDesign` (see customDesign.js), `textOverrides`, `placedImages`.
 * @returns {Promise<{ blob: Blob, filename: string, layout: { fields: object, fieldBoxes?: object, customFields?: object } }>}
 */
export async function generateCertificatePdf(data) {
  const assets = await loadCertificateAssets()
  let doc
  let layout

  if (data.customDesign) {
    // Record the regular layout first (never shown): it's where every field
    // starts on the design until it's moved in the editor.
    const [fonts, canvaFonts] = await Promise.all([loadReportFonts(), loadCanvaFonts()]) // the design fields' font choices
    const probe = newDoc()
    registerCertificateFonts(probe, { poppins: fonts.poppins, canva: canvaFonts })
    const { fields } = drawCertificate(probe, assets, { ...data, customDesign: null, placedImages: [] })
    const customFields = mergeDesignFields(fields, data.customDesign.fields)

    doc = newDoc()
    registerReportFonts(doc, fonts)
    registerCanvaFonts(doc, canvaFonts)
    const { fieldBoxes } = drawCertificate(doc, assets, { ...data, customFields })
    layout = { fields, customFields, fieldBoxes }
  } else {
    doc = newDoc()
    registerCertificateFonts(doc, await loadCertificateFonts())
    layout = drawCertificate(doc, assets, data)
  }

  // Formal filename, e.g. "Environmental Impact Certificate - Acme Corporation - EIC-2026-0001.pdf"
  const typeLabel = CERTIFICATE_TYPES[data.certificateType]?.label || 'Certificate'
  const filename = formalFilename([formalizeForFilename(typeLabel), formalizeForFilename(data.recipient, 'Recipient'), formalizeForFilename(data.certificateNumber)], 'pdf')
  const blob = doc.output('blob')
  return { blob, filename, layout }
}
