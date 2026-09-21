// Pixel dimensions of the certificate brand assets (see assets.js), kept in
// their own dependency-free file so certificateTemplate.js can import just
// the numbers without pulling in the browser-only (fetch/FileReader) image
// loading code — useful for server-side/Node-based testing of the drawing
// logic.
export const ASSET_DIMENSIONS = {
  logo: { width: 1000, height: 200 },
  complianceStrip: { width: 2400, height: 158 },
  iconTree: { width: 172, height: 200 },
  iconEnergy: { width: 158, height: 200 },
  iconRecycle: { width: 200, height: 195 },
}
