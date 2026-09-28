// Renders the pages of a PDF Blob to images with pdf.js — used for the
// certificate and report previews, so each page fills its box exactly and on-page
// positions (in mm) map straight to screen pixels (a browser PDF viewer in
// an iframe adds its own margins/zoom, which makes that impossible).
//
// pdf.js is loaded lazily, only once the preview is first shown.

let pdfjsPromise = null

function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
      .then(([lib, worker]) => {
        lib.GlobalWorkerOptions.workerSrc = worker.default
        return lib
      })
      .catch((err) => {
        pdfjsPromise = null // allow retry on next call
        throw err
      })
  }
  return pdfjsPromise
}

/**
 * Render every page of `blob` to a PNG data URL, `widthPx` wide. Returns the
 * data URLs in page order (used by the multi-page report preview).
 */
export async function renderPdfPagesToImages(blob, widthPx) {
  const lib = await loadPdfjs()
  const pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
  try {
    const images = []
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: widthPx / base.width })
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise
      images.push(canvas.toDataURL('image/png'))
    }
    return images
  } finally {
    pdf.destroy()
  }
}
