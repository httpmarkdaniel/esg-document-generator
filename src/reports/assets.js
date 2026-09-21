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

/** Load (and cache) every report brand asset as a data URL. */
export async function loadReportAssets() {
  const [letterhead, complianceStrip, formCode, gradientBar] = await Promise.all([
    loadAsDataUrl(letterheadUrl),
    loadAsDataUrl(complianceStripUrl),
    loadAsDataUrl(formCodeUrl),
    loadAsDataUrl(gradientBarUrl),
  ])
  return { letterhead, complianceStrip, formCode, gradientBar }
}
