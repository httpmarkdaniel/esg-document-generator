// Renders page 1 of a PDF Blob onto a canvas with pdf.js — used for the
// certificate preview, so the page fills the canvas exactly and on-page
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

/** Draw page 1 of `blob` into `canvas`, `widthPx` wide (height follows the page's aspect ratio). */
export async function renderPdfPage(blob, canvas, widthPx) {
  const lib = await loadPdfjs()
  const pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
  try {
    const page = await pdf.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: widthPx / base.width })
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise
  } finally {
    pdf.destroy()
  }
}
