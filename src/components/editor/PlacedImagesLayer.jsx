import { useEffect, useRef } from 'react'

const MIN_WIDTH_MM = 5

/**
 * Editable images sitting over one rendered page of a preview. Positions/sizes
 * are in mm on a `pageW × pageH` page, so the layer maps them to percentages
 * of its own box, which is exactly the rendered page. Drag a box to move it,
 * drag its corner handle to resize (aspect ratio kept), Delete/Backspace or ✕
 * to remove.
 */
export function PlacedImagesLayer({ images, onChange, selectedId, onSelect, pageW, pageH }) {
  const layerRef = useRef(null)
  const dragRef = useRef(null)

  // Delete / Backspace removes the selected image (but not while typing in a field).
  useEffect(() => {
    function onKey(e) {
      // Several pages can each have a layer — only the one holding the selected image acts.
      if (!selectedId || !images.some((img) => img.id === selectedId) || (e.key !== 'Delete' && e.key !== 'Backspace')) return
      if (e.target.closest?.('input, textarea, [contenteditable]')) return
      e.preventDefault()
      onChange(images.filter((img) => img.id !== selectedId))
      onSelect(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [images, onChange, selectedId, onSelect])

  function mmPerPx() {
    return pageW / layerRef.current.getBoundingClientRect().width
  }

  function startDrag(e, img, mode) {
    e.preventDefault()
    e.stopPropagation()
    onSelect(img.id)
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { mode, id: img.id, startX: e.clientX, startY: e.clientY, orig: img, scale: mmPerPx() }
  }

  function onPointerMove(e) {
    const drag = dragRef.current
    if (!drag) return
    const dx = (e.clientX - drag.startX) * drag.scale
    const dy = (e.clientY - drag.startY) * drag.scale
    const { orig } = drag
    let next
    if (drag.mode === 'move') {
      next = {
        x: clamp(orig.x + dx, -orig.w / 2, pageW - orig.w / 2),
        y: clamp(orig.y + dy, -orig.h / 2, pageH - orig.h / 2),
      }
    } else {
      const aspect = orig.h / orig.w
      const w = clamp(orig.w + dx, MIN_WIDTH_MM, pageW)
      next = { w, h: w * aspect }
    }
    onChange(images.map((img) => (img.id === drag.id ? { ...img, ...next } : img)))
  }

  function endDrag() {
    dragRef.current = null
  }

  return (
    // The layer itself lets clicks through (to the built-in logo targets below); only the image boxes catch them.
    <div ref={layerRef} className="pointer-events-none absolute inset-0">
      {images.map((img) => {
        const selected = img.id === selectedId
        return (
          <div
            key={img.id}
            onPointerDown={(e) => startDrag(e, img, 'move')}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={`pointer-events-auto absolute cursor-move touch-none select-none ${selected ? 'outline outline-2 outline-brand-green' : 'outline outline-1 outline-dashed outline-brand-green/50 hover:outline-brand-green'}`}
            style={{
              left: `${(img.x / pageW) * 100}%`,
              top: `${(img.y / pageH) * 100}%`,
              width: `${(img.w / pageW) * 100}%`,
              height: `${(img.h / pageH) * 100}%`,
            }}
            title={`${img.name} — drag to move, drag the corner to resize`}
          >
            <img src={img.dataUrl} alt={img.name} draggable={false} className="pointer-events-none h-full w-full" />
            {selected && (
              <>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    onChange(images.filter((i) => i.id !== img.id))
                    onSelect(null)
                  }}
                  className="absolute -right-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white shadow"
                  aria-label="Remove image"
                >
                  ✕
                </button>
                {/* Its pointer moves bubble up to the box's handlers below. */}
                <div
                  onPointerDown={(e) => startDrag(e, img, 'resize')}
                  className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border-2 border-white bg-brand-green shadow"
                  aria-label="Resize image"
                />
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}
