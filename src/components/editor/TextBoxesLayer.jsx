import { useEffect, useRef, useState } from 'react'

// 10pt body text sits on a 4.5mm line in the report (see reportPdfTemplate.js).
const LINE_RATIO = 4.5 / (10 * 0.3528)
const PT_MM = 0.3528

/**
 * Edit-on-the-page layer for the report preview: every text field the PDF
 * drew (`boxes`, mm per page from drawReportPdf's layout) is a click target
 * right where it prints. Clicking one opens a text box over it with the
 * current wording; clicking away (or Ctrl+Enter) saves it as that field's
 * override — the same override the side panel edits — and Esc cancels.
 * Sizes use container-query units, so the box scales with the page.
 */
export function TextBoxesLayer({ boxes, pageW, pageH, valueOf, defaultOf, onSave, onReset, activeKey, onActivate }) {
  return (
    <div className="absolute inset-0" style={{ containerType: 'inline-size' }}>
      {boxes.map((box) =>
        activeKey === box.key ? null : (
          <button
            key={`${box.key}-${box.page}`}
            type="button"
            title="Click to edit this text"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onActivate(box)}
            className="absolute cursor-text rounded-[2px] outline outline-1 outline-transparent transition hover:bg-brand-green/10 hover:outline-brand-green/60"
            style={{
              left: `${(box.x / pageW) * 100}%`,
              top: `${(box.y / pageH) * 100}%`,
              width: `${(box.w / pageW) * 100}%`,
              height: `${(box.h / pageH) * 100}%`,
            }}
            aria-label={`Edit ${box.key}`}
          />
        ),
      )}
      {boxes
        .filter((box) => box.key === activeKey)
        .slice(0, 1)
        .map((box) => (
          <InlineTextEditor
            key={`editor-${box.key}`}
            box={box}
            pageW={pageW}
            pageH={pageH}
            value={valueOf(box.key)}
            isEdited={valueOf(box.key) !== defaultOf(box.key)}
            onSave={(text) => {
              onSave(box.key, text)
              onActivate(null)
            }}
            onReset={() => {
              onReset(box.key)
              onActivate(null)
            }}
            onCancel={() => onActivate(null)}
          />
        ))}
    </div>
  )
}

function InlineTextEditor({ box, pageW, pageH, value, isEdited, onSave, onReset, onCancel }) {
  const [text, setText] = useState(value)
  const ref = useRef(null)
  const done = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  // Grow with the text so a reworded paragraph is never cut off.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  const finish = (fn) => {
    if (done.current) return
    done.current = true
    fn()
  }
  const fontCqw = ((box.size * PT_MM) / pageW) * 100

  return (
    <div
      className="absolute z-20"
      style={{ left: `${(box.x / pageW) * 100}%`, top: `${(box.y / pageH) * 100}%`, width: `${(box.w / pageW) * 100}%` }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => finish(() => (text === value ? onCancel() : onSave(text)))}
        onKeyDown={(e) => {
          if (e.key === 'Escape') finish(onCancel)
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) finish(() => onSave(text))
        }}
        spellCheck
        className="block w-full resize-none overflow-hidden rounded-[2px] bg-white p-0 text-black shadow-[0_0_0_2px_rgba(46,125,50,0.7),0_6px_20px_rgba(0,0,0,0.18)] outline-none"
        style={{ fontFamily: 'Lora, Georgia, serif', fontSize: `${fontCqw}cqw`, lineHeight: LINE_RATIO, minHeight: `${(box.h / pageW) * 100}cqw` }}
      />
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => finish(() => onSave(text))}
          className="rounded bg-brand-green px-2 py-0.5 font-semibold text-white shadow"
        >
          Save
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => finish(onCancel)}
          className="rounded bg-white px-2 py-0.5 text-gray-600 shadow"
        >
          Cancel
        </button>
        {isEdited && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => finish(onReset)}
            className="rounded bg-white px-2 py-0.5 text-amber-700 shadow"
          >
            Reset to original
          </button>
        )}
        <span className="rounded bg-white/90 px-1.5 py-0.5 text-gray-500 shadow-sm">**bold** · Ctrl+Enter saves · Esc cancels</span>
      </div>
    </div>
  )
}
