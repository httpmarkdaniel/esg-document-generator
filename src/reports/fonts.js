// Report fonts: Lora (OFL, Google Fonts) for all body text — the typeface of
// the real "Carbon Abatement - Client Template.pdf" — plus the certificate's
// Poppins for the letterhead contact lines, the form code, and the
// signatories' name block. Embedded into the PDF via jsPDF's VFS, like the
// certificate's fonts.

import loraRegularUrl from '../assets/fonts/Lora-Regular.ttf'
import loraBoldUrl from '../assets/fonts/Lora-Bold.ttf'
import loraItalicUrl from '../assets/fonts/Lora-Italic.ttf'
import loraBoldItalicUrl from '../assets/fonts/Lora-BoldItalic.ttf'
import { loadPoppinsFonts, registerPoppins } from '../certificate/fonts.js'

const cache = new Map()

function loadBase64(url) {
  if (cache.has(url)) return cache.get(url)
  const promise = fetch(url)
    .then((res) => res.arrayBuffer())
    .then((buf) => {
      const bytes = new Uint8Array(buf)
      let binary = ''
      const chunkSize = 0x8000
      for (let i = 0; i < bytes.length; i += chunkSize) binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
      return btoa(binary)
    })
  cache.set(url, promise)
  return promise
}

/** Load (and cache) Lora (4 styles) and Poppins as base64, ready for jsPDF's VFS. */
export async function loadReportFonts() {
  const [regular, bold, italic, bolditalic, poppins] = await Promise.all([
    loadBase64(loraRegularUrl),
    loadBase64(loraBoldUrl),
    loadBase64(loraItalicUrl),
    loadBase64(loraBoldItalicUrl),
    loadPoppinsFonts(),
  ])
  return { lora: { regular, bold, italic, bolditalic }, poppins }
}

/** Register the report fonts so `doc.setFont('Lora', 'normal' | 'bold' | 'italic' | 'bolditalic')` and Poppins work. */
export function registerReportFonts(doc, fonts) {
  for (const [style, file] of [
    ['normal', 'Lora-Regular.ttf'],
    ['bold', 'Lora-Bold.ttf'],
    ['italic', 'Lora-Italic.ttf'],
    ['bolditalic', 'Lora-BoldItalic.ttf'],
  ]) {
    doc.addFileToVFS(file, fonts.lora[style === 'normal' ? 'regular' : style])
    doc.addFont(file, 'Lora', style)
  }
  registerPoppins(doc, fonts.poppins)
}
