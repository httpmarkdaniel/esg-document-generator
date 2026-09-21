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
