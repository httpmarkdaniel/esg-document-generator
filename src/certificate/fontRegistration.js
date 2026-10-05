// Dependency-free half of fonts.js: just the jsPDF VFS registration call,
// with no font-file imports — so this can be exercised from plain Node
// (testing the drawing logic) without a browser/Vite asset pipeline.

/** Register Poppins on a jsPDF document so `doc.setFont('Poppins', 'bold' | 'normal' | 'italic' | 'semibold')` works. */
export function registerPoppins(doc, fonts) {
  doc.addFileToVFS('Poppins-Regular.ttf', fonts.regular)
  doc.addFont('Poppins-Regular.ttf', 'Poppins', 'normal')
  doc.addFileToVFS('Poppins-Bold.ttf', fonts.bold)
  doc.addFont('Poppins-Bold.ttf', 'Poppins', 'bold')
  doc.addFileToVFS('Poppins-Italic.ttf', fonts.italic)
  doc.addFont('Poppins-Italic.ttf', 'Poppins', 'italic')
  doc.addFileToVFS('Poppins-SemiBold.ttf', fonts.semibold)
  doc.addFont('Poppins-SemiBold.ttf', 'Poppins', 'semibold')
}

/**
 * Register the fonts of the current EnviroCycle (Canva) certificates:
 * League Spartan (titles, recipient, section headings) and Nunito Sans,
 * the closest open-licensed match to Canva Sans (everything else).
 * `doc.setFont('NunitoSans', 'normal' | 'bold' | 'italic')`, `doc.setFont('LeagueSpartan', 'bold')`.
 */
export function registerCanvaFonts(doc, fonts) {
  for (const [file, family, style, data] of [
    ['NunitoSans-Regular.ttf', 'NunitoSans', 'normal', fonts.nunitoRegular],
    ['NunitoSans-Bold.ttf', 'NunitoSans', 'bold', fonts.nunitoBold],
    ['NunitoSans-Italic.ttf', 'NunitoSans', 'italic', fonts.nunitoItalic],
    ['LeagueSpartan-Bold.ttf', 'LeagueSpartan', 'bold', fonts.spartanBold],
  ]) {
    doc.addFileToVFS(file, data)
    doc.addFont(file, family, style)
  }
}

/** Every font a certificate can use (Poppins + the Canva-certificate fonts), from loadCertificateFonts(). */
export function registerCertificateFonts(doc, fonts) {
  registerPoppins(doc, fonts.poppins)
  registerCanvaFonts(doc, fonts.canva)
}
