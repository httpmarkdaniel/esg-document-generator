// Vercel serverless function: proxies and parses the public "Material
// Split Catalog" Google Sheet — an ITEM TYPE -> Metal/Plastic/Glass/
// Electronics % lookup, each row cited to a source (EU JRC WEEE, EPA WARM,
// UNU Guidelines, OEM teardown data, etc.). This is what lets Certificate/
// Report material-breakdown fields auto-fill from an RR's ITEM TYPE
// instead of needing to be typed by hand, using real sourced factors
// rather than invented ones.
//
// Same pattern as rr-data.js: public CSV export (no service account
// needed), server-side fetch (avoids browser CORS + keeps the sheet
// ID/tab out of client bundle logic), in-memory cache.

import Papa from 'papaparse'

const SHEET_ID = '1uhzQVjh3mz6jUrgpIGp82u8_Dkd2DpsiCIUf5GTBsmY'
const GID = '606273994'
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`

const MATERIAL_KEYS = ['metal', 'plastic', 'glass', 'electronics']

/** "10% Metal, 10% Plastic, 70% Glass, 10% Electronics" -> { metal:10, plastic:10, glass:70, electronics:10 }. Tolerates trailing notes like "95% Plastic (fabric/textile)". */
function parseMaterialSplit(raw) {
  const split = { metal: 0, plastic: 0, glass: 0, electronics: 0 }
  const re = /(\d+(?:\.\d+)?)\s*%\s*(Metal|Plastic|Glass|Electronics)/gi
  let match
  let found = false
  while ((match = re.exec(String(raw || '')))) {
    const key = match[2].toLowerCase()
    split[key] = Number(match[1])
    found = true
  }
  return found ? split : null
}

/** "CCTV / Routers - fsp 150cc / Zywall usg / Wifi Router / Air Fiber" -> ["CCTV", "Routers", "fsp 150cc", "Zywall usg", "Wifi Router", "Air Fiber"]. */
function parseAliases(itemName) {
  // Strip parenthetical asides FIRST — some entries have a "/" *inside* the
  // parens (e.g. "Clear Ones phone (VoIP/office phone)"), which would
  // otherwise split mid-parenthetical and leave a dangling "(".
  const withoutParens = String(itemName || '').replace(/\([^)]*\)/g, ' ')
  return withoutParens
    .split(/[/,]|(?:–|-)(?=\s)/) // split on "/", "," and " - "/" – " (not hyphens inside words)
    .map((s) => s.trim())
    .filter(Boolean)
}

let cache = null
let cacheFetchedAt = 0
const CACHE_MS = 5 * 60 * 1000

async function loadCatalog() {
  const now = Date.now()
  if (cache && now - cacheFetchedAt < CACHE_MS) return cache

  const csvRes = await fetch(CSV_URL)
  if (!csvRes.ok) throw new Error(`Sheet fetch failed: HTTP ${csvRes.status}`)
  const csvText = await csvRes.text()

  const { data: rows } = Papa.parse(csvText, { skipEmptyLines: true })
  const headerRowIndex = rows.findIndex((r) => r.some((c) => String(c).trim() === 'Item'))
  if (headerRowIndex === -1) throw new Error('Could not find the header row (Item) in the sheet')
  const headers = rows[headerRowIndex].map((h) => String(h).trim())
  const itemCol = headers.indexOf('Item')
  const splitCol = headers.indexOf('Material Split')
  const refCol = headers.indexOf('Reference')

  const entries = []
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    const item = (row[itemCol] || '').toString().trim()
    if (!item) continue
    const split = parseMaterialSplit(row[splitCol])
    if (!split) continue
    entries.push({
      item,
      aliases: parseAliases(item),
      split,
      reference: (row[refCol] || '').toString().trim(),
    })
  }

  cache = { entries, fetchedAt: new Date().toISOString() }
  cacheFetchedAt = now
  return cache
}

export default async function handler(req, res) {
  try {
    const data = await loadCatalog()
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    res.status(200).json(data)
  } catch (err) {
    console.error('material-catalog error:', err)
    res.status(500).json({ error: err.message || 'Failed to load the material split catalog.' })
  }
}

export { MATERIAL_KEYS }
