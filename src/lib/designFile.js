// Turns an uploaded certificate design (a Canva export: PNG, JPG or PDF)
// into a page image for the certificate background. A PDF's first page is
// rendered with pdf.js; images are kept as they are unless larger than print
// resolution. JPEGs stay JPEG (photos), everything else becomes PNG.

import { renderPdfPagesToImages } from './renderPdfPage.js'

// ~260 dpi across an A4-landscape page (297mm) — sharp in print, still a manageable size.
const MAX_WIDTH_PX = 3000

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That file could not be read as an image.'))
    img.src = src
  })
}

/** @returns {Promise<{ dataUrl: string, width: number, height: number, name: string }>} */
export async function designFromFile(file) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!isPdf && !file.type.startsWith('image/')) throw new Error('Upload a PNG, JPG or PDF exported from Canva.')

  let src
  if (isPdf) {
    const [page] = await renderPdfPagesToImages(file, MAX_WIDTH_PX)
    if (!page) throw new Error('That PDF has no pages.')
    src = page
  } else {
    src = URL.createObjectURL(file)
  }

  try {
    const img = await loadImage(src)
    const scale = Math.min(1, MAX_WIDTH_PX / img.naturalWidth)
    const width = Math.round(img.naturalWidth * scale)
    const height = Math.round(img.naturalHeight * scale)
    const jpeg = !isPdf && file.type === 'image/jpeg'
    if (scale === 1 && (isPdf || file.type === 'image/png' || jpeg)) {
      // Already the right size and format: keep the original pixels.
      const dataUrl = isPdf ? src : await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      return { dataUrl, width, height, name: file.name }
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (jpeg) {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, width, height)
    }
    ctx.drawImage(img, 0, 0, width, height)
    return { dataUrl: jpeg ? canvas.toDataURL('image/jpeg', 0.92) : canvas.toDataURL('image/png'), width, height, name: file.name }
  } finally {
    if (!isPdf) URL.revokeObjectURL(src)
  }
}
