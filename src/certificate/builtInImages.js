// The certificate's own (built-in) images that the preview editor can
// remove: the EnviroCycle logo, the stat-tile icons, and each logo in the
// compliance strip along the bottom. Removed ones are listed by id in
// `textOverrides.hiddenImages`.
//
// The compliance strip is ONE image (compliance-strip.png, 2400×158 px). The
// pixel ranges below are where each logo sits in it, found from the empty
// columns between logos. With nothing removed the template still draws the
// whole strip in one go, exactly as before; once any logo is removed, the
// visible logos are drawn one by one, closed up and re-centered.

import { PAGE_W_MM, PAGE_H_MM } from './page.js'

export const LOGO_ID = 'logo'
export const ICONS_ID = 'icons'

// Real placement of the header wordmark, from the reference certificate PDF (see certificateTemplate.js).
export const HEADER_LOGO_BOX = { x: 27.2, y: 8.4, w: 62.7, h: 62.7 * (200 / 1000) }

const STRIP_PX = { width: 2400, height: 158 }
const STRIP_MM_WIDTH = 203.4
const STRIP_TOP_MM = PAGE_H_MM - 21.44
const MM_PER_STRIP_PX = STRIP_MM_WIDTH / STRIP_PX.width

export const COMPLIANCE_LOGOS = [
  { id: 'strip:keyhole', name: 'Keyhole badge', from: 1, to: 59 },
  { id: 'strip:bsi', name: 'BSI ISO 14064-1 Verified', from: 72, to: 210 },
  { id: 'strip:crest', name: 'Crest (grey)', from: 220, to: 315 },
  { id: 'strip:iso-list', name: 'ISO standards list', from: 326, to: 406 },
  { id: 'strip:recoze', name: 'RECOZE', from: 416, to: 498 },
  { id: 'strip:peza', name: 'PEZA', from: 510, to: 567 },
  { id: 'strip:green-building', name: 'Green Building Council', from: 579, to: 662 },
  { id: 'strip:grey-seal', name: 'Seal (grey)', from: 669, to: 750 },
  { id: 'strip:gear-seal', name: 'Gear seal', from: 763, to: 850 },
  { id: 'strip:blue-seal', name: 'Blue seal', from: 855, to: 934 },
  { id: 'strip:eco-habit', name: 'eco habit', from: 954, to: 1046 },
  { id: 'strip:twin-seals', name: 'Twin circle seals', from: 1057, to: 1184 },
  { id: 'strip:dun-bradstreet', name: 'Dun & Bradstreet', from: 1190, to: 1279 },
  { id: 'strip:rema', name: 'ReMA', from: 1283, to: 1363 },
  { id: 'strip:re-plus', name: 'Recycled Materials Association', from: 1373, to: 1510 },
  { id: 'strip:fda', name: 'FDA Philippines', from: 1591, to: 1761 },
  { id: 'strip:un', name: 'United Nations Carbon Offset Platform', from: 1776, to: 1975 },
  { id: 'strip:ibpap', name: 'IBPAP', from: 1994, to: 2148 },
  { id: 'strip:ifma', name: 'IFMA', from: 2164, to: 2357 },
]

/** Every removable built-in image, for the editor's list. */
export const BUILT_IN_IMAGES = [
  { id: LOGO_ID, name: 'EnviroCycle logo (header)' },
  { id: ICONS_ID, name: 'Stat icons' },
  ...COMPLIANCE_LOGOS.map(({ id, name }) => ({ id, name })),
]

export function hiddenImageSet(overrides) {
  return new Set(overrides?.hiddenImages || [])
}

/** The compliance strip's position on the page, as drawn when no logo is removed. */
export function fullStripBox() {
  const w = STRIP_MM_WIDTH
  return { x: PAGE_W_MM / 2 - w / 2, y: STRIP_TOP_MM, w, h: STRIP_PX.height * MM_PER_STRIP_PX }
}

/**
 * Page boxes (mm) of the compliance logos still shown. With none removed,
 * each sits exactly where it is in the full strip; otherwise the visible ones
 * keep their own widths and the gap in front of them, closed up and centered.
 */
export function complianceLogoBoxes(hidden) {
  const strip = fullStripBox()
  const anyHidden = COMPLIANCE_LOGOS.some((l) => hidden.has(l.id))
  if (!anyHidden) {
    return COMPLIANCE_LOGOS.map((l) => ({ ...l, x: strip.x + l.from * MM_PER_STRIP_PX, y: strip.y, w: (l.to - l.from) * MM_PER_STRIP_PX, h: strip.h }))
  }
  const visible = []
  let cursorPx = 0
  COMPLIANCE_LOGOS.forEach((l, i) => {
    if (hidden.has(l.id)) return
    const gapBefore = visible.length ? l.from - COMPLIANCE_LOGOS[i - 1].to : 0
    cursorPx += gapBefore
    visible.push({ ...l, xPx: cursorPx })
    cursorPx += l.to - l.from
  })
  const totalMm = cursorPx * MM_PER_STRIP_PX
  const left = PAGE_W_MM / 2 - totalMm / 2
  return visible.map((l) => ({ ...l, x: left + l.xPx * MM_PER_STRIP_PX, y: strip.y, w: (l.to - l.from) * MM_PER_STRIP_PX, h: strip.h }))
}
