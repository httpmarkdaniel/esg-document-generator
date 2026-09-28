// Pixel dimensions of the report's brand assets (see assets.js), kept
// dependency-free so reportPdfTemplate.js can import just the numbers
// without pulling in the browser-only (fetch/FileReader) image loading
// code — useful for Node-based testing of the drawing logic.
export const REPORT_ASSET_DIMENSIONS = {
  logoDark: { width: 839, height: 148 },
  complianceStrip: { width: 1074, height: 136 },
  gradientBar: { width: 1120, height: 21 },
}
