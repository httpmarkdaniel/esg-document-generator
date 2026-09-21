// Real EnviroCycle brand assets, extracted from the reference
// "Template ESG Certificates.pdf" (its embedded PNGs, with their soft
// masks/alpha channels properly merged, then downscaled to a sane print
// resolution). Loaded once and cached as data URLs so `jsPDF.addImage` can
// use them synchronously inside the drawing code.

import logoUrl from '../assets/certificate/logo.png'
import complianceStripUrl from '../assets/certificate/compliance-strip.png'
import treeIconUrl from '../assets/certificate/icon-tree.png'
import energyIconUrl from '../assets/certificate/icon-energy.png'
import recycleIconUrl from '../assets/certificate/icon-recycle.png'

export { ASSET_DIMENSIONS } from './assetDimensions.js'

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

/** Load (and cache) every certificate brand asset as a data URL. */
export async function loadCertificateAssets() {
  const [logo, complianceStrip, iconTree, iconEnergy, iconRecycle] = await Promise.all([
    loadAsDataUrl(logoUrl),
    loadAsDataUrl(complianceStripUrl),
    loadAsDataUrl(treeIconUrl),
    loadAsDataUrl(energyIconUrl),
    loadAsDataUrl(recycleIconUrl),
  ])
  return { logo, complianceStrip, iconTree, iconEnergy, iconRecycle }
}
