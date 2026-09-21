/** Trigger a browser download for a Blob. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // Give the browser a tick to pick up the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Build a filesystem-safe filename segment (no spaces/slashes/etc). */
export function slugifyForFilename(value, fallback = 'untitled') {
  const s = String(value ?? '').trim().toLowerCase()
  const slug = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || fallback
}

/**
 * Build a filesystem-safe filename segment that keeps readable spacing/
 * casing (e.g. "Acme Corporation", "Environmental Impact Certificate") for
 * formal document filenames, rather than slugifyForFilename's
 * all-lowercase-hyphenated form.
 */
export function formalizeForFilename(value, fallback = 'Untitled') {
  const s = String(value ?? '').trim()
  if (!s) return fallback
  // Strip characters illegal in Windows/macOS/Linux filenames; collapse whitespace.
  const cleaned = s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()
  return cleaned || fallback
}

/** Join formal filename segments with " - " and append the extension. */
export function formalFilename(segments, extension) {
  return `${segments.filter(Boolean).join(' - ')}.${extension}`
}
