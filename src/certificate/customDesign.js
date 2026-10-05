// Custom certificate designs (e.g. made in Canva): the uploaded page image
// replaces the built-in layout, and the live data is drawn on top of it.
//
// A design is stored per certificate type as
//   { dataUrl, name, width, height, fields: { [key]: partial field } }
// where `fields` only holds what was changed in the editor. Every field starts
// from where the regular certificate draws it (recorded by the template's
// fieldLog), so a Canva copy of the regular certificate lines up straight away.

import { SIGNATORIES } from '../lib/brand.js'

// Live data is shown on a custom design by default; fixed wording (titles,
// labels, disclaimer…) is assumed to be part of the design, so it starts hidden.
const DATA_KEY = /^(certificateNo|recipient|address|period|receivingReport|itemsCollected|givenLine)$|Value$|Amount$|^sig\dImg$/

export function isDataField(key) {
  return DATA_KEY.test(key)
}

/** The fields to draw: each recorded default, with the design's saved changes on top. */
export function mergeDesignFields(defaults, saved = {}) {
  const merged = {}
  for (const [key, f] of Object.entries(defaults)) merged[key] = { ...f, hidden: !isDataField(key), ...saved[key] }
  return merged
}

/** A readable name for a field key, for the editor's list. */
export function fieldLabel(key, textFields) {
  const sig = /^sig(\d)Img$/.exec(key)
  if (sig) return `Signature — ${SIGNATORIES[Number(sig[1])]?.name ?? `signatory ${Number(sig[1]) + 1}`}`
  return textFields.find((f) => f.key === key)?.label ?? key
}

export const DESIGN_FONTS = [
  { font: 'Poppins', label: 'Poppins' },
  { font: 'Lora', label: 'Lora' },
  { font: 'NunitoSans', label: 'Nunito Sans' },
  { font: 'LeagueSpartan', label: 'League Spartan' },
]
