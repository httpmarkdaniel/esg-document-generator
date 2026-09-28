// Pure helpers for the preview editors' `textOverrides` object, shared by the
// certificate and report editors. Shape: { [textKey]: string, hideSignatures?:
// true, hiddenImages?: string[] } — see certificate/certificateText.js and
// reports/reportText.js.

/** Set a text field; typing the default value back removes the override. */
export function withText(overrides, key, value, defaultValue) {
  const next = { ...overrides }
  if (value === defaultValue) delete next[key]
  else next[key] = value
  return next
}

export function withoutKey(overrides, key) {
  const next = { ...overrides }
  delete next[key]
  return next
}

export function withSignatures(overrides, show) {
  const next = { ...overrides }
  if (show) delete next.hideSignatures
  else next.hideSignatures = true
  return next
}

export function hiddenImageSet(overrides) {
  return new Set(overrides?.hiddenImages || [])
}

/** Hide (remove) or un-hide built-in images by id. */
export function withHiddenImages(overrides, ids, hide) {
  const set = hiddenImageSet(overrides)
  for (const id of ids) {
    if (hide) set.add(id)
    else set.delete(id)
  }
  const next = { ...overrides, hiddenImages: [...set] }
  if (!set.size) delete next.hiddenImages
  return next
}

/** How many edits the "N edit(s) applied" note counts: text overrides for these fields, the signature switch, removed images. */
export function countEdits(overrides, fields) {
  return fields.filter((f) => f.key in overrides).length + (overrides.hideSignatures ? 1 : 0) + hiddenImageSet(overrides).size
}
