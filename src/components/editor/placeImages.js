// Turn image files (dropped on a page or picked with "Add image") into
// placed images: { id, name, dataUrl, page, x, y, w, h } in mm, fitted inside
// a default box and centered on the drop point (or the page center), each
// offset a little from the previous one.

import { imageFileToPng } from '../../lib/imageFile.js'

const NEW_IMAGE_MAX_W_MM = 45
const NEW_IMAGE_MAX_H_MM = 28

/** @returns {Promise<{ added: object[], error: string | null }>} */
export async function placedImagesFromFiles(fileList, { at, page = 0, pageW, pageH }) {
  const files = [...fileList].filter((f) => f.type.startsWith('image/'))
  if (!files.length) return { added: [], error: 'Only image files (PNG, JPG, SVG, WebP…) can be added.' }
  const added = []
  let error = null
  for (const [i, file] of files.entries()) {
    try {
      const { dataUrl, width, height } = await imageFileToPng(file)
      const scale = Math.min(NEW_IMAGE_MAX_W_MM / width, NEW_IMAGE_MAX_H_MM / height)
      const w = width * scale
      const h = height * scale
      const cx = (at?.x ?? pageW / 2) + i * 6
      const cy = (at?.y ?? pageH / 2) + i * 6
      added.push({ id: `img-${Date.now()}-${i}`, name: file.name, dataUrl, page, x: cx - w / 2, y: cy - h / 2, w, h })
    } catch (err) {
      error = err.message
    }
  }
  return { added, error }
}
