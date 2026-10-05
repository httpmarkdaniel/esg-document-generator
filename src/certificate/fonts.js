// Poppins (OFL-licensed, from Google Fonts) — the certificate's real
// typeface is a rounded geometric sans that matches Poppins closely; the
// standard PDF fonts (Helvetica/Times/Courier) don't have a rounded
// option, so this embeds real font files into the generated PDF via
// jsPDF's addFont/VFS API instead of substituting a built-in font.

import poppinsRegularUrl from '../assets/fonts/Poppins-Regular.ttf'
import poppinsBoldUrl from '../assets/fonts/Poppins-Bold.ttf'
import poppinsItalicUrl from '../assets/fonts/Poppins-Italic.ttf'
import poppinsSemiBoldUrl from '../assets/fonts/Poppins-SemiBold.ttf'
// League Spartan + Nunito Sans (OFL, Google Fonts): the current Canva-made
// CAC/LDC certificates' fonts (Nunito Sans stands in for Canva Sans, which
// isn't licensed for use outside Canva).
import nunitoRegularUrl from '../assets/fonts/NunitoSans-Regular.ttf'
import nunitoBoldUrl from '../assets/fonts/NunitoSans-Bold.ttf'
import nunitoItalicUrl from '../assets/fonts/NunitoSans-Italic.ttf'
import spartanBoldUrl from '../assets/fonts/LeagueSpartan-Bold.ttf'

export { registerPoppins, registerCanvaFonts, registerCertificateFonts } from './fontRegistration.js'

const cache = new Map()

function loadBase64(url) {
  if (cache.has(url)) return cache.get(url)
  const promise = fetch(url)
    .then((res) => res.arrayBuffer())
    .then((buf) => {
      const bytes = new Uint8Array(buf)
      let binary = ''
      const chunkSize = 0x8000
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
      }
      return btoa(binary)
    })
  cache.set(url, promise)
  return promise
}

/** Load (and cache) every Poppins weight as base64, ready for jsPDF's VFS. */
export async function loadPoppinsFonts() {
  const [regular, bold, italic, semibold] = await Promise.all([
    loadBase64(poppinsRegularUrl),
    loadBase64(poppinsBoldUrl),
    loadBase64(poppinsItalicUrl),
    loadBase64(poppinsSemiBoldUrl),
  ])
  return { regular, bold, italic, semibold }
}

/** Load (and cache) the Canva-certificate fonts as base64 (see registerCanvaFonts). */
export async function loadCanvaFonts() {
  const [nunitoRegular, nunitoBold, nunitoItalic, spartanBold] = await Promise.all([
    loadBase64(nunitoRegularUrl),
    loadBase64(nunitoBoldUrl),
    loadBase64(nunitoItalicUrl),
    loadBase64(spartanBoldUrl),
  ])
  return { nunitoRegular, nunitoBold, nunitoItalic, spartanBold }
}

/** Every font a certificate can use, for registerCertificateFonts. */
export async function loadCertificateFonts() {
  const [poppins, canva] = await Promise.all([loadPoppinsFonts(), loadCanvaFonts()])
  return { poppins, canva }
}
