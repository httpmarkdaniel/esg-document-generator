// Turns an image File (PNG, JPG, SVG, WebP, GIF…) into a PNG data URL that
// jsPDF can embed, keeping transparency. Large images are scaled down so a
// logo can't bloat the certificate PDF.

const MAX_SIDE_PX = 1600

/** @returns {Promise<{ dataUrl: string, width: number, height: number }>} */
export function imageFileToPng(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      // SVGs without an intrinsic size report 0 — give them a sensible canvas.
      const naturalW = img.naturalWidth || 800
      const naturalH = img.naturalHeight || 800
      const scale = Math.min(1, MAX_SIDE_PX / Math.max(naturalW, naturalH))
      const width = Math.max(1, Math.round(naturalW * scale))
      const height = Math.max(1, Math.round(naturalH * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      resolve({ dataUrl: canvas.toDataURL('image/png'), width, height })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Couldn't read "${file.name}" as an image.`))
    }
    img.src = url
  })
}
