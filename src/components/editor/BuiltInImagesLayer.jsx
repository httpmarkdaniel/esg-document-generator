/**
 * Hover targets over a page's own (built-in) images in edit mode: hover shows
 * an outline, ✕ removes the image, and clicking a movable one turns it into a
 * regular movable/resizable image (onEdit). `boxes` are in mm on a
 * `pageW × pageH` page — the same numbers the template draws with — so each
 * target sits exactly on its image.
 */
export function BuiltInImagesLayer({ boxes, pageW, pageH, onHide, onEdit }) {
  return (
    <>
      {boxes.map((box, i) => (
        <div
          key={`${box.id}-${i}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => box.movable && onEdit(box)}
          className={`group absolute rounded-sm outline-1 outline-dashed outline-transparent hover:bg-brand-green/5 hover:outline-brand-green ${box.movable ? 'cursor-pointer' : ''}`}
          style={{
            left: `${(box.x / pageW) * 100}%`,
            top: `${(box.y / pageH) * 100}%`,
            width: `${(box.w / pageW) * 100}%`,
            height: `${(box.h / pageH) * 100}%`,
          }}
          title={box.movable ? `${box.name} — click to move or resize, ✕ to remove` : `${box.name} — ✕ to remove`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onHide(box.id)
            }}
            className="absolute -right-2 -top-2 hidden h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] text-white shadow group-hover:flex"
            aria-label={`Remove ${box.name}`}
          >
            ✕
          </button>
        </div>
      ))}
    </>
  )
}
