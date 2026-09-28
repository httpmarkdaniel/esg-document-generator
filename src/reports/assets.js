// Real EnviroCycle report assets, extracted directly from the reference
// "Carbon Abatement - Client Template.pdf"'s embedded images (soft masks
// merged the same way as the certificate assets — see
// certificate/assets.js). These are pre-composed images from the source
// PDF itself (letterhead with logo+contact info, the teal-to-blue gradient
// bar, the two-row compliance-logo strip, and the form-code footer text) —
// not redrawn, so they match the reference exactly.

import letterheadUrl from '../assets/report/letterhead.png'
import complianceStripUrl from '../assets/report/compliance-strip.png'
import formCodeUrl from '../assets/report/form-code.png'
import gradientBarUrl from '../assets/report/gradient-bar.png'
// Same pen signatures as the certificate, for the sign-off lines.
import sigSanchezUrl from '../assets/certificate/sig-sanchez.png'
import sigLaconsayUrl from '../assets/certificate/sig-laconsay.png'
import sigBweheniUrl from '../assets/certificate/sig-bweheni.png'
import { REPORT_COMPLIANCE_LOGOS } from './reportBuiltInImages.js'

export { REPORT_ASSET_DIMENSIONS } from './assetDimensions.js'

const urlCache = new Map()

function loadAsDataUrl(url) {
  if (urlCache.has(url)) return urlCache.get(url)
  const promise = fetch(url)
    .then((res) => res.blob())
    .then(
      (blob) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(blob)
        }),
    )
  urlCache.set(url, promise)
  return promise
}

const stripPiecesCache = new Map()

/**
 * Each compliance logo cut out of the two-row strip image (its own row's
 * height), as a PNG data URL keyed by id — used when some logos are removed
 * and the rest are drawn one by one. See reportBuiltInImages.js.
 */
function cropStripPieces(stripDataUrl) {
  if (stripPiecesCache.has(stripDataUrl)) return stripPiecesCache.get(stripDataUrl)
  const promise = new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const pieces = {}
      for (const logo of REPORT_COMPLIANCE_LOGOS) {
        const canvas = document.createElement('canvas')
        canvas.width = logo.to - logo.from
        canvas.height = logo.y1 - logo.y0
        canvas.getContext('2d').drawImage(img, logo.from, logo.y0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
        pieces[logo.id] = canvas.toDataURL('image/png')
      }
      resolve(pieces)
    }
    img.onerror = () => reject(new Error('Could not load the compliance logo strip.'))
    img.src = stripDataUrl
  })
  stripPiecesCache.set(stripDataUrl, promise)
  return promise
}

/** Load (and cache) every report brand asset as a data URL. */
export async function loadReportAssets() {
  const [letterhead, complianceStrip, formCode, gradientBar, sigSanchez, sigLaconsay, sigBweheni] = await Promise.all([
    loadAsDataUrl(letterheadUrl),
    loadAsDataUrl(complianceStripUrl),
    loadAsDataUrl(formCodeUrl),
    loadAsDataUrl(gradientBarUrl),
    loadAsDataUrl(sigSanchezUrl),
    loadAsDataUrl(sigLaconsayUrl),
    loadAsDataUrl(sigBweheniUrl),
  ])
  const complianceStripPieces = await cropStripPieces(complianceStrip)
  return { letterhead, complianceStrip, complianceStripPieces, formCode, gradientBar, sigSanchez, sigLaconsay, sigBweheni }
}
