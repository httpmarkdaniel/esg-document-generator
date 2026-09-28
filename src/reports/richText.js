// Minimal rich text for the report PDF: `**bold**` spans inside a line (the
// reference bolds figures, "Description:", "4.1 Data Collection:" …), word
// wrapping across bold/regular runs, and "CO2" drawn as CO₂ (Lora has no ₂
// glyph, so the 2 is drawn smaller and lowered — same as the reference,
// which borrows another font for it).

const SUB_SCALE = 0.68
const SUB_DROP_EM = 0.18
const PT_TO_MM = 25.4 / 72

/** "a **b** c" -> [{ text: 'a ', bold }, { text: 'b', bold: true }, …]; an unpaired ** is kept literally. */
export function parseRich(text) {
  const parts = String(text).split('**')
  if (parts.length % 2 === 0) return [{ text: String(text), bold: false }]
  return parts.map((t, i) => ({ text: t, bold: i % 2 === 1 })).filter((s) => s.text)
}

/** Split runs into pieces: words, spaces, and the subscript "2" of CO2 — each measured on its own. */
function toPieces(runs) {
  const pieces = []
  for (const run of runs) {
    for (const token of run.text.split(/(\s+)/)) {
      if (!token) continue
      if (/^\s+$/.test(token)) {
        pieces.push({ text: ' ', bold: run.bold, space: true })
        continue
      }
      // CO2 / CO2e / (CO2) -> "CO" + subscript "2" + rest, kept together as one word.
      const m = token.match(/^(.*CO)2(.*)$/)
      if (m) {
        pieces.push({ text: m[1], bold: run.bold, join: false })
        pieces.push({ text: '2', bold: run.bold, sub: true, join: true })
        if (m[2]) pieces.push({ text: m[2], bold: run.bold, join: true })
      } else {
        pieces.push({ text: token, bold: run.bold, join: false })
      }
    }
  }
  return pieces
}

function setStyle(doc, font, size, piece) {
  doc.setFont(font, piece.bold ? 'bold' : 'normal')
  doc.setFontSize(piece.sub ? size * SUB_SCALE : size)
}

function widthOf(doc, font, size, piece) {
  setStyle(doc, font, size, piece)
  return doc.getTextWidth(piece.text)
}

/**
 * Wrap `text` (with **bold** markup) to `maxWidth` mm. Returns lines, each a
 * list of pieces with measured widths.
 */
export function wrapRich(doc, text, { font, size, maxWidth }) {
  const pieces = toPieces(parseRich(text)).map((p) => ({ ...p, w: widthOf(doc, font, size, p) }))
  // Group into words (a word = consecutive pieces joined with no space), keeping spaces between.
  const words = []
  for (const p of pieces) {
    if (p.space) words.push({ space: true, pieces: [p], w: p.w })
    else if (p.join && words.length && !words[words.length - 1].space) {
      const last = words[words.length - 1]
      last.pieces.push(p)
      last.w += p.w
    } else if (words.length && !words[words.length - 1].space && !p.join) {
      // two runs touching with no space between (e.g. "**bold**," ) stay one word
      const last = words[words.length - 1]
      last.pieces.push(p)
      last.w += p.w
    } else words.push({ space: false, pieces: [p], w: p.w })
  }

  const lines = []
  let line = []
  let lineW = 0
  for (const word of words) {
    if (word.space) {
      if (line.length) {
        line.push(word)
        lineW += word.w
      }
      continue
    }
    const trailingSpace = line.length && line[line.length - 1].space ? line[line.length - 1].w : 0
    if (line.length && lineW - trailingSpace + word.w > maxWidth) {
      if (line[line.length - 1]?.space) line.pop()
      lines.push(line)
      line = []
      lineW = 0
    }
    line.push(word)
    lineW += word.w
  }
  if (line.length && line[line.length - 1].space) line.pop()
  if (line.length) lines.push(line)
  return lines.map((ws) => ({ pieces: ws.flatMap((w) => w.pieces), width: ws.reduce((s, w) => s + w.w, 0) }))
}

/**
 * Draw wrapped lines from wrapRich. `align`: 'left' | 'center' | 'justify'.
 * Justified lines are stretched to `maxWidth` by widening their spaces,
 * except a paragraph's last line (pass `lastLine: true`), which stays
 * left-aligned — like Word's "Justify". Baseline of line i = y + i * lineHeight.
 */
export function drawRichLines(doc, lines, { font, size, x, y, lineHeight, align = 'left', centerX, maxWidth, lastLine = false }) {
  lines.forEach((line, i) => {
    let cx = align === 'center' ? centerX - line.width / 2 : x
    const baseline = y + i * lineHeight
    const spaces = line.pieces.filter((p) => p.space).length
    const isLast = lastLine && i === lines.length - 1
    const extra = align === 'justify' && !isLast && spaces && maxWidth > line.width ? (maxWidth - line.width) / spaces : 0
    for (const p of line.pieces) {
      setStyle(doc, font, size, p)
      if (!p.space) doc.text(p.text, cx, p.sub ? baseline + size * PT_TO_MM * SUB_DROP_EM : baseline)
      cx += p.w + (p.space ? extra : 0)
    }
  })
  doc.setFontSize(size)
}
