// Shared formatting/sanitization helpers.
//
// Every generated document (PDF certificate, DOCX report) MUST pass its
// values through these helpers before rendering. This is what guarantees we
// never print "NaN", "undefined", or "null" into an output file.

/** Coerce any input into a finite number, defaulting to 0. */
export function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** Format a number with thousands separators and a fixed number of decimals. */
export function formatNumber(value, decimals = 2) {
  const n = toNumber(value)
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Format a quantity of kilograms, e.g. "86.60 kg". */
export function formatKg(value, decimals = 2) {
  return `${formatNumber(value, decimals)} kg`
}

/** Format a value + unit, safely. */
export function formatUnit(value, unit, decimals = 2) {
  return `${formatNumber(value, decimals)} ${unit}`
}

/** Coerce any input into a trimmed, non-empty-or-fallback string. */
export function toText(value, fallback = '—') {
  if (value === null || value === undefined) return fallback
  const s = String(value).trim()
  return s.length ? s : fallback
}

/** Format an ISO/date-like value as "MMM D, YYYY", or a fallback. */
export function formatDate(value, fallback = '—') {
  if (!value) return fallback
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return fallback
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

/** Today, as YYYY-MM-DD, for default form values. */
export function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

/** Today, formatted for display. */
export function todayDisplay() {
  return formatDate(new Date())
}
