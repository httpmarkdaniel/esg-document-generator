// The report's own (built-in) images that the preview editor can remove or
// move — the report's counterpart of certificate/builtInImages.js. Removed
// ones are listed by id in `textOverrides.hiddenImages`.
//
// The header (letterhead, top bar) and footer (compliance strip) repeat on
// every page, so they can only be removed — from all pages. The form code is
// text, edited in the Text section.
//
// The compliance strip is ONE image (compliance-strip.png, 1074×136 px, two
// rows of logos). The ranges below are where each logo sits in it, found from
// the empty rows/columns between logos. With nothing removed the template
// draws the whole strip as before; once a logo is removed, each row's visible
// logos are drawn one by one, closed up and re-centered.

export const LETTERHEAD_ID = 'letterhead'
export const GRADIENT_BAR_ID = 'gradientBar'
// The RECO2E / HMRCO2 VERIFIED stamp behind the reviewer's signature — appears once, so it can also be moved.
export const STAMP_ID = 'reco2Stamp'

export const STRIP_PX_WIDTH = 1074
const ROW_BANDS = [
  { y0: 4, y1: 65 },
  { y0: 76, y1: 132 },
]

const logo = (row, slug, name, from, to) => ({ id: `rstrip:${slug}`, name, row, from, to, ...ROW_BANDS[row] })

export const REPORT_COMPLIANCE_LOGOS = [
  logo(0, 'iso-27000', 'ISO 27000', 78, 134),
  logo(0, 'iso-9001', 'ISO 9001:2015', 143, 200),
  logo(0, 'iso-14001', 'ISO 14001:2015', 210, 263),
  logo(0, 'iso-45001', 'ISO 45001:2018', 271, 327),
  logo(0, 'iso-14064', 'ISO 14064', 333, 380),
  logo(0, 'iso-27001-seal', 'ISO 27001 certified seal', 385, 439),
  logo(0, 'carbon-footprint', 'Carbon Footprint verified', 445, 502),
  logo(0, 'r2', 'R2v3 Certified', 509, 553),
  logo(0, 'bsi-practitioner', 'BSI Greenhouse Gas Practitioner', 566, 659),
  logo(0, 'bsi-14064', 'BSI ISO 14064-1 Verified', 668, 759),
  logo(0, 'dun-bradstreet', 'Dun & Bradstreet', 764, 821),
  logo(0, 'issb', 'ISSB', 837, 894),
  logo(0, 'sasb', 'SASB', 903, 959),
  logo(0, 'gri', 'GRI', 966, 1022),
  logo(1, 'llda', 'LLDA', 6, 63),
  logo(1, 'peza', 'PEZA seal', 68, 123),
  logo(1, 'blue-leaf', 'Blue leaf seal', 131, 182),
  logo(1, 'green-building', 'Philippine Green Building Council', 194, 247),
  logo(1, 'grey-seal', 'Seal (grey)', 254, 310),
  logo(1, 'fda', 'FDA Philippines', 320, 408),
  logo(1, 'seipi', 'SEIPI', 422, 486),
  logo(1, 'ibpap', 'IBPAP', 503, 573),
  logo(1, 'rema', 'Recycled Materials Association (ReMA)', 587, 681),
  logo(1, 'un', 'United Nations Carbon Offset Platform', 696, 800),
  logo(1, 'ifma', 'IFMA Engage', 812, 946),
  logo(1, 'twin-seals', 'Twin circle seals', 956, 1039),
  logo(1, 'keyhole', 'Keyhole badge', 1045, 1069),
]

export const REPORT_BUILT_IN_IMAGES = [
  { id: STAMP_ID, name: 'RECO2 stamp' },
  { id: LETTERHEAD_ID, name: 'Letterhead (every page)' },
  { id: GRADIENT_BAR_ID, name: 'Top colour bar (every page)' },
  ...REPORT_COMPLIANCE_LOGOS.map(({ id, name }) => ({ id, name })),
]

/**
 * Page boxes (mm) of the strip logos still shown, given where the whole strip
 * would be drawn (`strip`: x, y, w in mm; height follows the image). With none
 * removed each logo sits exactly where it is in the strip; otherwise each
 * row's visible logos keep their widths and the gap in front of them, closed
 * up and centered on the strip.
 */
export function reportStripLogoBoxes(hidden, strip) {
  const k = strip.w / STRIP_PX_WIDTH
  const anyHidden = REPORT_COMPLIANCE_LOGOS.some((l) => hidden.has(l.id))
  const box = (l, xPx) => ({ ...l, x: strip.x + xPx * k, y: strip.y + l.y0 * k, w: (l.to - l.from) * k, h: (l.y1 - l.y0) * k })
  if (!anyHidden) return REPORT_COMPLIANCE_LOGOS.map((l) => box(l, l.from))

  const boxes = []
  for (const row of [0, 1]) {
    const rowLogos = REPORT_COMPLIANCE_LOGOS.filter((l) => l.row === row)
    const visible = []
    let cursorPx = 0
    rowLogos.forEach((l, i) => {
      if (hidden.has(l.id)) return
      if (visible.length) cursorPx += l.from - rowLogos[i - 1].to
      visible.push({ l, xPx: cursorPx })
      cursorPx += l.to - l.from
    })
    const leftPx = STRIP_PX_WIDTH / 2 - cursorPx / 2
    for (const { l, xPx } of visible) boxes.push(box(l, leftPx + xPx))
  }
  return boxes
}
