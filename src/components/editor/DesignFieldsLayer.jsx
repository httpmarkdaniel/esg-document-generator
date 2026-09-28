import { useRef } from 'react'

const MIN_IMAGE_W_MM = 5

/**
 * Drag handles for the live-data fields drawn on a custom (Canva) design.
 * `boxes` are where each field was drawn in the last render (mm);
 * `renderedFields` / `fields` are the field settings at that render and now —
 * the difference shifts a box instantly while dragging, before the next
 * render catches up. Text fields move; signature (image) fields also resize
 * from their corner, keeping their proportions.
 */
export function DesignFieldsLayer({ boxes, renderedFields, fields, pageW, pageH, selectedKey, onSelect, onFieldChange, labelOf }) {
  const layerRef = useRef(null)
  const dragRef = useRef(null)

  function startDrag(e, key, mode) {
    e.preventDefault()
    e.stopPropagation()
    onSelect(key)
    e.currentTarget.setPointerCapture(e.pointerId)
    const f = fields[key]
    dragRef.current = { key, mode, startX: e.clientX, startY: e.clientY, orig: f, scale: pageW / layerRef.current.getBoundingClientRect().width }
  }

  function onPointerMove(e) {
    const drag = dragRef.current
    if (!drag) return
    const dx = (e.clientX - drag.startX) * drag.scale
    const dy = (e.clientY - drag.startY) * drag.scale
    const { orig } = drag
    if (drag.mode === 'move') onFieldChange(drag.key, { x: orig.x + dx, y: orig.y + dy })
    else {
      const w = Math.max(MIN_IMAGE_W_MM, orig.w + dx)
      onFieldChange(drag.key, { w, h: w * (orig.h / orig.w) })
    }
  }

  function endDrag() {
    dragRef.current = null
  }

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0">
      {Object.entries(boxes).map(([key, box]) => {
        const now = fields[key]
        const then = renderedFields[key]
        if (!now || !then || now.hidden) return null
        const isImage = now.kind === 'image'
        const x = box.x + (now.x - then.x)
        const y = box.y + (now.y - then.y)
        const w = isImage ? now.w : box.w
        const h = isImage ? now.h : box.h
        const selected = key === selectedKey
        return (
          <div
            key={key}
            onPointerDown={(e) => startDrag(e, key, 'move')}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={`pointer-events-auto absolute cursor-move touch-none select-none rounded-sm ${
              selected ? 'bg-sky-400/10 outline outline-2 outline-sky-500' : 'outline outline-1 outline-dashed outline-sky-500/60 hover:bg-sky-400/10'
            }`}
            style={{
              left: `${(x / pageW) * 100}%`,
              top: `${(y / pageH) * 100}%`,
              width: `${(Math.max(w, 2) / pageW) * 100}%`,
              height: `${(Math.max(h, 2) / pageH) * 100}%`,
            }}
            title={`${labelOf(key)} — drag to move`}
          >
            {selected && (
              <span className="pointer-events-none absolute -top-4 left-0 whitespace-nowrap rounded bg-sky-600 px-1 py-px text-[9px] font-medium text-white">{labelOf(key)}</span>
            )}
            {selected && isImage && (
              // Its pointer moves bubble up to the box's handlers.
              <div
                onPointerDown={(e) => startDrag(e, key, 'resize')}
                className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border-2 border-white bg-sky-600 shadow"
                aria-label="Resize"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
