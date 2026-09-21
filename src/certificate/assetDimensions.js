// Pixel dimensions of the certificate brand assets (see assets.js), kept in
// their own dependency-free file so certificateTemplate.js can import just
// the numbers without pulling in the browser-only (fetch/FileReader) image
// loading code — useful for server-side/Node-based testing of the drawing
// logic.
// Every icon* entry below is a COMPLETE badge (the scalloped circular frame
// + its glyph), cropped directly from the reference PDF's own rendered
// pixels — not a bare glyph meant to be composited onto a separately-drawn
// circle. certificateTemplate.js draws these as a single image.
export const ASSET_DIMENSIONS = {
  logo: { width: 1000, height: 200 },
  complianceStrip: { width: 2400, height: 158 },
  iconTree: { width: 320, height: 317 },
  iconEnergy: { width: 320, height: 317 },
  iconRecycle: { width: 320, height: 317 },
  iconFootprint: { width: 320, height: 317 },
  iconCo2: { width: 320, height: 317 },
  iconCloud: { width: 320, height: 318 },
  iconCar: { width: 320, height: 317 },
  iconLandfill: { width: 320, height: 317 },
  iconWater: { width: 320, height: 317 },
}
