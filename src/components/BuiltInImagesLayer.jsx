import { PAGE_W_MM, PAGE_H_MM } from '../certificate/page.js'
import { HEADER_LOGO_BOX, LOGO_ID, complianceLogoBoxes } from '../certificate/builtInImages.js'

/**
 * Hover targets over the certificate's own images (header logo + each
 * compliance logo) in edit mode: hover shows an outline, ✕ removes it, and
 * clicking the logo itself turns it into a movable/resizable image (onEdit).
 * Positions come from builtInImages.js — the same numbers the template draws
 * with — so each box sits exactly on its logo.
 */
export function BuiltInImagesLayer({ hidden, onHide, onEdit }) {
  const boxes = [...(hidden.has(LOGO_ID) ? [] : [{ id: LOGO_ID, name: 'EnviroCycle logo', ...HEADER_LOGO_BOX }]), ...complianceLogoBoxes(hidden)]
  return (
    <>
      {boxes.map((box) => (
        <div
          key={box.id}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onEdit(box)}
          className="group absolute cursor-pointer rounded-sm outline-1 outline-dashed outline-transparent hover:bg-brand-green/5 hover:outline-brand-green"
          style={{
            left: `${(box.x / PAGE_W_MM) * 100}%`,
            top: `${(box.y / PAGE_H_MM) * 100}%`,
            width: `${(box.w / PAGE_W_MM) * 100}%`,
            height: `${(box.h / PAGE_H_MM) * 100}%`,
          }}
          title={`${box.name} — click to move or resize, ✕ to remove`}
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
